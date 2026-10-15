import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, callOutline, navigateOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { EntregarComponent } from '../../shared/entregar/entregar.component';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { Pedido } from '../../shared/modelos';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO } from '../../shared/fecha-colombia';

/** Pantalla del mensajero: lo que tiene en ruta y lo que lleva por cuadrar */
@Component({
  selector: 'app-mis-entregas',
  standalone: true,
  imports: [IonIcon, EntregarComponent, PedidoDetalleComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .tarjeta h3 { cursor: pointer; }
      .total { font-size: 17px; }
      .cuadre { display: flex; flex-direction: column; gap: 12px; }
      .cuadre .panel-head { margin-bottom: 0; }
      .en-ruta { font-size: 13px; color: var(--text-soft); }
      .entregar-total { display: flex; flex-direction: column; gap: 2px; padding: 14px; border-radius: var(--radius); background: var(--accent-wash); }
      .entregar-total span { font-size: 13px; color: var(--text-2); }
      .entregar-total strong { font-size: 28px; font-weight: 600; color: var(--accent); letter-spacing: -0.01em; }
      .desglose { display: grid; grid-template-columns: 1fr auto; gap: 6px 12px; margin: 0; font-size: 13px; }
      .desglose dt { color: var(--text-soft); }
      .desglose dd { margin: 0; text-align: right; }
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

  esMensajero = computed(() => this.sb.tiene('mensajero'));
  pendiente = computed(() => this.pendientes().find((x) => x.mensajero_id === this.sb.usuario()?.id) ?? null);

  private dejar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ refreshOutline, callOutline, navigateOutline });
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

  async alEntregar(p: Pedido): Promise<void> {
    this.entregando.set(null);
    this.toast.ok(`#${p.id} entregado`);
    await this.cargar();
  }

  async verDetalle(): Promise<void> {
    if (this.detalle().length) return this.detalle.set([]);
    const yo = this.sb.usuario()?.id;
    if (yo) this.detalle.set(await this.ps.pendientesDe(yo));
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'long' });
  }

  mapa(p: Pedido): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.direccion ?? ''}, ${p.barrio ?? ''}, Cali`);
  }
}
