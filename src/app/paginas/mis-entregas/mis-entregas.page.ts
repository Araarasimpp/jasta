import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, callOutline, navigateOutline, logoWhatsapp, chatbubbleEllipses, chatbubbleEllipsesOutline } from 'ionicons/icons';
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
      .top-izq { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; cursor: pointer; }
      .top-izq .total { display: flex; align-items: baseline; gap: 8px; font-size: 19px; line-height: 1.2; }
      .top-izq .total small { font-size: 12px; font-weight: 500; color: var(--text-muted); text-transform: capitalize; font-family: var(--font); }
      .top-der { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
      /* Chat con la vendedora: burbuja con un "?" (o "!" si hay mensaje nuevo) */
      .chat-btn { position: relative; width: 42px; height: 42px; display: grid; place-items: center; padding: 0; border: 1px solid var(--accent-soft);
        border-radius: 50%; background: var(--accent-wash); color: var(--accent); font-size: 21px; cursor: pointer;
        transition: transform 120ms var(--ease), background 120ms var(--ease); -webkit-tap-highlight-color: transparent; }
      .chat-btn:active { transform: scale(0.92); }
      @media (hover: hover) { .chat-btn:hover { background: var(--accent-soft); } }
      .chat-q { position: absolute; top: -5px; right: -5px; min-width: 19px; height: 19px; padding: 0 4px; display: grid; place-items: center;
        border-radius: 10px; border: 2px solid var(--surface); background: var(--accent); color: #fff; font-size: 11.5px; font-weight: 800; line-height: 1; }
      .chat-btn.nuevo { border-color: color-mix(in srgb, var(--danger) 40%, transparent); background: var(--danger-wash); color: var(--danger); }
      .chat-btn.nuevo .chat-q { background: var(--danger); animation: latido 1.4s ease-in-out infinite; }
      @keyframes latido { 50% { transform: scale(1.18); } }
      @media (prefers-reduced-motion: reduce) { .chat-btn.nuevo .chat-q { animation: none; } }
      .chip-mensaje { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 12px; border: none;
        border-radius: 999px; background: var(--oro); color: #0f172a; font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
      .chip-mensaje ion-icon { font-size: 15px; }
      .b-wa { color: var(--efectivo); border-color: color-mix(in srgb, var(--efectivo) 40%, var(--border)); }
      @media (hover: hover) { .b-wa:hover { border-color: var(--efectivo); background: var(--ok-wash); } }
      .cuadre { display: flex; flex-direction: column; gap: 12px; }
      .cuadre .panel-head { margin-bottom: 0; }
      .acciones-cuadre { display: flex; gap: 8px; flex-wrap: wrap; }
      .acciones-cuadre .b { flex: 1 1 200px; justify-content: center; }
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
      /* Ordenar la ruta: mantener presionada una tarjeta y moverla */
      .ayuda-ruta { margin: 0 0 -2px; font-size: 13px; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
      .tarjetas .tarjeta { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
        transition: box-shadow 160ms var(--ease), scale 160ms var(--ease); }
      .tarjetas .tarjeta.arrastrando { touch-action: none; position: relative; z-index: 20; scale: 1.02; box-shadow: 0 18px 44px rgba(15, 23, 42, 0.28);
        outline: 2px solid var(--accent); outline-offset: -1px; }
      .tarjetas.ordenando .tarjeta:not(.arrastrando) { transition: box-shadow 160ms var(--ease), transform 180ms var(--ease); }
      .parada { display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 6px; margin-right: 6px; border-radius: 12px;
        background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 750; font-family: var(--mono-font); vertical-align: 2px; }
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
            <div class="acciones-cuadre">
              <button class="b" (click)="verDetalle()">{{ detalle().length ? 'Ocultar pedidos' : 'Ver pedidos por cuadrar' }}</button>
              <button class="b b-ok" [disabled]="cerrandoCuadre()" (click)="cerrarMiCuadre()">
                {{ cerrandoCuadre() ? 'Cerrando…' : 'Cerrar mi cuadre (' + c.pedidos + (c.pedidos === 1 ? ' pedido)' : ' pedidos)') }}</button>
            </div>
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

      @if (rutaOrdenada().length > 1) {
        <p class="ayuda-ruta">Mantén presionada una tarjeta y muévela para ordenar tu ruta.</p>
      }
      <div class="tarjetas" [class.ordenando]="arrastrandoId() !== null">
        @for (p of rutaOrdenada(); track p.id; let i = $index) {
          <article class="tarjeta" [class.arrastrando]="arrastrandoId() === p.id" (pointerdown)="presionar($event, p.id)" (touchstart)="tocar($event, p.id)" (contextmenu)="$event.preventDefault()">
            <div class="tarjeta-top">
              <div class="top-izq" (click)="abrir(p.id)">
                <h3>@if (rutaOrdenada().length > 1) {<span class="parada" [attr.aria-label]="'Parada ' + (i + 1)">{{ i + 1 }}</span>}<span class="guia">#{{ p.id }}</span> {{ p.cliente_nombre }}</h3>
                <strong class="total num">{{ pesos(p.total) }}<small>{{ p.tipo_recaudo || '' }}</small></strong>
              </div>
              <div class="top-der">
                <button type="button" class="chat-btn" [class.nuevo]="avisos.pedidosConMensajes().has(p.id)" (click)="abrir(p.id, true)"
                  [attr.aria-label]="avisos.pedidosConMensajes().has(p.id) ? 'Mensaje nuevo de la vendedora: abrir chat' : 'Preguntarle a la vendedora (chat del pedido)'"
                  title="Chat con la vendedora">
                  <ion-icon name="chatbubble-ellipses-outline" aria-hidden="true"></ion-icon>
                  <span class="chat-q" aria-hidden="true">{{ avisos.pedidosConMensajes().has(p.id) ? '!' : '?' }}</span>
                </button>
              </div>
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
              <span>Cuadrado <strong class="num">{{ pesos(totHechas().cuadrado) }}</strong></span>
              @if (totHechas().porCuadrar) {
                <span>Por cuadrar <strong class="num">{{ pesos(totHechas().porCuadrar) }}</strong></span>
              }
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
  cerrandoCuadre = signal(false);
  /** Orden de la ruta que el mensajero armó (ids), guardado en este celular */
  orden = signal<number[]>([]);
  arrastrandoId = signal<number | null>(null);
  rutaOrdenada = computed(() => {
    const pos = new Map(this.orden().map((id, i) => [id, i]));
    return this.enRuta()
      .map((p, i) => ({ p, k: pos.has(p.id) ? pos.get(p.id)! : 1e6 + i }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.p);
  });
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
  /** Cuadrado / por cuadrar = efectivo − domicilios, igual que en Cuadres (lo que el mensajero entrega) */
  totHechas = computed(() =>
    this.hechas().reduce(
      (a, p) => {
        const neto = Number(p.valor_efectivo || 0) - Number(p.valor_domicilio || 0);
        return {
          domicilios: a.domicilios + Number(p.valor_domicilio || 0),
          efectivo: a.efectivo + Number(p.valor_efectivo || 0),
          transferencia: a.transferencia + Number(p.valor_transferencia || 0),
          cuadrado: a.cuadrado + (p.cuadre_id ? neto : 0),
          porCuadrar: a.porCuadrar + (p.cuadre_id ? 0 : neto),
        };
      },
      { domicilios: 0, efectivo: 0, transferencia: 0, cuadrado: 0, porCuadrar: 0 }
    )
  );

  esMensajero = computed(() => this.sb.tiene('mensajero'));
  pendiente = computed(() => this.pendientes().find((x) => x.mensajero_id === this.sb.usuario()?.id) ?? null);

  private dejar?: () => void;
  private subParams?: { unsubscribe(): void };
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ refreshOutline, callOutline, navigateOutline, logoWhatsapp, chatbubbleEllipses, chatbubbleEllipsesOutline });
  }

  ngOnInit(): void {
    try {
      const guardado = JSON.parse(localStorage.getItem(this.claveOrden()) || '[]');
      if (Array.isArray(guardado)) this.orden.set(guardado.filter((x) => typeof x === 'number'));
    } catch { /* sin almacenamiento: orden por defecto */ }
    document.addEventListener('touchmove', this.bloquearScroll, { passive: false });
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
    document.removeEventListener('touchmove', this.bloquearScroll);
    this.soltar();
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

  // ------------------------------------------------- Ordenar la ruta (arrastrar)
  private claveOrden(): string {
    return `jasta-ruta-${this.sb.usuario()?.id ?? 0}`;
  }
  private guardarOrden(): void {
    try { localStorage.setItem(this.claveOrden(), JSON.stringify(this.orden().slice(-300))); } catch { /* sin almacenamiento */ }
  }
  private espera?: ReturnType<typeof setTimeout>;
  private el: HTMLElement | null = null;
  private xy = { x: 0, y: 0 };
  private agarre = 0;
  private dy = 0;
  private raf = 0;
  private scroller: HTMLElement | null = null;
  private indiceEsperado: number | null = null;

  /** Mientras se arrastra, el dedo mueve la tarjeta y no la página */
  private bloquearScroll = (e: TouchEvent): void => {
    if (this.arrastrandoId() !== null) e.preventDefault();
  };

  /** Mantener presionado ~0,4 s (sin mover el dedo) para empezar a mover la tarjeta */
  presionar(e: PointerEvent, id: number): void {
    if (e.pointerType !== 'mouse') return; // en el celular se usa tocar() con eventos táctiles (iPhone cancela los de puntero)
    if (e.button !== 0) return;
    if ((e.target as Element | null)?.closest('button, a, input, textarea')) return;
    if (this.rutaOrdenada().length < 2) return;
    const el = e.currentTarget as HTMLElement;
    const x0 = e.clientX, y0 = e.clientY;
    const mover0 = (ev: PointerEvent) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) cancelar(); };
    const cancelar = () => {
      clearTimeout(this.espera);
      window.removeEventListener('pointermove', mover0);
      window.removeEventListener('pointerup', cancelar);
      window.removeEventListener('pointercancel', cancelar);
    };
    cancelar();
    window.addEventListener('pointermove', mover0);
    window.addEventListener('pointerup', cancelar);
    window.addEventListener('pointercancel', cancelar);
    this.espera = setTimeout(() => { cancelar(); this.empezar(el, id, x0, y0); }, 420);
  }

  /**
   * Celular (iPhone y Android): mantener el dedo quieto ~0,4 s y luego moverlo.
   * Se usan eventos táctiles porque Safari cancela los de puntero al mantener presionado.
   */
  tocar(e: TouchEvent, id: number): void {
    if (e.touches.length !== 1) return;
    if ((e.target as Element | null)?.closest('button, a, input, textarea')) return;
    if (this.rutaOrdenada().length < 2) return;
    const el = e.currentTarget as HTMLElement;
    const t0 = e.touches[0];
    const x0 = t0.clientX, y0 = t0.clientY;
    let activo = false;
    const mover = (ev: TouchEvent) => {
      const t = ev.touches[0];
      if (!t) return;
      if (activo) {
        if (ev.cancelable) ev.preventDefault();
        this.xy = { x: t.clientX, y: t.clientY };
      } else if (Math.hypot(t.clientX - x0, t.clientY - y0) > 10) {
        terminar(); // el dedo se movió antes de tiempo: es scroll normal
      }
    };
    const fin = () => { const estaba = activo; terminar(); if (estaba) this.soltar(); };
    const terminar = () => {
      clearTimeout(this.espera);
      document.removeEventListener('touchmove', mover);
      document.removeEventListener('touchend', fin);
      document.removeEventListener('touchcancel', fin);
    };
    clearTimeout(this.espera);
    document.addEventListener('touchmove', mover, { passive: false });
    document.addEventListener('touchend', fin);
    document.addEventListener('touchcancel', fin);
    this.espera = setTimeout(() => { activo = true; this.empezar(el, id, x0, y0, true); }, 400);
  }

  private empezar(el: HTMLElement, id: number, x: number, y: number, tactil = false): void {
    this.el = el;
    this.xy = { x, y };
    this.dy = 0;
    this.agarre = y - el.getBoundingClientRect().top;
    this.indiceEsperado = null;
    this.arrastrandoId.set(id);
    navigator.vibrate?.(25);
    let p: HTMLElement | null = el.parentElement;
    while (p && !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) p = p.parentElement;
    this.scroller = p ?? (document.scrollingElement as HTMLElement);
    if (!tactil) {
      window.addEventListener('pointermove', this.alMover);
      window.addEventListener('pointerup', this.soltar);
      window.addEventListener('pointercancel', this.soltar);
    }
    this.raf = requestAnimationFrame(this.cuadro);
  }

  private alMover = (ev: PointerEvent): void => {
    this.xy = { x: ev.clientX, y: ev.clientY };
  };

  /** Cada cuadro: desplaza la página si el dedo está en un borde y acomoda la tarjeta */
  private cuadro = (): void => {
    const el = this.el;
    if (!el) return;
    const y = this.xy.y;
    if (this.scroller) {
      if (y < 110) this.scroller.scrollTop -= Math.ceil((110 - y) / 8);
      else if (y > window.innerHeight - 150) this.scroller.scrollTop += Math.ceil((y - (window.innerHeight - 150)) / 8);
    }
    const natural = el.getBoundingClientRect().top - this.dy;
    this.dy = y - this.agarre - natural;
    el.style.transform = `translateY(${this.dy}px)`;
    const lista = [...(el.parentElement?.querySelectorAll<HTMLElement>(':scope > article.tarjeta') ?? [])];
    const i = lista.indexOf(el);
    if (this.indiceEsperado !== null && i !== this.indiceEsperado) {
      this.raf = requestAnimationFrame(this.cuadro);
      return; // todavía no se re-dibujó el cambio anterior
    }
    this.indiceEsperado = null;
    // Cambia de puesto cuando el centro de la tarjeta pasa la mitad de la vecina
    const re = el.getBoundingClientRect();
    const centro = re.top + re.height / 2;
    const mitad = (c: HTMLElement | undefined) => { if (!c) return NaN; const r = c.getBoundingClientRect(); return r.top + r.height / 2; };
    let destino = -1;
    if (centro > mitad(lista[i + 1])) destino = i + 1;
    else if (centro < mitad(lista[i - 1])) destino = i - 1;
    if (destino >= 0 && destino !== i) {
      const ids = this.rutaOrdenada().map((p) => p.id);
      const id = this.arrastrandoId()!;
      ids.splice(ids.indexOf(id), 1);
      ids.splice(destino, 0, id);
      this.orden.set(ids);
      this.indiceEsperado = destino;
      navigator.vibrate?.(8);
    }
    this.raf = requestAnimationFrame(this.cuadro);
  };

  private soltar = (): void => {
    window.removeEventListener('pointermove', this.alMover);
    window.removeEventListener('pointerup', this.soltar);
    window.removeEventListener('pointercancel', this.soltar);
    cancelAnimationFrame(this.raf);
    if (this.el) {
      this.el.style.transform = '';
      // El toque que suelta la tarjeta no debe abrir el pedido
      const tragar = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', tragar, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', tragar, { capture: true }), 350);
    }
    this.el = null;
    if (this.arrastrandoId() !== null) {
      this.arrastrandoId.set(null);
      this.orden.set(this.rutaOrdenada().map((p) => p.id));
      this.guardarOrden();
    }
  };

  /** El mensajero cierra su propio cuadre (le llega aviso a admin y cuadres) */
  async cerrarMiCuadre(): Promise<void> {
    const c = this.pendiente();
    const yo = this.sb.usuario()?.id;
    if (!c || !yo) return;
    const entrega = pesos(c.efectivo - c.domicilios);
    if (!confirm(`¿Cerrar tu cuadre? ${c.pedidos} ${c.pedidos === 1 ? 'pedido' : 'pedidos'} · entregas ${entrega} en efectivo. Después no se le pueden agregar más pedidos.`)) return;
    this.cerrandoCuadre.set(true);
    try {
      await this.ps.cerrarCuadre(yo);
      this.toast.ok(`Cuadre cerrado: entregas ${entrega} en efectivo`);
      this.detalle.set([]);
      await this.cargar();
      await this.cargarHechas();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cerrandoCuadre.set(false);
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
