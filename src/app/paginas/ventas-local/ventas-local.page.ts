import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';
import { Pedido } from '../../shared/modelos';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';

type Metodo = 'todos' | 'efectivo' | 'transferencia' | 'mixto';

/** Registro de las ventas del punto físico: qué se vendió, quién, a qué hora y cómo pagó */
@Component({
  selector: 'app-ventas-local',
  standalone: true,
  imports: [FormsModule, RouterLink, IonIcon, RangoComponent, PedidoDetalleComponent],
  styles: [
    `
      .seccion { padding: 16px 20px 0; }
      .prods { white-space: normal; min-width: 220px; max-width: 360px; font-size: 12px; color: var(--text-soft); line-height: 1.35; }
      .tabla td { white-space: nowrap; }
      @media (max-width: 760px) { .seccion { padding: 12px 14px 0; } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Ventas del local <small class="num">{{ numero(ventas().length) }}</small></h1>
        <a class="b b-pri" routerLink="/app/venta-local"><ion-icon name="add"></ion-icon>Nueva venta</a>
      </div>
      <div class="barra">
        <app-rango (cambio)="cambiarRango($event)"></app-rango>
        <div class="chips">
          @for (m of metodos; track m.id) {
            <button class="chip" [class.on]="metodo() === m.id" (click)="metodo.set(m.id)">{{ m.label }}</button>
          }
        </div>
      </div>
      <div class="seccion">
        <div class="cifras-grid">
          <div class="cifra-t clave"><small>Total vendido</small><strong class="num">{{ pesos(tot().total) }}</strong><em>{{ tot().n }} ventas</em></div>
          <div class="cifra-t"><small>Efectivo</small><strong class="num">{{ pesos(tot().efectivo) }}</strong></div>
          <div class="cifra-t"><small>Transferencias</small><strong class="num">{{ pesos(tot().transferencia) }}</strong></div>
        </div>
      </div>
      <div class="tabla-wrap" style="margin-top: 16px">
        <table class="tabla">
          <thead><tr><th>Hora</th><th>N.º</th><th>Cliente</th><th>Productos</th><th>Vendió</th><th>Pago</th><th class="der">Efectivo</th><th class="der">Transferencia</th><th class="der">Total</th></tr></thead>
          <tbody>
            @for (v of filtradas(); track v.id) {
              <tr class="click" (click)="abierto.set(v.id)">
                <td class="suave">{{ fecha(v.created_at) }}</td>
                <td class="num suave">#{{ v.id }}</td>
                <td>{{ v.cliente_nombre }}</td>
                <td class="prods">{{ productos(v) }}</td>
                <td>{{ v.vendedora?.nombre || '—' }}</td>
                <td>{{ pago(v.tipo_recaudo) }}</td>
                <td class="der num">{{ pesos(v.valor_efectivo) }}</td>
                <td class="der num">{{ pesos(v.valor_transferencia) }}</td>
                <td class="der num">{{ pesos(v.total) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="9" class="suave">{{ cargando() ? 'Cargando…' : 'No hay ventas en el local en este periodo.' }}</td></tr>
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
export class VentasLocalPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  metodos: { id: Metodo; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'mixto', label: 'Mixto' },
  ];
  metodo = signal<Metodo>('todos');
  ventas = signal<Pedido[]>([]);
  cargando = signal(true);
  abierto = signal<number | null>(null);
  private rango: RangoFechas | null = null;
  private dejar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  filtradas = computed(() => (this.metodo() === 'todos' ? this.ventas() : this.ventas().filter((v) => v.tipo_recaudo === this.metodo())));
  tot = computed(() =>
    this.filtradas().reduce(
      (a, v) => ({
        n: a.n + (v.estado === 'cancelado' ? 0 : 1),
        total: a.total + (v.estado === 'cancelado' ? 0 : Number(v.total)),
        efectivo: a.efectivo + (v.estado === 'cancelado' ? 0 : Number(v.valor_efectivo || 0)),
        transferencia: a.transferencia + (v.estado === 'cancelado' ? 0 : Number(v.valor_transferencia || 0)),
      }),
      { n: 0, total: 0, efectivo: 0, transferencia: 0 }
    )
  );

  pesos = pesos;
  numero = numero;

  constructor() {
    addIcons({ add });
  }

  ngOnInit(): void {
    this.dejar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 600);
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
    this.cargando.set(true);
    try {
      const res = await this.ps.listar({
        estado: null,
        canal: 'local',
        conItems: true,
        desde: r.desde ? inicioDiaColombia(r.desde).toISOString() : null,
        hasta: r.hasta ? finDiaColombia(r.hasta).toISOString() : null,
        porPagina: 1000,
      });
      this.ventas.set(res.filas);
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  productos(p: Pedido): string {
    return (p.pedido_items ?? []).map((i) => (i.cantidad > 1 ? `${i.nombre} x${i.cantidad}` : i.nombre)).join(', ');
  }

  pago(t: string | null): string {
    return t === 'efectivo' ? 'Efectivo' : t === 'transferencia' ? 'Transferencia' : t === 'mixto' ? 'Mixto' : '—';
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
