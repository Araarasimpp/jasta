import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { hoyColombiaISO } from '../../shared/fecha-colombia';

interface Resumen {
  pedidos: number;
  entregados: number;
  cancelados: number;
  ventas: number;
  domicilios: number;
  ganancia: number;
  margen_vendedoras: number;
  efectivo: number;
  transferencia: number;
  por_estado: Record<string, number>;
  por_dia: { dia: string; pedidos: number; ventas: number }[];
  vendedoras: { nombre: string; pedidos: number; ventas: number }[];
  mensajeros: { nombre: string; pedidos: number }[];
  productos: { nombre: string; cantidad: number; ventas: number }[];
}

type Rango = 'hoy' | 'ayer' | '7' | 'mes' | 'mes_pasado' | 'otro';

function sumarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1100px; }
      .rango { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .rango input { width: 140px; }
      .resumen-dia { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 16px; align-items: start; }
      .renglones dt small { font-size: 12px; }
      .en-curso > a > :last-child { font-size: 20px; font-weight: 600; }
      .ir { margin-top: 14px; }
      .dos { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .barras { position: relative; display: flex; align-items: flex-end; gap: 2px; height: 160px; padding-top: 8px; border-bottom: 1px solid var(--border); }
      .barra-dia { flex: 1; min-width: 2px; height: 100%; display: flex; align-items: flex-end; cursor: default; position: relative; }
      .barra-dia span { width: 100%; background: var(--oro); border-radius: 3px 3px 0 0; min-height: 2px; }
      .barra-dia:hover span { opacity: 1; }
      .barra-dia .tip { display: none; position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); z-index: 2;
        padding: 6px 8px; border-radius: 6px; background: var(--text); color: var(--surface); font-size: 12px; white-space: nowrap; pointer-events: none; }
      .barra-dia:hover .tip { display: block; }
      .eje { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--text-muted); }
      .ranking { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
      .ranking li { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font-size: 13px; }
      .ranking .nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ranking .val { color: var(--text-soft); text-align: right; }
      .ranking .pista { grid-column: 1 / -1; height: 4px; border-radius: 2px; background: var(--selected); overflow: hidden; }
      .ranking .pista span { display: block; height: 100%; border-radius: 2px; background: var(--oro); }
      @media (max-width: 860px) { .dos, .resumen-dia { grid-template-columns: 1fr; } }
      @media (max-width: 860px) { .resumen-dia > :last-child { order: -1; } }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <h1>Inicio<small>{{ etiquetaRango() }}</small></h1>
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

      <div class="resumen-dia">
        <section class="panel">
          <div class="panel-head"><div><h2>Resumen</h2><p class="panel-sub">Pedidos entregados en el periodo</p></div></div>
          <dl class="renglones" [attr.aria-busy]="cargando()">
            <div><dt>Pedidos entregados</dt><dd>{{ numero(r()?.entregados) }} <small>· {{ numero(r()?.cancelados) }} cancelados</small></dd></div>
            <div><dt>Ticket promedio</dt><dd>{{ pesos(ticket()) }}</dd></div>
            <div><dt>Efectivo</dt><dd>{{ pesos(r()?.efectivo) }}</dd></div>
            <div><dt>Transferencias</dt><dd>{{ pesos(r()?.transferencia) }}</dd></div>
            <div><dt>Domicilios <small class="suave">(de los mensajeros)</small></dt><dd>{{ pesos(r()?.domicilios) }}</dd></div>
            <div><dt>Ganancia <small class="suave">(venta − compra)</small></dt><dd>{{ pesos(r()?.ganancia) }}</dd></div>
            <div><dt>Margen vendedoras <small class="suave">(venta − base)</small></dt><dd>{{ pesos(r()?.margen_vendedoras) }}</dd></div>
            <div class="total"><dt>Ventas entregadas</dt><dd>{{ cargando() ? '…' : pesos(r()?.ventas) }}</dd></div>
          </dl>
        </section>

        <section class="panel">
          <div class="panel-head"><div><h2>En curso</h2><p class="panel-sub">Lo que falta mover ahora</p></div></div>
          <div class="renglones en-curso">
            <a routerLink="/app/pedidos"><span><span class="estado por_alistar">Por alistar</span></span><span>{{ r()?.por_estado?.['por_alistar'] ?? 0 }}</span></a>
            <a routerLink="/app/pedidos"><span><span class="estado alistado">Alistados sin despachar</span></span><span>{{ r()?.por_estado?.['alistado'] ?? 0 }}</span></a>
            <a routerLink="/app/pedidos"><span><span class="estado despachado">En ruta</span></span><span>{{ r()?.por_estado?.['despachado'] ?? 0 }}</span></a>
          </div>
          <a class="b b-ancho ir" routerLink="/app/pedidos">Ir a pedidos</a>
        </section>
      </div>

      @if ((r()?.por_dia?.length ?? 0) > 1) {
        <section class="panel">
          <div class="panel-head"><div><h2>Ventas por día</h2><p class="panel-sub">Pedidos entregados, sin domicilios</p></div></div>
          <div class="barras" role="img" [attr.aria-label]="'Ventas por día, máximo ' + pesos(maxDia())">
            @for (d of r()!.por_dia; track d.dia) {
              <div class="barra-dia">
                <span [style.height.%]="(d.ventas / maxDia()) * 100"></span>
                <div class="tip">{{ diaCorto(d.dia) }} · {{ pesos(d.ventas) }} · {{ d.pedidos }} pedidos</div>
              </div>
            }
          </div>
          <div class="eje"><span>{{ diaCorto(r()!.por_dia[0].dia) }}</span><span>{{ diaCorto(r()!.por_dia[r()!.por_dia.length - 1].dia) }}</span></div>
        </section>
      }

      <div class="dos">
        <section class="panel">
          <div class="panel-head"><h2>Vendedoras</h2></div>
          <ol class="ranking">
            @for (v of r()?.vendedoras ?? []; track v.nombre) {
              <li>
                <span class="nom">{{ v.nombre }}</span><span class="val num">{{ pesos(v.ventas) }} · {{ v.pedidos }}</span>
                <span class="pista"><span [style.width.%]="(v.ventas / maxVend()) * 100"></span></span>
              </li>
            } @empty {
              <li class="suave">Sin ventas en este rango.</li>
            }
          </ol>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Productos más vendidos</h2></div>
          <ol class="ranking">
            @for (p of r()?.productos ?? []; track p.nombre) {
              <li>
                <span class="nom">{{ p.nombre }}</span><span class="val num">{{ p.cantidad }} und · {{ pesos(p.ventas) }}</span>
                <span class="pista"><span [style.width.%]="(p.cantidad / maxProd()) * 100"></span></span>
              </li>
            } @empty {
              <li class="suave">Sin ventas en este rango.</li>
            }
          </ol>
        </section>
        <section class="panel">
          <div class="panel-head"><h2>Mensajeros</h2></div>
          <ol class="ranking">
            @for (m of r()?.mensajeros ?? []; track m.nombre) {
              <li>
                <span class="nom">{{ m.nombre }}</span><span class="val num">{{ m.pedidos }} entregas</span>
                <span class="pista"><span [style.width.%]="(m.pedidos / maxMens()) * 100"></span></span>
              </li>
            } @empty {
              <li class="suave">Sin entregas en este rango.</li>
            }
          </ol>
        </section>
      </div>
    </div>
  `,
})
export class InicioPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  rangos: { id: Rango; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: 'ayer', label: 'Ayer' },
    { id: '7', label: '7 días' },
    { id: 'mes', label: 'Este mes' },
    { id: 'mes_pasado', label: 'Mes pasado' },
    { id: 'otro', label: 'Otro' },
  ];
  rango = signal<Rango>('hoy');
  desde = hoyColombiaISO();
  hasta = hoyColombiaISO();
  r = signal<Resumen | null>(null);
  cargando = signal(true);

  pesos = pesos;
  numero = numero;

  ticket = computed(() => {
    const x = this.r();
    return x && x.entregados ? x.ventas / x.entregados : 0;
  });
  maxDia = computed(() => Math.max(1, ...(this.r()?.por_dia ?? []).map((d) => Number(d.ventas))));
  maxVend = computed(() => Math.max(1, ...(this.r()?.vendedoras ?? []).map((d) => Number(d.ventas))));
  maxProd = computed(() => Math.max(1, ...(this.r()?.productos ?? []).map((d) => Number(d.cantidad))));
  maxMens = computed(() => Math.max(1, ...(this.r()?.mensajeros ?? []).map((d) => Number(d.pedidos))));
  etiquetaRango = signal('');

  ngOnInit(): void {
    this.elegir('hoy');
  }

  elegir(r: Rango): void {
    this.rango.set(r);
    const hoy = hoyColombiaISO();
    if (r === 'hoy') [this.desde, this.hasta] = [hoy, hoy];
    if (r === 'ayer') [this.desde, this.hasta] = [sumarDias(hoy, -1), sumarDias(hoy, -1)];
    if (r === '7') [this.desde, this.hasta] = [sumarDias(hoy, -6), hoy];
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
    this.etiquetaRango.set(
      this.desde === this.hasta ? this.diaLargo(this.desde) : `${this.diaLargo(this.desde)} – ${this.diaLargo(this.hasta)}`
    );
    const { data, error } = await this.sb.client.rpc('resumen', { p_desde: this.desde, p_hasta: this.hasta });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.r.set(data as Resumen);
  }

  diaCorto(iso: string): string {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  diaLargo(iso: string): string {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  }
}
