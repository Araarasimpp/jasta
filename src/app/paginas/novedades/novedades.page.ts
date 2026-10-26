import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircleOutline, callOutline, logoWhatsapp, refreshOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO, formatoHoraCO } from '../../shared/fecha-colombia';

interface Abierta {
  id: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  barrio: string | null;
  direccion: string | null;
  total: number;
  estado: string;
  novedades: number;
  ultima_novedad: string;
  novedad_at: string;
  vendedora: string | null;
  mensajero: string | null;
  detalle: string | null;
}
interface Fila {
  id: number;
  pedido_id: number;
  fecha: string;
  motivo_label: string;
  detalle: string | null;
  accion: 'reintentar' | 'devolver';
  autor: string | null;
  mensajero: string | null;
  cliente_nombre: string;
  barrio: string | null;
  estado: string;
  vendedora: string | null;
}
interface Datos {
  abiertas: Abierta[];
  historial: Fila[];
  por_motivo: { motivo: string; n: number }[];
  por_mensajero: { nombre: string; n: number }[];
}

const ESTADOS: Record<string, string> = {
  por_alistar: 'Por alistar', alistado: 'Alistado', despachado: 'En ruta', entregado: 'Entregado', cancelado: 'Cancelado',
};

/**
 * Novedades de entrega: los pedidos que el mensajero no pudo entregar (por qué y qué
 * pasó con ellos). Arriba los que siguen sin entregarse; abajo el historial del periodo.
 */
@Component({
  selector: 'app-novedades',
  standalone: true,
  imports: [IonIcon, PedidoDetalleComponent, RangoComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1000px; }
      .abiertas { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px; }
      .nov { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; border: 1px solid color-mix(in srgb, var(--danger) 30%, var(--border));
        border-radius: var(--radius-lg); background: var(--surface); }
      .nov-top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
      .nov-top button { all: unset; cursor: pointer; font-size: 15px; font-weight: 650; }
      .nov-top button:hover { text-decoration: underline; }
      .nov-top .num { font-size: 14px; font-weight: 650; white-space: nowrap; }
      .motivo { display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; padding: 3px 9px; border-radius: var(--radius-xs);
        background: var(--danger-wash); color: var(--danger); font-size: 12.5px; font-weight: 650; }
      .nov p { margin: 0; font-size: 13px; color: var(--text-soft); }
      .nov .det { color: var(--text); font-style: italic; }
      .estado { display: inline-block; padding: 1px 8px; border-radius: 8px; font-size: 11.5px; font-weight: 650; background: var(--surface-2); color: var(--text-soft); }
      .estado.despachado { background: var(--accent-wash); color: var(--accent); }
      .estado.alistado { background: var(--oro-wash); color: var(--oro-texto); }
      .estado.entregado { background: var(--ok-wash); color: var(--efectivo-texto); }
      .estado.cancelado { background: var(--danger-wash); color: var(--danger); }
      .nov .acc { display: flex; gap: 8px; flex-wrap: wrap; }
      .nov .acc .b { height: 34px; font-size: 13px; }
      .stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .barras { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .barras li { display: grid; grid-template-columns: minmax(0, 150px) minmax(0, 1fr) 32px; gap: 10px; align-items: center; font-size: 13px; }
      .barras .nombre { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .barras .pista { display: block; height: 10px; border-radius: 5px; background: var(--surface-2); overflow: hidden; }
      .barras .relleno { display: block; height: 100%; border-radius: 5px; background: var(--danger); opacity: 0.75; }
      .barras .n { text-align: right; font-family: var(--mono-font); font-weight: 650; }
      .vacio-txt { margin: 0; padding: 14px 0 6px; text-align: center; font-size: 13.5px; color: var(--text-soft); }
      td .t2 { display: block; font-size: 12px; color: var(--text-muted); }
      @media (max-width: 720px) { .stats { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">Lo que no se pudo entregar</p><h1>Novedades</h1></div>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
      </div>

      <section class="panel" aria-labelledby="t-abiertas">
        <div class="panel-head"><div>
          <h2 id="t-abiertas">Sin resolver ({{ d()?.abiertas?.length ?? 0 }})</h2>
          <p class="panel-sub">Pedidos con novedad que todavía no se entregan ni se cancelan</p>
        </div></div>
        @if (d()?.abiertas?.length) {
          <div class="abiertas">
            @for (a of d()!.abiertas; track a.id) {
              <article class="nov">
                <div class="nov-top">
                  <button type="button" (click)="abierto.set(a.id)">#{{ a.id }} {{ a.cliente_nombre }}</button>
                  <span class="num">{{ pesos(a.total) }}</span>
                </div>
                <span class="motivo"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>{{ a.ultima_novedad }}@if (a.novedades > 1) { · {{ a.novedades }} intentos }</span>
                @if (a.detalle) { <p class="det">"{{ a.detalle }}"</p> }
                <p>{{ a.barrio || 'Sin barrio' }} · {{ cuando(a.novedad_at) }}</p>
                <p><span class="estado" [class]="'estado ' + a.estado">{{ estado(a.estado) }}</span>
                  @if (a.mensajero) { · {{ a.mensajero }} } @if (a.vendedora) { · vendió {{ a.vendedora }} }</p>
                <div class="acc">
                  @if (a.cliente_telefono) {
                    <a class="b" [href]="'tel:' + a.cliente_telefono"><ion-icon name="call-outline"></ion-icon>Llamar</a>
                    <a class="b b-wa" [href]="whatsapp(a)" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>WhatsApp</a>
                  }
                  <button class="b" (click)="abierto.set(a.id)">Ver pedido</button>
                </div>
              </article>
            }
          </div>
        } @else {
          <p class="vacio-txt">{{ cargando() ? 'Cargando…' : 'No hay pedidos con novedades pendientes.' }}</p>
        }
      </section>

      <div class="hist-head" style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap">
        <h2 style="margin: 0; font-size: 15px">Historial</h2>
        <app-rango inicial="7" (cambio)="cambiarRango($event)"></app-rango>
      </div>

      @if (d()?.historial?.length) {
        <div class="stats">
          <section class="panel"><div class="panel-head"><div><h2>Por motivo</h2></div></div>
            <ul class="barras">
              @for (m of d()!.por_motivo; track m.motivo) {
                <li><span class="nombre">{{ m.motivo }}</span><span class="pista"><span class="relleno" [style.width.%]="(m.n / maxMotivo()) * 100"></span></span><span class="n">{{ m.n }}</span></li>
              }
            </ul>
          </section>
          @if (veTodo()) {
            <section class="panel"><div class="panel-head"><div><h2>Por mensajero</h2></div></div>
              <ul class="barras">
                @for (m of d()!.por_mensajero; track m.nombre) {
                  <li><span class="nombre">{{ m.nombre }}</span><span class="pista"><span class="relleno" [style.width.%]="(m.n / maxMensajero()) * 100"></span></span><span class="n">{{ m.n }}</span></li>
                }
              </ul>
            </section>
          }
        </div>
      }

      <div class="tabla-wrap">
        <table class="tabla tarjetas-cel">
          <thead><tr><th>Fecha</th><th>Pedido</th><th>Motivo</th><th>Qué pasó</th><th>Mensajero</th><th>Estado hoy</th></tr></thead>
          <tbody>
            @for (f of d()?.historial ?? []; track f.id) {
              <tr class="click" (click)="abierto.set(f.pedido_id)">
                <td class="suave" data-etq="Fecha">{{ cuando(f.fecha) }}</td>
                <td data-etq="Pedido">#{{ f.pedido_id }} {{ f.cliente_nombre }}<span class="t2">{{ f.barrio || '' }}@if (f.vendedora) { · {{ f.vendedora }} }</span></td>
                <td data-etq="Motivo">{{ f.motivo_label }}@if (f.detalle) { <span class="t2">{{ f.detalle }}</span> }</td>
                <td data-etq="Qué pasó">{{ f.accion === 'devolver' ? 'Volvió a la tienda' : 'Siguió en ruta' }}</td>
                <td class="suave" data-etq="Mensajero">{{ f.mensajero || f.autor || '—' }}</td>
                <td data-etq="Estado hoy"><span class="estado" [class]="'estado ' + f.estado">{{ estado(f.estado) }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="suave">{{ cargando() ? 'Cargando…' : 'No hubo novedades en este periodo.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class NovedadesPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  d = signal<Datos | null>(null);
  cargando = signal(true);
  abierto = signal<number | null>(null);
  veTodo = computed(() => this.sb.tiene('admin', 'alistador', 'cuadres'));
  maxMotivo = computed(() => Math.max(1, ...(this.d()?.por_motivo ?? []).map((m) => m.n)));
  maxMensajero = computed(() => Math.max(1, ...(this.d()?.por_mensajero ?? []).map((m) => m.n)));
  pesos = pesos;

  private rango: RangoFechas | null = null;
  private consulta = 0;
  private dejar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ alertCircleOutline, callOutline, logoWhatsapp, refreshOutline });
  }

  ngOnInit(): void {
    // Una novedad nueva (o el pedido que se entrega) cambia la lista
    this.dejar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 700);
    });
  }

  ngOnDestroy(): void {
    this.dejar?.();
    clearTimeout(this.timer);
  }

  cambiarRango(r: RangoFechas): void {
    this.rango = r;
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const r = this.rango;
    if (!r) return;
    const n = ++this.consulta;
    const { data, error } = await this.sb.client.rpc('novedades', { p_desde: r.desde || '2020-01-01', p_hasta: r.hasta || r.desde });
    if (n !== this.consulta) return;
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.d.set(data as Datos);
  }

  estado(e: string): string {
    return ESTADOS[e] ?? e;
  }

  whatsapp(a: Abierta): string {
    const tel = (a.cliente_telefono ?? '').replace(/\D/g, '');
    const num = tel.length === 10 ? '57' + tel : tel;
    return `https://wa.me/${num}?text=${encodeURIComponent(`Hola ${a.cliente_nombre.split(' ')[0]}, te escribimos de Jasta por tu pedido #${a.id}.`)}`;
  }

  cuando(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
