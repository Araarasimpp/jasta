import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { downloadOutline, searchOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoFechas, diaCorto, diaLargo } from '../../shared/rango/rango.component';
import { PedidosService } from '../../core/services/pedidos.service';
import { Usuario } from '../../shared/modelos';
import { descargarExcel } from '../../shared/exportar';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, hoyColombiaISO, inicioDiaColombia } from '../../shared/fecha-colombia';

// ---------- Tipos ----------
interface FilaVendedora { nombre: string; pedidos: number; unidades: number; ventas: number; base: number; ganancia_vendedora: number; ganancia_tienda: number }
interface FilaMensajero { nombre: string; entregas: number; domicilios: number; efectivo: number; transferencia: number; total: number }
interface FilaProducto { nombre: string; unidades: number; ventas: number; costo: number; ganancia: number; ganancia_vendedora: number; ganancia_tienda: number }
interface FilaBarrio { barrio: string; pedidos: number; ventas: number; domicilios: number; ganancia_vendedora: number; ganancia_tienda: number }
interface FilaDia { dia: string; pedidos: number; ventas: number; domicilios: number; efectivo: number; transferencia: number; ganancia_vendedora: number; ganancia_tienda: number }
interface Agrupado { vendedoras: FilaVendedora[]; mensajeros: FilaMensajero[]; productos: FilaProducto[]; barrios: FilaBarrio[]; dias: FilaDia[] }

interface LineaVenta {
  id: number; pedido_id: number; created_at: string; cliente_nombre: string; barrio: string | null;
  vendedora: string | null; mensajero: string | null; producto: string; sku: string | null; cantidad: number;
  precio_venta: number; precio_base: number; precio_compra: number; total: number; costo: number;
  ganancia_tienda: number; ganancia_vendedora: number; domicilio_pedido: number; tipo_recaudo: string | null;
}
interface PedidoVenta {
  id: number; created_at: string; cliente_nombre: string; cliente_telefono: string | null; barrio: string | null;
  vendedora: string | null; mensajero: string | null; productos: string; unidades: number; subtotal: number;
  domicilio: number; total: number; costo: number; ganancia_tienda: number; ganancia_vendedora: number;
  tipo_recaudo: string | null; valor_efectivo: number | null; valor_transferencia: number | null;
}

type Pestana = 'detalle' | 'pedidos' | 'vendedoras' | 'productos' | 'mensajeros' | 'barrios' | 'dias';

const POR_PAGINA = 100;
const suma = <T>(filas: T[], f: (x: T) => number) => filas.reduce((a, x) => a + Number(f(x) || 0), 0);
const PAGO: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', mixto: 'Mixto' };
type EstadoFiltro = 'entregado' | 'por_alistar' | 'alistado' | 'despachado' | 'cancelado' | 'todos';
const ESTADOS: { id: EstadoFiltro; label: string }[] = [
  { id: 'entregado', label: 'Entregados' },
  { id: 'por_alistar', label: 'Por alistar' },
  { id: 'alistado', label: 'Alistados' },
  { id: 'despachado', label: 'En ruta' },
  { id: 'cancelado', label: 'Cancelados' },
  { id: 'todos', label: 'Todos los estados' },
];

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [FormsModule, IonIcon, PedidoDetalleComponent],
  styles: [
    `
      .periodo { margin: 0 0 0 auto; font-size: 13px; color: var(--text-soft); }
      .periodo::first-letter { text-transform: uppercase; }
      .pestanas { padding: 12px 20px 0; border-bottom: 1px solid var(--border-soft); }
      .pestanas .chips { padding-bottom: 10px; }
      .filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 20px; border-bottom: 1px solid var(--border-soft); }
      .filtros select { width: auto; min-width: 180px; }
      .filtros-rep { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
      .filtros-rep label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-soft); }
      .filtros-rep input { width: 150px; }
      .filtros-rep select { width: auto; min-width: 170px; }
      @media (max-width: 760px) {
        .filtros-rep { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
        .filtros-rep input, .filtros-rep select { width: 100%; min-width: 0; }
      }
      .tabla td, .tabla th { white-space: nowrap; }
      .tabla td.texto { white-space: normal; min-width: 180px; max-width: 320px; line-height: 1.35; }
      .tabla td.texto small { display: block; color: var(--text-muted); font-size: 12px; }
      .tabla tfoot td { font-weight: 650; background: var(--surface); border-top: 1px solid var(--text); border-bottom: none; }
      .tabla .tienda { color: var(--efectivo-texto); }
      .tabla .vende { color: var(--accent); }
      .tabla .neg { color: var(--danger); }
      .nota { margin: 0; padding: 12px 20px 24px; font-size: 12px; line-height: 1.5; color: var(--text-muted); }
      @media (max-width: 760px) {
        .pestanas, .filtros { padding-left: 14px; padding-right: 14px; }
        .periodo { margin: 0; width: 100%; }
        .nota { padding: 12px 14px 24px; }
      }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>{{ veTodo() ? 'Reportes' : 'Mis ventas' }}</h1>
        <button class="b" (click)="exportar()" [disabled]="exportando() || !rango">
          <ion-icon name="download-outline"></ion-icon>{{ exportando() ? 'Preparando…' : 'Descargar Excel' }}
        </button>
      </div>

      <div class="barra">
        <div class="filtros-rep">
          <label>Desde<input class="inp inp-chico num" type="date" [(ngModel)]="desde" [max]="hoy" (change)="aplicar()" /></label>
          <label>Hasta<input class="inp inp-chico num" type="date" [(ngModel)]="hasta" [max]="hoy" (change)="aplicar()" /></label>
          @if (veTodo()) {
            <label>Vendedora
              <select class="inp inp-chico" [(ngModel)]="vendedoraSel" (ngModelChange)="aplicar()">
                <option [ngValue]="null">Todas las vendedoras</option>
                @for (v of vendedoras(); track v.id) {
                  <option [ngValue]="v.id">{{ v.nombre }}{{ v.activo ? '' : ' (inactiva)' }}</option>
                }
              </select>
            </label>
          }
          <label>Estado del pedido
            <select class="inp inp-chico" [(ngModel)]="estadoSel" (ngModelChange)="aplicar()">
              @for (e of estados; track e.id) {
                <option [ngValue]="e.id">{{ e.label }}</option>
              }
            </select>
          </label>
        </div>
        <p class="periodo">{{ etiqueta() }} · {{ etiquetaEstado() }}</p>
      </div>

      <div class="pestanas">
        <div class="chips">
          @for (p of pestanasVisibles(); track p.id) {
            <button class="chip" [class.on]="pestana() === p.id" (click)="cambiarPestana(p.id)">{{ p.label }}</button>
          }
        </div>
      </div>

      @if (pestana() === 'detalle' || pestana() === 'pedidos') {
        <div class="filtros">
          <label class="buscar">
            <ion-icon name="search-outline"></ion-icon>
            <input type="search" [placeholder]="pestana() === 'detalle' ? 'Producto, cliente o pedido' : 'Cliente, barrio o pedido'"
              [(ngModel)]="texto" (ngModelChange)="buscarLuego()" />
          </label>
          <span class="suave num" style="font-size: 13px; margin-left: auto">{{ numero(totalFilas()) }} {{ pestana() === 'detalle' ? 'líneas' : 'pedidos' }}</span>
        </div>
      }

      <div class="tabla-wrap">
        @switch (pestana()) {
          @case ('detalle') {
            <table class="tabla">
              <thead>
                <tr>
                  <th>Fecha</th><th>Pedido</th><th>Producto</th><th class="der">Cant.</th>
                  <th class="der">P. venta</th>
                  @if (veTodo()) { <th class="der">P. base</th><th class="der">P. compra</th> } @else { <th class="der">P. base</th> }
                  <th class="der">Total</th>
                  @if (veTodo()) { <th class="der">Ganancia tienda</th> }
                  <th class="der">Ganancia vendedora</th>
                  @if (veTodo()) { <th>Vendedora</th> }
                  <th>Cliente</th><th class="der">Domicilio</th><th>Mensajero</th><th>Pago</th>
                </tr>
              </thead>
              <tbody>
                @for (l of lineas(); track l.id) {
                  <tr>
                    <td class="suave">{{ fecha(l.created_at) }}</td>
                    <td><a class="guia" (click)="abierto.set(l.pedido_id)">#{{ l.pedido_id }}</a></td>
                    <td class="texto">{{ l.producto }}@if (l.sku) {<small>{{ l.sku }}</small>}</td>
                    <td class="der num">{{ l.cantidad }}</td>
                    <td class="der num">{{ pesos(l.precio_venta) }}</td>
                    <td class="der num suave">{{ pesos(l.precio_base) }}</td>
                    @if (veTodo()) { <td class="der num suave">{{ pesos(l.precio_compra) }}</td> }
                    <td class="der num">{{ pesos(l.total) }}</td>
                    @if (veTodo()) { <td class="der num tienda" [class.neg]="l.ganancia_tienda < 0">{{ pesos(l.ganancia_tienda) }}</td> }
                    <td class="der num vende" [class.neg]="l.ganancia_vendedora < 0">{{ pesos(l.ganancia_vendedora) }}</td>
                    @if (veTodo()) { <td>{{ l.vendedora || '—' }}</td> }
                    <td class="texto">{{ l.cliente_nombre }}<small>{{ l.barrio || '' }}</small></td>
                    <td class="der num suave">{{ pesos(l.domicilio_pedido) }}</td>
                    <td>{{ l.mensajero || '—' }}</td>
                    <td class="suave">{{ pago(l.tipo_recaudo) }}</td>
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="15" class="suave">{{ cargandoFilas() ? 'Cargando…' : 'No hay ventas con estos filtros.' }}</td></tr>
                }
              </tbody>
              @if (lineas().length && sumas(); as s) {
                <tfoot>
                  <tr>
                    <td>Total</td><td class="num">{{ numero(s['filas']) }} lín.</td><td></td>
                    <td class="der num">{{ numero(s['cantidad']) }}</td>
                    <td></td><td></td>@if (veTodo()) { <td></td> }
                    <td class="der num">{{ pesos(s['total']) }}</td>
                    @if (veTodo()) { <td class="der num">{{ pesos(s['ganancia_tienda']) }}</td> }
                    <td class="der num">{{ pesos(s['ganancia_vendedora']) }}</td>
                    @if (veTodo()) { <td></td> }
                    <td></td><td class="der num">{{ pesos(s['domicilio']) }}</td><td></td><td></td>
                  </tr>
                </tfoot>
              }
            </table>
          }
          @case ('pedidos') {
            <table class="tabla">
              <thead>
                <tr>
                  <th>Fecha</th><th>Pedido</th><th>Cliente</th><th>Productos</th><th class="der">Und.</th>
                  <th class="der">Productos $</th><th class="der">Domicilio</th><th class="der">Total cobrado</th>
                  @if (veTodo()) { <th class="der">Costo</th><th class="der">Ganancia tienda</th> }
                  <th class="der">Ganancia vendedora</th>
                  @if (veTodo()) { <th>Vendedora</th> }
                  <th>Mensajero</th><th>Pago</th><th class="der">Efectivo</th><th class="der">Transferencia</th>
                </tr>
              </thead>
              <tbody>
                @for (p of pedidosV(); track p.id) {
                  <tr>
                    <td class="suave">{{ fecha(p.created_at) }}</td>
                    <td><a class="guia" (click)="abierto.set(p.id)">#{{ p.id }}</a></td>
                    <td class="texto">{{ p.cliente_nombre }}<small>{{ p.barrio || '' }}</small></td>
                    <td class="texto">{{ p.productos }}</td>
                    <td class="der num">{{ p.unidades }}</td>
                    <td class="der num">{{ pesos(p.subtotal) }}</td>
                    <td class="der num">{{ pesos(p.domicilio) }}</td>
                    <td class="der num">{{ pesos(p.total) }}</td>
                    @if (veTodo()) {
                      <td class="der num suave">{{ pesos(p.costo) }}</td>
                      <td class="der num tienda">{{ pesos(p.ganancia_tienda) }}</td>
                    }
                    <td class="der num vende">{{ pesos(p.ganancia_vendedora) }}</td>
                    @if (veTodo()) { <td>{{ p.vendedora || '—' }}</td> }
                    <td>{{ p.mensajero || '—' }}</td>
                    <td class="suave">{{ pago(p.tipo_recaudo) }}</td>
                    <td class="der num">{{ p.tipo_recaudo ? pesos(p.valor_efectivo) : '—' }}</td>
                    <td class="der num">{{ p.tipo_recaudo ? pesos(p.valor_transferencia) : '—' }}</td>
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="16" class="suave">{{ cargandoFilas() ? 'Cargando…' : 'No hay pedidos con estos filtros.' }}</td></tr>
                }
              </tbody>
              @if (pedidosV().length && sumas(); as s) {
                <tfoot>
                  <tr>
                    <td>Total</td><td class="num">{{ numero(s['filas']) }} ped.</td><td></td><td></td>
                    <td class="der num">{{ numero(s['unidades']) }}</td>
                    <td class="der num">{{ pesos(s['subtotal']) }}</td>
                    <td class="der num">{{ pesos(s['domicilio']) }}</td>
                    <td class="der num">{{ pesos(s['total']) }}</td>
                    @if (veTodo()) { <td class="der num">{{ pesos(s['costo']) }}</td><td class="der num">{{ pesos(s['ganancia_tienda']) }}</td> }
                    <td class="der num">{{ pesos(s['ganancia_vendedora']) }}</td>
                    @if (veTodo()) { <td></td> }
                    <td></td><td></td>
                    <td class="der num">{{ pesos(s['efectivo']) }}</td>
                    <td class="der num">{{ pesos(s['transferencia']) }}</td>
                  </tr>
                </tfoot>
              }
            </table>
          }
          @case ('vendedoras') {
            <table class="tabla">
              <thead><tr><th>Vendedora</th><th class="der">Pedidos</th><th class="der">Unidades</th><th class="der">Ventas</th>
                <th class="der">Total a precio base</th><th class="der">Ganancia vendedora</th><th class="der">Ganancia tienda</th></tr></thead>
              <tbody>
                @for (f of agrupado()?.vendedoras ?? []; track f.nombre) {
                  <tr><td>{{ f.nombre }}</td><td class="der num">{{ numero(f.pedidos) }}</td><td class="der num">{{ numero(f.unidades) }}</td>
                    <td class="der num">{{ pesos(f.ventas) }}</td><td class="der num suave">{{ pesos(f.base) }}</td>
                    <td class="der num vende">{{ pesos(f.ganancia_vendedora) }}</td><td class="der num tienda">{{ pesos(f.ganancia_tienda) }}</td></tr>
                } @empty { <tr><td colspan="7" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (agrupado()?.vendedoras?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().vPedidos) }}</td><td class="der num">{{ numero(tot().vUnidades) }}</td>
                  <td class="der num">{{ pesos(tot().vVentas) }}</td><td class="der num">{{ pesos(tot().vBase) }}</td>
                  <td class="der num">{{ pesos(tot().vGanV) }}</td><td class="der num">{{ pesos(tot().vGanT) }}</td></tr></tfoot>
              }
            </table>
          }
          @case ('productos') {
            <table class="tabla">
              <thead><tr><th>Producto</th><th class="der">Unidades</th><th class="der">Ventas</th>
                @if (veTodo()) { <th class="der">Costo</th> }<th class="der">Ganancia vendedora</th>
                @if (veTodo()) { <th class="der">Ganancia tienda</th><th class="der">Ganancia total</th> }</tr></thead>
              <tbody>
                @for (f of agrupado()?.productos ?? []; track f.nombre) {
                  <tr><td class="texto">{{ f.nombre }}</td><td class="der num">{{ numero(f.unidades) }}</td><td class="der num">{{ pesos(f.ventas) }}</td>
                    @if (veTodo()) { <td class="der num suave">{{ pesos(f.costo) }}</td> }
                    <td class="der num vende" [class.neg]="f.ganancia_vendedora < 0">{{ pesos(f.ganancia_vendedora) }}</td>
                    @if (veTodo()) { <td class="der num tienda" [class.neg]="f.ganancia_tienda < 0">{{ pesos(f.ganancia_tienda) }}</td><td class="der num">{{ pesos(f.ganancia) }}</td> }</tr>
                } @empty { <tr><td colspan="7" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (agrupado()?.productos?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().pUnidades) }}</td><td class="der num">{{ pesos(tot().pVentas) }}</td>
                  @if (veTodo()) { <td class="der num">{{ pesos(tot().pCosto) }}</td> }<td class="der num">{{ pesos(tot().pGanV) }}</td>
                  @if (veTodo()) { <td class="der num">{{ pesos(tot().pGanT) }}</td><td class="der num">{{ pesos(tot().pGan) }}</td> }</tr></tfoot>
              }
            </table>
          }
          @case ('mensajeros') {
            <table class="tabla">
              <thead><tr><th>Mensajero</th><th class="der">Entregas</th><th class="der">Domicilios (su pago)</th><th class="der">Efectivo</th>
                <th class="der">Transferencias</th><th class="der">Total cobrado</th></tr></thead>
              <tbody>
                @for (f of agrupado()?.mensajeros ?? []; track f.nombre) {
                  <tr><td>{{ f.nombre }}</td><td class="der num">{{ numero(f.entregas) }}</td><td class="der num vende">{{ pesos(f.domicilios) }}</td>
                    <td class="der num">{{ pesos(f.efectivo) }}</td><td class="der num">{{ pesos(f.transferencia) }}</td><td class="der num">{{ pesos(f.total) }}</td></tr>
                } @empty { <tr><td colspan="6" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (agrupado()?.mensajeros?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().mEntregas) }}</td><td class="der num">{{ pesos(tot().mDom) }}</td>
                  <td class="der num">{{ pesos(tot().mEf) }}</td><td class="der num">{{ pesos(tot().mTr) }}</td><td class="der num">{{ pesos(tot().mTotal) }}</td></tr></tfoot>
              }
            </table>
          }
          @case ('barrios') {
            <table class="tabla">
              <thead><tr><th>Barrio</th><th class="der">Pedidos</th><th class="der">Ventas</th><th class="der">Domicilios</th>
                <th class="der">Ganancia vendedora</th>@if (veTodo()) { <th class="der">Ganancia tienda</th> }</tr></thead>
              <tbody>
                @for (f of agrupado()?.barrios ?? []; track f.barrio) {
                  <tr><td>{{ f.barrio }}</td><td class="der num">{{ numero(f.pedidos) }}</td><td class="der num">{{ pesos(f.ventas) }}</td><td class="der num">{{ pesos(f.domicilios) }}</td>
                    <td class="der num vende">{{ pesos(f.ganancia_vendedora) }}</td>@if (veTodo()) { <td class="der num tienda">{{ pesos(f.ganancia_tienda) }}</td> }</tr>
                } @empty { <tr><td colspan="6" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (agrupado()?.barrios?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().bPedidos) }}</td><td class="der num">{{ pesos(tot().bVentas) }}</td>
                  <td class="der num">{{ pesos(tot().bDom) }}</td><td class="der num">{{ pesos(tot().bGanV) }}</td>
                  @if (veTodo()) { <td class="der num">{{ pesos(tot().bGanT) }}</td> }</tr></tfoot>
              }
            </table>
          }
          @case ('dias') {
            <table class="tabla">
              <thead><tr><th>Día</th><th class="der">Pedidos</th><th class="der">Ventas</th><th class="der">Domicilios</th>
                @if (veTodo()) { <th class="der">Efectivo</th><th class="der">Transferencias</th> }
                <th class="der">Ganancia vendedora</th>@if (veTodo()) { <th class="der">Ganancia tienda</th> }</tr></thead>
              <tbody>
                @for (f of agrupado()?.dias ?? []; track f.dia) {
                  <tr><td>{{ diaCorto(f.dia) }}</td><td class="der num">{{ numero(f.pedidos) }}</td><td class="der num">{{ pesos(f.ventas) }}</td>
                    <td class="der num">{{ pesos(f.domicilios) }}</td>
                    @if (veTodo()) { <td class="der num">{{ pesos(f.efectivo) }}</td><td class="der num">{{ pesos(f.transferencia) }}</td> }
                    <td class="der num vende">{{ pesos(f.ganancia_vendedora) }}</td>@if (veTodo()) { <td class="der num tienda">{{ pesos(f.ganancia_tienda) }}</td> }</tr>
                } @empty { <tr><td colspan="8" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (agrupado()?.dias?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().dPedidos) }}</td><td class="der num">{{ pesos(tot().dVentas) }}</td>
                  <td class="der num">{{ pesos(tot().dDom) }}</td>
                  @if (veTodo()) { <td class="der num">{{ pesos(tot().dEf) }}</td><td class="der num">{{ pesos(tot().dTr) }}</td> }
                  <td class="der num">{{ pesos(tot().dGanV) }}</td>@if (veTodo()) { <td class="der num">{{ pesos(tot().dGanT) }}</td> }</tr></tfoot>
              }
            </table>
          }
        }
      </div>

      @if ((pestana() === 'detalle' || pestana() === 'pedidos') && totalFilas() > porPagina) {
        <div class="paginar">
          <span class="num">{{ pagina() * porPagina + 1 }}–{{ min((pagina() + 1) * porPagina, totalFilas()) }} de {{ numero(totalFilas()) }}</span>
          <span style="display: flex; gap: 8px">
            <button class="b" [disabled]="pagina() === 0" (click)="irPagina(pagina() - 1)">Anterior</button>
            <button class="b" [disabled]="(pagina() + 1) * porPagina >= totalFilas()" (click)="irPagina(pagina() + 1)">Siguiente</button>
          </span>
        </div>
      }

      <p class="nota">
        Cuentan los pedidos del estado elegido (por defecto <strong>entregados</strong>), según la fecha en que se crearon.
        Ganancia tienda = (precio base − precio de compra) × cantidad. Ganancia vendedora = (precio de venta − precio base) × cantidad; en las ventas del local se le descuenta el aporte al servicio local.
        El domicilio lo cobra el mensajero y no entra en las ganancias. "Descargar Excel" baja la pestaña que estás viendo, completa.
      </p>
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)"></app-pedido-detalle>
    }
  `,
})
export class ReportesPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private ps = inject(PedidosService);

  readonly porPagina = POR_PAGINA;
  veTodo = computed(() => this.sb.tiene('admin', 'cuadres'));
  private pestanas: { id: Pestana; label: string; todo?: boolean }[] = [
    { id: 'detalle', label: 'Productos vendidos' },
    { id: 'pedidos', label: 'Pedidos' },
    { id: 'vendedoras', label: 'Por vendedora', todo: true },
    { id: 'productos', label: 'Por producto' },
    { id: 'mensajeros', label: 'Por mensajero', todo: true },
    { id: 'barrios', label: 'Por barrio', todo: true },
    { id: 'dias', label: 'Por día' },
  ];
  pestanasVisibles = computed(() => this.pestanas.filter((p) => this.veTodo() || !p.todo));

  pestana = signal<Pestana>('detalle');
  etiqueta = signal('');
  agrupado = signal<Agrupado | null>(null);
  cargando = signal(true);
  lineas = signal<LineaVenta[]>([]);
  pedidosV = signal<PedidoVenta[]>([]);
  /** Sumas de todas las filas filtradas (no solo de la página que se ve) */
  sumas = signal<Record<string, number> | null>(null);
  totalFilas = signal(0);
  pagina = signal(0);
  cargandoFilas = signal(false);
  exportando = signal(false);
  abierto = signal<number | null>(null);
  texto = '';
  vendedoraSel: number | null = null;
  estadoSel: EstadoFiltro = 'entregado';
  readonly estados = ESTADOS;
  readonly hoy = hoyColombiaISO();
  desde = this.hoy;
  hasta = this.hoy;
  vendedoras = signal<Usuario[]>([]);
  etiquetaEstado = signal('pedidos entregados');
  rango: RangoFechas | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  pesos = pesos;
  numero = numero;
  diaCorto = diaCorto;
  min = Math.min;

  tot = computed(() => {
    const d = this.agrupado() ?? { vendedoras: [], mensajeros: [], productos: [], barrios: [], dias: [] };
    return {
      vPedidos: suma(d.vendedoras, (x) => x.pedidos), vUnidades: suma(d.vendedoras, (x) => x.unidades),
      vVentas: suma(d.vendedoras, (x) => x.ventas), vBase: suma(d.vendedoras, (x) => x.base),
      vGanV: suma(d.vendedoras, (x) => x.ganancia_vendedora), vGanT: suma(d.vendedoras, (x) => x.ganancia_tienda),
      mEntregas: suma(d.mensajeros, (x) => x.entregas), mDom: suma(d.mensajeros, (x) => x.domicilios),
      mEf: suma(d.mensajeros, (x) => x.efectivo), mTr: suma(d.mensajeros, (x) => x.transferencia), mTotal: suma(d.mensajeros, (x) => x.total),
      pUnidades: suma(d.productos, (x) => x.unidades), pVentas: suma(d.productos, (x) => x.ventas),
      pCosto: suma(d.productos, (x) => x.costo), pGan: suma(d.productos, (x) => x.ganancia),
      pGanV: suma(d.productos, (x) => x.ganancia_vendedora), pGanT: suma(d.productos, (x) => x.ganancia_tienda),
      bPedidos: suma(d.barrios, (x) => x.pedidos), bVentas: suma(d.barrios, (x) => x.ventas), bDom: suma(d.barrios, (x) => x.domicilios),
      bGanV: suma(d.barrios, (x) => x.ganancia_vendedora), bGanT: suma(d.barrios, (x) => x.ganancia_tienda),
      dPedidos: suma(d.dias, (x) => x.pedidos), dVentas: suma(d.dias, (x) => x.ventas), dDom: suma(d.dias, (x) => x.domicilios),
      dEf: suma(d.dias, (x) => x.efectivo), dTr: suma(d.dias, (x) => x.transferencia),
      dGanV: suma(d.dias, (x) => x.ganancia_vendedora), dGanT: suma(d.dias, (x) => x.ganancia_tienda),
    };
  });

  constructor() {
    addIcons({ downloadOutline, searchOutline });
  }

  ngOnInit(): void {
    if (this.veTodo()) this.ps.vendedoras().then((v) => this.vendedoras.set(v)).catch(() => undefined);
    void this.aplicar();
  }

  vacio(): string {
    return this.cargando() ? 'Cargando…' : 'No hay pedidos con estos filtros.';
  }

  /** Aplica los filtros de fecha, vendedora y estado */
  async aplicar(): Promise<void> {
    if (!this.desde || !this.hasta) return;
    if (this.desde > this.hasta) [this.desde, this.hasta] = [this.hasta, this.desde];
    const r: RangoFechas = {
      desde: this.desde,
      hasta: this.hasta,
      etiqueta: this.desde === this.hasta ? diaLargo(this.desde) : `${diaLargo(this.desde)} – ${diaLargo(this.hasta)}`,
    };
    this.rango = r;
    this.etiqueta.set(r.etiqueta);
    const est = ESTADOS.find((e) => e.id === this.estadoSel)!;
    this.etiquetaEstado.set(est.id === 'todos' ? 'todos los estados' : 'pedidos ' + est.label.toLowerCase());
    this.cargando.set(true);
    this.pagina.set(0);
    void this.cargarFilas();
    const args = { p_desde: r.desde, p_hasta: r.hasta, p_estado: this.estadoSel, p_vendedora: this.vendedoraSel };
    const a = await this.sb.client.rpc('reporte_filtrado', args);
    // Si mientras tanto cambiaron los filtros, esta respuesta ya no sirve
    if (this.rango !== r) return;
    this.cargando.set(false);
    if (a.error) return this.toast.error(mensajeError(a.error));
    this.agrupado.set(a.data as Agrupado);
  }

  cambiarPestana(p: Pestana): void {
    this.pestana.set(p);
    if (p === 'detalle' || p === 'pedidos') this.irPagina(0);
  }

  irPagina(n: number): void {
    this.pagina.set(n);
    void this.cargarFilas();
  }

  buscarLuego(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.irPagina(0), 350);
  }

  /** Consulta base de las pestañas línea por línea, con los filtros puestos */
  private consulta(vista: 'ventas_detalle' | 'ventas_pedidos', conteo: boolean) {
    const r = this.rango!;
    let q = this.sb.client
      .from(vista)
      .select('*', conteo ? { count: 'exact' } : undefined)
      .gte('created_at', inicioDiaColombia(r.desde).toISOString())
      .lte('created_at', finDiaColombia(r.hasta).toISOString());
    if (this.estadoSel !== 'todos') q = q.eq('estado', this.estadoSel);
    if (this.vendedoraSel) q = q.eq('vendedora_id', this.vendedoraSel);
    const t = this.textoLimpio();
    if (t) {
      const idCol = vista === 'ventas_detalle' ? 'pedido_id' : 'id';
      if (/^\d+$/.test(t)) q = q.eq(idCol, Number(t));
      else if (vista === 'ventas_detalle') q = q.or(`producto.ilike.%${t}%,cliente_nombre.ilike.%${t}%,sku.ilike.%${t}%`);
      else q = q.or(`cliente_nombre.ilike.%${t}%,barrio.ilike.%${t}%,productos.ilike.%${t}%`);
    }
    return q;
  }

  /** El texto de búsqueda sin los caracteres que rompen el filtro */
  private textoLimpio(): string {
    return this.texto.trim().replace(/[,()%]/g, ' ').trim();
  }

  async cargarFilas(): Promise<void> {
    const p = this.pestana();
    if (!this.rango || (p !== 'detalle' && p !== 'pedidos')) return;
    this.cargandoFilas.set(true);
    const vista = p === 'detalle' ? 'ventas_detalle' : 'ventas_pedidos';
    const desde = this.pagina() * POR_PAGINA;
    const rango = this.rango;
    const [r, sumas] = await Promise.all([
      this.consulta(vista, true)
        .order('created_at', { ascending: false })
        .order(p === 'detalle' ? 'pedido_id' : 'id', { ascending: false })
        .range(desde, desde + POR_PAGINA - 1),
      this.sb.client.rpc(p === 'detalle' ? 'sumas_ventas_detalle' : 'sumas_ventas_pedidos', {
        p_desde: inicioDiaColombia(rango.desde).toISOString(),
        p_hasta: finDiaColombia(rango.hasta).toISOString(),
        p_estado: this.estadoSel,
        p_vendedora: this.vendedoraSel,
        p_texto: this.textoLimpio(),
      }),
    ]);
    // Si mientras tanto cambió la pestaña o los filtros, esta respuesta ya no sirve
    if (this.rango !== rango || this.pestana() !== p) return;
    this.cargandoFilas.set(false);
    if (r.error) return this.toast.error(mensajeError(r.error));
    this.sumas.set(sumas.error ? null : (sumas.data as Record<string, number>));
    this.totalFilas.set(r.count ?? 0);
    if (p === 'detalle') this.lineas.set((r.data ?? []) as LineaVenta[]);
    else this.pedidosV.set((r.data ?? []) as PedidoVenta[]);
  }

  /** Trae todas las filas (de a 1000) para exportar */
  private async todas<T>(vista: 'ventas_detalle' | 'ventas_pedidos'): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < 50; i++) {
      const r = await this.consulta(vista, false).order('created_at').range(i * 1000, i * 1000 + 999);
      if (r.error) throw r.error;
      out.push(...((r.data ?? []) as T[]));
      if ((r.data ?? []).length < 1000) break;
    }
    return out;
  }

  async exportar(): Promise<void> {
    const r = this.rango;
    if (!r) return;
    const sufijo = r.desde === r.hasta ? r.desde : `${r.desde}_a_${r.hasta}`;
    const todo = this.veTodo();
    const a = this.agrupado();
    this.exportando.set(true);
    try {
      switch (this.pestana()) {
        case 'detalle': {
          const filas = await this.todas<LineaVenta>('ventas_detalle');
          descargarExcel(`productos_vendidos_${sufijo}`, [
            { titulo: 'Fecha', valor: (f: LineaVenta) => this.fechaExcel(f.created_at) },
            { titulo: 'Pedido', valor: (f) => f.pedido_id },
            { titulo: 'Producto', valor: (f) => f.producto },
            { titulo: 'SKU', valor: (f) => f.sku },
            { titulo: 'Cantidad', valor: (f) => f.cantidad },
            { titulo: 'Precio venta', valor: (f) => f.precio_venta },
            { titulo: 'Precio base', valor: (f) => f.precio_base },
            ...(todo ? [{ titulo: 'Precio compra', valor: (f: LineaVenta) => f.precio_compra }] : []),
            { titulo: 'Total', valor: (f) => f.total },
            ...(todo
              ? [{ titulo: 'Costo', valor: (f: LineaVenta) => f.costo }, { titulo: 'Ganancia tienda', valor: (f: LineaVenta) => f.ganancia_tienda }]
              : []),
            { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
            { titulo: 'Vendedora', valor: (f) => f.vendedora },
            { titulo: 'Cliente', valor: (f) => f.cliente_nombre },
            { titulo: 'Barrio', valor: (f) => f.barrio },
            { titulo: 'Domicilio del pedido', valor: (f) => f.domicilio_pedido },
            { titulo: 'Mensajero', valor: (f) => f.mensajero },
            { titulo: 'Pago', valor: (f) => this.pago(f.tipo_recaudo) },
          ], filas);
          break;
        }
        case 'pedidos': {
          const filas = await this.todas<PedidoVenta>('ventas_pedidos');
          descargarExcel(`pedidos_${sufijo}`, [
            { titulo: 'Fecha', valor: (f: PedidoVenta) => this.fechaExcel(f.created_at) },
            { titulo: 'Pedido', valor: (f) => f.id },
            { titulo: 'Cliente', valor: (f) => f.cliente_nombre },
            { titulo: 'Teléfono', valor: (f) => f.cliente_telefono },
            { titulo: 'Barrio', valor: (f) => f.barrio },
            { titulo: 'Productos', valor: (f) => f.productos },
            { titulo: 'Unidades', valor: (f) => f.unidades },
            { titulo: 'Valor productos', valor: (f) => f.subtotal },
            { titulo: 'Domicilio', valor: (f) => f.domicilio },
            { titulo: 'Total cobrado', valor: (f) => f.total },
            ...(todo
              ? [{ titulo: 'Costo', valor: (f: PedidoVenta) => f.costo }, { titulo: 'Ganancia tienda', valor: (f: PedidoVenta) => f.ganancia_tienda }]
              : []),
            { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
            { titulo: 'Vendedora', valor: (f) => f.vendedora },
            { titulo: 'Mensajero', valor: (f) => f.mensajero },
            { titulo: 'Pago', valor: (f) => this.pago(f.tipo_recaudo) },
            { titulo: 'Efectivo', valor: (f) => f.valor_efectivo },
            { titulo: 'Transferencia', valor: (f) => f.valor_transferencia },
          ], filas);
          break;
        }
        case 'vendedoras':
          descargarExcel(`vendedoras_${sufijo}`, [
            { titulo: 'Vendedora', valor: (f: FilaVendedora) => f.nombre },
            { titulo: 'Pedidos', valor: (f) => f.pedidos },
            { titulo: 'Unidades', valor: (f) => f.unidades },
            { titulo: 'Ventas', valor: (f) => f.ventas },
            { titulo: 'Total a precio base', valor: (f) => f.base },
            { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
            { titulo: 'Ganancia tienda', valor: (f) => f.ganancia_tienda },
          ], a?.vendedoras ?? []);
          break;
        case 'productos':
          descargarExcel(`por_producto_${sufijo}`, [
            { titulo: 'Producto', valor: (f: FilaProducto) => f.nombre },
            { titulo: 'Unidades', valor: (f) => f.unidades },
            { titulo: 'Ventas', valor: (f) => f.ventas },
            ...(todo ? [{ titulo: 'Costo', valor: (f: FilaProducto) => f.costo }] : []),
            { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
            ...(todo
              ? [{ titulo: 'Ganancia tienda', valor: (f: FilaProducto) => f.ganancia_tienda }, { titulo: 'Ganancia total', valor: (f: FilaProducto) => f.ganancia }]
              : []),
          ], a?.productos ?? []);
          break;
        case 'mensajeros':
          descargarExcel(`mensajeros_${sufijo}`, [
            { titulo: 'Mensajero', valor: (f: FilaMensajero) => f.nombre },
            { titulo: 'Entregas', valor: (f) => f.entregas },
            { titulo: 'Domicilios', valor: (f) => f.domicilios },
            { titulo: 'Efectivo', valor: (f) => f.efectivo },
            { titulo: 'Transferencias', valor: (f) => f.transferencia },
            { titulo: 'Total cobrado', valor: (f) => f.total },
          ], a?.mensajeros ?? []);
          break;
        case 'barrios':
          descargarExcel(`barrios_${sufijo}`, [
            { titulo: 'Barrio', valor: (f: FilaBarrio) => f.barrio },
            { titulo: 'Pedidos', valor: (f) => f.pedidos },
            { titulo: 'Ventas', valor: (f) => f.ventas },
            { titulo: 'Domicilios', valor: (f) => f.domicilios },
            { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
            ...(todo ? [{ titulo: 'Ganancia tienda', valor: (f: FilaBarrio) => f.ganancia_tienda }] : []),
          ], a?.barrios ?? []);
          break;
        case 'dias':
          descargarExcel(`por_dia_${sufijo}`, [
            { titulo: 'Día', valor: (f: FilaDia) => f.dia },
            { titulo: 'Pedidos', valor: (f) => f.pedidos },
            { titulo: 'Ventas', valor: (f) => f.ventas },
            { titulo: 'Domicilios', valor: (f) => f.domicilios },
            ...(todo
              ? [{ titulo: 'Efectivo', valor: (f: FilaDia) => f.efectivo }, { titulo: 'Transferencias', valor: (f: FilaDia) => f.transferencia }]
              : []),
            { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
            ...(todo ? [{ titulo: 'Ganancia tienda', valor: (f: FilaDia) => f.ganancia_tienda }] : []),
          ], a?.dias ?? []);
          break;
      }
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.exportando.set(false);
    }
  }

  pago(t: string | null): string {
    return t ? (PAGO[t] ?? t) : '—';
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }

  fechaExcel(iso: string): string {
    return new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Bogota' }).slice(0, 16);
  }
}
