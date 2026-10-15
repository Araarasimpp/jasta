import { Component, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { downloadOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RangoComponent, RangoFechas, diaCorto } from '../../shared/rango/rango.component';
import { descargarCsv } from '../../shared/exportar';
import { mensajeError, numero, pesos } from '../../shared/formato';

interface FilaVendedora { nombre: string; pedidos: number; unidades: number; ventas: number; base: number; ganancia_vendedora: number; ganancia_tienda: number }
interface FilaMensajero { nombre: string; entregas: number; domicilios: number; efectivo: number; transferencia: number; total: number }
interface FilaProducto { nombre: string; unidades: number; ventas: number; costo: number; ganancia: number }
interface FilaBarrio { barrio: string; pedidos: number; ventas: number; domicilios: number }
interface FilaDia { dia: string; pedidos: number; ventas: number; domicilios: number; efectivo: number; transferencia: number }
interface Reporte { vendedoras: FilaVendedora[]; mensajeros: FilaMensajero[]; productos: FilaProducto[]; barrios: FilaBarrio[]; dias: FilaDia[] }

type Pestana = 'vendedoras' | 'mensajeros' | 'productos' | 'barrios' | 'dias';

const suma = <T>(filas: T[], f: (x: T) => number) => filas.reduce((a, x) => a + Number(f(x) || 0), 0);

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [IonIcon, RangoComponent],
  styles: [
    `
      .periodo { margin: 0; font-size: 13px; color: var(--text-soft); }
      .periodo::first-letter { text-transform: uppercase; }
      tfoot td { font-weight: 600; border-top: 1px solid var(--border); background: var(--surface-2); }
      .resaltar { color: var(--accent); font-weight: 500; }
      .kpis-v { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
      .kpis-v div { display: flex; flex-direction: column; gap: 3px; padding: 14px 16px; }
      .kpis-v div + div { border-left: 1px solid var(--border); }
      .kpis-v small { font-size: 12px; color: var(--text-soft); }
      .kpis-v strong { font-size: 20px; font-weight: 600; }
      .kpis-v .clave strong { color: var(--accent); }
      @media (max-width: 640px) { .kpis-v strong { font-size: 16px; } .kpis-v div { padding: 10px; } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>{{ veTodo() ? 'Reportes' : 'Mis ventas' }}</h1>
        <button class="b" (click)="exportar()" [disabled]="!datos()"><ion-icon name="download-outline"></ion-icon>Descargar Excel</button>
      </div>
      <div class="barra">
        <app-rango (cambio)="cargar($event)"></app-rango>
      </div>
      @if (!veTodo()) {
        <div class="vista-body" style="padding-bottom: 0">
          <div class="kpis-v">
            <div><small>Pedidos entregados</small><strong class="num">{{ numero(tot().vPedidos) }}</strong></div>
            <div><small>Ventas</small><strong class="num">{{ pesos(tot().vVentas) }}</strong></div>
            <div class="clave"><small>Tu ganancia</small><strong class="num">{{ pesos(tot().vGanV) }}</strong></div>
          </div>
        </div>
      }
      <div class="barra">
        <div class="chips">
          @for (t of pestanasVisibles(); track t.id) {
            <button class="chip" [class.on]="pestana() === t.id" (click)="pestana.set(t.id)">{{ t.label }}</button>
          }
        </div>
        <p class="periodo">{{ etiqueta() }} · solo pedidos entregados</p>
      </div>

      <div class="tabla-wrap">
        @switch (pestana()) {
          @case ('vendedoras') {
            <table class="tabla">
              <thead><tr><th>Vendedora</th><th class="der">Pedidos</th><th class="der">Unidades</th><th class="der">Ventas</th>
                <th class="der">Ganancia vendedora</th><th class="der">Ganancia tienda</th></tr></thead>
              <tbody>
                @for (f of datos()?.vendedoras ?? []; track f.nombre) {
                  <tr><td>{{ f.nombre }}</td><td class="der num">{{ numero(f.pedidos) }}</td><td class="der num">{{ numero(f.unidades) }}</td>
                    <td class="der num">{{ pesos(f.ventas) }}</td><td class="der num resaltar">{{ pesos(f.ganancia_vendedora) }}</td>
                    <td class="der num">{{ pesos(f.ganancia_tienda) }}</td></tr>
                } @empty { <tr><td colspan="6" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (datos()?.vendedoras?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().vPedidos) }}</td><td class="der num">{{ numero(tot().vUnidades) }}</td>
                  <td class="der num">{{ pesos(tot().vVentas) }}</td><td class="der num">{{ pesos(tot().vGanV) }}</td><td class="der num">{{ pesos(tot().vGanT) }}</td></tr></tfoot>
              }
            </table>
          }
          @case ('mensajeros') {
            <table class="tabla">
              <thead><tr><th>Mensajero</th><th class="der">Entregas</th><th class="der">Domicilios</th><th class="der">Efectivo</th>
                <th class="der">Transferencias</th><th class="der">Total cobrado</th></tr></thead>
              <tbody>
                @for (f of datos()?.mensajeros ?? []; track f.nombre) {
                  <tr><td>{{ f.nombre }}</td><td class="der num">{{ numero(f.entregas) }}</td><td class="der num resaltar">{{ pesos(f.domicilios) }}</td>
                    <td class="der num">{{ pesos(f.efectivo) }}</td><td class="der num">{{ pesos(f.transferencia) }}</td><td class="der num">{{ pesos(f.total) }}</td></tr>
                } @empty { <tr><td colspan="6" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (datos()?.mensajeros?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().mEntregas) }}</td><td class="der num">{{ pesos(tot().mDom) }}</td>
                  <td class="der num">{{ pesos(tot().mEf) }}</td><td class="der num">{{ pesos(tot().mTr) }}</td><td class="der num">{{ pesos(tot().mTotal) }}</td></tr></tfoot>
              }
            </table>
          }
          @case ('productos') {
            <table class="tabla">
              <thead><tr><th>Producto</th><th class="der">Unidades</th><th class="der">Ventas</th><th class="der">Costo</th><th class="der">Ganancia</th></tr></thead>
              <tbody>
                @for (f of datos()?.productos ?? []; track f.nombre) {
                  <tr><td class="corta" style="max-width: 360px">{{ f.nombre }}</td><td class="der num">{{ numero(f.unidades) }}</td>
                    <td class="der num">{{ pesos(f.ventas) }}</td><td class="der num suave">{{ pesos(f.costo) }}</td><td class="der num resaltar">{{ pesos(f.ganancia) }}</td></tr>
                } @empty { <tr><td colspan="5" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (datos()?.productos?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().pUnidades) }}</td><td class="der num">{{ pesos(tot().pVentas) }}</td>
                  <td class="der num">{{ pesos(tot().pCosto) }}</td><td class="der num">{{ pesos(tot().pGan) }}</td></tr></tfoot>
              }
            </table>
          }
          @case ('barrios') {
            <table class="tabla">
              <thead><tr><th>Barrio</th><th class="der">Pedidos</th><th class="der">Ventas</th><th class="der">Domicilios</th></tr></thead>
              <tbody>
                @for (f of datos()?.barrios ?? []; track f.barrio) {
                  <tr><td>{{ f.barrio }}</td><td class="der num">{{ numero(f.pedidos) }}</td><td class="der num">{{ pesos(f.ventas) }}</td><td class="der num">{{ pesos(f.domicilios) }}</td></tr>
                } @empty { <tr><td colspan="4" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
            </table>
          }
          @case ('dias') {
            <table class="tabla">
              <thead><tr><th>Día</th><th class="der">Pedidos</th><th class="der">Ventas</th><th class="der">Domicilios</th><th class="der">Efectivo</th><th class="der">Transferencias</th></tr></thead>
              <tbody>
                @for (f of datos()?.dias ?? []; track f.dia) {
                  <tr><td>{{ diaCorto(f.dia) }}</td><td class="der num">{{ numero(f.pedidos) }}</td><td class="der num">{{ pesos(f.ventas) }}</td>
                    <td class="der num">{{ pesos(f.domicilios) }}</td><td class="der num">{{ pesos(f.efectivo) }}</td><td class="der num">{{ pesos(f.transferencia) }}</td></tr>
                } @empty { <tr><td colspan="6" class="suave">{{ vacio() }}</td></tr> }
              </tbody>
              @if (datos()?.dias?.length) {
                <tfoot><tr><td>Total</td><td class="der num">{{ numero(tot().dPedidos) }}</td><td class="der num">{{ pesos(tot().dVentas) }}</td>
                  <td class="der num">{{ pesos(tot().mDom) }}</td><td class="der num">{{ pesos(tot().mEf) }}</td><td class="der num">{{ pesos(tot().mTr) }}</td></tr></tfoot>
              }
            </table>
          }
        }
      </div>
      <div class="vista-body">
        <p class="ayuda">
          Ganancia vendedora = (precio de venta − precio base) × unidades. Ganancia tienda = (precio base − precio de compra) × unidades.
          Ventas sin domicilios. Los domicilios son del mensajero.
        </p>
      </div>
    </div>
  `,
})
export class ReportesPage {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  pestanas: { id: Pestana; label: string }[] = [
    { id: 'vendedoras', label: 'Vendedoras' },
    { id: 'mensajeros', label: 'Mensajeros' },
    { id: 'productos', label: 'Productos' },
    { id: 'barrios', label: 'Barrios' },
    { id: 'dias', label: 'Por día' },
  ];
  /** Admin y cuadres ven todo; una vendedora solo sus ventas */
  veTodo = computed(() => this.sb.tiene('admin', 'cuadres'));
  pestanasVisibles = computed(() =>
    this.veTodo() ? this.pestanas : this.pestanas.filter((t) => t.id === 'productos' || t.id === 'dias')
  );
  pestana = signal<Pestana>('vendedoras');
  datos = signal<Reporte | null>(null);
  cargando = signal(true);
  etiqueta = signal('');
  private rango: RangoFechas | null = null;

  pesos = pesos;
  numero = numero;
  diaCorto = diaCorto;

  tot = computed(() => {
    const d = this.datos() ?? { vendedoras: [], mensajeros: [], productos: [], barrios: [], dias: [] };
    return {
      vPedidos: suma(d.vendedoras, (x) => x.pedidos), vUnidades: suma(d.vendedoras, (x) => x.unidades),
      vVentas: suma(d.vendedoras, (x) => x.ventas), vGanV: suma(d.vendedoras, (x) => x.ganancia_vendedora),
      vGanT: suma(d.vendedoras, (x) => x.ganancia_tienda),
      mEntregas: suma(d.mensajeros, (x) => x.entregas), mDom: suma(d.mensajeros, (x) => x.domicilios),
      mEf: suma(d.mensajeros, (x) => x.efectivo), mTr: suma(d.mensajeros, (x) => x.transferencia), mTotal: suma(d.mensajeros, (x) => x.total),
      pUnidades: suma(d.productos, (x) => x.unidades), pVentas: suma(d.productos, (x) => x.ventas),
      pCosto: suma(d.productos, (x) => x.costo), pGan: suma(d.productos, (x) => x.ganancia),
      dPedidos: suma(d.dias, (x) => x.pedidos), dVentas: suma(d.dias, (x) => x.ventas),
    };
  });

  constructor() {
    addIcons({ downloadOutline });
    if (!this.sb.tiene('admin', 'cuadres')) this.pestana.set('productos');
  }

  vacio(): string {
    return this.cargando() ? 'Cargando…' : 'No hay pedidos entregados en este periodo.';
  }

  async cargar(r: RangoFechas): Promise<void> {
    this.rango = r;
    this.etiqueta.set(r.etiqueta);
    this.cargando.set(true);
    const { data, error } = await this.sb.client.rpc('reporte', { p_desde: r.desde, p_hasta: r.hasta });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.datos.set(data as Reporte);
  }

  exportar(): void {
    const d = this.datos();
    const r = this.rango;
    if (!d || !r) return;
    const sufijo = r.desde === r.hasta ? r.desde : `${r.desde}_a_${r.hasta}`;
    switch (this.pestana()) {
      case 'vendedoras':
        return descargarCsv(`vendedoras_${sufijo}`, [
          { titulo: 'Vendedora', valor: (f: FilaVendedora) => f.nombre },
          { titulo: 'Pedidos', valor: (f) => f.pedidos },
          { titulo: 'Unidades', valor: (f) => f.unidades },
          { titulo: 'Ventas', valor: (f) => f.ventas },
          { titulo: 'Ganancia vendedora', valor: (f) => f.ganancia_vendedora },
          { titulo: 'Ganancia tienda', valor: (f) => f.ganancia_tienda },
        ], d.vendedoras);
      case 'mensajeros':
        return descargarCsv(`mensajeros_${sufijo}`, [
          { titulo: 'Mensajero', valor: (f: FilaMensajero) => f.nombre },
          { titulo: 'Entregas', valor: (f) => f.entregas },
          { titulo: 'Domicilios', valor: (f) => f.domicilios },
          { titulo: 'Efectivo', valor: (f) => f.efectivo },
          { titulo: 'Transferencias', valor: (f) => f.transferencia },
          { titulo: 'Total cobrado', valor: (f) => f.total },
        ], d.mensajeros);
      case 'productos':
        return descargarCsv(`productos_${sufijo}`, [
          { titulo: 'Producto', valor: (f: FilaProducto) => f.nombre },
          { titulo: 'Unidades', valor: (f) => f.unidades },
          { titulo: 'Ventas', valor: (f) => f.ventas },
          { titulo: 'Costo', valor: (f) => f.costo },
          { titulo: 'Ganancia', valor: (f) => f.ganancia },
        ], d.productos);
      case 'barrios':
        return descargarCsv(`barrios_${sufijo}`, [
          { titulo: 'Barrio', valor: (f: FilaBarrio) => f.barrio },
          { titulo: 'Pedidos', valor: (f) => f.pedidos },
          { titulo: 'Ventas', valor: (f) => f.ventas },
          { titulo: 'Domicilios', valor: (f) => f.domicilios },
        ], d.barrios);
      case 'dias':
        return descargarCsv(`ventas_por_dia_${sufijo}`, [
          { titulo: 'Día', valor: (f: FilaDia) => f.dia },
          { titulo: 'Pedidos', valor: (f) => f.pedidos },
          { titulo: 'Ventas', valor: (f) => f.ventas },
          { titulo: 'Domicilios', valor: (f) => f.domicilios },
          { titulo: 'Efectivo', valor: (f) => f.efectivo },
          { titulo: 'Transferencias', valor: (f) => f.transferencia },
        ], d.dias);
    }
  }
}
