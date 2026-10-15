import { Injectable, computed, signal } from '@angular/core';
import { createClient, Session, SupabaseClient } from '@supabase/supabase-js';
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

  tiene(...roles: Rol[]): boolean {
    const mios = this.roles();
    return roles.some((r) => mios.includes(r));
  }

  async login(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  }

  async registro(nombre: string, email: string, password: string) {
    return this.client.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { nombre: nombre.trim() }, emailRedirectTo: document.baseURI },
    });
  }

  async recuperar(email: string) {
    return this.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: new URL('auth/nueva-clave', document.baseURI).href,
    });
  }

  async cambiarClave(password: string) {
    return this.client.auth.updateUser({ password });
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
    this.usuario.set(null);
  }

  /** Primera pantalla según los roles */
  inicioSegunRoles(): string {
    if (this.tiene('admin', 'cuadres')) return '/app/inicio';
    if (this.tiene('alistador', 'vendedora')) return '/app/pedidos';
    if (this.tiene('mensajero')) return '/app/mis-entregas';
    return '/app/espera';
  }
}
