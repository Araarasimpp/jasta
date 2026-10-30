import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../toast/toast.service';
import { Pedido } from '../modelos';
import { mensajeError } from '../formato';
import { DatosNegocio, PedidoRotulo, cargarDatosNegocio, documentoRotulos, imprimirHtml, rotuloHtml } from './rotulo';
import { nombreConVariante } from '../variante';

/** Imprime rótulos de 100 × 100 mm y los marca como impresos */
@Injectable({ providedIn: 'root' })
export class RotulosService {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private negocio: DatosNegocio | null = null;

  static aRotulo(p: Pedido): PedidoRotulo {
    return {
      numero: p.id,
      cliente_nombre: p.cliente_nombre,
      cliente_telefono: p.cliente_telefono,
      direccion: p.direccion ?? '',
      barrio: p.barrio,
      observaciones: p.observaciones,
      total: Number(p.total),
      created_at: p.created_at,
      productos: (p.pedido_items ?? []).map((i) => `${nombreConVariante(i)}${i.cantidad > 1 ? ' x' + i.cantidad : ''}`),
    };
  }

  /** Olvida los datos del negocio guardados (después de editarlos en Configuración) */
  refrescar(): void {
    this.negocio = null;
  }

  /**
   * Se imprime desde un marco oculto de la misma página (sin ventanas
   * emergentes), así que también funciona en el celular.
   */
  async imprimir(fuente: Pedido[] | (() => Promise<Pedido[]>)): Promise<boolean> {
    if (Array.isArray(fuente) && !fuente.length) return false;
    try {
      const pedidos = Array.isArray(fuente) ? fuente : await fuente();
      if (!pedidos.length) {
        this.toast.ok('No hay rótulos por imprimir');
        return false;
      }
      this.negocio ??= await cargarDatosNegocio(this.sb.client);
      const html = documentoRotulos(
        pedidos.map((p) => rotuloHtml(RotulosService.aRotulo(p), this.negocio!)),
        pedidos.length === 1 ? `Rótulo #${pedidos[0].id}` : `${pedidos.length} rótulos`
      );
      imprimirHtml(html);
      const { error } = await this.sb.client.rpc('marcar_rotulos', { p_ids: pedidos.map((p) => p.id) });
      if (error) throw error;
      return true;
    } catch (e) {
      this.toast.error(mensajeError(e));
      return false;
    }
  }
}
