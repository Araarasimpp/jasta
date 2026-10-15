import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { mensajeError, pesos } from '../../shared/formato';
import { hoyColombiaISO } from '../../shared/fecha-colombia';

type Periodo = 'hoy' | 'semana' | 'mes';
interface Fila {
  usuario_id: number; nombre: string; avatar_url: string | null; tipo: 'vendedora' | 'mensajero';
  cantidad: number; ventas: number | null; meta: number | null; puesto: number; avance: number | null;
}

function rango(p: Periodo): { desde: string; hasta: string } {
  const hoy = hoyColombiaISO();
  if (p === 'hoy') return { desde: hoy, hasta: hoy };
  if (p === 'mes') return { desde: hoy.slice(0, 8) + '01', hasta: hoy };
  const d = new Date(hoy + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // lunes
  return { desde: d.toISOString().slice(0, 10), hasta: hoy };
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
      .puesto.top { color: var(--accent); }
      .nom { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .nom strong { font-weight: 500; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .barra-meta { height: 6px; border-radius: 3px; background: var(--surface-2); overflow: hidden; }
      .barra-meta span { display: block; height: 100%; background: var(--accent); border-radius: 3px; }
      .nom small { font-size: 12px; color: var(--text-muted); }
      .val { text-align: right; font-size: 13px; }
      .val strong { display: block; font-size: 16px; }
      .meta-inp { width: 70px; height: 30px; font-size: 13px; }
      @media (max-width: 860px) { .dos { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">{{ subtitulo() }}</p><h1>Ranking</h1></div>
        <div class="segmented">
          @for (p of periodos; track p.id) {
            <button [class.on]="periodo() === p.id" (click)="elegir(p.id)">{{ p.label }}</button>
          }
        </div>
      </div>
      <div class="dos">
        @for (g of grupos; track g.tipo) {
          <section class="panel">
            <div class="panel-head">
              <div><h2>{{ g.titulo }}</h2><p class="panel-sub">{{ g.sub }}{{ periodo() === 'mes' ? ' · meta del mes' : '' }}</p></div>
            </div>
            <ol class="lista">
              @for (f of filas(g.tipo); track f.usuario_id) {
                <li [class.yo]="f.usuario_id === yo()">
                  <span class="puesto num" [class.top]="f.puesto <= 3">{{ f.puesto }}</span>
                  <app-avatar [nombre]="f.nombre" [foto]="f.avatar_url" [tam]="34"></app-avatar>
                  <span class="nom">
                    <strong>{{ f.nombre }}</strong>
                    @if (periodo() === 'mes' && f.meta) {
                      <span class="barra-meta"><span [style.width.%]="f.avance ?? 0"></span></span>
                      <small>{{ f.cantidad }} de {{ f.meta }} · {{ f.avance ?? 0 }}%</small>
                    }
                  </span>
                  <span class="val">
                    <strong class="num">{{ f.cantidad }}</strong>
                    @if (f.ventas !== null && g.tipo === 'vendedora') { <span class="suave num">{{ pesos(f.ventas) }}</span> }
                    @if (esAdmin() && periodo() === 'mes') {
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

  periodos: { id: Periodo; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mes' },
  ];
  grupos = [
    { tipo: 'vendedora' as const, titulo: 'Vendedoras', sub: 'Ventas entregadas' },
    { tipo: 'mensajero' as const, titulo: 'Mensajeros', sub: 'Entregas a domicilio' },
  ];
  periodo = signal<Periodo>('mes');
  datos = signal<Fila[]>([]);
  cargando = signal(true);
  yo = computed(() => this.sb.usuario()?.id ?? null);
  esAdmin = computed(() => this.sb.tiene('admin'));
  subtitulo = computed(() => ({ hoy: 'Hoy', semana: 'Esta semana', mes: 'Este mes' })[this.periodo()]);
  pesos = pesos;

  ngOnInit(): void {
    void this.cargar();
  }

  filas(tipo: 'vendedora' | 'mensajero'): Fila[] {
    return this.datos()
      .filter((f) => f.tipo === tipo && (f.cantidad > 0 || f.meta || this.periodo() === 'mes'))
      .sort((a, b) => a.puesto - b.puesto);
  }

  elegir(p: Periodo): void {
    this.periodo.set(p);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    const r = rango(this.periodo());
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
