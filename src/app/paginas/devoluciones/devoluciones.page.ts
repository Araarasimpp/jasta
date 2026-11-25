import { IonIcon } from '@ionic/angular';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { closeOutline, printOutline } from 'ionicons/icons';
import { DevolucionParaRotulo, cobroDe, crearEnvioDevolucion, imprimirRotuloDevolucion } from '../../shared/rotulo/rotulo-devolucion';
import { GarantiasAlertaService } from '../../shared/garantias-alerta/garantias-alerta.service';
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
  tecnico: string | null;
  tecnico_fecha: string | null;
  tecnico_obs: string | null;
  resuelta: boolean;
  nuevo_nombre: string | null;
  nuevo_cantidad: number | null;
  diferencia: number;
  diferencia_metodo: string | null;
  cliente_telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  domicilio: number;
  garantia_estado: string;
  garantia_estado_texto: string;
  garantia_detalle: string | null;
  envio_pedido_id: number | null;
  envio_estado: string | null;
  envio_total: number | null;
  envio_domicilio: number | null;
}

/** Garantía sin resolver (de cualquier fecha) */
interface GarantiaPendiente {
  id: number;
  pedido_id: number;
  cliente: string;
  cliente_telefono: string | null;
  direccion: string | null;
  barrio: string | null;
  estado: string;
  estado_texto: string;
  detalle: string | null;
  nota: string | null;
  fecha: string;
  items: { nombre: string; cantidad: number }[] | null;
  envio_pedido_id: number | null;
  envio_estado: string | null;
}

const ESTADOS_GARANTIA = [
  { id: 'recibida', label: 'Recibida en la tienda' },
  { id: 'en_arreglo', label: 'En arreglo con…' },
  { id: 'esperando_repuesto', label: 'Esperando repuesto' },
  { id: 'lista', label: 'Lista para entregar' },
  { id: 'en_camino', label: 'En camino al cliente' },
  { id: 'entregada', label: 'Entregada al cliente' },
  { id: 'sin_arreglo', label: 'No tiene arreglo' },
];

/**
 * Devoluciones, cambios y garantías del periodo. Se registran desde el detalle de un
 * pedido entregado ("Devolución o garantía"); aquí se ven todas con su resumen.
 */
@Component({
  selector: 'app-devoluciones',
  standalone: true,
  imports: [EsqueletoComponent, PedidoDetalleComponent, RangoComponent, FormsModule, IonIcon],
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
      .g-estado { display: inline-block; margin-left: 4px; padding: 1px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 650; background: var(--danger-wash); color: var(--danger); }
      .g-estado.tec { background: var(--accent-wash); color: var(--accent); }
      .g-estado.ok { background: var(--ok-wash); color: var(--efectivo-texto); }
      .tec-info { margin: 4px 0 0; padding: 6px 10px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: 13px; color: var(--text-soft); }
      .link { display: block; margin: 6px 0 2px; border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 13px; font-weight: 600; text-decoration: underline; cursor: pointer; }
      .check { display: flex; gap: 8px; align-items: center; font-size: 14px; }
      .pend { border-color: color-mix(in srgb, var(--oro) 45%, var(--border)); }
      .pend h2 { display: flex; align-items: center; gap: 8px; }
      .pend-li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 4px 12px; padding: 10px 0; border-bottom: var(--perfora); }
      .pend-li:last-child { border-bottom: 0; }
      .pend-li strong { font-size: 14.5px; }
      .pend-li p { margin: 2px 0 0; font-size: 13px; color: var(--text-soft); }
      .acc-dev { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; align-items: center; }
      .acc-dev .b { height: 34px; padding: 0 12px; font-size: 13px; }
      .g-estado.en_arreglo, .g-estado.esperando_repuesto { background: var(--accent-wash); color: var(--accent); }
      .g-estado.lista, .g-estado.en_camino { background: var(--oro-wash); color: var(--oro-texto); }
      .g-estado.entregada { background: var(--ok-wash); color: var(--efectivo-texto); }
      .estados-g { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .estados-g button { min-height: 44px; padding: 8px 10px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface);
        color: var(--text); font: inherit; font-size: 13.5px; text-align: left; cursor: pointer; }
      .estados-g button.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .hist li { font-size: 13px; color: var(--text-soft); }
      .hist b { color: var(--text); font-weight: 650; }
      .dom { font-size: 12px; color: var(--text-muted); }
      @media (max-width: 640px) { .pend-li { grid-template-columns: minmax(0, 1fr); } .acc-dev { justify-content: flex-start; } }
      .vacio-txt { margin: 0; padding: 14px 0 6px; text-align: center; font-size: 13.5px; color: var(--text-soft); }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">{{ etiqueta() }}</p><h1>Devoluciones</h1></div>
      </div>
      <app-rango inicial="mes" (cambio)="cambiarRango($event)"></app-rango>
      <p class="ayuda" style="margin: 0">Para registrar una, abre el pedido entregado y toca <strong>Devolución o garantía</strong>. Cada una tiene su rótulo para el mensajero.</p>

      @if (pendientes().length) {
        <section class="panel pend" aria-labelledby="t-pend">
          <h2 id="t-pend"><ion-icon name="construct" aria-hidden="true"></ion-icon>Garantías pendientes ({{ pendientes().length }})</h2>
          <ul class="lista">
            @for (g of pendientes(); track g.id) {
              <li class="pend-li">
                <span style="min-width: 0">
                  <strong>#{{ g.pedido_id }} {{ g.cliente }}</strong>
                  <span [class]="'g-estado ' + g.estado">{{ g.estado_texto }}{{ g.detalle ? (g.estado === 'en_arreglo' ? ' con ' : ' · ') + g.detalle : '' }}</span>
                  <p>{{ itemsTxt(g.items) }}{{ g.nota ? ' · "' + g.nota + '"' : '' }}</p>
                  <p>Desde {{ cuando(g.fecha) }}@if (g.envio_pedido_id) { · envío #{{ g.envio_pedido_id }} {{ estadoEnvio(g.envio_estado) }} }</p>
                </span>
                <span class="acc-dev">
                  <button type="button" class="b" (click)="rotuloPendiente(g)"><ion-icon name="print-outline"></ion-icon>Rótulo</button>
                  <button type="button" class="b b-pri" (click)="abrirEstado(g.id, g.pedido_id, g.estado, g.detalle, itemsTxt(g.items))">Cambiar estado</button>
                </span>
              </li>
            }
          </ul>
        </section>
      }

      <div class="kpis" role="list">
        <div class="kpi" role="listitem"><span class="kpi-label">Casos</span><span class="kpi-valor num">{{ lista().length }}</span>
          <span class="kpi-nota">{{ cuenta('devolucion') }} devoluciones · {{ cuenta('cambio') }} cambios · {{ cuenta('garantia') }} garantías{{ garantiasAbiertas() ? ' (' + garantiasAbiertas() + ' sin resolver)' : '' }}</span></div>
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
                  @if (d.tipo === 'garantia') {
                    <span [class]="'g-estado ' + d.garantia_estado">{{ d.garantia_estado_texto }}{{ d.garantia_detalle ? (d.garantia_estado === 'en_arreglo' ? ' con ' : ' · ') + d.garantia_detalle : '' }}</span>
                    <p>{{ items(d) }}</p>
                    @if (d.nota) { <p>Problema: "{{ d.nota }}"</p> }
                    @if (d.tecnico) {
                      <p class="tec-info"><ion-icon class="ico" name="construct" aria-hidden="true"></ion-icon>{{ d.tecnico }} · {{ fechaCorta(d.tecnico_fecha) }}{{ d.tecnico_obs ? ' · ' + d.tecnico_obs : '' }}</p>
                    }
                    <button type="button" class="link" (click)="$event.stopPropagation(); abrirEstado(d.id, d.pedido_id, d.garantia_estado, d.garantia_detalle, items(d))">Cambiar estado</button>
                  } @else {
                    <p>{{ items(d) }} · {{ d.motivo }}</p>
                    @if (d.nuevo_nombre) { <p>→ Por {{ d.nuevo_cantidad }} {{ d.nuevo_nombre }}{{ +d.diferencia ? (d.diferencia_metodo === 'contra_entrega' ? ' · deducible ' + pesos(d.diferencia) + ' (lo cobra el mensajero)' : ' · pagó ' + pesos(d.diferencia) + ' de diferencia (' + d.diferencia_metodo + ')') : ' · sin diferencia' }}</p> }
                    @if (d.nota) { <p>"{{ d.nota }}"</p> }
                  }
                  <small>{{ cuando(d.fecha) }}{{ d.creado_por_nombre ? ' · ' + d.creado_por_nombre : '' }}{{ d.vendedora ? ' · vendió ' + d.vendedora : '' }}</small>
                </span>
                <span class="der">
                  @if (d.tipo === 'devolucion' && d.reembolso) { <span class="num">−{{ pesos(d.reembolso) }}</span> }
                  @if (+d.diferencia) { <span class="num" style="color: var(--efectivo-texto)">+{{ pesos(d.diferencia) }}</span> }
                  @if (d.tipo !== 'garantia') {
                    <span class="estado" [class.danado]="d.estado_producto === 'danado'">{{ d.estado_producto === 'danado' ? 'Dañado' : 'Volvió al inventario' }}{{ d.reemplazo ? ' · se entregó otro' : '' }}</span>
                  }
                  @if (d.comision_descuento) { <small>Comisión −{{ pesos(d.comision_descuento) }}</small> }
                  @if (d.envio_pedido_id) { <span class="dom">Envío #{{ d.envio_pedido_id }} · {{ estadoEnvio(d.envio_estado) }}</span> }
                  @if (+d.domicilio) { <span class="dom">Domicilio {{ pesos(d.domicilio) }} (gasto)</span> }
                  <button type="button" class="b b-icono" (click)="$event.stopPropagation(); rotulo(d)" aria-label="Imprimir el rótulo" title="Imprimir el rótulo"><ion-icon name="print-outline"></ion-icon></button>
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

    @if (estadoDe(); as e) {
      <button class="velo" aria-label="Cerrar" (click)="estadoDe.set(null)"></button>
      <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-est">
        <div class="hoja-head"><h2 id="t-est">Garantía · #{{ e.pedido_id }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="estadoDe.set(null)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <p class="ayuda" style="margin: 0">{{ e.items }}</p>
          <div class="campo"><span class="etq">¿En qué va?</span>
            <div class="estados-g" role="radiogroup" aria-label="Estado de la garantía">
              @for (op of estadosGarantia; track op.id) {
                <button type="button" role="radio" [class.on]="eEstado() === op.id" [attr.aria-checked]="eEstado() === op.id" (click)="eEstado.set(op.id)">{{ op.label }}</button>
              }
            </div>
          </div>
          <div class="campo"><label for="ge-d">{{ eEstado() === 'en_arreglo' ? '¿Con quién está en arreglo?' : 'Detalle (opcional)' }}</label>
            <input id="ge-d" maxlength="200" [(ngModel)]="eDetalle" [placeholder]="eEstado() === 'en_arreglo' ? 'Ej: técnico Carlos, servicio técnico Samsung' : 'Ej: le falta el cargador, se entrega el viernes'" /></div>
          @if (historial().length) {
            <div class="campo"><span class="etq">Historial</span>
              <ul class="hist">
                @for (h of historial(); track $index) { <li><b>{{ h.estado }}</b>{{ h.detalle ? ' · ' + h.detalle : '' }} · {{ cuando(h.fecha) }}{{ h.autor ? ' · ' + h.autor : '' }}</li> }
              </ul>
            </div>
          }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="estadoDe.set(null)">Cancelar</button>
          <button class="b b-pri" [disabled]="guardando()" (click)="guardarEstado()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>
    }

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class DevolucionesPage {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private visor = inject(VisorService);
  private alerta = inject(GarantiasAlertaService);

  constructor() {
    addIcons({ closeOutline, printOutline });
  }

  lista = signal<Devolucion[]>([]);
  porMotivo = signal<{ motivo: string; n: number }[]>([]);
  miniaturas = signal<Record<string, string>>({});
  cargando = signal(true);
  etiqueta = signal('');
  abierto = signal<number | null>(null);
  esAdmin = computed(() => this.sb.tiene('admin'));
  pesos = pesos;
  private rango: RangoFechas | null = null;

  garantiasAbiertas = computed(() => this.lista().filter((d) => d.tipo === 'garantia' && !d.resuelta).length);
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
    if (!this.rango) void this.cargarPendientes();
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

  // Estado de la garantía
  estadosGarantia = ESTADOS_GARANTIA;
  estadoDe = signal<{ id: number; pedido_id: number; items: string } | null>(null);
  eEstado = signal('recibida');
  eDetalle = '';
  historial = signal<{ estado: string; detalle: string | null; autor: string | null; fecha: string }[]>([]);
  guardando = signal(false);

  abrirEstado(id: number, pedidoId: number, estado: string, detalle: string | null, items: string): void {
    this.eEstado.set(estado || 'recibida');
    this.eDetalle = detalle ?? '';
    this.historial.set([]);
    this.estadoDe.set({ id, pedido_id: pedidoId, items });
    void this.sb.client.rpc('garantia_historial', { p_id: id }).then(({ data }) => this.historial.set((data as never[]) ?? []));
  }

  async guardarEstado(): Promise<void> {
    const e = this.estadoDe();
    if (!e) return;
    if (this.eEstado() === 'en_arreglo' && !this.eDetalle.trim()) return this.toast.error('Escribe con quién está en arreglo');
    this.guardando.set(true);
    const { error } = await this.sb.client.rpc('garantia_estado', { p_id: e.id, p_estado: this.eEstado(), p_detalle: this.eDetalle.trim() });
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok(this.eEstado() === 'entregada' ? 'Garantía entregada: queda resuelta' : 'Estado de la garantía guardado');
    this.estadoDe.set(null);
    this.alerta.refrescar();
    await Promise.all([this.cargar(), this.cargarPendientes()]);
  }

  // Garantías sin resolver (de cualquier fecha)
  pendientes = signal<GarantiaPendiente[]>([]);
  async cargarPendientes(): Promise<void> {
    const { data } = await this.sb.client.rpc('garantias_pendientes');
    this.pendientes.set(((data as { lista?: GarantiaPendiente[] } | null)?.lista ?? []) as GarantiaPendiente[]);
  }

  itemsTxt(items: { nombre: string; cantidad: number }[] | null): string {
    return (items ?? []).map((i) => `${i.cantidad} ${i.nombre}`).join(', ');
  }

  // Rótulo y envío de la devolución, el cambio o la garantía
  async rotulo(d: Devolucion): Promise<void> {
    await this.rotuloDe(d.id, d.envio_pedido_id, d.envio_estado, Number(d.envio_total) || 0, Number(d.envio_domicilio ?? d.domicilio) || 0, {
      tipo: d.tipo, pedido_id: d.pedido_id, cliente: d.cliente, cliente_telefono: d.cliente_telefono, direccion: d.direccion, barrio: d.barrio,
      fecha: d.fecha, items: d.items, reemplazo: d.reemplazo, nuevo_nombre: d.nuevo_nombre, nuevo_cantidad: d.nuevo_cantidad,
      diferencia: d.diferencia, diferencia_metodo: d.diferencia_metodo, nota: d.nota, garantia_estado: d.garantia_estado,
    });
  }

  async rotuloPendiente(g: GarantiaPendiente): Promise<void> {
    await this.rotuloDe(g.id, g.envio_pedido_id, g.envio_estado, 0, 0, {
      tipo: 'garantia', pedido_id: g.pedido_id, cliente: g.cliente, cliente_telefono: g.cliente_telefono, direccion: g.direccion, barrio: g.barrio,
      fecha: g.fecha, items: g.items, nota: g.nota, garantia_estado: g.estado,
    });
  }

  /**
   * Si el envío de este caso todavía no se entrega, se reimprime su rótulo. Si no tiene envío
   * (o ya se entregó, como cuando hay que llevarle al cliente la garantía arreglada), se crea uno nuevo.
   */
  private async rotuloDe(id: number, envio: number | null, estadoEnvio: string | null, totalEnvio: number, domAntes: number, datos: DevolucionParaRotulo): Promise<void> {
    try {
      if (envio && estadoEnvio && !['entregado', 'cancelado'].includes(estadoEnvio)) {
        await imprimirRotuloDevolucion(this.sb.client, { ...datos, numero: envio, diferencia: totalEnvio, diferencia_metodo: totalEnvio ? 'contra_entrega' : null });
        return;
      }
      const r = prompt(
        (envio ? 'Se crea un envío nuevo para el mensajero (el anterior ya se entregó).' : 'Se crea el envío para el mensajero.') +
          '\n¿Cuánto es el domicilio? Lo paga el negocio (escribe 0 si no hay).',
        String(domAntes || 0)
      );
      if (r === null) return;
      // El deducible se cobra una sola vez: en el primer envío
      const cobrar = envio ? 0 : cobroDe(datos);
      const n = await crearEnvioDevolucion(this.sb.client, id, datos, Number(r.replace(/\D/g, '')) || 0, true, cobrar);
      this.toast.ok(`Envío #${n} creado: escanéalo en Despachar para asignárselo al mensajero`);
      await Promise.all([this.cargar(), this.cargarPendientes()]);
    } catch (e) {
      this.toast.error(mensajeError(e));
    }
  }

  estadoEnvio(e: string | null): string {
    return { por_alistar: 'por despachar', alistado: 'por despachar', despachado: 'en ruta', entregado: 'entregado', cancelado: 'cancelado' }[e ?? ''] ?? '';
  }

  fechaCorta(d: string | null): string {
    return d ? formatoFechaCO(d + 'T12:00:00-05:00', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
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
