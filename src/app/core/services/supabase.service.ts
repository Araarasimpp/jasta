import { Injectable, computed, signal } from '@angular/core';
import { createClient, RealtimeChannel, Session, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { Rol, Usuario } from '../../shared/modelos';

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
      // Latido más seguido: una conexión muerta (celular que se durmió) se nota en ~15 s y no en ~50 s
      realtime: { heartbeatIntervalMs: 15000 },
    });
    this.listo = this.iniciar();
    this.client.auth.onAuthStateChange((evento, session) => {
      this.session.set(session);
      if (evento === 'SIGNED_OUT') this.usuario.set(null);
      if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') void this.cargarUsuario();
    });
  }

  private async iniciar(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    this.session.set(data.session);
    if (data.session) await this.cargarUsuario();
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
    const { data } = await this.client.from('usuarios').select('*').eq('auth_id', uid).maybeSingle();
    this.usuario.set((data as Usuario) ?? null);
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
