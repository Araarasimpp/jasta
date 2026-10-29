import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';
import { TipoRecaudo } from '../../shared/modelos';

/** Pedido en ruta de Variedades JYB (otra base: los ids son uuid y se muestra el número) */
export interface PedidoJyb {
  id: string;
  numero: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  valor_domicilio: number;
  total: number;
  observaciones: string | null;
  created_at?: string;
  /** Cuándo se lo asignaron (por Telegram, la hora de la foto del rótulo) */
  asignado_at?: string | null;
  vendedor?: string | null;
  items: { nombre: string; cantidad: number; precio?: number | null }[];
}

/** Pedido de Variedades JYB que ya entregó (para el historial) */
export interface EntregadoJyb {
  id: string;
  numero: number;
  cliente_nombre: string;
  barrio: string | null;
  total: number;
  valor_domicilio: number;
  metodo_pago: TipoRecaudo | null;
  efectivo: number;
  transferencia: number;
  entregado_at: string;
  cuadre: 'por_cuadrar' | 'por_confirmar' | 'cuadrado';
}

export interface ResumenJyb {
  vinculado: boolean;
  /** Canal de avisos en vivo de Variedades JYB para este mensajero */
  canal?: string;
  en_ruta?: PedidoJyb[];
  por_cuadrar?: { pedidos: number; efectivo: number; transferencia: number; domicilios: number; desde: string | null };
  por_confirmar?: { id: string; fecha: string; cantidad_pedidos: number; total_a_entregar: number }[];
}

/** Pedido de Variedades JYB por despachar (para imprimir su rótulo desde Jasta) */
export interface PedidoRotuloJybFila {
  id: string;
  numero: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  observaciones: string | null;
  total: number;
  created_at: string;
  alistado_at: string | null;
  rotulo_impreso_at: string | null;
  vendedor: string | null;
  items: { nombre: string; cantidad: number }[];
}

export interface RotulosJyb {
  /** false: esta persona no puede imprimir rótulos de Variedades JYB */
  vinculado: boolean;
  negocio?: { nombre_negocio: string | null; telefonos: string | null; redes: string | null; texto_garantia: string | null } | null;
  pedidos?: PedidoRotuloJybFila[];
}

/**
 * Pedidos de Variedades JYB para el mensajero que también reparte allá.
 * Se reconoce por el correo con el que entra a las dos apps; los cuadres siguen separados.
 */
@Injectable({ providedIn: 'root' })
export class JybService {
  private sb = inject(SupabaseService);
  /** Conexión a Variedades JYB solo para recibir avisos en vivo (sin sesión: los datos llegan por la función) */
  private avisos?: SupabaseClient;

  private async llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
    const { data } = await this.sb.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Tu sesión se cerró, vuelve a entrar');
    const r = await fetch(environment.jybPuenteUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json?.error || 'Variedades JYB no responde, intenta de nuevo');
    return json as T;
  }

  resumen(): Promise<ResumenJyb> {
    return this.llamar<ResumenJyb>({ accion: 'resumen' });
  }

  /** En mixto, Variedades JYB guarda el efectivo y calcula la transferencia */
  async entregar(pedidoId: string, tipo: TipoRecaudo, efectivo: number, evidencias: string[]): Promise<void> {
    await this.llamar({ accion: 'entregar', pedido_id: pedidoId, metodo: tipo, efectivo, comprobantes: evidencias });
  }

  entregadas(desde: string | null, hasta: string | null): Promise<EntregadoJyb[]> {
    return this.llamar<EntregadoJyb[]>({ accion: 'entregadas', desde, hasta });
  }

  /** Avisa cada vez que cambia un pedido o un cuadre de este mensajero en Variedades JYB */
  escuchar(canal: string, cb: () => void): () => void {
    this.avisos ??= createClient(environment.jybUrl, environment.jybKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'jyb-avisos' },
    });
    const c = this.avisos.channel(canal).on('broadcast', { event: 'cambio' }, () => cb()).subscribe();
    return () => void this.avisos?.removeChannel(c);
  }

  async cerrarCuadre(): Promise<void> {
    await this.llamar({ accion: 'cerrar_cuadre' });
  }

  /** Pedidos de Variedades JYB por despachar, para imprimir sus rótulos aquí (admin o alistador) */
  rotulos(): Promise<RotulosJyb> {
    return this.llamar<RotulosJyb>({ accion: 'rotulos' });
  }

  async marcarRotulos(ids: string[]): Promise<void> {
    await this.llamar({ accion: 'marcar_rotulos', ids });
  }
}
