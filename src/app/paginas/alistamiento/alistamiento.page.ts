import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, printOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RotulosService } from '../../shared/rotulo/rotulos.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { Pedido, Usuario } from '../../shared/modelos';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoHoraCO, formatoFechaCO } from '../../shared/fecha-colombia';

/** Cola de trabajo: alistar pedidos nuevos y despacharlos con un mensajero */
@Component({
  selector: 'app-alistamiento',
  standalone: true,
  imports: [FormsModule, IonIcon, PedidoDetalleComponent],
  styles: [
    `
      .columnas { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
      .col-head { display: flex; align-items: baseline; gap: 8px; margin: 0 0 10px; font-size: 14px; font-weight: 600; }
      .col-head span { color: var(--text-muted); font-weight: 400; }
      .tarjeta h3 { cursor: pointer; }
      .despacho { display: flex; gap: 8px; }
      .despacho select { flex: 1; min-width: 0; }
      .obs { color: var(--st-ruta-text) !important; }
      @media (max-width: 760px) { .columnas { grid-template-columns: 1fr; } .oculta-cel { display: none; } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Alistamiento</h1>
        <button class="b" [disabled]="!sinRotulo().length" (click)="imprimirPendientes()">
          <ion-icon name="print-outline"></ion-icon>Imprimir rótulos ({{ sinRotulo().length }})
        </button>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
      </div>
      <div class="barra solo-cel">
        <div class="chips">
          <button class="chip" [class.on]="vista() === 'alistar'" (click)="vista.set('alistar')">Por alistar <span class="n">{{ porAlistar().length }}</span></button>
          <button class="chip" [class.on]="vista() === 'despachar'" (click)="vista.set('despachar')">Por despachar <span class="n">{{ alistados().length }}</span></button>
        </div>
      </div>
      <div class="vista-body">
        <div class="columnas">
          <section [class.oculta-cel]="vista() !== 'alistar'">
            <h2 class="col-head">Por alistar <span class="num">{{ porAlistar().length }}</span></h2>
            <div class="tarjetas">
              @for (p of porAlistar(); track p.id) {
                <article class="tarjeta">
                  <div class="tarjeta-top">
                    <h3 (click)="abierto.set(p.id)">#{{ p.id }} · {{ p.cliente_nombre }}</h3>
                    <span class="suave num" style="font-size: 12px">{{ hora(p.created_at) }}</span>
                  </div>
                  <ul class="items-mini">
                    @for (i of p.pedido_items ?? []; track i.id) {
                      <li><span>{{ i.cantidad }} × {{ i.nombre }}</span></li>
                    }
                  </ul>
                  <p>{{ p.barrio || 'Sin barrio' }} · {{ p.vendedora?.nombre || '—' }}</p>
                  @if (p.observaciones) {
                    <p class="obs">{{ p.observaciones }}</p>
                  }
                  <div class="acciones">
                    <button class="b" (click)="imprimir(p)"><ion-icon name="print-outline"></ion-icon>{{ p.rotulo_impreso_at ? 'Reimprimir' : 'Rótulo' }}</button>
                    <button class="b b-pri" style="flex: 1" [disabled]="ocupado() === p.id" (click)="alistar(p)">Marcar alistado</button>
                  </div>
                </article>
              } @empty {
                <div class="vacio">{{ cargando() ? 'Cargando…' : 'No hay pedidos por alistar.' }}</div>
              }
            </div>
          </section>

          <section [class.oculta-cel]="vista() !== 'despachar'">
            <h2 class="col-head">Por despachar <span class="num">{{ alistados().length }}</span></h2>
            <div class="tarjetas">
              @for (p of alistados(); track p.id) {
                <article class="tarjeta">
                  <div class="tarjeta-top">
                    <h3 (click)="abierto.set(p.id)">#{{ p.id }} · {{ p.cliente_nombre }}</h3>
                    <strong class="num">{{ pesos(p.total) }}</strong>
                  </div>
                  <p>{{ p.direccion }} · {{ p.barrio || 'Sin barrio' }}</p>
                  <p>
                    @if (p.rotulo_impreso_at) {
                      <span class="etiqueta">Rótulo impreso</span>
                    } @else {
                      <button class="b" (click)="imprimir(p)"><ion-icon name="print-outline"></ion-icon>Imprimir rótulo</button>
                    }
                  </p>
                  <div class="despacho">
                    <select class="inp" [(ngModel)]="eleccion[p.id]" aria-label="Mensajero">
                      <option [ngValue]="undefined">Elige mensajero…</option>
                      @for (m of mensajeros(); track m.id) {
                        <option [ngValue]="m.id">{{ m.nombre }}</option>
                      }
                    </select>
                    <button class="b b-pri" [disabled]="!eleccion[p.id] || ocupado() === p.id" (click)="despachar(p)">Despachar</button>
                  </div>
                </article>
              } @empty {
                <div class="vacio">{{ cargando() ? 'Cargando…' : 'No hay pedidos alistados esperando mensajero.' }}</div>
              }
            </div>
          </section>
        </div>
      </div>
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class AlistamientoPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private toast = inject(ToastService);
  private rotulos = inject(RotulosService);

  pedidos = signal<Pedido[]>([]);
  mensajeros = signal<Usuario[]>([]);
  cargando = signal(true);
  ocupado = signal<number | null>(null);
  abierto = signal<number | null>(null);
  vista = signal<'alistar' | 'despachar'>('alistar');
  eleccion: Record<number, number | undefined> = {};

  porAlistar = computed(() => this.pedidos().filter((p) => p.estado === 'por_alistar'));
  alistados = computed(() => this.pedidos().filter((p) => p.estado === 'alistado'));
  /** Rótulos por imprimir: todo lo que está en la cola y no tiene rótulo */
  sinRotulo = computed(() => this.pedidos().filter((p) => !p.rotulo_impreso_at));
  pesos = pesos;

  private dejar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ refreshOutline, printOutline });
  }

  ngOnInit(): void {
    void this.cargar();
    this.ps.mensajeros().then((m) => this.mensajeros.set(m)).catch(() => undefined);
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
      const ps = await this.ps.cola(['por_alistar', 'alistado']);
      this.pedidos.set(ps);
      for (const p of ps) if (p.mensajero_id && this.eleccion[p.id] === undefined) this.eleccion[p.id] = p.mensajero_id;
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  async alistar(p: Pedido): Promise<void> {
    this.ocupado.set(p.id);
    try {
      await this.ps.cambiarEstado(p.id, 'alistado');
      this.toast.ok(`#${p.id} alistado`);
      await this.cargar();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  async despachar(p: Pedido): Promise<void> {
    const m = this.eleccion[p.id];
    if (!m) return;
    this.ocupado.set(p.id);
    try {
      await this.ps.cambiarEstado(p.id, 'despachado', m);
      this.toast.ok(`#${p.id} despachado`);
      await this.cargar();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(null);
    }
  }

  async imprimir(p: Pedido): Promise<void> {
    if (await this.rotulos.imprimir([p])) await this.cargar();
  }

  async imprimirPendientes(): Promise<void> {
    const lista = this.sinRotulo();
    if (await this.rotulos.imprimir(lista)) {
      this.toast.ok(`${lista.length} rótulo(s) enviados a imprimir`);
      await this.cargar();
    }
  }

  hora(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
