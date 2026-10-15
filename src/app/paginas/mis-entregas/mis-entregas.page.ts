import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, callOutline, navigateOutline, logoWhatsapp } from 'ionicons/icons';
import { enlaceWhatsapp } from '../../shared/whatsapp';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { EntregarComponent } from '../../shared/entregar/entregar.component';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { Pedido } from '../../shared/modelos';
import { mensajeError, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';

/** Pantalla del mensajero: lo que tiene en ruta y lo que lleva por cuadrar */
@Component({
  selector: 'app-mis-entregas',
  standalone: true,
  imports: [IonIcon, EntregarComponent, PedidoDetalleComponent, RangoComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .tarjeta h3 { cursor: pointer; }
      .total { font-size: 17px; }
      .b-wa { color: #128c4a; border-color: #9fd8b5; }
      .b-wa:hover { border-color: #128c4a; }
      .cuadre { display: flex; flex-direction: column; gap: 12px; }
      .cuadre .panel-head { margin-bottom: 0; }
      .en-ruta { font-size: 13px; color: var(--text-soft); }
      .entregar-total { display: flex; flex-direction: column; gap: 2px; padding: 14px; border-radius: var(--radius); background: var(--accent-wash); }
      .entregar-total span { font-size: 13px; color: var(--text-2); }
      .entregar-total strong { font-size: 28px; font-weight: 600; color: var(--accent); letter-spacing: -0.01em; }
      .desglose { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; margin: 0; font-size: 13px; }
      .desglose dt { color: var(--text-soft); }
      .desglose dd { margin: 0; text-align: right; }
      .hist-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .hist { width: 100%; border-collapse: collapse; font-size: 13px; }
      .hist td { padding: 8px 4px; border-bottom: 1px solid var(--border-soft); }
      .hist td:last-child { text-align: right; white-space: nowrap; }
      .hist tr { cursor: pointer; }
      .hist small { display: block; color: var(--text-muted); font-size: 12px; }
      .hist-tot { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--text-soft); }
      .hist-tot strong { color: var(--text); }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><h1>Mis entregas</h1></div>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
      </div>

      @if (esMensajero()) {
        <section class="panel cuadre">
          <div class="panel-head">
            <div>
              <h2>Por cuadrar</h2>
              <p class="panel-sub">
                @if (pendiente(); as c) {
                  {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido entregado' : 'pedidos entregados' }} desde {{ fecha(c.desde) }}
                } @else {
                  No tienes entregas pendientes por cuadrar
                }
              </p>
            </div>
            <span class="en-ruta">{{ enRuta().length }} en ruta</span>
          </div>
          @if (pendiente(); as c) {
            <div class="entregar-total">
              <span>Efectivo que debes entregar</span>
              <strong class="num">{{ pesos(c.efectivo - c.domicilios) }}</strong>
            </div>
            <dl class="desglose">
              <dt>Efectivo cobrado</dt><dd class="num">{{ pesos(c.efectivo) }}</dd>
              <dt>Tus domicilios (se descuentan)</dt><dd class="num">− {{ pesos(c.domicilios) }}</dd>
              <dt>Transferencias (ya le llegaron a la tienda)</dt><dd class="num">{{ pesos(c.transferencia) }}</dd>
            </dl>
            <button class="b" (click)="verDetalle()">{{ detalle().length ? 'Ocultar pedidos' : 'Ver pedidos por cuadrar' }}</button>
            @if (detalle().length) {
              <ul class="items-mini">
                @for (p of detalle(); track p.id) {
                  <li (click)="abierto.set(p.id)" style="cursor: pointer">
                    <span>#{{ p.id }} · {{ p.cliente_nombre }} · {{ p.tipo_recaudo }}</span><span class="num">{{ pesos(p.total) }}</span>
                  </li>
                }
              </ul>
            }
          }
        </section>
      } @else {
        <div class="vacio">
          <span class="vacio-titulo">No tienes el rol de mensajero</span>
          <p>Aquí abajo ves todos los pedidos en ruta. Para ver lo que tiene que cuadrar cada mensajero, entra a Cuadres.</p>
        </div>
      }

      <div class="tarjetas">
        @for (p of enRuta(); track p.id) {
          <article class="tarjeta">
            <div class="tarjeta-top">
              <h3 (click)="abierto.set(p.id)">#{{ p.id }} · {{ p.cliente_nombre }}</h3>
              <strong class="total num">{{ pesos(p.total) }}</strong>
            </div>
            <p>{{ p.direccion }}<br />{{ p.barrio || 'Sin barrio' }}</p>
            @if (p.observaciones) {
              <p style="color: var(--st-ruta-text)">{{ p.observaciones }}</p>
            }
            <ul class="items-mini">
              @for (i of p.pedido_items ?? []; track i.id) {
                <li><span>{{ i.cantidad }} × {{ i.nombre }}</span></li>
              }
            </ul>
            <div class="acciones">
              @if (p.cliente_telefono) {
                <a class="b" [href]="'tel:' + p.cliente_telefono"><ion-icon name="call-outline"></ion-icon>Llamar</a>
                <a class="b b-wa" [href]="whatsapp(p)" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>WhatsApp</a>
              }
              <a class="b" [href]="mapa(p)" target="_blank" rel="noopener"><ion-icon name="navigate-outline"></ion-icon>Mapa</a>
              <button class="b b-pri" style="flex: 1" (click)="entregando.set(p)">Entregar</button>
            </div>
          </article>
        } @empty {
          <div class="vacio">
            <span class="vacio-titulo">{{ cargando() ? 'Cargando…' : 'No tienes pedidos en ruta' }}</span>
            @if (!cargando()) {
              <p>Cuando alistamiento te despache un pedido, aparece aquí.</p>
            }
          </div>
        }
      </div>

      @if (esMensajero()) {
        <section class="panel">
          <div class="hist-head">
            <h2>Mis entregas hechas</h2>
            <app-rango (cambio)="cambiarRango($event)"></app-rango>
          </div>
          @if (hechas().length) {
            <p class="hist-tot" style="margin: 12px 0 4px">
              <span><strong class="num">{{ hechas().length }}</strong> entregas</span>
              <span>Domicilios <strong class="num">{{ pesos(totHechas().domicilios) }}</strong></span>
              <span>Efectivo <strong class="num">{{ pesos(totHechas().efectivo) }}</strong></span>
              <span>Transferencias <strong class="num">{{ pesos(totHechas().transferencia) }}</strong></span>
            </p>
            <table class="hist">
              @for (p of hechas(); track p.id) {
                <tr (click)="abierto.set(p.id)">
                  <td>#{{ p.id }} · {{ p.cliente_nombre }}<small>{{ p.barrio || '' }} · {{ hora(p.entregado_at) }} · {{ p.cuadre_id ? 'cuadrado' : 'por cuadrar' }}</small></td>
                  <td class="num">{{ pesos(p.total) }}<small>{{ p.tipo_recaudo || '' }}</small></td>
                </tr>
              }
            </table>
          } @else {
            <p class="panel-sub" style="margin-top: 12px">No hay entregas en este periodo.</p>
          }
        </section>
      }
    </div>

    @if (entregando(); as p) {
      <app-entregar [pedido]="p" (cerrar)="entregando.set(null)" (entregado)="alEntregar(p)"></app-entregar>
    }
    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class MisEntregasPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  enRuta = signal<Pedido[]>([]);
  pendientes = signal<
    { mensajero_id: number; pedidos: number; efectivo: number; transferencia: number; domicilios: number; desde: string }[]
  >([]);
  detalle = signal<Pedido[]>([]);
  cargando = signal(true);
  entregando = signal<Pedido | null>(null);
  abierto = signal<number | null>(null);
  pesos = pesos;

  hechas = signal<Pedido[]>([]);
  private rango: RangoFechas | null = null;
  totHechas = computed(() =>
    this.hechas().reduce(
      (a, p) => ({
        domicilios: a.domicilios + Number(p.valor_domicilio || 0),
        efectivo: a.efectivo + Number(p.valor_efectivo || 0),
        transferencia: a.transferencia + Number(p.valor_transferencia || 0),
      }),
      { domicilios: 0, efectivo: 0, transferencia: 0 }
    )
  );

  esMensajero = computed(() => this.sb.tiene('mensajero'));
  pendiente = computed(() => this.pendientes().find((x) => x.mensajero_id === this.sb.usuario()?.id) ?? null);

  private dejar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ refreshOutline, callOutline, navigateOutline, logoWhatsapp });
  }

  ngOnInit(): void {
    void this.cargar();
    this.dejar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 600);
    });
  }

  ngOnDestroy(): void {
    this.dejar?.();
    clearTimeout(this.timer);
  }

  async cargar(): Promise<void> {
    try {
      const yo = this.sb.usuario()?.id;
      const soloMios = this.sb.tiene('mensajero') ? yo : undefined;
      const [r, c] = await Promise.all([this.ps.cola(['despachado'], soloMios), this.ps.cuadresPendientes()]);
      this.enRuta.set(r);
      this.pendientes.set(c);
      if (this.detalle().length && this.sb.usuario()) this.detalle.set(await this.ps.pendientesDe(this.sb.usuario()!.id));
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarRango(r: RangoFechas): void {
    this.rango = r;
    void this.cargarHechas();
  }

  async cargarHechas(): Promise<void> {
    const yo = this.sb.usuario()?.id;
    const r = this.rango;
    if (!yo || !r) return;
    try {
      this.hechas.set(
        await this.ps.entregadosPor(yo, r.desde ? inicioDiaColombia(r.desde).toISOString() : null, r.hasta ? finDiaColombia(r.hasta).toISOString() : null)
      );
    } catch (e) {
      this.toast.error(mensajeError(e));
    }
  }

  hora(iso: string | null): string {
    return iso ? formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso) : '';
  }

  async alEntregar(p: Pedido): Promise<void> {
    this.entregando.set(null);
    this.toast.ok(`#${p.id} entregado`);
    await Promise.all([this.cargar(), this.cargarHechas()]);
  }

  async verDetalle(): Promise<void> {
    if (this.detalle().length) return this.detalle.set([]);
    const yo = this.sb.usuario()?.id;
    if (yo) this.detalle.set(await this.ps.pendientesDe(yo));
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'long' });
  }

  /** Mensaje listo para avisarle al cliente que va el pedido */
  whatsapp(p: Pedido): string {
    const cliente = p.cliente_nombre.split(' ')[0];
    const yo = this.sb.usuario()?.nombre.split(' ')[0] ?? '';
    return enlaceWhatsapp(
      p.cliente_telefono,
      `Hola ${cliente}, soy ${yo}, mensajero de Jasta. Voy en camino con tu pedido #${p.id} por ${pesos(p.total)}.`
    );
  }

  mapa(p: Pedido): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.direccion ?? ''}, ${p.barrio ?? ''}, Cali`);
  }
}
