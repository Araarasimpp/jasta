import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';

/** Estado de los avisos con la app cerrada (push) en este dispositivo. */
export type EstadoPush = 'activo' | 'inactivo' | 'no-soportado' | 'instalar-ios' | 'error';

/** Antes se podían apagar los avisos en un dispositivo; esta marca se borra al entrar */
const CLAVE_DESACTIVADOS = 'jasta-avisos-desactivados';

const SW_URL = '/assets/sw-push.js';

/** Lo que le falta a este dispositivo para poder usar la app (ver RequisitosComponent) */
export type Requisito = 'instalar' | 'permiso' | 'bloqueado' | 'no-soportado';

/** Evento del navegador para instalar la app (Chrome/Edge/Samsung en Android y computador) */
interface EventoInstalar extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function esStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

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

  // ---------- Requisitos para usar la app: instalada (en celular) y con avisos activos
  readonly ios = typeof navigator !== 'undefined' &&
    (/iphone|ipad|ipod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));
  readonly esMovil = typeof navigator !== 'undefined' && (this.ios || /android|mobile/i.test(navigator.userAgent));
  readonly instalada = signal(typeof window !== 'undefined' && esStandalone());
  /** El navegador ofrece instalar con un botón (si es null, se explica cómo hacerlo a mano) */
  readonly instalable = signal<EventoInstalar | null>(null);
  readonly recienInstalada = signal(false);
  /** Solo el admin puede entrar sin avisos (por ejemplo, en un computador prestado), hasta cerrar la pestaña */
  readonly saltado = signal(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('jasta-sin-requisitos') === '1');
  readonly requisito = computed<Requisito | null>(() => {
    if (this.saltado()) return null;
    if (this.esMovil && !this.instalada()) return 'instalar';
    const push = this.push();
    // Con el permiso dado no se bloquea: el dispositivo se termina de registrar en segundo plano
    if (push === 'activo' || this.permiso() === 'granted') return null;
    if (push === 'no-soportado' || this.permiso() === 'no-soportado') return 'no-soportado';
    if (this.permiso() === 'denied') return 'bloqueado';
    return 'permiso';
  });

  private cerrarCanal: (() => void) | null = null;
  private usuarioId: number | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    // Los avisos ya no se pueden apagar: si alguien los había desactivado aquí, vuelven
    try {
      localStorage.removeItem(CLAVE_DESACTIVADOS);
    } catch {
      /* sin almacenamiento */
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.instalable.set(e as EventoInstalar);
    });
    window.addEventListener('appinstalled', () => {
      this.instalable.set(null);
      this.recienInstalada.set(true);
    });
    window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => this.instalada.set(esStandalone()));
    // Si activó los avisos en los ajustes del celular y vuelve a la app, se nota sin recargar
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.revisarPermiso();
    });
  }

  /** Abre la ventana del navegador para instalar la app */
  async instalar(): Promise<void> {
    const e = this.instalable();
    if (!e) return;
    await e.prompt();
    const r = await e.userChoice.catch(() => null);
    if (r?.outcome === 'accepted') {
      this.instalable.set(null);
      this.recienInstalada.set(true);
    }
  }

  /** Vuelve a mirar el permiso del navegador (por si lo cambió en los ajustes) */
  async revisarPermiso(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.permiso.set(Notification.permission);
    if (Notification.permission === 'granted' && this.push() !== 'activo' && this.push() !== 'no-soportado' && this.push() !== 'instalar-ios') {
      await this.activarPush().catch(() => this.push.set('error'));
    }
  }

  saltarRequisitos(): void {
    try {
      sessionStorage.setItem('jasta-sin-requisitos', '1');
    } catch {
      /* solo por ahora */
    }
    this.saltado.set(true);
  }

  /** Se llama desde el shell al entrar. Seguro de llamar varias veces. */
  async iniciar(): Promise<void> {
    const usuario = await this.sb.asegurar();
    if (!usuario || usuario.id === this.usuarioId) return;
    this.detener();
    this.usuarioId = usuario.id;

    await this.recargar();
    // Al volver a la app (o reconectarse) se trae lo que llegó mientras tanto
    this.cerrarCanal = this.sb.enVivo(
      `avisos-${usuario.id}`,
      (c) =>
        c.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notificaciones', filter: `usuario_id=eq.${usuario.id}` },
          (payload) => this.recibir(payload.new as Aviso)
        ),
      () => void this.recargar()
    );

    // Si en este dispositivo ya se dio permiso, se renueva la suscripción en
    // silencio (por ejemplo, si ahora entró otra persona en el mismo celular)
    if (this.permiso() === 'granted' && this.push() !== 'no-soportado' && this.push() !== 'instalar-ios') {
      this.activarPush().catch(() => undefined);
    }
  }

  private async recargar(): Promise<void> {
    const { data } = await this.sb.client
      .from('notificaciones')
      .select('id, tipo, titulo, cuerpo, url, pedido_id, leida, created_at')
      .order('created_at', { ascending: false })
      .limit(60);
    if (!data) return;
    this.avisos.set(data as Aviso[]);
    this.marcarEntregados(this.avisos().filter((a) => !a.leida && a.tipo === 'mensaje' && a.pedido_id).map((a) => a.pedido_id!));
  }

  /** Los mensajes de estos chats ya le llegaron a la persona (doble chulo gris para quien los mandó) */
  private marcarEntregados(pedidos: number[]): void {
    const unicos = [...new Set(pedidos)];
    // (las consultas de Supabase solo salen al pedir el resultado: de ahí el then)
    if (unicos.length) void this.sb.client.rpc('chat_marcar_entregados', { p_pedidos: unicos }).then();
  }

  detener(): void {
    this.cerrarCanal?.();
    this.cerrarCanal = null;
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
    this.avisos.update((lista) => [aviso, ...lista.filter((a) => a.id !== aviso.id)].slice(0, 80));
    if (aviso.tipo === 'mensaje' && aviso.pedido_id) this.marcarEntregados([aviso.pedido_id]);
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
    const r = await Notification.requestPermission();
    this.permiso.set(r);
    if (r === 'granted') {
      this.sonar();
      await this.activarPush().catch(() => this.push.set('error'));
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
    if (this.push() === 'no-soportado' || this.push() === 'instalar-ios') return;
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
