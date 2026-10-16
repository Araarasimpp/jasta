import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

/** Estado de los avisos con la app cerrada (push) en este dispositivo. */
export type EstadoPush = 'activo' | 'inactivo' | 'no-soportado' | 'instalar-ios' | 'error' | 'desactivado';

/** Si la persona apagó los avisos en este dispositivo (se recuerda aunque cierre la app). */
const CLAVE_DESACTIVADOS = 'jasta-avisos-desactivados';

const SW_URL = '/assets/sw-push.js';

export interface Aviso {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  url: string | null;
  pedido_id: number | null;
  leida: boolean;
  created_at: string;
}

/**
 * Avisos de la app, como en Home ALS (pedido nuevo, despachado, entregado,
 * cancelado, cuadre cerrado y mensajes de los pedidos).
 * Los crea la base de datos con triggers y llegan al instante por Realtime.
 * Con permiso del navegador, además se muestra un aviso del sistema y suena.
 * Con "push" activo, los avisos llegan aunque la app esté cerrada: los envía
 * la Edge Function enviar-push y los muestra el service worker sw-push.js.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private sb = inject(SupabaseService);
  private router = inject(Router);

  readonly avisos = signal<Aviso[]>([]);
  readonly noLeidas = computed(() => this.avisos().filter((a) => !a.leida).length);
  /** Pedidos con mensajes sin leer (para marcarlos en las listas) */
  readonly pedidosConMensajes = computed(
    () => new Set(this.avisos().filter((a) => !a.leida && a.tipo === 'mensaje' && a.pedido_id).map((a) => a.pedido_id!))
  );
  readonly abierto = signal(false);
  readonly permiso = signal<NotificationPermission | 'no-soportado'>(
    typeof Notification === 'undefined' ? 'no-soportado' : Notification.permission
  );

  readonly push = signal<EstadoPush>(this.estadoPushInicial());
  /** Cambiando entre activar y desactivar (para deshabilitar el botón). */
  readonly cambiando = signal(false);

  private canal: RealtimeChannel | null = null;
  private usuarioId: number | null = null;

  /** Se llama desde el shell al entrar. Seguro de llamar varias veces. */
  async iniciar(): Promise<void> {
    const usuario = await this.sb.asegurar();
    if (!usuario || usuario.id === this.usuarioId) return;
    this.detener();
    this.usuarioId = usuario.id;

    const { data } = await this.sb.client
      .from('notificaciones')
      .select('id, tipo, titulo, cuerpo, url, pedido_id, leida, created_at')
      .order('created_at', { ascending: false })
      .limit(60);
    this.avisos.set((data ?? []) as Aviso[]);

    this.canal = this.sb.client
      .channel(`avisos-${usuario.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuario.id}` },
        (payload) => this.recibir(payload.new as Aviso)
      )
      .subscribe();

    // Si en este dispositivo ya se dio permiso, se renueva la suscripción en
    // silencio (por ejemplo, si ahora entró otra persona en el mismo celular)
    if (this.permiso() === 'granted' && !this.desactivadosAqui() && this.push() !== 'no-soportado' && this.push() !== 'instalar-ios') {
      this.activarPush().catch(() => undefined);
    }
  }

  detener(): void {
    if (this.canal) this.sb.client.removeChannel(this.canal);
    this.canal = null;
    this.usuarioId = null;
    this.avisos.set([]);
    this.abierto.set(false);
  }

  /** Al cerrar sesión: este dispositivo deja de recibir avisos de esa persona */
  async salir(): Promise<void> {
    try {
      const sub = await this.suscripcionActual();
      if (sub) await this.sb.client.rpc('quitar_push', { p_endpoint: sub.endpoint });
    } catch {
      /* sin conexión: la suscripción vieja se reemplaza al entrar otra persona */
    }
    this.detener();
  }

  private recibir(aviso: Aviso): void {
    this.avisos.update((lista) => [aviso, ...lista].slice(0, 80));
    this.sonar();
    this.avisoDelSistema(aviso);
  }

  toggle(): void {
    this.abierto.update((v) => !v);
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  async abrirAviso(aviso: Aviso): Promise<void> {
    this.cerrar();
    if (!aviso.leida) await this.marcarLeida(aviso.id);
    if (aviso.url) this.router.navigateByUrl(aviso.url);
  }

  async marcarLeida(id: string): Promise<void> {
    this.avisos.update((l) => l.map((a) => (a.id === id ? { ...a, leida: true } : a)));
    await this.sb.client.from('notificaciones').update({ leida: true }).eq('id', id);
  }

  /** Al abrir la conversación de un pedido, sus mensajes quedan leídos */
  async marcarMensajesLeidos(pedidoId: number): Promise<void> {
    const ids = this.avisos().filter((a) => !a.leida && a.tipo === 'mensaje' && a.pedido_id === pedidoId).map((a) => a.id);
    if (!ids.length) return;
    this.avisos.update((l) => l.map((a) => (ids.includes(a.id) ? { ...a, leida: true } : a)));
    await this.sb.client.from('notificaciones').update({ leida: true }).in('id', ids);
  }

  async marcarTodasLeidas(): Promise<void> {
    const ids = this.avisos().filter((a) => !a.leida).map((a) => a.id);
    if (!ids.length) return;
    this.avisos.update((l) => l.map((a) => ({ ...a, leida: true })));
    await this.sb.client.from('notificaciones').update({ leida: true }).in('id', ids);
  }

  /** Pide permiso para mostrar avisos del sistema y los activa con la app cerrada. */
  async pedirPermiso(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.recordarDesactivados(false);
    const r = await Notification.requestPermission();
    this.permiso.set(r);
    if (r === 'granted') {
      this.sonar();
      await this.activarPush().catch(() => this.push.set('error'));
    }
  }

  // ---------------------------------------------------------------------
  // Activar / desactivar en este dispositivo
  // ---------------------------------------------------------------------

  /**
   * Apaga los avisos en este dispositivo: lo da de baja de los avisos con la
   * app cerrada y deja de mostrar ventanas del sistema y sonido. La campana
   * dentro de la app sigue funcionando.
   */
  async desactivar(): Promise<void> {
    if (this.cambiando()) return;
    this.cambiando.set(true);
    this.recordarDesactivados(true);
    try {
      const sub = await this.suscripcionActual();
      if (sub) {
        await this.sb.client.rpc('quitar_push', { p_endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
    } catch {
      /* aunque falle la baja en el servidor, el dispositivo queda sin suscripción */
    } finally {
      this.push.set('desactivado');
      this.cambiando.set(false);
    }
  }

  /** Vuelve a encender los avisos en este dispositivo. */
  async reactivar(): Promise<void> {
    if (this.cambiando()) return;
    this.cambiando.set(true);
    this.recordarDesactivados(false);
    try {
      this.push.set('inactivo');
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        await this.activarPush().catch(() => this.push.set('error'));
      } else {
        await this.pedirPermiso();
      }
    } finally {
      this.cambiando.set(false);
    }
  }

  private desactivadosAqui(): boolean {
    try {
      return localStorage.getItem(CLAVE_DESACTIVADOS) === '1';
    } catch {
      return false;
    }
  }

  private recordarDesactivados(si: boolean): void {
    try {
      if (si) localStorage.setItem(CLAVE_DESACTIVADOS, '1');
      else localStorage.removeItem(CLAVE_DESACTIVADOS);
    } catch {
      /* sin almacenamiento: solo dura mientras la app esté abierta */
    }
  }

  // ---------------------------------------------------------------------
  // Avisos con la app cerrada (Web Push)
  // ---------------------------------------------------------------------

  private estadoPushInicial(): EstadoPush {
    if (typeof window === 'undefined') return 'no-soportado';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalada =
      window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    // En iPhone solo funciona si la app está agregada a la pantalla de inicio
    if (ios && !instalada) return 'instalar-ios';
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') {
      return 'no-soportado';
    }
    if (this.desactivadosAqui()) return 'desactivado';
    return 'inactivo';
  }

  private async suscripcionActual(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator)) return null;
    const regs = await navigator.serviceWorker.getRegistrations();
    const reg = regs.find((r) => (r.active || r.installing || r.waiting)?.scriptURL.includes('sw-push.js'));
    return (await reg?.pushManager.getSubscription()) ?? null;
  }

  /** Registra el service worker y suscribe este dispositivo a los avisos. */
  async activarPush(): Promise<void> {
    if (this.push() === 'no-soportado' || this.push() === 'instalar-ios' || this.push() === 'desactivado') return;
    if (Notification.permission !== 'granted') return;

    const registro = await this.registrarServiceWorker();
    const clave = await this.clavePublica();
    if (!clave) {
      this.push.set('error');
      return;
    }

    let sub = await registro.pushManager.getSubscription();
    if (!sub) {
      sub = await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.base64UrlABytes(clave) });
    }

    const json = sub.toJSON();
    const { error } = await this.sb.client.rpc('registrar_push', {
      p_endpoint: json.endpoint,
      p_p256dh: json.keys?.['p256dh'],
      p_auth: json.keys?.['auth'],
      p_dispositivo: navigator.userAgent.slice(0, 200),
    });
    this.push.set(error ? 'error' : 'activo');
  }

  /** El service worker controla toda la app si el servidor lo permite; si no, solo /assets/. */
  private async registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
    let reg: ServiceWorkerRegistration;
    try {
      reg = await navigator.serviceWorker.register(SW_URL, { scope: '/' });
    } catch {
      reg = await navigator.serviceWorker.register(SW_URL);
    }
    // pushManager.subscribe necesita un service worker activo
    if (!reg.active) {
      const sw = reg.installing || reg.waiting;
      if (sw) {
        await new Promise<void>((ok) => {
          if (sw.state === 'activated') return ok();
          sw.addEventListener('statechange', () => sw.state === 'activated' && ok());
          setTimeout(ok, 8000);
        });
      }
    }
    return reg;
  }

  private clavePublicaCache: string | null = null;

  /** La clave pública VAPID la entrega la Edge Function (así no hay que ponerla en el código). */
  private async clavePublica(): Promise<string | null> {
    if (this.clavePublicaCache) return this.clavePublicaCache;
    const { data, error } = await this.sb.client.functions.invoke('enviar-push', { method: 'GET' });
    const clave = !error ? (data as { publicKey?: string })?.publicKey : null;
    this.clavePublicaCache = clave || null;
    return this.clavePublicaCache;
  }

  private base64UrlABytes(base64Url: string): ArrayBuffer {
    const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
    const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = atob(base64);
    return Uint8Array.from(crudo, (c) => c.charCodeAt(0)).buffer as ArrayBuffer;
  }

  private avisoDelSistema(aviso: Aviso): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (this.push() === 'desactivado') return;
    // Si la persona está mirando la app, basta con la campana y el sonido
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    const opciones: NotificationOptions = {
      body: aviso.cuerpo ?? '',
      icon: 'assets/icon/logo-192.png',
      tag: aviso.tipo === 'mensaje' && aviso.pedido_id ? `chat-${aviso.pedido_id}` : aviso.id,
    };
    try {
      const n = new Notification(aviso.titulo, opciones);
      n.onclick = () => {
        window.focus();
        void this.abrirAviso(aviso);
        n.close();
      };
    } catch {
      // Android no permite "new Notification" sin un service worker
      navigator.serviceWorker?.ready.then((reg) => reg.showNotification(aviso.titulo, opciones)).catch(() => undefined);
    }
  }

  /** Dos tonos cortos, generados en el navegador (no necesita archivos de audio). */
  private sonar(): void {
    if (this.push() === 'desactivado') return;
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const Ctx = w.AudioContext || w.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [880, 1175].forEach((frecuencia, i) => {
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.frequency.value = frecuencia;
        osc.type = 'sine';
        const t = ctx.currentTime + i * 0.16;
        vol.gain.setValueAtTime(0.0001, t);
        vol.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        osc.connect(vol).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.15);
      });
      setTimeout(() => ctx.close(), 600);
    } catch {
      /* sin sonido si el navegador no lo permite */
    }
  }
}
