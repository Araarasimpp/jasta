import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, closeOutline, searchOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { TarifaDomicilio } from '../../shared/modelos';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';
import { PesosDirective } from '../../shared/pesos/pesos.directive';

/** Quita tildes y pasa a minúsculas para buscar sin importar cómo se escriba */
function normal(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

type Filtro = 'activos' | 'inactivos' | 'todos';

/**
 * Barrios y su valor de domicilio. Al crear un pedido, escribir el barrio lo
 * sugiere y al tocarlo pone este valor. Solo el admin los cambia.
 */
@Component({
  selector: 'app-barrios',
  standalone: true,
  imports: [PesosDirective, EsqueletoComponent, FormsModule, IonIcon],
  styles: [
    `
      .tabla td { white-space: normal; }
      .tabla td.der { white-space: nowrap; width: 1%; }
      .inactivo td { opacity: 0.55; }
      .valores { display: flex; gap: 6px; flex-wrap: wrap; }
      .form { display: flex; flex-direction: column; gap: 14px; }
      .activo { display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
      .activo input { width: 18px; height: 18px; accent-color: var(--oro); }
      .rapidos { display: flex; gap: 6px; flex-wrap: wrap; }
      .rapidos button { height: 32px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 16px; background: var(--surface); color: var(--text);
        font: inherit; font-size: 13px; cursor: pointer; font-variant-numeric: tabular-nums; }
      .rapidos button.on { border-color: var(--oro); background: var(--oro-wash); color: var(--oro-texto); font-weight: 600; }
      .pie { display: flex; gap: 8px; justify-content: flex-end; }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Barrios y domicilios <small class="num">{{ numero(visibles().length) }}</small></h1>
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="Buscar barrio" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </label>
        <button class="b b-pri" (click)="nuevo()"><ion-icon name="add"></ion-icon>Agregar barrio</button>
      </div>
      <div class="vista-body" style="padding-bottom: 0">
        <div class="chips">
          @for (f of filtros; track f.id) {
            <button class="chip" [class.on]="filtro() === f.id" (click)="filtro.set(f.id)">{{ f.label }} <span class="n">{{ cuenta()[f.id] }}</span></button>
          }
        </div>
        @if (valores().length > 1) {
          <div class="chips">
            <button class="chip" [class.on]="valor() === null" (click)="valor.set(null)">Cualquier valor</button>
            @for (v of valores(); track v.valor) {
              <button class="chip" [class.on]="valor() === v.valor" (click)="valor.set(v.valor)">{{ pesos(v.valor) }} <span class="n">{{ v.n }}</span></button>
            }
          </div>
        }
      </div>
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>Barrio</th><th class="der">Domicilio</th></tr></thead>
          <tbody>
            @for (t of visibles(); track t.id) {
              <tr class="click" [class.inactivo]="!t.activo" (click)="editar(t)">
                <td class="titulo">{{ t.barrio }}@if (!t.activo) { <small class="suave"> · inactivo</small> }</td>
                <td class="der num"><strong>{{ pesos(t.domicilio) }}</strong></td>
              </tr>
            } @empty {
              @if (cargando()) { <tr><td colspan="2" class="suave"><app-esqueleto forma="tabla" [filas]="8" [columnas]="2"></app-esqueleto></td></tr> } @else { <tr><td colspan="2" class="suave">{{ 'No hay barrios con esa búsqueda.' }}</td></tr> }
            }
          </tbody>
        </table>
      </div>
      <div class="vista-body">
        <p class="ayuda">Cuando alguien crea un pedido y escribe el barrio, aparece aquí y al tocarlo se pone el valor del domicilio. Los inactivos no se sugieren.</p>
      </div>
    </div>

    @if (form(); as f) {
      <button class="velo" aria-label="Cerrar" (click)="form.set(null)"></button>
      <aside class="hoja" role="dialog" aria-labelledby="t-barrio">
        <div class="hoja-head">
          <h2 id="t-barrio">{{ f.id ? 'Editar barrio' : 'Nuevo barrio' }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="form.set(null)"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="hoja-body">
          <form class="form" (ngSubmit)="guardar()">
            <div class="campo">
              <label for="b-nom">Barrio</label>
              <input id="b-nom" name="barrio" autocomplete="off" maxlength="120" required [(ngModel)]="f.barrio" />
            </div>
            <div class="campo">
              <label for="b-val">Valor del domicilio</label>
              <input pesos id="b-val" name="domicilio" required [(ngModel)]="f.domicilio" />
            </div>
            <div class="rapidos" aria-label="Valores frecuentes">
              @for (v of frecuentes(); track v) {
                <button type="button" [class.on]="+f.domicilio === v" (click)="f.domicilio = v">{{ pesos(v) }}</button>
              }
            </div>
            <label class="activo"><input type="checkbox" name="activo" [(ngModel)]="f.activo" />Activo (se sugiere al crear pedidos)</label>
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
            <div class="pie">
              <button type="button" class="b" (click)="form.set(null)">Cancelar</button>
              <button type="submit" class="b b-pri" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
            </div>
          </form>
        </div>
      </aside>
    }
  `,
})
export class BarriosPage implements OnInit {
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  tarifas = signal<TarifaDomicilio[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');
  q = signal('');
  filtro = signal<Filtro>('activos');
  valor = signal<number | null>(null);
  form = signal<{ id?: number; barrio: string; domicilio: number; activo: boolean } | null>(null);

  filtros: { id: Filtro; label: string }[] = [
    { id: 'activos', label: 'Activos' },
    { id: 'inactivos', label: 'Inactivos' },
    { id: 'todos', label: 'Todos' },
  ];

  pesos = pesos;
  numero = numero;

  cuenta = computed(() => {
    const t = this.tarifas();
    const activos = t.filter((x) => x.activo).length;
    return { activos, inactivos: t.length - activos, todos: t.length };
  });

  private delFiltro = computed(() => {
    const f = this.filtro();
    return this.tarifas().filter((t) => f === 'todos' || (f === 'activos') === t.activo);
  });

  /** Valores distintos (con cuántos barrios tiene cada uno) para filtrar */
  valores = computed(() => {
    const m = new Map<number, number>();
    for (const t of this.delFiltro()) m.set(Number(t.domicilio), (m.get(Number(t.domicilio)) ?? 0) + 1);
    return [...m].map(([valor, n]) => ({ valor, n })).sort((a, b) => a.valor - b.valor);
  });

  /** Los valores más usados, para elegir de un toque en el formulario */
  frecuentes = computed(() => {
    const m = new Map<number, number>();
    for (const t of this.tarifas()) m.set(Number(t.domicilio), (m.get(Number(t.domicilio)) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([v]) => v).sort((a, b) => a - b);
  });

  visibles = computed(() => {
    const partes = normal(this.q().trim()).split(/\s+/).filter(Boolean);
    const v = this.valor();
    return this.delFiltro().filter((t) => (v === null || Number(t.domicilio) === v) && partes.every((p) => normal(t.barrio).includes(p)));
  });

  constructor() {
    addIcons({ add, closeOutline, searchOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.tarifas.set(await this.ps.tarifas());
    } catch (e) {
      this.toast.error('No se pudieron cargar los barrios: ' + mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  nuevo(): void {
    this.error.set('');
    this.form.set({ barrio: this.q().trim(), domicilio: this.frecuentes()[0] ?? 0, activo: true });
  }

  editar(t: TarifaDomicilio): void {
    this.error.set('');
    this.form.set({ id: t.id, barrio: t.barrio, domicilio: Number(t.domicilio), activo: t.activo });
  }

  async guardar(): Promise<void> {
    const f = this.form();
    if (!f) return;
    const barrio = f.barrio.trim().replace(/\s+/g, ' ');
    const domicilio = Number(f.domicilio);
    if (!barrio) return this.error.set('Escribe el nombre del barrio.');
    if (!Number.isFinite(domicilio) || domicilio < 0) return this.error.set('El valor del domicilio no es válido.');
    const repetido = this.tarifas().find((t) => t.id !== f.id && normal(t.barrio) === normal(barrio));
    if (repetido) return this.error.set(`Ya existe "${repetido.barrio}" (${pesos(repetido.domicilio)}).`);
    this.guardando.set(true);
    this.error.set('');
    try {
      const g = await this.ps.guardarTarifa({ id: f.id, barrio, domicilio, activo: f.activo });
      this.tarifas.update((l) => [...l.filter((t) => t.id !== g.id), g].sort((a, b) => a.barrio.localeCompare(b.barrio, 'es')));
      this.form.set(null);
      this.toast.ok(f.id ? 'Barrio actualizado' : 'Barrio agregado');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
