import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, callOutline, navigateOutline, logoWhatsapp, chatbubbleEllipses } from 'ionicons/icons';
import { enlaceWhatsapp, productosDelPedido } from '../../shared/whatsapp';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ToastService } from '../../shared/toast/toast.service';
import { EntregarComponent } from '../../shared/entregar/entregar.component';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { Pedido } from '../../shared/modelos';
import { mensajeError, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';
import { RangoFechas } from '../../shared/rango/rango.component';
import { DiaComponent } from '../../shared/rango/dia.component';
import { nombreConVariante } from '../../shared/variante';

/** Pantalla del mensajero: lo que tiene en ruta y lo que lleva por cuadrar */
@Component({
  selector: 'app-mis-entregas',
  standalone: true,
  imports: [IonIcon, EntregarComponent, PedidoDetalleComponent, DiaComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .tarjeta h3 { cursor: pointer; }
      .chip-mensaje { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border: none;
        border-radius: 999px; background: var(--oro); color: #0f172a; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
      .chip-mensaje ion-icon { font-size: 15px; }
      .total { font-size: 17px; }
      .b-wa { color: var(--efectivo); border-color: color-mix(in srgb, var(--efectivo) 40%, var(--border)); }
      @media (hover: hover) { .b-wa:hover { border-color: var(--efectivo); background: var(--ok-wash); } }
      .cuadre { display: flex; flex-direction: column; gap: 12px; }
      .cuadre .panel-head { margin-bottom: 0; }
      .en-ruta { font-size: 13px; color: var(--text-soft); }
      .entregar-total { display: flex; flex-direction: column; gap: 4px; padding: 14px 16px; border-radius: var(--radius); background: var(--ok-wash); }
      .entregar-total span { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--efectivo-texto); }
      .entregar-total strong { font-family: var(--mono-font); font-size: 28px; font-weight: 600; color: var(--text); letter-spacing: -0.03em; }
      .desglose { display: grid; grid-template-columns: 1fr auto; gap: 6px 0; margin: 0; font-size: 13px; }
      .desglose dt { display: flex; align-items: baseline; gap: 8px; color: var(--text-soft); }
      .desglose dt::after { content: ''; flex: 1; min-width: 16px; border-bottom: 1px dotted var(--border-strong); transform: translateY(-4px); }
      .desglose dd { margin: 0; padding-left: 8px; text-align: right; }
      .hist-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .hist { width: 100%; border-collapse: collapse; font-size: 13px; }
      .hist td { padding: 8px 4px; border-bottom: var(--perfora); }
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
              <h3 (click)="abrir(p.id)"><span class="guia">#{{ p.id }}</span> {{ p.cliente_nombre }}</h3>
              <strong class="total num">{{ pesos(p.total) }}</strong>
            </div>
            @if (avisos.pedidosConMensajes().has(p.id)) {
              <button type="button" class="chip-mensaje" (click)="abrir(p.id, true)">
                <ion-icon name="chatbubble-ellipses" aria-hidden="true"></ion-icon>Mensaje nuevo de la tienda
              </button>
            }
            <p>{{ p.direccion }}<br />{{ p.barrio || 'Sin barrio' }}</p>
            @if (p.observaciones) {
              <p style="color: var(--st-pendiente-text)">{{ p.observaciones }}</p>
            }
            <ul class="items-mini">
              @for (i of p.pedido_items ?? []; track i.id) {
                <li><span>{{ i.cantidad }} × {{ nombreConVariante(i) }}</span></li>
              }
            </ul>
            <div class="acciones">
              @if (p.cliente_telefono) {
                <a class="b" [href]="'tel:' + p.cliente_telefono"><ion-icon name="call-outline"></ion-icon>Llamar</a>
                <a class="b b-wa" [href]="whatsapp(p)" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>WhatsApp</a>
              }
              <a class="b" [href]="mapa(p)" target="_blank" rel="noopener"><ion-icon name="navigate-outline"></ion-icon>Mapa</a>
              <button class="b b-ok" style="flex: 1" (click)="entregando.set(p)">Entregar</button>
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
            <app-dia (cambio)="cambiarRango($event)"></app-dia>
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
      <app-pedido-detalle [pedidoId]="id" [chat]="abiertoEnChat()" (cerrar)="cerrarDetalle()" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class MisEntregasPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  avisos = inject(NotificacionesService);

  enRuta = signal<Pedido[]>([]);
  pendientes = signal<
    { mensajero_id: number; pedidos: number; efectivo: number; transferencia: number; domicilios: number; desde: string }[]
  >([]);
  detalle = signal<Pedido[]>([]);
  cargando = signal(true);
  entregando = signal<Pedido | null>(null);
  abierto = signal<number | null>(null);
  abiertoEnChat = signal(false);
  pesos = pesos;
  nombreConVariante = nombreConVariante;

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
  private subParams?: { unsubscribe(): void };
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ refreshOutline, callOutline, navigateOutline, logoWhatsapp, chatbubbleEllipses });
  }

  ngOnInit(): void {
    void this.cargar();
    // Al tocar un aviso (mensaje o pedido asignado) se abre ese pedido
    this.subParams = this.route.queryParamMap.subscribe((q) => {
      const id = Number(q.get('id'));
      if (id) {
        this.abiertoEnChat.set(q.get('chat') === '1');
        this.abierto.set(id);
      }
    });
    this.dejar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 600);
    });
  }

  ngOnDestroy(): void {
    this.subParams?.unsubscribe();
    this.dejar?.();
    clearTimeout(this.timer);
  }

  abrir(id: number, chat = false): void {
    this.abiertoEnChat.set(chat);
    this.abierto.set(id);
    void this.router.navigate([], { queryParams: { id, chat: chat ? 1 : null }, replaceUrl: true });
  }

  cerrarDetalle(): void {
    this.abierto.set(null);
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
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
      (p.pedido_items?.length
        ? `Hola ${cliente}, soy ${yo}, mensajero de Jasta. Voy en camino con tu pedido de ${productosDelPedido(p.pedido_items)} por ${pesos(p.total)}.`
        : `Hola ${cliente}, soy ${yo}, mensajero de Jasta. Voy en camino con tu pedido por ${pesos(p.total)}.`)
    );
  }

  mapa(p: Pedido): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.direccion ?? ''}, ${p.barrio ?? ''}, Cali`);
  }
}
