import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { mensajeError, pesos } from '../../shared/formato';
import { hoyColombiaISO } from '../../shared/fecha-colombia';

interface Fila {
  usuario_id: number; nombre: string; avatar_url: string | null; tipo: 'vendedora' | 'mensajero';
  cantidad: number; ventas: number | null; meta: number | null; puesto: number; avance: number | null;
}

/** Primer y último día del mes (YYYY-MM); el mes en curso llega hasta hoy */
function rangoMes(mes: string): { desde: string; hasta: string } {
  const hoy = hoyColombiaISO();
  if (hoy.startsWith(mes)) return { desde: mes + '-01', hasta: hoy };
  const [a, m] = mes.split('-').map(Number);
  const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10);
  return { desde: mes + '-01', hasta: fin };
}

/** Los últimos 24 meses, del más reciente al más antiguo */
function ultimosMeses(): { id: string; label: string }[] {
  const hoy = hoyColombiaISO();
  let a = Number(hoy.slice(0, 4));
  let m = Number(hoy.slice(5, 7));
  const out: { id: string; label: string }[] = [];
  for (let i = 0; i < 24; i++) {
    const id = `${a}-${String(m).padStart(2, '0')}`;
    const label = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    out.push({ id, label: label.charAt(0).toUpperCase() + label.slice(1) });
    if (--m === 0) [a, m] = [a - 1, 12];
  }
  return out;
}

/** Ranking de vendedoras (ventas entregadas) y mensajeros (entregas), con metas del mes */
@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1000px; }
      .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start; }
      .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .lista li { display: grid; grid-template-columns: 28px auto 1fr auto; gap: 10px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-soft); }
      .lista li.yo { background: var(--accent-wash); margin: 0 -10px; padding: 10px; border-radius: var(--radius-sm); }
      .puesto { font-weight: 600; color: var(--text-muted); text-align: center; }
      .puesto.top { color: var(--oro-texto); }
      .nom { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .nom strong { font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .barra-meta { height: 4px; border-radius: 2px; background: var(--selected); overflow: hidden; }
      .barra-meta span { display: block; height: 100%; background: var(--oro); border-radius: 2px; }
      .nom small { font-size: 12px; color: var(--text-muted); }
      .val { text-align: right; font-size: 13px; }
      .val strong { display: block; font-size: 16px; }
      .meta-inp { width: 70px; height: 30px; font-size: 13px; }
      .mes { width: auto; min-width: 190px; }
      .val { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; }
      @media (max-width: 860px) { .dos { grid-template-columns: 1fr; } }
      /* Celular: el nombre puede usar dos líneas y la meta va debajo de las cifras */
      @media (max-width: 640px) {
        .lista li { grid-template-columns: 22px auto minmax(0, 1fr) auto; gap: 8px; }
        .nom strong { white-space: normal; overflow-wrap: anywhere; line-height: 1.25; }
        .val .suave { font-size: 12px; }
        .meta-inp { width: 84px; height: 34px; }
      }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">{{ subtitulo() }}</p><h1>Ranking</h1></div>
        <select class="inp mes" [ngModel]="mes()" (ngModelChange)="elegir($event)" aria-label="Mes">
          @for (m of meses; track m.id) {
            <option [ngValue]="m.id">{{ m.label }}</option>
          }
        </select>
      </div>
      <div class="dos">
        @for (g of grupos; track g.tipo) {
          <section class="panel">
            <div class="panel-head">
              <div><h2>{{ g.titulo }}</h2><p class="panel-sub">{{ g.sub }}{{ esMesActual() ? ' · meta del mes' : '' }}</p></div>
            </div>
            <ol class="lista">
              @for (f of filas(g.tipo); track f.usuario_id) {
                <li [class.yo]="f.usuario_id === yo()">
                  <span class="puesto num" [class.top]="f.puesto <= 3">{{ f.puesto }}</span>
                  <app-avatar [nombre]="f.nombre" [foto]="f.avatar_url" [tam]="34"></app-avatar>
                  <span class="nom">
                    <strong>{{ f.nombre }}</strong>
                    @if (esMesActual() && f.meta) {
                      <span class="barra-meta"><span [style.width.%]="f.avance ?? 0"></span></span>
                      <small>{{ f.cantidad }} de {{ f.meta }} · {{ f.avance ?? 0 }}%</small>
                    }
                  </span>
                  <span class="val">
                    <strong class="num">{{ f.cantidad }}</strong>
                    @if (f.ventas !== null && g.tipo === 'vendedora') { <span class="suave num">{{ pesos(f.ventas) }}</span> }
                    @if (esAdmin() && esMesActual()) {
                      <input class="inp meta-inp num" type="number" min="0" [ngModel]="f.meta" (change)="guardarMeta(f, $any($event.target).value)"
                        placeholder="Meta" [attr.aria-label]="'Meta de ' + f.nombre" />
                    }
                  </span>
                </li>
              } @empty {
                <li><span></span><span></span><span class="suave">{{ cargando() ? 'Cargando…' : 'Sin datos' }}</span><span></span></li>
              }
            </ol>
          </section>
        }
      </div>
    </div>
  `,
})
export class RankingPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  meses = ultimosMeses();
  grupos = [
    { tipo: 'vendedora' as const, titulo: 'Vendedoras', sub: 'Ventas entregadas' },
    { tipo: 'mensajero' as const, titulo: 'Mensajeros', sub: 'Entregas a domicilio' },
  ];
  mes = signal(this.meses[0].id);
  esMesActual = computed(() => this.mes() === this.meses[0].id);
  datos = signal<Fila[]>([]);
  cargando = signal(true);
  yo = computed(() => this.sb.usuario()?.id ?? null);
  esAdmin = computed(() => this.sb.tiene('admin'));
  subtitulo = computed(() => (this.esMesActual() ? 'Este mes' : this.meses.find((m) => m.id === this.mes())?.label ?? ''));
  pesos = pesos;

  ngOnInit(): void {
    void this.cargar();
  }

  filas(tipo: 'vendedora' | 'mensajero'): Fila[] {
    return this.datos()
      .filter((f) => f.tipo === tipo && (f.cantidad > 0 || this.esMesActual()))
      .sort((a, b) => a.puesto - b.puesto);
  }

  elegir(m: string): void {
    this.mes.set(m);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    const r = rangoMes(this.mes());
    const { data, error } = await this.sb.client.rpc('ranking', { p_desde: r.desde, p_hasta: r.hasta });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.datos.set((data ?? []) as Fila[]);
  }

  async guardarMeta(f: Fila, valor: string): Promise<void> {
    const n = valor === '' ? null : Math.max(0, Math.trunc(Number(valor)));
    const campo = f.tipo === 'vendedora' ? 'meta_ventas' : 'meta_entregas';
    const { error } = await this.sb.client.from('metas').upsert({ usuario_id: f.usuario_id, [campo]: n, updated_at: new Date().toISOString() });
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok(`Meta de ${f.nombre} guardada`);
    await this.cargar();
  }
}
