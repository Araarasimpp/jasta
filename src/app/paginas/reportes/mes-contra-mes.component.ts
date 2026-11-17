import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { formatoFechaCO, hoyColombiaISO } from '../../shared/fecha-colombia';
import { CuentaDirective } from '../../shared/animar/animar';

interface Cifras { desde: string; hasta: string; pedidos: number; ventas: number; ganancia: number; comisiones: number; gastos: number }
interface Comparacion { en_curso: boolean; actual: Cifras; anterior: Cifras; anio: Cifras }
type Clave = 'ventas' | 'pedidos' | 'ganancia' | 'comisiones' | 'gastos' | 'utilidad';

/**
 * Mes contra mes: el mes elegido contra el mes pasado y el mismo mes del año pasado.
 * Si el mes va en curso, se compara con los mismos días de los otros meses (del 1 al día de hoy).
 */
@Component({
  selector: 'app-mes-contra-mes',
  standalone: true,
  imports: [FormsModule, CuentaDirective],
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 14px; }
      .top { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
      .top select { max-width: 200px; }
      .nota { margin: 0; font-size: 13px; color: var(--text-soft); }
      .tabla { width: 100%; border-collapse: collapse; font-size: 14px; }
      .tabla th, .tabla td { padding: 10px 8px; border-bottom: var(--perfora); text-align: right; white-space: nowrap; }
      .tabla th:first-child, .tabla td:first-child { text-align: left; }
      .tabla thead th { font-size: 12px; font-weight: 650; color: var(--text-muted); }
      .tabla td.v { font-family: var(--mono-font); font-weight: 650; }
      .cambio { display: block; font-size: 11.5px; font-weight: 650; }
      .sube { color: var(--efectivo-texto); }
      .baja { color: var(--danger); }
      .tabla tr.util td { font-weight: 750; border-top: 2px solid var(--text); }
      .barras { display: flex; flex-direction: column; gap: 10px; }
      .barra { display: grid; grid-template-columns: 120px minmax(0, 1fr) auto; gap: 10px; align-items: center; font-size: 13px; }
      .riel { height: 12px; border-radius: 6px; background: var(--surface-2); overflow: hidden; }
      .riel i { display: block; height: 100%; border-radius: 6px; background: var(--accent); }
      .riel i.ant { background: var(--text-muted); }
      .riel i.anio { background: var(--st-pendiente); }
      @media (max-width: 640px) { .tabla { font-size: 13px; } .barra { grid-template-columns: 90px minmax(0, 1fr) auto; } }
    `,
  ],
  template: `
    <div class="top">
      <select class="inp" [ngModel]="mes()" (ngModelChange)="mes.set($event); cargar()" aria-label="Mes">
        @for (m of meses; track m.id) { <option [value]="m.id">{{ m.label }}</option> }
      </select>
      @if (c()?.en_curso) { <p class="nota">El mes va en curso: se compara del 1 al {{ diaNum(c()!.actual.hasta) }} de cada mes.</p> }
    </div>
    @if (error()) { <p class="nota">{{ error() }}</p> }
    @if (c(); as c) {
      <div style="overflow-x: auto">
        <table class="tabla">
          <thead><tr><th></th><th>{{ nombreMes(c.actual.desde) }}</th><th>{{ nombreMes(c.anterior.desde) }}</th><th>{{ nombreMes(c.anio.desde) }}</th></tr></thead>
          <tbody>
            @for (f of filas; track f.clave) {
              <tr [class.util]="f.clave === 'utilidad'">
                <td>{{ f.label }}</td>
                <td class="v"><span [cuenta]="valor(c.actual, f.clave)" [cuentaFormato]="f.clave === 'pedidos' ? 'numero' : 'pesos'"></span></td>
                <td class="v">{{ mostrar(valor(c.anterior, f.clave), f.clave) }}
                  @if (cambio(c.actual, c.anterior, f.clave); as k) { <span class="cambio" [class.sube]="bien(k, f.clave)" [class.baja]="!bien(k, f.clave)">{{ k > 0 ? '+' : '' }}{{ k }} % este mes</span> }</td>
                <td class="v">{{ mostrar(valor(c.anio, f.clave), f.clave) }}
                  @if (cambio(c.actual, c.anio, f.clave); as k) { <span class="cambio" [class.sube]="bien(k, f.clave)" [class.baja]="!bien(k, f.clave)">{{ k > 0 ? '+' : '' }}{{ k }} % este mes</span> }</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="barras" aria-label="Ventas comparadas">
        @for (b of barras(); track b.label) {
          <div class="barra"><span>{{ b.label }}</span><span class="riel"><i class="llenar" [class]="'llenar ' + b.clase" [style.width.%]="b.pct"></i></span><b class="num">{{ pesos(b.v) }}</b></div>
        }
      </div>
      <p class="nota">Ventas sin domicilios de los pedidos entregados, por el día en que se subieron. Utilidad = ganancia de la tienda menos gastos (los gastos se empezaron a registrar hace poco: en meses viejos pueden salir en cero).</p>
    }
  `,
})
export class MesContraMesComponent implements OnInit {
  private sb = inject(SupabaseService);
  pesos = pesos;
  c = signal<Comparacion | null>(null);
  error = signal('');
  mes = signal(hoyColombiaISO().slice(0, 7));
  readonly meses = Array.from({ length: 13 }, (_, i) => {
    const d = new Date(hoyColombiaISO() + 'T12:00:00Z');
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - i);
    const id = d.toISOString().slice(0, 7);
    return { id, label: this.nombreMes(id + '-01', true) };
  });
  readonly filas: { clave: Clave; label: string }[] = [
    { clave: 'ventas', label: 'Ventas' }, { clave: 'pedidos', label: 'Pedidos' }, { clave: 'ganancia', label: 'Ganancia tienda' },
    { clave: 'comisiones', label: 'Comisiones' }, { clave: 'gastos', label: 'Gastos' }, { clave: 'utilidad', label: 'Utilidad' },
  ];
  barras = computed(() => {
    const c = this.c();
    if (!c) return [];
    const l = [
      { label: this.nombreMes(c.actual.desde), v: +c.actual.ventas, clase: '' },
      { label: this.nombreMes(c.anterior.desde), v: +c.anterior.ventas, clase: 'ant' },
      { label: this.nombreMes(c.anio.desde), v: +c.anio.ventas, clase: 'anio' },
    ];
    const max = Math.max(1, ...l.map((x) => x.v));
    return l.map((x) => ({ ...x, pct: (x.v / max) * 100 }));
  });

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.error.set('');
    const { data, error } = await this.sb.client.rpc('comparar_meses', { p_mes: this.mes() + '-01' });
    if (error) return this.error.set(mensajeError(error));
    this.c.set(data as Comparacion);
  }

  valor(x: Cifras, k: Clave): number {
    return k === 'utilidad' ? +x.ganancia - +x.gastos : +x[k];
  }
  mostrar(v: number, k: Clave): string {
    return k === 'pedidos' ? numero(v) : pesos(v);
  }
  /** % de cambio del mes elegido frente al otro (null si no se puede comparar) */
  cambio(a: Cifras, b: Cifras, k: Clave): number | null {
    const x = this.valor(a, k);
    const y = this.valor(b, k);
    if (!y) return null;
    return Math.round(((x - y) / Math.abs(y)) * 100);
  }
  /** Subir es bueno, salvo en gastos y comisiones */
  bien(k: number, clave: Clave): boolean {
    return clave === 'gastos' || clave === 'comisiones' ? k <= 0 : k >= 0;
  }
  nombreMes(dia: string, conAnio = false): string {
    const t = formatoFechaCO(dia.slice(0, 10) + 'T12:00:00-05:00', conAnio ? { month: 'long', year: 'numeric' } : { month: 'short', year: '2-digit' });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  diaNum(dia: string): number {
    return Number(dia.slice(8, 10));
  }
}
