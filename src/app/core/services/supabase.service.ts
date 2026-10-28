import { Injectable, computed, signal } from '@angular/core';
import { createClient, RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Rol, Usuario } from '../../shared/modelos';

/** Ninguna petición se queda esperando para siempre (mala señal): a los 20 s se corta y falla */
function fetchConLimite(url: RequestInfo | URL, opciones: RequestInit = {}): Promise<Response> {
  const dir = String(url instanceof Request ? url.url : url);
  // Las subidas de fotos y comprobantes pueden tardar más con mala señal
  if (dir.includes('/storage/v1/object') && opciones.method && opciones.method !== 'GET') return fetch(url, opciones);
  const limite = new AbortController();
  const reloj = setTimeout(() => limite.abort(), 20000);
  opciones.signal?.addEventListener('abort', () => limite.abort());
  return fetch(url, { ...opciones, signal: limite.signal }).finally(() => clearTimeout(reloj));
}

const CLAVE_USUARIO = 'jasta-usuario';

/** El usuario de la última vez en este dispositivo (para abrir sin esperar a la red) */
function usuarioGuardado(authId: string): Usuario | null {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_USUARIO) ?? 'null') as { authId: string; usuario: Usuario } | null;
    return g?.authId === authId ? g.usuario : null;
  } catch {
    return null;
  }
}

function guardarUsuario(authId: string, u: Usuario | null): void {
  try {
    if (u) localStorage.setItem(CLAVE_USUARIO, JSON.stringify({ authId, usuario: u }));
    else localStorage.removeItem(CLAVE_USUARIO);
  } catch {
    /* sin almacenamiento */
  }
}

const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  readonly session = signal<Session | null>(null);
  readonly usuario = signal<Usuario | null>(null);
  readonly roles = computed<Rol[]>(() => (this.usuario()?.activo ? this.usuario()!.roles : []));

  private listo: Promise<void>;

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: fetchConLimite },
      // Latido más seguido: una conexión muerta (celular que se durmió) se nota en ~15 s y no en ~50 s
      realtime: { heartbeatIntervalMs: 15000 },
    });
    this.listo = this.iniciar();
    this.client.auth.onAuthStateChange((evento, session) => {
      this.session.set(session);
      if (evento === 'SIGNED_OUT') {
        this.usuario.set(null);
        guardarUsuario('', null);
      }
      if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') void this.cargarUsuario();
    });
  }

  private async iniciar(): Promise<void> {
    // Si renovar la sesión se demora (sesión vencida y mala señal), no se traba el arranque:
    // a los 8 s se sigue con la sesión guardada y se actualiza cuando responda
    const sesion = await Promise.race([
      this.client.auth.getSession().then(({ data }) => data.session),
      esperar(8000).then(() => this.sesionGuardada()),
    ]);
    this.session.set(sesion);
    if (!sesion) return;
    const previo = usuarioGuardado(sesion.user.id);
    if (previo) {
      // Abre de una vez con lo de la última vez y se actualiza por detrás
      this.usuario.set(previo);
      void this.cargarUsuario();
    } else {
      await this.cargarUsuario();
    }
  }

  private sesionGuardada(): Session | null {
    try {
      const clave = Object.keys(localStorage).find((k) => k.startsWith('sb-') && k.endsWith('-auth-token'));
      return clave ? (JSON.parse(localStorage.getItem(clave)!) as Session) : null;
    } catch {
      return null;
    }
  }

  /** Espera a que se sepa si hay sesión y quién es el usuario */
  async asegurar(): Promise<Usuario | null> {
    await this.listo;
    if (this.session() && !this.usuario()) await this.cargarUsuario();
    return this.usuario();
  }

  async cargarUsuario(): Promise<void> {
    const uid = this.session()?.user.id;
    if (!uid) {
      this.usuario.set(null);
      return;
    }
    // Con mala señal se intenta otra vez; si de verdad no se puede, se queda lo que había
    for (let intento = 0; intento < 3; intento++) {
      const { data, error } = await this.client.from('usuarios').select('*').eq('auth_id', uid).maybeSingle();
      if (!error) {
        this.usuario.set((data as Usuario) ?? null);
        guardarUsuario(uid, (data as Usuario) ?? null);
        return;
      }
      await esperar(1500 * (intento + 1));
    }
  }

  /**
   * Canal de Realtime que no se queda dormido. El celular corta la conexión cuando la app
   * pasa a segundo plano o se bloquea la pantalla, y Realtime no repite lo que llegó mientras
   * tanto. Por eso `alVolver` (traer de nuevo los datos) se llama:
   *  · al volver a la app o recuperar internet (y se reconecta el socket si quedó caído),
   *  · cuando el canal se vuelve a unir después de una caída,
   *  · cada minuto mientras la app está a la vista, como respaldo.
   * Si el canal falla (error o tiempo agotado) se arma de nuevo, esperando cada vez más.
   * Devuelve la función para cerrarlo.
   */
  enVivo(nombre: string, armar: (canal: RealtimeChannel) => RealtimeChannel, alVolver: () => void): () => void {
    let canal: RealtimeChannel | null = null;
    let cerrado = false;
    let unidoAntes = false;
    let espera = 10000;
    let reintento: ReturnType<typeof setTimeout> | undefined;
    let ultimo = 0;
    const avisar = () => {
      if (cerrado || Date.now() - ultimo < 1500) return;
      ultimo = Date.now();
      alVolver();
    };
    const abrir = () => {
      if (cerrado) return;
      const c = armar(this.client.channel(`${nombre}-${Math.random().toString(36).slice(2, 8)}`));
      canal = c;
      c.subscribe((estado) => {
        if (cerrado || canal !== c) return;
        if (estado === 'SUBSCRIBED') {
          clearTimeout(reintento);
          // Siempre: lo que cambió entre el último aviso y este momento no llegó por el canal
          if (unidoAntes) alVolver();
          unidoAntes = true;
          espera = 10000;
        } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
          // Casi siempre Realtime se vuelve a unir solo; si no lo logró en un rato, se arma de nuevo
          clearTimeout(reintento);
          reintento = setTimeout(() => {
            if (cerrado || canal !== c || c.state === 'joined') return;
            canal = null;
            void this.client.removeChannel(c);
            abrir();
          }, espera);
          espera = Math.min(espera * 2, 60000);
        }
      });
    };
    const despertar = () => {
      if (document.visibilityState !== 'visible') return;
      if (!this.client.realtime.isConnected()) this.client.realtime.connect();
      avisar();
    };
    const respaldo = setInterval(() => {
      if (document.visibilityState === 'visible') avisar();
    }, 60000);
    document.addEventListener('visibilitychange', despertar);
    window.addEventListener('online', despertar);
    abrir();
    return () => {
      cerrado = true;
      clearTimeout(reintento);
      clearInterval(respaldo);
      document.removeEventListener('visibilitychange', despertar);
      window.removeEventListener('online', despertar);
      if (canal) void this.client.removeChannel(canal);
      canal = null;
    };
  }

  tiene(...roles: Rol[]): boolean {
    const mios = this.roles();
    return roles.some((r) => mios.includes(r));
  }

  async login(email: string, password: string, captchaToken?: string) {
    return this.client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
  }

  async registro(nombre: string, email: string, password: string, captchaToken?: string) {
    return this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { nombre: nombre.trim() }, emailRedirectTo: document.baseURI, ...(captchaToken ? { captchaToken } : {}) },
    });
  }

  async recuperar(email: string, captchaToken?: string) {
    return this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: new URL('auth/nueva-clave', document.baseURI).href,
      ...(captchaToken ? { captchaToken } : {}),
    });
  }

  async cambiarClave(password: string) {
    return this.client.auth.updateUser({ password });
  }

  async logout(): Promise<void> {
    guardarUsuario('', null);
    await this.client.auth.signOut();
    this.usuario.set(null);
  }

  /** Dónde ve sus pedidos quien acaba de crear o editar uno */
  rutaPedidos(): string {
    return this.tiene('admin', 'alistador', 'cuadres') ? '/app/pedidos' : '/app/mi-panel';
  }

  /** Primera pantalla según los roles */
  inicioSegunRoles(): string {
    if (this.tiene('admin')) return '/app/inicio';
    if (this.tiene('cuadres')) return '/app/cuadres';
    if (this.tiene('alistador')) return '/app/tablero';
    // La cuenta del local (aunque también tenga rol de vendedora) entra a registrar ventas
    if (this.tiene('venta_local')) return '/app/venta-local';
    if (this.tiene('vendedora')) return '/app/mi-panel';
    if (this.tiene('mensajero')) return '/app/mis-entregas';
    if (this.tiene('recolector')) return '/app/recolector';
    return '/app/espera';
  }
}
