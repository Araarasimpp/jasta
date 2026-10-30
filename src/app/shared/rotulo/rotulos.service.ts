import { Injectable, inject } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../toast/toast.service';
import { Pedido } from '../modelos';
import { mensajeError } from '../formato';
import { DatosNegocio, PedidoRotulo, cargarDatosNegocio, documentoRotulos, imprimirHtml, rotuloHtml } from './rotulo';
import { NEGOCIO_JYB, ROTULO_JYB_CSS, rotuloJybHtml } from './rotulo-jyb';
import { JybService, PedidoRotuloJybFila, RotulosJyb } from '../../core/services/jyb.service';
import { microsAsignado } from '../fecha-colombia';
import { nombreConVariante } from '../variante';

/** Imprime rótulos de 100 × 100 mm y los marca como impresos */
@Injectable({ providedIn: 'root' })
export class RotulosService {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private jyb = inject(JybService);
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

  /**
   * Rótulos de Jasta y de Variedades JYB en un mismo documento (una sola impresión),
   * en el orden en que se alistaron. Marca los dos como impresos.
   */
  async imprimirConJyb(jasta: Pedido[], jyb: PedidoRotuloJybFila[], negocioJyb: RotulosJyb['negocio']): Promise<boolean> {
    if (!jasta.length && !jyb.length) {
      this.toast.ok('No hay rótulos por imprimir');
      return false;
    }
    try {
      if (jasta.length) this.negocio ??= await cargarDatosNegocio(this.sb.client);
      const nJyb: DatosNegocio = {
        nombre_negocio: negocioJyb?.nombre_negocio?.trim() || NEGOCIO_JYB.nombre_negocio,
        telefonos: negocioJyb?.telefonos?.trim() || null,
        redes: negocioJyb?.redes?.trim() || null,
        texto_garantia: negocioJyb?.texto_garantia?.trim() || null,
      };
      const todos = [
        ...jasta.map((p) => ({ cuando: microsAsignado(p.alistado_at ?? p.created_at), html: rotuloHtml(RotulosService.aRotulo(p), this.negocio!) })),
        ...jyb.map((p) => ({ cuando: microsAsignado(p.alistado_at ?? p.created_at), html: rotuloJybHtml(p, nJyb) })),
      ].sort((a, b) => a.cuando - b.cuando);
      const titulo = todos.length === 1 ? 'Rótulo' : `${todos.length} rótulos`;
      imprimirHtml(documentoRotulos(todos.map((x) => x.html), titulo, ROTULO_JYB_CSS));
      // Se marcan al abrir el diálogo (el navegador no avisa si se canceló)
      if (jasta.length) {
        const { error } = await this.sb.client.rpc('marcar_rotulos', { p_ids: jasta.map((p) => p.id) });
        if (error) throw error;
      }
      if (jyb.length) await this.jyb.marcarRotulos(jyb.map((p) => p.id));
      return true;
    } catch (e) {
      this.toast.error(mensajeError(e));
      return false;
    }
  }
}
