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

/** Pantalla del mensajero: lo que tiene en ruta y lo que lleva por cuadrar */
@Component({
  selector: 'app-mis-entregas',
  standalone: true,
  imports: [IonIcon, EntregarComponent, PedidoDetalleComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .tarjeta h3 { cursor: pointer; }
      .contacto { display: flex; gap: 8px; }
      .total { font-size: 17px; }
      @media (max-width: 640px) { .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } .kpi:nth-child(3) { border-left: 1px solid var(--border); } .kpi:nth-child(n + 3) { border-top: none; } }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><h1>Mis entregas</h1></div>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
      </div>

      <div class="kpis">
        <div class="kpi"><span class="kpi-label">En ruta</span><span class="kpi-valor num">{{ enRuta().length }}</span></div>
        <div class="kpi"><span class="kpi-label">Por cuadrar</span><span class="kpi-valor num">{{ pendiente()?.pedidos ?? 0 }}</span></div>
        <div class="kpi kpi-principal"><span class="kpi-label">Efectivo a entregar</span><span class="kpi-valor num">{{ pesos(pendiente()?.efectivo ?? 0) }}</span></div>
      </div>

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
  pendientes = signal<{ mensajero_id: number; pedidos: number; efectivo: number }[]>([]);
  cargando = signal(true);
  entregando = signal<Pedido | null>(null);
  abierto = signal<number | null>(null);
  pesos = pesos;

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

  mapa(p: Pedido): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.direccion ?? ''}, ${p.barrio ?? ''}, Cali`);
  }
}
