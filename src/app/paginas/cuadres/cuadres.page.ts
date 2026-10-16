import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';
import { Cuadre, Pedido } from '../../shared/modelos';
import { mensajeError, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';

interface Pendiente {
  mensajero_id: number;
  nombre: string;
  pedidos: number;
  efectivo: number;
  transferencia: number;
  domicilios: number;
  desde: string;
}

@Component({
  selector: 'app-cuadres',
  standalone: true,
  imports: [IonIcon, PedidoDetalleComponent, RangoComponent],
  styles: [
    `
      .cifras { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
      .cifra { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-2); }
      .cifra small { font-size: 12px; color: var(--text-soft); }
      .cifra strong { font-size: 15px; }
      .cifra.clave { background: var(--accent-wash); }
      .cifra.clave small { color: var(--oro-texto); }
      .cifra.clave strong { color: var(--text); }
      .mini { width: 100%; border-collapse: collapse; font-size: 13px; }
      .mini td { padding: 6px 4px; border-bottom: 1px solid var(--border-soft); }
      .mini td:last-child { text-align: right; }
      .mini tr { cursor: pointer; }
      .mini tr:hover td { background: var(--hover); }
      h2 { margin: 0; font-size: 14px; font-weight: 600; }
      .hist-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      @media (max-width: 640px) { .cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Cuadres</h1>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
      </div>
      <div class="vista-body">
        <h2>Pendientes por cuadrar</h2>
        <div class="tarjetas">
          @for (c of pendientes(); track c.mensajero_id) {
            <article class="tarjeta">
              <div class="tarjeta-top">
                <h3>{{ c.nombre }}</h3>
                <span class="suave" style="font-size: 12px">desde {{ fecha(c.desde) }}</span>
              </div>
              <div class="cifras">
                <div class="cifra"><small>Pedidos</small><strong class="num">{{ c.pedidos }}</strong></div>
                <div class="cifra clave"><small>Efectivo a recibir</small><strong class="num">{{ pesos(c.efectivo - c.domicilios) }}</strong></div>
                <div class="cifra"><small>Transferencias</small><strong class="num">{{ pesos(c.transferencia) }}</strong></div>
                <div class="cifra"><small>Domicilios (para él)</small><strong class="num">{{ pesos(c.domicilios) }}</strong></div>
              </div>
              <p>Efectivo cobrado {{ pesos(c.efectivo) }} menos domicilios {{ pesos(c.domicilios) }}.</p>
              @if (abiertoM() === c.mensajero_id) {
                <table class="mini">
                  @for (p of pedidosM(); track p.id) {
                    <tr (click)="abierto.set(p.id)">
                      <td class="num suave">#{{ p.id }}</td><td>{{ p.cliente_nombre }}</td>
                      <td class="suave">{{ p.tipo_recaudo || '—' }}</td><td class="num">{{ pesos(p.total) }}</td>
                    </tr>
                  }
                </table>
              }
              <div class="acciones">
                <button class="b" (click)="verPedidos(c.mensajero_id)">
                  <ion-icon [name]="abiertoM() === c.mensajero_id ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
                  {{ abiertoM() === c.mensajero_id ? 'Ocultar pedidos' : 'Ver pedidos' }}
                </button>
                @if (puedeCerrar()) {
                  <button class="b b-pri" [disabled]="cerrando() === c.mensajero_id" (click)="cerrar(c)">Cerrar cuadre</button>
                }
              </div>
            </article>
          } @empty {
            <div class="vacio">{{ cargando() ? 'Cargando…' : 'No hay entregas pendientes por cuadrar.' }}</div>
          }
        </div>

        <div class="hist-head">
          <h2>Historial de cuadres</h2>
          <app-rango [conTodo]="true" inicial="todo" (cambio)="cambiarRango($event)"></app-rango>
        </div>
        @if (historial().length) {
          <div class="cifras">
            <div class="cifra"><small>Cuadres</small><strong class="num">{{ historial().length }}{{ historial().length === 30 ? '+' : '' }}</strong></div>
            <div class="cifra"><small>Pedidos</small><strong class="num">{{ resumenHist().pedidos }}</strong></div>
            <div class="cifra clave"><small>Efectivo recibido</small><strong class="num">{{ pesos(resumenHist().efectivo - resumenHist().domicilios) }}</strong></div>
            <div class="cifra"><small>Transferencias</small><strong class="num">{{ pesos(resumenHist().transferencia) }}</strong></div>
          </div>
          @if (historial().length === 30) {
            <p class="ayuda">Las cifras suman los cuadres de esta página.</p>
          }
        }
        <div class="tabla-wrap">
          <table class="tabla tarjetas-cel">
            <thead><tr><th>Fecha</th><th>Mensajero</th><th class="der">Pedidos</th><th class="der">Efectivo</th><th class="der">Transferencia</th><th class="der">Domicilios</th><th>Cerró</th></tr></thead>
            <tbody>
              @for (c of historial(); track c.id) {
                <tr class="click" (click)="verCuadre(c)">
                  <td class="suave" data-etq="Fecha">{{ fecha(c.cerrado_at) }}</td>
                  <td data-etq="Mensajero">{{ c.mensajero?.nombre || '—' }}</td>
                  <td class="der num" data-etq="Pedidos">{{ c.cantidad_pedidos }}</td>
                  <td class="der num" data-etq="Efectivo">{{ pesos(c.total_efectivo) }}</td>
                  <td class="der num" data-etq="Transferencia">{{ pesos(c.total_transferencia) }}</td>
                  <td class="der num" data-etq="Domicilios">{{ pesos(c.total_domicilios) }}</td>
                  <td class="suave corta" data-etq="Cerró">{{ c.cerrado_por_nombre || '—' }}</td>
                </tr>
                @if (cuadreAbierto() === c.id) {
                  <tr><td colspan="7">
                    <table class="mini">
                      @for (p of pedidosCuadre(); track p.id) {
                        <tr (click)="abierto.set(p.id)">
                          <td class="num suave">#{{ p.id }}</td><td>{{ p.cliente_nombre }}</td><td class="suave">{{ p.tipo_recaudo || '—' }}</td><td class="num">{{ pesos(p.total) }}</td>
                        </tr>
                      }
                    </table>
                  </td></tr>
                }
              } @empty {
                <tr><td colspan="7" class="suave">Sin cuadres todavía.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <div class="paginar">
          <span>Página {{ pagina() + 1 }}</span>
          <span style="display: flex; gap: 8px">
            <button class="b" [disabled]="pagina() === 0" (click)="irPagina(pagina() - 1)">Anterior</button>
            <button class="b" [disabled]="historial().length < 30" (click)="irPagina(pagina() + 1)">Siguiente</button>
          </span>
        </div>
      </div>
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class CuadresPage implements OnInit {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  pendientes = signal<Pendiente[]>([]);
  historial = signal<Cuadre[]>([]);
  pagina = signal(0);
  cargando = signal(true);
  cerrando = signal<number | null>(null);
  abiertoM = signal<number | null>(null);
  pedidosM = signal<Pedido[]>([]);
  cuadreAbierto = signal<number | null>(null);
  pedidosCuadre = signal<Pedido[]>([]);
  abierto = signal<number | null>(null);

  private rango: RangoFechas = { desde: '', hasta: '', etiqueta: '' };
  resumenHist = computed(() =>
    this.historial().reduce(
      (a, c) => ({
        pedidos: a.pedidos + Number(c.cantidad_pedidos),
        efectivo: a.efectivo + Number(c.total_efectivo),
        transferencia: a.transferencia + Number(c.total_transferencia),
        domicilios: a.domicilios + Number(c.total_domicilios),
      }),
      { pedidos: 0, efectivo: 0, transferencia: 0, domicilios: 0 }
    )
  );

  puedeCerrar = computed(() => this.sb.tiene('admin', 'cuadres'));
  pesos = pesos;

  constructor() {
    addIcons({ refreshOutline, chevronDownOutline, chevronUpOutline });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  private soloMio(): number | null {
    return this.sb.tiene('admin', 'cuadres') ? null : (this.sb.usuario()?.id ?? null);
  }

  async cargar(): Promise<void> {
    try {
      const [p, h] = await Promise.all([this.ps.cuadresPendientes(), this.historialPagina(this.pagina())]);
      this.pendientes.set(p);
      this.historial.set(h);
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private historialPagina(n: number) {
    const r = this.rango;
    return this.ps.historialCuadres(
      n,
      this.soloMio(),
      r.desde ? inicioDiaColombia(r.desde).toISOString() : null,
      r.hasta ? finDiaColombia(r.hasta).toISOString() : null
    );
  }

  cambiarRango(r: RangoFechas): void {
    this.rango = r;
    void this.irPagina(0);
  }

  async irPagina(n: number): Promise<void> {
    this.pagina.set(n);
    this.historial.set(await this.historialPagina(n));
  }

  async verPedidos(id: number): Promise<void> {
    if (this.abiertoM() === id) return this.abiertoM.set(null);
    this.pedidosM.set([]);
    this.abiertoM.set(id);
    this.pedidosM.set(await this.ps.pendientesDe(id));
  }

  async verCuadre(c: Cuadre): Promise<void> {
    if (this.cuadreAbierto() === c.id) return this.cuadreAbierto.set(null);
    this.pedidosCuadre.set([]);
    this.cuadreAbierto.set(c.id);
    this.pedidosCuadre.set(await this.ps.pedidosDeCuadre(c.id));
  }

  async cerrar(c: Pendiente): Promise<void> {
    const recibe = pesos(c.efectivo - c.domicilios);
    if (!confirm(`¿Cerrar el cuadre de ${c.nombre}? ${c.pedidos} pedidos · recibes ${recibe} en efectivo.`)) return;
    this.cerrando.set(c.mensajero_id);
    try {
      await this.ps.cerrarCuadre(c.mensajero_id);
      this.toast.ok(`Cuadre de ${c.nombre} cerrado`);
      this.abiertoM.set(null);
      await this.cargar();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cerrando.set(null);
    }
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
