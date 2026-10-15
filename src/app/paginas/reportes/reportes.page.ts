import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { downloadOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { hoyColombiaISO } from '../../shared/fecha-colombia';

interface FilaVendedora {
  id: number | null;
  nombre: string;
  pedidos: number;
  unidades: number;
  ventas: number;
  base: number;
  ganancia_vendedora: number;
  ganancia_tienda: number;
}
interface Reporte {
  vendedoras: FilaVendedora[];
  productos: { nombre: string; unidades: number; ventas: number; ganancia: number }[];
  mensajeros: { nombre: string; pedidos: number; domicilios: number; efectivo: number; transferencia: number }[];
  barrios: { barrio: string; pedidos: number; ventas: number }[];
  dias: { dia: string; pedidos: number; ventas: number }[];
}

type Tab = 'vendedoras' | 'productos' | 'mensajeros' | 'barrios' | 'dias';
type Rango = 'hoy' | 'ayer' | '7' | 'quincena' | 'mes' | 'mes_pasado' | 'otro';

interface Columna {
  campo: string;
  titulo: string;
  tipo?: 'pesos' | 'num' | 'dia';
}

const COLUMNAS: Record<Tab, Columna[]> = {
  vendedoras: [
    { campo: 'nombre', titulo: 'Vendedora' },
    { campo: 'pedidos', titulo: 'Pedidos', tipo: 'num' },
    { campo: 'unidades', titulo: 'Unidades', tipo: 'num' },
    { campo: 'ventas', titulo: 'Ventas', tipo: 'pesos' },
    { campo: 'base', titulo: 'Precio base', tipo: 'pesos' },
    { campo: 'ganancia_vendedora', titulo: 'Ganancia vendedora', tipo: 'pesos' },
  ],
  productos: [
    { campo: 'nombre', titulo: 'Producto' },
    { campo: 'unidades', titulo: 'Unidades', tipo: 'num' },
    { campo: 'ventas', titulo: 'Ventas', tipo: 'pesos' },
    { campo: 'ganancia', titulo: 'Ganancia', tipo: 'pesos' },
  ],
  mensajeros: [
    { campo: 'nombre', titulo: 'Mensajero' },
    { campo: 'pedidos', titulo: 'Entregas', tipo: 'num' },
    { campo: 'domicilios', titulo: 'Domicilios', tipo: 'pesos' },
    { campo: 'efectivo', titulo: 'Efectivo', tipo: 'pesos' },
    { campo: 'transferencia', titulo: 'Transferencias', tipo: 'pesos' },
  ],
  barrios: [
    { campo: 'barrio', titulo: 'Barrio' },
    { campo: 'pedidos', titulo: 'Pedidos', tipo: 'num' },
    { campo: 'ventas', titulo: 'Ventas', tipo: 'pesos' },
  ],
  dias: [
    { campo: 'dia', titulo: 'Día', tipo: 'dia' },
    { campo: 'pedidos', titulo: 'Pedidos', tipo: 'num' },
    { campo: 'ventas', titulo: 'Ventas', tipo: 'pesos' },
  ],
};

function sumarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Reportes por rango de fechas. Admin y cuadres ven todo; cada vendedora ve lo suyo. */
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [FormsModule, IonIcon],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1100px; }
      .rango { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .rango .segmented { flex-wrap: wrap; }
      .rango input { width: 140px; }
      .tabla td:first-child { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tabla tfoot td { font-weight: 600; border-top: 1px solid var(--border); border-bottom: none; }
      .encabezado-tabla { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
      .nota { margin: 0; font-size: 12px; color: var(--text-muted); }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div>
          <p class="fecha">{{ etiqueta() }}</p>
          <h1>{{ todo() ? 'Reportes' : 'Mis ventas' }}</h1>
        </div>
      </div>

      <div class="rango">
        <div class="segmented">
          @for (r of rangos; track r.id) {
            <button [class.on]="rango() === r.id" (click)="elegir(r.id)">{{ r.label }}</button>
          }
        </div>
        @if (rango() === 'otro') {
          <input class="inp inp-chico" type="date" [(ngModel)]="desde" (change)="cargar()" aria-label="Desde" />
          <input class="inp inp-chico" type="date" [(ngModel)]="hasta" (change)="cargar()" aria-label="Hasta" />
        }
      </div>

      <div class="kpis">
        <div class="kpi kpi-principal"><span class="kpi-label">Ventas</span><span class="kpi-valor num">{{ cargando() ? '…' : pesos(tot().ventas) }}</span><span class="kpi-nota">Entregadas, sin domicilio</span></div>
        <div class="kpi"><span class="kpi-label">Pedidos</span><span class="kpi-valor num">{{ cargando() ? '…' : numero(tot().pedidos) }}</span></div>
        <div class="kpi"><span class="kpi-label">{{ todo() ? 'Ganancia vendedoras' : 'Mi ganancia' }}</span><span class="kpi-valor num">{{ cargando() ? '…' : pesos(tot().ganancia_vendedora) }}</span><span class="kpi-nota">Venta − precio base</span></div>
        @if (todo()) {
          <div class="kpi"><span class="kpi-label">Ganancia tienda</span><span class="kpi-valor num">{{ cargando() ? '…' : pesos(tot().ganancia_tienda) }}</span><span class="kpi-nota">Precio base − compra</span></div>
        } @else {
          <div class="kpi"><span class="kpi-label">Unidades</span><span class="kpi-valor num">{{ cargando() ? '…' : numero(tot().unidades) }}</span></div>
        }
      </div>

      <section class="panel">
        <div class="encabezado-tabla">
          <div class="tabs">
            @for (t of tabsVisibles(); track t.id) {
              <button [class.on]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
            }
          </div>
          <button class="b" (click)="exportar()" [disabled]="!filas().length"><ion-icon name="download-outline"></ion-icon>Descargar CSV</button>
        </div>
        <div class="tabla-wrap" style="margin-top: 12px">
          <table class="tabla">
            <thead>
              <tr>
                @for (c of columnas(); track c.campo) {
                  <th [class.der]="c.tipo === 'pesos' || c.tipo === 'num'">{{ c.titulo }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (f of filas(); track $index) {
                <tr>
                  @for (c of columnas(); track c.campo) {
                    <td [class.der]="c.tipo === 'pesos' || c.tipo === 'num'" [class.num]="!!c.tipo">{{ celda(f, c) }}</td>
                  }
                </tr>
              } @empty {
                <tr><td [attr.colspan]="columnas().length" class="suave">{{ cargando() ? 'Cargando…' : 'Sin ventas entregadas en este rango.' }}</td></tr>
              }
            </tbody>
            @if (filas().length > 1 && tab() !== 'productos' && tab() !== 'barrios') {
              <tfoot>
                <tr>
                  @for (c of columnas(); track c.campo; let i = $index) {
                    <td [class.der]="c.tipo === 'pesos' || c.tipo === 'num'" class="num">{{ i === 0 ? 'Total' : totalColumna(c) }}</td>
                  }
                </tr>
              </tfoot>
            }
          </table>
        </div>
        @if (tab() === 'productos') {
          <p class="nota" style="margin-top: 8px">Los 50 productos con más unidades vendidas en el rango.</p>
        }
      </section>
      <p class="nota">Se cuentan los pedidos entregados según la fecha en que se crearon.</p>
    </div>
  `,
})
export class ReportesPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  rangos: { id: Rango; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: '7', label: '7 días' },
    { id: 'quincena', label: 'Quincena' },
    { id: 'mes', label: 'Este mes' },
    { id: 'mes_pasado', label: 'Mes pasado' },
    { id: 'otro', label: 'Otro' },
  ];
  private tabs: { id: Tab; label: string; soloAdmin?: boolean }[] = [
    { id: 'vendedoras', label: 'Vendedoras', soloAdmin: true },
    { id: 'productos', label: 'Productos' },
    { id: 'mensajeros', label: 'Mensajeros', soloAdmin: true },
    { id: 'barrios', label: 'Barrios' },
    { id: 'dias', label: 'Por día' },
  ];

  todo = computed(() => this.sb.tiene('admin', 'cuadres'));
  tabsVisibles = computed(() => this.tabs.filter((t) => !t.soloAdmin || this.todo()));
  rango = signal<Rango>('mes');
  tab = signal<Tab>('vendedoras');
  datos = signal<Reporte | null>(null);
  cargando = signal(true);
  etiqueta = signal('');
  desde = hoyColombiaISO();
  hasta = hoyColombiaISO();

  columnas = computed(() => COLUMNAS[this.tab()]);
  filas = computed<Record<string, unknown>[]>(() => {
    const d = this.datos();
    if (!d) return [];
    const filas = [...((d[this.tab()] ?? []) as unknown as Record<string, unknown>[])];
    if (this.tab() === 'vendedoras') filas.sort((a, b) => Number(b['ventas']) - Number(a['ventas']));
    return filas;
  });
  tot = computed(() => {
    const v = this.datos()?.vendedoras ?? [];
    const s = (k: keyof FilaVendedora) => v.reduce((a, x) => a + Number(x[k] ?? 0), 0);
    return {
      ventas: s('ventas'),
      pedidos: s('pedidos'),
      unidades: s('unidades'),
      ganancia_vendedora: s('ganancia_vendedora'),
      ganancia_tienda: s('ganancia_tienda'),
    };
  });

  pesos = pesos;
  numero = numero;

  constructor() {
    addIcons({ downloadOutline });
  }

  ngOnInit(): void {
    if (!this.todo()) this.tab.set('productos');
    this.elegir('mes');
  }

  elegir(r: Rango): void {
    this.rango.set(r);
    const hoy = hoyColombiaISO();
    if (r === 'hoy') [this.desde, this.hasta] = [hoy, hoy];
    if (r === 'ayer') [this.desde, this.hasta] = [sumarDias(hoy, -1), sumarDias(hoy, -1)];
    if (r === '7') [this.desde, this.hasta] = [sumarDias(hoy, -6), hoy];
    if (r === 'quincena') {
      const dia = Number(hoy.slice(8, 10));
      [this.desde, this.hasta] = [hoy.slice(0, 8) + (dia <= 15 ? '01' : '16'), hoy];
    }
    if (r === 'mes') [this.desde, this.hasta] = [hoy.slice(0, 8) + '01', hoy];
    if (r === 'mes_pasado') {
      const fin = sumarDias(hoy.slice(0, 8) + '01', -1);
      [this.desde, this.hasta] = [fin.slice(0, 8) + '01', fin];
    }
    void this.cargar();
  }

  async cargar(): Promise<void> {
    if (!this.desde || !this.hasta) return;
    this.cargando.set(true);
    this.etiqueta.set(this.desde === this.hasta ? this.diaLargo(this.desde) : `${this.diaLargo(this.desde)} – ${this.diaLargo(this.hasta)}`);
    const { data, error } = await this.sb.client.rpc('reporte', { p_desde: this.desde, p_hasta: this.hasta });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.datos.set(data as Reporte);
  }

  celda(f: Record<string, unknown>, c: Columna): string {
    const v = f[c.campo];
    if (c.tipo === 'pesos') return pesos(Number(v));
    if (c.tipo === 'num') return numero(Number(v));
    if (c.tipo === 'dia') return this.diaCorto(String(v));
    return String(v ?? '—');
  }

  totalColumna(c: Columna): string {
    if (!c.tipo || c.tipo === 'dia') return '';
    const s = this.filas().reduce((a, f) => a + Number(f[c.campo] ?? 0), 0);
    return c.tipo === 'pesos' ? pesos(s) : numero(s);
  }

  exportar(): void {
    const cols = this.columnas();
    const esc = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const lineas = [cols.map((c) => esc(c.titulo)).join(';')];
    for (const f of this.filas()) lineas.push(cols.map((c) => esc(c.tipo === 'pesos' ? Math.round(Number(f[c.campo])) : f[c.campo])).join(';'));
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `jasta-${this.tab()}-${this.desde}_a_${this.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  diaCorto(iso: string): string {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  diaLargo(iso: string): string {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  }
}
