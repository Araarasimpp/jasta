import { Component, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';
import { urlsComprobantes } from '../../shared/comprobantes';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO, formatoHoraCO, hoyColombiaISO } from '../../shared/fecha-colombia';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

interface Devolucion {
  id: number;
  pedido_id: number;
  cliente: string;
  vendedora: string | null;
  tipo: 'devolucion' | 'cambio' | 'garantia';
  motivo: string;
  estado_producto: 'vuelve_stock' | 'danado';
  reemplazo: boolean;
  reembolso: number;
  metodo: string | null;
  comision_descuento: number;
  nota: string | null;
  fotos: string[];
  creado_por_nombre: string | null;
  fecha: string;
  perdida: number | null;
  items: { nombre: string; cantidad: number }[];
}

/**
 * Devoluciones, cambios y garantías del periodo. Se registran desde el detalle de un
 * pedido entregado ("Devolución o garantía"); aquí se ven todas con su resumen.
 */
@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [EsqueletoComponent, PedidoDetalleComponent, RangoComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1000px; }
      .lista { list-style: none; margin: 0; padding: 0; }
      .dev { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 12px; padding: 12px 0; border-bottom: var(--perfora); cursor: pointer; }
      .dev:last-child { border-bottom: 0; }
      .dev strong { font-size: 14.5px; }
      .dev p { margin: 2px 0 0; font-size: 13px; color: var(--text-soft); }
      .dev small { font-size: 12px; color: var(--text-muted); }
      .der { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-align: right; }
      .der .num { font-weight: 700; }
      .tipo { display: inline-block; padding: 1px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 650; }
      .tipo.devolucion { background: var(--danger-wash); color: var(--danger); }
      .tipo.cambio { background: var(--accent-wash); color: var(--accent); }
      .tipo.garantia { background: var(--oro-wash); color: var(--oro-texto); }
      .estado { font-size: 12px; color: var(--text-muted); }
      .estado.danado { color: var(--danger); font-weight: 600; }
      .foto { width: 36px; height: 36px; padding: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; background: var(--surface-2); cursor: zoom-in; }
      .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .motivos { display: flex; flex-wrap: wrap; gap: 8px; }
      .motivos span { padding: 5px 11px; border-radius: 999px; background: var(--surface-2); font-size: 13px; }
      .motivos b { font-family: var(--mono-font); margin-left: 4px; }
      .vacio-txt { margin: 0; padding: 14px 0 6px; text-align: center; font-size: 13.5px; color: var(--text-soft); }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">{{ etiqueta() }}</p><h1>Devoluciones</h1></div>
      </div>
      <app-rango inicial="mes" (cambio)="cambiarRango($event)"></app-rango>
      <p class="ayuda" style="margin: 0">Para registrar una, abre el pedido entregado y toca <strong>Devolución o garantía</strong>.</p>

      <div class="kpis" role="list">
        <div class="kpi" role="listitem"><span class="kpi-label">Casos</span><span class="kpi-valor num">{{ lista().length }}</span>
          <span class="kpi-nota">{{ cuenta('devolucion') }} devoluciones · {{ cuenta('cambio') }} cambios · {{ cuenta('garantia') }} garantías</span></div>
        <div class="kpi" role="listitem"><span class="kpi-label">Unidades</span><span class="kpi-valor num">{{ resumen().unidades }}</span>
          <span class="kpi-nota">{{ resumen().danadas }} dañadas</span></div>
        <div class="kpi" role="listitem"><span class="kpi-label">Reembolsado</span><span class="kpi-valor num">{{ pesos(resumen().reembolsos) }}</span>
          <span class="kpi-nota">Plata devuelta a clientes</span></div>
        @if (esAdmin()) {
          <div class="kpi" role="listitem"><span class="kpi-label">Pérdida por dañados</span><span class="kpi-valor num">{{ pesos(resumen().perdida) }}</span>
            <span class="kpi-nota">A precio de compra</span></div>
        } @else {
          <div class="kpi" role="listitem"><span class="kpi-label">Comisión descontada</span><span class="kpi-valor num">{{ pesos(resumen().comision) }}</span>
            <span class="kpi-nota">A las vendedoras</span></div>
        }
      </div>

      @if (porMotivo().length) {
        <div class="motivos">
          @for (m of porMotivo(); track m.motivo) { <span>{{ m.motivo }}<b>{{ m.n }}</b></span> }
        </div>
      }

      <section class="panel">
        @if (lista().length) {
          <ul class="lista">
            @for (d of lista(); track d.id) {
              <li class="dev" (click)="abierto.set(d.pedido_id)">
                <span style="min-width: 0">
                  <strong>#{{ d.pedido_id }} {{ d.cliente }}</strong> <span class="tipo" [class]="'tipo ' + d.tipo">{{ tipoTxt(d.tipo) }}</span>
                  <p>{{ items(d) }} · {{ d.motivo }}</p>
                  @if (d.nota) { <p>"{{ d.nota }}"</p> }
                  <small>{{ cuando(d.fecha) }}{{ d.creado_por_nombre ? ' · ' + d.creado_por_nombre : '' }}{{ d.vendedora ? ' · vendió ' + d.vendedora : '' }}</small>
                </span>
                <span class="der">
                  @if (d.tipo === 'devolucion' && d.reembolso) { <span class="num">−{{ pesos(d.reembolso) }}</span> }
                  <span class="estado" [class.danado]="d.estado_producto === 'danado'">{{ d.estado_producto === 'danado' ? 'Dañado' : 'Volvió al inventario' }}{{ d.reemplazo ? ' · se entregó otro' : '' }}</span>
                  @if (d.comision_descuento) { <small>Comisión −{{ pesos(d.comision_descuento) }}</small> }
                  @if (d.fotos.length) {
                    <button type="button" class="foto" (click)="$event.stopPropagation(); verFotos(d)" aria-label="Ver fotos">
                      @if (miniaturas()[d.fotos[0]]; as u) { <img [src]="u" alt="" loading="lazy" /> }
                    </button>
                  }
                </span>
              </li>
            }
          </ul>
        } @else {
          @if (cargando()) { <app-esqueleto forma="lista" [filas]="4"></app-esqueleto> } @else { <p class="vacio-txt">{{ 'No hubo devoluciones ni garantías en este periodo.' }}</p> }
        }
      </section>
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class DevolucionesPage {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private visor = inject(VisorService);

  lista = signal<Devolucion[]>([]);
  porMotivo = signal<{ motivo: string; n: number }[]>([]);
  miniaturas = signal<Record<string, string>>({});
  cargando = signal(true);
  etiqueta = signal('');
  abierto = signal<number | null>(null);
  esAdmin = computed(() => this.sb.tiene('admin'));
  pesos = pesos;
  private rango: RangoFechas | null = null;

  resumen = computed(() => {
    const l = this.lista();
    return {
      unidades: l.reduce((s, d) => s + d.items.reduce((a, i) => a + i.cantidad, 0), 0),
      danadas: l.filter((d) => d.estado_producto === 'danado').reduce((s, d) => s + d.items.reduce((a, i) => a + i.cantidad, 0), 0),
      reembolsos: l.reduce((s, d) => s + Number(d.reembolso || 0), 0),
      perdida: l.reduce((s, d) => s + Number(d.perdida || 0), 0),
      comision: l.reduce((s, d) => s + Number(d.comision_descuento || 0), 0),
    };
  });

  cambiarRango(r: RangoFechas): void {
    this.rango = r;
    this.etiqueta.set(r.etiqueta);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const r = this.rango;
    if (!r) return;
    const { data, error } = await this.sb.client.rpc('devoluciones_lista', { p_desde: r.desde || '2020-01-01', p_hasta: r.hasta || hoyColombiaISO() });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    const res = data as { lista: Devolucion[]; por_motivo: { motivo: string; n: number }[] };
    this.lista.set(res.lista ?? []);
    this.porMotivo.set(res.por_motivo ?? []);
    const faltan = (res.lista ?? []).flatMap((d) => d.fotos.slice(0, 1)).filter((f) => !this.miniaturas()[f]);
    if (faltan.length) {
      const urls = await urlsComprobantes(this.sb.client, faltan);
      this.miniaturas.update((m) => ({ ...m, ...Object.fromEntries(faltan.map((f, i) => [f, urls[i]])) }));
    }
  }

  cuenta(t: string): number {
    return this.lista().filter((d) => d.tipo === t).length;
  }

  tipoTxt(t: string): string {
    return { devolucion: 'Devolución', cambio: 'Cambio', garantia: 'Garantía' }[t] ?? t;
  }

  items(d: Devolucion): string {
    return d.items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ');
  }

  verFotos(d: Devolucion): void {
    void urlsComprobantes(this.sb.client, d.fotos).then((urls) => this.visor.abrir(urls.map((url) => ({ url, titulo: `Pedido #${d.pedido_id}` })), 0));
  }

  cuando(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
