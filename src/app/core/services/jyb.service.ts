import { Injectable, inject } from '@angular/core';
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
  items: { nombre: string; cantidad: number }[];
}

export interface ResumenJyb {
  vinculado: boolean;
  en_ruta?: PedidoJyb[];
  por_cuadrar?: { pedidos: number; efectivo: number; transferencia: number; domicilios: number; desde: string | null };
  por_confirmar?: { id: string; fecha: string; cantidad_pedidos: number; total_a_entregar: number }[];
}

/**
 * Pedidos de Variedades JYB para el mensajero que también reparte allá.
 * Se reconoce por el correo con el que entra a las dos apps; los cuadres siguen separados.
 */
@Injectable({ providedIn: 'root' })
export class JybService {
  private sb = inject(SupabaseService);

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

  /** En mixto, Variedades JYB guarda el efectivo y calcula la transferencia; solo usa el primer comprobante */
  async entregar(pedidoId: string, tipo: TipoRecaudo, efectivo: number, evidencias: string[]): Promise<void> {
    await this.llamar({ accion: 'entregar', pedido_id: pedidoId, metodo: tipo, efectivo, comprobante: evidencias[0] ?? null });
  }

  async cerrarCuadre(): Promise<void> {
    await this.llamar({ accion: 'cerrar_cuadre' });
  }
}
