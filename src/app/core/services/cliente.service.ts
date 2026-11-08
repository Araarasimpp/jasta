import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ClienteDireccion {
  id: number;
  etiqueta: string;
  direccion: string;
  barrio: string;
  indicaciones: string | null;
  principal: boolean;
}
export interface CompraItem { producto_id: number | null; nombre: string; cantidad: number; precio: number; color: string | null; talla: string | null; imagen_url: string | null }
export interface Compra {
  fecha: string;
  codigo: string | null;
  /** Página pública para ver el pedido: /pago/:codigo (tienda) o /seguimiento/:codigo */
  ruta: 'pago' | 'seguimiento';
  pedido: number | null;
  estado: 'por_pagar' | 'por_confirmar' | 'por_alistar' | 'alistado' | 'despachado' | 'entregado' | 'cancelado';
  total: number;
  domicilio: number | null;
  confirmado_at: string | null;
  alistado_at: string | null;
  enviado_at: string | null;
  entregado_at: string | null;
  direccion: string | null;
  barrio: string | null;
  pago: string | null;
  pago_estado: string | null;
  canal: string;
  items: CompraItem[] | null;
}
export interface ClientePerfil {
  id: number;
  nombre: string;
  email: string | null;
  prefijo: string;
  telefono: string | null;
  tipo_doc: string;
  documento: string | null;
  desde: string;
  direcciones: ClienteDireccion[];
}

/**
 * Cuenta del cliente de la tienda (como en las tiendas en línea): sus datos y sus direcciones.
 * Los clientes no son del equipo: no tienen fila en usuarios y no ven nada de adentro.
 */
@Injectable({ providedIn: 'root' })
export class ClienteService {
  private sb = inject(SupabaseService);
  readonly perfil = signal<ClientePerfil | null>(null);
  /** Ya se sabe si hay cliente o no */
  readonly listo = signal(false);
  private consulta = 0;

  constructor() {
    // Cada vez que cambia la sesión (entra, sale o cambia de cuenta) se vuelve a leer el perfil
    effect(() => {
      const uid = this.sb.session()?.user.id ?? null;
      untracked(() => void this.cargar(uid));
    });
  }

  private destino(ruta: string): string {
    return new URL(ruta, location.origin).href;
  }

  async cargar(uid = this.sb.session()?.user.id ?? null): Promise<void> {
    const n = ++this.consulta;
    if (!uid) {
      this.perfil.set(null);
      this.listo.set(true);
      return;
    }
    const { data, error } = await this.sb.client.rpc('cliente_yo');
    if (n !== this.consulta) return;
    if (!error) this.perfil.set((data as ClientePerfil | null) ?? null);
    this.listo.set(true);
  }

  registrar(d: { nombre: string; email: string; password: string; prefijo: string; telefono: string }, captchaToken?: string) {
    return this.sb.client.auth.signUp({
      email: d.email.trim().toLowerCase(),
      password: d.password,
      options: {
        data: { tipo: 'cliente', nombre: d.nombre.trim(), prefijo: d.prefijo, telefono: d.telefono },
        emailRedirectTo: this.destino('/tienda/cuenta'),
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
  }

  reenviarConfirmacion(email: string, captchaToken?: string) {
    return this.sb.client.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: this.destino('/tienda/cuenta'), ...(captchaToken ? { captchaToken } : {}) },
    });
  }

  /** Código de 6 números del correo (si la plantilla del correo lo trae) */
  verificarCodigo(email: string, token: string, tipo: 'signup' | 'recovery') {
    return this.sb.client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: tipo });
  }

  entrar(email: string, password: string, captchaToken?: string) {
    return this.sb.login(email, password, captchaToken);
  }

  recuperar(email: string, captchaToken?: string) {
    return this.sb.client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: this.destino('/tienda/cuenta?nueva=1'),
      ...(captchaToken ? { captchaToken } : {}),
    });
  }

  cambiarClave(password: string) {
    return this.sb.cambiarClave(password);
  }

  async guardarDatos(d: { nombre: string; prefijo: string; telefono: string; tipo_doc: string; documento: string }) {
    const r = await this.sb.client.rpc('cliente_guardar', {
      p_nombre: d.nombre, p_prefijo: d.prefijo, p_telefono: d.telefono, p_tipo_doc: d.tipo_doc, p_documento: d.documento,
    });
    if (!r.error) this.perfil.set(r.data as ClientePerfil);
    return r;
  }

  async guardarDireccion(d: { id: number | null; etiqueta: string; direccion: string; barrio: string; indicaciones: string; principal: boolean }) {
    const r = await this.sb.client.rpc('cliente_guardar_direccion', {
      p_id: d.id, p_etiqueta: d.etiqueta, p_direccion: d.direccion, p_barrio: d.barrio, p_indicaciones: d.indicaciones, p_principal: d.principal,
    });
    if (!r.error) this.perfil.set(r.data as ClientePerfil);
    return r;
  }

  async quitarDireccion(id: number) {
    const r = await this.sb.client.rpc('cliente_quitar_direccion', { p_id: id });
    if (!r.error) this.perfil.set(r.data as ClientePerfil);
    return r;
  }

  /** Sus compras (las más recientes primero) */
  async compras(): Promise<Compra[]> {
    const { data, error } = await this.sb.client.rpc('cliente_compras');
    if (error) throw error;
    return (data as Compra[]) ?? [];
  }

  /** Volver a comprar: deja los productos listos para que la tienda los ponga en el carrito */
  volverAComprar(c: Compra): void {
    const items = (c.items ?? []).filter((i) => i.producto_id).map((i) => ({ producto_id: i.producto_id!, cantidad: i.cantidad, color: i.color, talla: i.talla }));
    try { sessionStorage.setItem('tienda-repetir', JSON.stringify({ items })); } catch { /* sin almacenamiento */ }
  }

  async salir(): Promise<void> {
    await this.sb.logout();
    this.perfil.set(null);
  }
}
