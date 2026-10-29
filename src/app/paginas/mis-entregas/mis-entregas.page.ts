import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { qrCodeOutline, refreshOutline, callOutline, navigateOutline, logoWhatsapp, chatbubbleEllipses, chatbubbleEllipsesOutline, alertCircleOutline } from 'ionicons/icons';
import { enlaceWhatsapp, productosDelPedido } from '../../shared/whatsapp';
import { PedidosService } from '../../core/services/pedidos.service';
import { EntregadoJyb, JybService, PedidoJyb, ResumenJyb } from '../../core/services/jyb.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ToastService } from '../../shared/toast/toast.service';
import { EntregarComponent } from '../../shared/entregar/entregar.component';
import { NovedadComponent } from '../../shared/novedad/novedad.component';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { PedidoJybComponent } from '../../shared/pedido-jyb/pedido-jyb.component';
import { Cuadre, Pedido, TipoRecaudo } from '../../shared/modelos';
import { mensajeError, pesos } from '../../shared/formato';
import { diaCorto, finDiaColombia, formatoFechaCO, formatoHoraCO, hoyColombiaISO, inicioDiaColombia, microsAsignado } from '../../shared/fecha-colombia';
import { RangoFechas } from '../../shared/rango/rango.component';
import { DiaComponent } from '../../shared/rango/dia.component';
import { nombreConVariante } from '../../shared/variante';
import { QrPagoComponent } from '../../shared/qr-pago/qr-pago.component';
import { cargarCuentas } from '../../shared/qr-pago/cuentas-pago';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

/** Una parada de la ruta: un pedido de Jasta o uno de Variedades JYB */
type Parada = { clave: string; jasta: Pedido; jyb?: undefined } | { clave: string; jyb: PedidoJyb; jasta?: undefined };

/**
 * Pantalla del mensajero: lo que tiene en ruta y lo que lleva por cuadrar.
 * Si también reparte para Variedades JYB (mismo correo), sus pedidos de allá entran en la misma ruta
 * y su cuadre de allá se ve aparte.
 */
@Component({
  selector: 'app-mis-entregas',
  standalone: true,
  imports: [EsqueletoComponent, QrPagoComponent, IonIcon, EntregarComponent, NovedadComponent, PedidoDetalleComponent, PedidoJybComponent, DiaComponent],
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
      .entregado-espera { display: flex; flex-direction: column; gap: 3px; padding: 12px 16px; border-radius: var(--radius); background: var(--oro-wash); }
      .entregado-espera span { font-size: 11px; font-weight: 650; letter-spacing: 0.06em; text-transform: uppercase; color: var(--oro-texto); }
      .entregado-espera strong { font-family: var(--mono-font); font-size: 22px; font-weight: 600; color: var(--text); }
      .entregado-espera small { font-size: 12.5px; color: var(--text-soft); }
      .acciones-cuadre { display: flex; gap: 8px; flex-wrap: wrap; }
      .acciones-cuadre .b { flex: 1 1 200px; justify-content: center; }
      .en-ruta { font-size: 13px; color: var(--text-soft); }
      .entregar-total.atrasado { background: var(--danger-wash); }
      .entregar-total.atrasado span { color: var(--danger); }
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
      .negocio { display: inline-block; margin-bottom: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;
        letter-spacing: 0.04em; text-transform: uppercase; background: var(--accent-wash); color: var(--accent); align-self: flex-start; }
      .negocio.jyb { background: var(--oro-wash); color: var(--oro-texto); }
      .tarjeta.jyb { border-left: 4px solid var(--oro); }
      .hist tr.sin-detalle { cursor: default; }
      .hist .negocio { margin: 0 6px 0 0; padding: 1px 6px; font-size: 10px; vertical-align: 1px; }
      .novedad-previa { display: flex; align-items: center; gap: 6px; margin: 0; padding: 7px 10px; border-radius: var(--radius-sm);
        background: var(--oro-wash); color: var(--oro-texto); font-size: 13px; font-weight: 600; }
      .b-novedad { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, var(--border)); }
      .parada { display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 6px; margin-right: 6px; border-radius: 12px;
        background: var(--accent); color: #fff; font-size: 12.5px; font-weight: 750; font-family: var(--mono-font); vertical-align: 2px; }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><h1>Mis entregas</h1></div>
        <div style="display: flex; gap: 8px">
          @if (hayCuentas()) {
            <button class="b" (click)="qrDe.set({ total: null, detalle: '' })"><ion-icon name="qr-code-outline"></ion-icon>QR de pago</button>
          }
          <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
        </div>
      </div>

      @if (esMensajero()) {
        <section class="panel cuadre">
          <div class="panel-head">
            <div>
              <h2>{{ conJyb() ? 'Por cuadrar Jasta' : 'Por cuadrar' }}</h2>
              <p class="panel-sub">
                @if (misPendientes().length > 1) {
                  Tienes {{ misPendientes().length }} cuadres sin entregar: uno por cada día
                } @else if (pendiente(); as c) {
                  {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido entregado' : 'pedidos entregados' }} {{ dia(c.fecha) }}
                } @else {
                  No tienes entregas pendientes por cuadrar
                }
              </p>
            </div>
            <span class="en-ruta">{{ enRuta().length }} en ruta</span>
          </div>
          @for (pc of misPorConfirmar(); track pc.id) {
            <div class="entregado-espera">
              <span>Cuadre de {{ dia(pc.fecha_entrega) }} entregado · esperando confirmación</span>
              <strong class="num">{{ pesos(pc.total_efectivo - pc.total_domicilios) }}</strong>
              <small>{{ pc.cantidad_pedidos }} {{ pc.cantidad_pedidos === 1 ? 'pedido' : 'pedidos' }} · la oficina debe confirmar que recibió la plata</small>
            </div>
          }
          @for (c of misPendientes(); track c.fecha) {
            <div class="entregar-total" [class.atrasado]="c.fecha < hoy">
              <span>Entregas de {{ dia(c.fecha) }} · efectivo que debes entregar</span>
              <strong class="num">{{ pesos(c.efectivo - c.domicilios) }}</strong>
            </div>
            <dl class="desglose">
              <dt>Efectivo cobrado</dt><dd class="num">{{ pesos(c.efectivo) }}</dd>
              <dt>Tus domicilios (se descuentan)</dt><dd class="num">− {{ pesos(c.domicilios) }}</dd>
              <dt>Transferencias (ya le llegaron a la tienda)</dt><dd class="num">{{ pesos(c.transferencia) }}</dd>
            </dl>
            <div class="acciones-cuadre">
              <button class="b" (click)="verDetalle(c.fecha)">{{ detalleDia() === c.fecha ? 'Ocultar pedidos' : 'Ver pedidos' }}</button>
              <button class="b b-ok" [disabled]="cerrandoCuadre()" (click)="cerrarMiCuadre(c)">
                {{ cerrandoCuadre() ? 'Entregando…' : 'Entregar cuadre de ' + dia(c.fecha) + ' (' + c.pedidos + (c.pedidos === 1 ? ' pedido)' : ' pedidos)') }}</button>
            </div>
            @if (detalleDia() === c.fecha && detalle().length) {
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

      @if (jyb()?.vinculado) {
        <section class="panel cuadre">
          <div class="panel-head">
            <div>
              <h2>Por cuadrar Variedades JYB</h2>
              <p class="panel-sub">
                @if (pendienteJyb(); as c) {
                  {{ c.pedidos }} {{ c.pedidos === 1 ? 'pedido entregado' : 'pedidos entregados' }} desde {{ fecha(c.desde!) }}
                } @else {
                  No tienes entregas pendientes por cuadrar
                }
              </p>
            </div>
            <span class="en-ruta">{{ jyb()?.en_ruta?.length ?? 0 }} en ruta</span>
          </div>
          @for (pc of jyb()?.por_confirmar ?? []; track pc.id) {
            <div class="entregado-espera">
              <span>Cuadre entregado · esperando confirmación</span>
              <strong class="num">{{ pesos(pc.total_a_entregar) }}</strong>
              <small>{{ pc.cantidad_pedidos }} {{ pc.cantidad_pedidos === 1 ? 'pedido' : 'pedidos' }} · Variedades JYB debe confirmar que recibió la plata</small>
            </div>
          }
          @if (pendienteJyb(); as c) {
            <div class="entregar-total">
              <span>Efectivo que debes entregar a Variedades JYB</span>
              <strong class="num">{{ pesos(c.efectivo - c.domicilios) }}</strong>
            </div>
            <dl class="desglose">
              <dt>Efectivo cobrado</dt><dd class="num">{{ pesos(c.efectivo) }}</dd>
              <dt>Tus domicilios (se descuentan)</dt><dd class="num">− {{ pesos(c.domicilios) }}</dd>
              <dt>Transferencias (ya le llegaron a la tienda)</dt><dd class="num">{{ pesos(c.transferencia) }}</dd>
            </dl>
            <div class="acciones-cuadre">
              <button class="b b-ok" [disabled]="cerrandoJyb()" (click)="cerrarCuadreJyb()">
                {{ cerrandoJyb() ? 'Entregando…' : 'Entregar mi cuadre de Variedades JYB (' + c.pedidos + (c.pedidos === 1 ? ' pedido)' : ' pedidos)') }}</button>
            </div>
          }
        </section>
      }

      @if (rutaOrdenada().length > 1) {
        <p class="ayuda-ruta">Mantén presionada una tarjeta y muévela para ordenar tu ruta.</p>
      }
      <div class="tarjetas" [class.ordenando]="arrastrandoId() !== null">
        @for (parada of rutaOrdenada(); track parada.clave; let i = $index) {
          @if (parada.jasta; as p) {
          <article class="tarjeta" [class.arrastrando]="arrastrandoId() === parada.clave" (pointerdown)="presionar($event, parada.clave)" (touchstart)="tocar($event, parada.clave)" (contextmenu)="$event.preventDefault()">
            <div class="tarjeta-top">
              <div class="top-izq" (click)="abrir(p.id)">
                @if (conJyb()) {<span class="negocio">Jasta</span>}
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
            @if (p.ultima_novedad && p.novedades) {
              <p class="novedad-previa"><ion-icon name="alert-circle-outline" aria-hidden="true"></ion-icon>
                {{ p.novedades === 1 ? 'Ya se intentó' : 'Ya se intentó ' + p.novedades + ' veces' }}: {{ p.ultima_novedad }}</p>
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
              @if (hayCuentas()) {
                <button class="b" (click)="qrDe.set({ total: p.total, detalle: 'Pedido #' + p.id + ' · ' + p.cliente_nombre })" aria-label="Mostrar el QR para que el cliente pague por transferencia">
                  <ion-icon name="qr-code-outline"></ion-icon>QR</button>
              }
              <button class="b b-novedad" (click)="novedadDe.set(p)">No se pudo</button>
              <button class="b b-ok" style="flex: 1" (click)="entregando.set(p)">Entregar</button>
            </div>
          </article>
          } @else if (parada.jyb; as p) {
          <article class="tarjeta jyb" [class.arrastrando]="arrastrandoId() === parada.clave" (pointerdown)="presionar($event, parada.clave)" (touchstart)="tocar($event, parada.clave)" (contextmenu)="$event.preventDefault()">
            <div class="tarjeta-top">
              <div class="top-izq" (click)="abiertoJyb.set(p)">
                <span class="negocio jyb">Variedades JYB</span>
                <h3>@if (rutaOrdenada().length > 1) {<span class="parada" [attr.aria-label]="'Parada ' + (i + 1)">{{ i + 1 }}</span>}<span class="guia">#{{ p.numero }}</span> {{ p.cliente_nombre }}</h3>
                <strong class="total num">{{ pesos(p.total) }}</strong>
              </div>
            </div>
            <p>{{ p.direccion }}<br />{{ p.barrio || 'Sin barrio' }}</p>
            @if (p.observaciones) {
              <p style="color: var(--st-pendiente-text)">{{ p.observaciones }}</p>
            }
            <ul class="items-mini">
              @for (it of p.items; track $index) {
                <li><span>{{ it.cantidad }} × {{ it.nombre }}</span></li>
              }
            </ul>
            <div class="acciones">
              @if (p.cliente_telefono) {
                <a class="b" [href]="'tel:' + p.cliente_telefono"><ion-icon name="call-outline"></ion-icon>Llamar</a>
                <a class="b b-wa" [href]="whatsappJyb(p)" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>WhatsApp</a>
              }
              <a class="b" [href]="mapa(p)" target="_blank" rel="noopener"><ion-icon name="navigate-outline"></ion-icon>Mapa</a>
              <button class="b b-ok" style="flex: 1" (click)="abrirEntregaJyb(p)">Entregar</button>
            </div>
          </article>
          }
        } @empty {
          @if (cargando()) {
            <app-esqueleto forma="lista" [filas]="4"></app-esqueleto>
          } @else {
            <div class="vacio">
              <span class="vacio-titulo">No tienes pedidos en ruta</span>
              <p>Cuando alistamiento te despache un pedido, aparece aquí.</p>
            </div>
          }
        }
      </div>

      @if (esMensajero()) {
        <section class="panel">
          <div class="hist-head">
            <h2>Mis entregas hechas</h2>
            <app-dia (cambio)="cambiarRango($event)"></app-dia>
          </div>
          @if (hechas().length || hechasJyb().length) {
            @if (hechas().length) {
            <p class="hist-tot" style="margin: 12px 0 4px">
              @if (conJyb()) {<span><strong>Jasta</strong></span>}
              <span><strong class="num">{{ hechas().length }}</strong> entregas</span>
              <span>Domicilios <strong class="num">{{ pesos(totHechas().domicilios) }}</strong></span>
              <span>Efectivo <strong class="num">{{ pesos(totHechas().efectivo) }}</strong></span>
              <span>Transferencias <strong class="num">{{ pesos(totHechas().transferencia) }}</strong></span>
              <span>Cuadrado <strong class="num">{{ pesos(totHechas().cuadrado) }}</strong></span>
              @if (totHechas().porConfirmar) {
                <span>Por confirmar <strong class="num">{{ pesos(totHechas().porConfirmar) }}</strong></span>
              }
              @if (totHechas().porCuadrar) {
                <span>Por cuadrar <strong class="num">{{ pesos(totHechas().porCuadrar) }}</strong></span>
              }
            </p>
            }
            @if (hechasJyb().length) {
            <p class="hist-tot" style="margin: 12px 0 4px">
              <span><strong>Variedades JYB</strong></span>
              <span><strong class="num">{{ hechasJyb().length }}</strong> entregas</span>
              <span>Domicilios <strong class="num">{{ pesos(totJyb().domicilios) }}</strong></span>
              <span>Efectivo <strong class="num">{{ pesos(totJyb().efectivo) }}</strong></span>
              <span>Transferencias <strong class="num">{{ pesos(totJyb().transferencia) }}</strong></span>
              <span>Cuadrado <strong class="num">{{ pesos(totJyb().cuadrado) }}</strong></span>
              @if (totJyb().porConfirmar) {
                <span>Por confirmar <strong class="num">{{ pesos(totJyb().porConfirmar) }}</strong></span>
              }
              @if (totJyb().porCuadrar) {
                <span>Por cuadrar <strong class="num">{{ pesos(totJyb().porCuadrar) }}</strong></span>
              }
            </p>
            }
            <table class="hist">
              @for (h of historial(); track h.clave) {
                @if (h.jasta; as p) {
                <tr (click)="abierto.set(p.id)">
                  <td>@if (conJyb()) {<span class="negocio">Jasta</span>}#{{ p.id }} · {{ p.cliente_nombre }}<small>{{ p.barrio || '' }} · {{ hora(p.entregado_at) }} · {{ !p.cuadre_id ? 'por cuadrar' : esperaConfirmacion(p) ? 'cuadre por confirmar' : 'cuadrado' }}</small></td>
                  <td class="num">{{ pesos(p.total) }}<small>{{ p.tipo_recaudo || '' }}</small></td>
                </tr>
                } @else if (h.jyb; as p) {
                <tr class="sin-detalle">
                  <td><span class="negocio jyb">JYB</span>#{{ p.numero }} · {{ p.cliente_nombre }}<small>{{ p.barrio || '' }} · {{ hora(p.entregado_at) }} · {{ p.cuadre === 'por_cuadrar' ? 'por cuadrar' : p.cuadre === 'por_confirmar' ? 'cuadre por confirmar' : 'cuadrado' }}</small></td>
                  <td class="num">{{ pesos(p.total) }}<small>{{ p.metodo_pago || '' }}</small></td>
                </tr>
                }
              }
            </table>
          } @else {
            <p class="panel-sub" style="margin-top: 12px">No hay entregas en este periodo.</p>
          }
        </section>
      }
    </div>

    @if (novedadDe(); as p) {
      <app-novedad [pedido]="p" (cerrar)="novedadDe.set(null)" (reportado)="alReportar(p, $event)"></app-novedad>
    }
    @if (entregando(); as p) {
      <app-entregar [pedido]="p" [conQr]="hayCuentas()" (qr)="qrDe.set({ total: $event, detalle: 'Pedido #' + p.id + ' · ' + p.cliente_nombre, titulo: 'Valor de la transferencia' })"
        (cerrar)="entregando.set(null)" (entregado)="alEntregar(p)"></app-entregar>
    }
    @if (entregandoJyb(); as e) {
      <app-entregar [pedido]="e.resumen" [alConfirmar]="e.guardar" (cerrar)="entregandoJyb.set(null)" (entregado)="alEntregarJyb(e.resumen.id)"></app-entregar>
    }
    @if (abiertoJyb(); as p) {
      <app-pedido-jyb [pedido]="p" (cerrar)="abiertoJyb.set(null)"></app-pedido-jyb>
    }
    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" [chat]="abiertoEnChat()" (cerrar)="cerrarDetalle()" (cambiado)="cargar()"></app-pedido-detalle>
    }
    @if (qrDe(); as q) {
      <app-qr-pago [total]="q.total" [titulo]="q.titulo || 'Total del pedido'" [detalle]="q.detalle" (cerrar)="qrDe.set(null)"></app-qr-pago>
    }
  `,
})
export class MisEntregasPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private jybs = inject(JybService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  avisos = inject(NotificacionesService);

  enRuta = signal<Pedido[]>([]);
  cerrandoCuadre = signal(false);
  /** Cuadres que entregó y la oficina todavía no confirma */
  misPorConfirmar = signal<Cuadre[]>([]);
  /** Pedidos y cuadre de Variedades JYB (null = todavía no se sabe o no reparte allá) */
  jyb = signal<ResumenJyb | null>(null);
  conJyb = computed(() => !!this.jyb()?.vinculado);
  pendienteJyb = computed(() => {
    const c = this.jyb()?.por_cuadrar;
    return c && c.pedidos > 0 ? c : null;
  });
  cerrandoJyb = signal(false);
  abiertoJyb = signal<PedidoJyb | null>(null);
  hechasJyb = signal<EntregadoJyb[]>([]);
  /** Lo que entrega a Variedades JYB = efectivo − domicilios, igual que en su cuadre */
  totJyb = computed(() =>
    this.hechasJyb().reduce(
      (a, p) => {
        const neto = Number(p.efectivo || 0) - Number(p.valor_domicilio || 0);
        return {
          domicilios: a.domicilios + Number(p.valor_domicilio || 0),
          efectivo: a.efectivo + Number(p.efectivo || 0),
          transferencia: a.transferencia + Number(p.transferencia || 0),
          cuadrado: a.cuadrado + (p.cuadre === 'cuadrado' ? neto : 0),
          porConfirmar: a.porConfirmar + (p.cuadre === 'por_confirmar' ? neto : 0),
          porCuadrar: a.porCuadrar + (p.cuadre === 'por_cuadrar' ? neto : 0),
        };
      },
      { domicilios: 0, efectivo: 0, transferencia: 0, cuadrado: 0, porConfirmar: 0, porCuadrar: 0 }
    )
  );
  /** Entregas hechas de los dos negocios, la más reciente primero */
  historial = computed(() =>
    [
      ...this.hechas().map((p) => ({ clave: 'j:' + p.id, cuando: p.entregado_at ?? '', jasta: p, jyb: undefined })),
      ...this.hechasJyb().map((p) => ({ clave: 'k:' + p.id, cuando: p.entregado_at, jyb: p, jasta: undefined })),
    ].sort((a, b) => b.cuando.localeCompare(a.cuando))
  );
  entregandoJyb = signal<{
    resumen: { id: number; cliente_nombre: string; total: number };
    guardar: (tipo: TipoRecaudo, efectivo: number, transferencia: number, evidencias: string[]) => Promise<void>;
  } | null>(null);
  /** Orden de la ruta que el mensajero armó ('j:<id>' Jasta, 'k:<uuid>' Variedades JYB), guardado en este celular */
  orden = signal<string[]>([]);
  arrastrandoId = signal<string | null>(null);
  rutaOrdenada = computed<Parada[]>(() => {
    const pos = new Map(this.orden().map((clave, i) => [clave, i]));
    // Sin orden propio, va en el orden en que se los asignaron: por Telegram es el orden de las
    // fotos de los rótulos (de Jasta y de Variedades JYB mezcladas)
    const todas: Parada[] = [
      ...this.enRuta().map((p) => ({ clave: 'j:' + p.id, jasta: p, cuando: microsAsignado(p.asignado_at) })),
      ...(this.jyb()?.en_ruta ?? []).map((p) => ({ clave: 'k:' + p.id, jyb: p, cuando: microsAsignado(p.asignado_at ?? p.created_at) })),
    ]
      .sort((a, b) => a.cuando - b.cuando)
      .map(({ cuando: _, ...p }) => p);
    return todas
      .map((p, i) => ({ p, k: pos.has(p.clave) ? pos.get(p.clave)! : 1e6 + i }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.p);
  });
  pendientes = signal<
    { mensajero_id: number; fecha: string; pedidos: number; efectivo: number; transferencia: number; domicilios: number; desde: string }[]
  >([]);
  detalle = signal<Pedido[]>([]);
  /** Día cuyos pedidos por cuadrar se están viendo */
  detalleDia = signal<string | null>(null);
  hoy = hoyColombiaISO();
  cargando = signal(true);
  entregando = signal<Pedido | null>(null);
  abierto = signal<number | null>(null);
  abiertoEnChat = signal(false);
  pesos = pesos;
  nombreConVariante = nombreConVariante;

  hechas = signal<Pedido[]>([]);
  private rango: RangoFechas | null = null;
  /** Cuadrado / por cuadrar = efectivo − domicilios, igual que en Cuadres (lo que el mensajero entrega) */
  totHechas = computed(() => {
    const pendientesIds = new Set(this.misPorConfirmar().map((c) => c.id));
    return this.hechas().reduce(
      (a, p) => {
        const neto = Number(p.valor_efectivo || 0) - Number(p.valor_domicilio || 0);
        const esperando = !!p.cuadre_id && pendientesIds.has(p.cuadre_id);
        return {
          domicilios: a.domicilios + Number(p.valor_domicilio || 0),
          efectivo: a.efectivo + Number(p.valor_efectivo || 0),
          transferencia: a.transferencia + Number(p.valor_transferencia || 0),
          cuadrado: a.cuadrado + (p.cuadre_id && !esperando ? neto : 0),
          porConfirmar: a.porConfirmar + (esperando ? neto : 0),
          porCuadrar: a.porCuadrar + (p.cuadre_id ? 0 : neto),
        };
      },
      { domicilios: 0, efectivo: 0, transferencia: 0, cuadrado: 0, porConfirmar: 0, porCuadrar: 0 }
    );
  });

  esMensajero = computed(() => this.sb.tiene('mensajero'));
  /** Mis cuadres sin entregar: uno por día de entrega, el más viejo primero */
  misPendientes = computed(() => this.pendientes().filter((x) => x.mensajero_id === this.sb.usuario()?.id));
  pendiente = computed(() => this.misPendientes()[0] ?? null);

  private dejar?: () => void;
  private subParams?: { unsubscribe(): void };
  private timer?: ReturnType<typeof setTimeout>;
  /** Además de los avisos en vivo, se consulta Variedades JYB cada minuto por si se pierde la conexión */
  private relojJyb?: ReturnType<typeof setInterval>;
  private canalJyb: string | null = null;
  private dejarJyb?: () => void;
  private timerJyb?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ qrCodeOutline, refreshOutline, callOutline, navigateOutline, logoWhatsapp, chatbubbleEllipses, chatbubbleEllipsesOutline, alertCircleOutline });
  }

  ngOnInit(): void {
    void cargarCuentas(this.sb.client).then((l) => this.hayCuentas.set(l.length > 0));
    try {
      const guardado = JSON.parse(localStorage.getItem(this.claveOrden()) || '[]');
      // Antes se guardaban solo ids de Jasta (números)
      if (Array.isArray(guardado))
        this.orden.set(guardado.map((x) => (typeof x === 'number' ? 'j:' + x : x)).filter((x): x is string => typeof x === 'string'));
    } catch { /* sin almacenamiento: orden por defecto */ }
    document.addEventListener('touchmove', this.bloquearScroll, { passive: false });
    void this.cargar();
    this.relojJyb = setInterval(() => void this.cargarJyb(), 60_000);
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
    clearInterval(this.relojJyb);
    clearTimeout(this.timerJyb);
    this.dejarJyb?.();
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
    void this.cargarJyb();
    try {
      const yo = this.sb.usuario()?.id;
      const soloMios = this.sb.tiene('mensajero') ? yo : undefined;
      const [r, c, pc] = await Promise.all([
        this.ps.cola(['despachado'], soloMios),
        this.ps.cuadresPendientes(),
        this.sb.tiene('mensajero') && yo ? this.ps.cuadresPorConfirmar(yo) : Promise.resolve([]),
      ]);
      this.enRuta.set(r);
      this.pendientes.set(c);
      this.misPorConfirmar.set(pc);
      const dd = this.detalleDia();
      if (dd && this.sb.usuario()) this.detalle.set(await this.ps.pendientesDe(this.sb.usuario()!.id, dd));
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Si falla (sin señal, por ejemplo) se dejan los pedidos de Variedades JYB que ya se veían */
  async cargarJyb(): Promise<void> {
    try {
      const r = await this.jybs.resumen();
      const primeraVez = r.vinculado && !this.jyb()?.vinculado;
      this.jyb.set(r);
      this.escucharJyb(r.vinculado ? r.canal ?? null : null);
      if (primeraVez) void this.cargarHechasJyb();
    } catch {
      /* se reintenta en el próximo minuto o al actualizar */
    }
  }

  /** Cuando Variedades JYB avisa un cambio, se vuelve a pedir lo de allá */
  private escucharJyb(canal: string | null): void {
    if (canal === this.canalJyb) return;
    this.dejarJyb?.();
    this.dejarJyb = undefined;
    this.canalJyb = canal;
    if (!canal) return;
    this.dejarJyb = this.jybs.escuchar(canal, () => {
      clearTimeout(this.timerJyb);
      this.timerJyb = setTimeout(() => {
        void this.cargarJyb();
        void this.cargarHechasJyb();
      }, 600);
    });
  }

  async cargarHechasJyb(): Promise<void> {
    const r = this.rango;
    if (!r || !this.jyb()?.vinculado) return;
    try {
      this.hechasJyb.set(
        await this.jybs.entregadas(r.desde ? inicioDiaColombia(r.desde).toISOString() : null, r.hasta ? finDiaColombia(r.hasta).toISOString() : null)
      );
    } catch {
      /* se deja lo que ya se veía */
    }
  }

  abrirEntregaJyb(p: PedidoJyb): void {
    this.entregandoJyb.set({
      resumen: { id: p.numero, cliente_nombre: p.cliente_nombre, total: Number(p.total) },
      guardar: (tipo, efectivo, _transferencia, evidencias) => this.jybs.entregar(p.id, tipo, efectivo, evidencias),
    });
  }

  async alEntregarJyb(numero: number): Promise<void> {
    this.entregandoJyb.set(null);
    this.toast.ok(`#${numero} de Variedades JYB entregado`);
    await Promise.all([this.cargarJyb(), this.cargarHechasJyb()]);
  }

  async cerrarCuadreJyb(): Promise<void> {
    const c = this.pendienteJyb();
    if (!c) return;
    const entrega = pesos(c.efectivo - c.domicilios);
    if (!confirm(`¿Entregar tu cuadre de Variedades JYB? ${c.pedidos} ${c.pedidos === 1 ? 'pedido' : 'pedidos'} · entregas ${entrega} en efectivo. Variedades JYB debe confirmar que recibió la plata.`)) return;
    this.cerrandoJyb.set(true);
    try {
      await this.jybs.cerrarCuadre();
      this.toast.ok(`Cuadre de Variedades JYB entregado (${entrega}): falta que confirmen`);
      await Promise.all([this.cargarJyb(), this.cargarHechasJyb()]);
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cerrandoJyb.set(false);
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
  presionar(e: PointerEvent, id: string): void {
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
  tocar(e: TouchEvent, id: string): void {
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

  private empezar(el: HTMLElement, id: string, x: number, y: number, tactil = false): void {
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
      const ids = this.rutaOrdenada().map((p) => p.clave);
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
      this.orden.set(this.rutaOrdenada().map((p) => p.clave));
      this.guardarOrden();
    }
  };

  esperaConfirmacion(p: Pedido): boolean {
    return !!p.cuadre_id && this.misPorConfirmar().some((c) => c.id === p.cuadre_id);
  }

  /** El mensajero entrega su cuadre; queda por confirmar hasta que la oficina reciba la plata */
  async cerrarMiCuadre(c: { fecha: string; pedidos: number; efectivo: number; domicilios: number }): Promise<void> {
    const yo = this.sb.usuario()?.id;
    if (!yo) return;
    const entrega = pesos(c.efectivo - c.domicilios);
    if (!confirm(`¿Entregar tu cuadre de ${this.dia(c.fecha)}? ${c.pedidos} ${c.pedidos === 1 ? 'pedido' : 'pedidos'} · entregas ${entrega} en efectivo. La oficina debe confirmar que recibió la plata.`)) return;
    this.cerrandoCuadre.set(true);
    try {
      await this.ps.cerrarCuadre(yo, c.fecha);
      this.toast.ok(`Cuadre de ${this.dia(c.fecha)} entregado (${entrega}): falta que la oficina confirme`);
      this.detalle.set([]);
      this.detalleDia.set(null);
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
    void this.cargarHechasJyb();
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

  /** Pedido al que se le está reportando que no se pudo entregar */
  novedadDe = signal<Pedido | null>(null);
  /** QR de la cuenta del negocio en pantalla completa (total = lo que se cobra; null = sin valor) */
  qrDe = signal<{ total: number | null; detalle: string; titulo?: string } | null>(null);
  hayCuentas = signal(false);

  async alReportar(p: Pedido, accion: 'reintentar' | 'devolver'): Promise<void> {
    this.novedadDe.set(null);
    this.toast.ok(accion === 'devolver' ? `#${p.id}: novedad reportada, vuelve a la tienda` : `#${p.id}: novedad reportada, sigue en tu ruta`);
    await this.cargar();
  }

  async alEntregar(p: Pedido): Promise<void> {
    this.entregando.set(null);
    this.toast.ok(`#${p.id} entregado`);
    await Promise.all([this.cargar(), this.cargarHechas()]);
  }

  async verDetalle(dia: string): Promise<void> {
    this.detalle.set([]);
    if (this.detalleDia() === dia) return this.detalleDia.set(null);
    this.detalleDia.set(dia);
    const yo = this.sb.usuario()?.id;
    if (yo) this.detalle.set(await this.ps.pendientesDe(yo, dia));
  }

  dia(f: string | null | undefined): string {
    return f ? diaCorto(f) : '—';
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

  whatsappJyb(p: PedidoJyb): string {
    const cliente = p.cliente_nombre.split(' ')[0];
    const yo = this.sb.usuario()?.nombre.split(' ')[0] ?? '';
    const productos = p.items.map((i) => `${i.cantidad} ${i.nombre}`).join(', ');
    return enlaceWhatsapp(
      p.cliente_telefono,
      productos
        ? `Hola ${cliente}, soy ${yo}, mensajero de Variedades JYB. Voy en camino con tu pedido de ${productos} por ${pesos(p.total)}.`
        : `Hola ${cliente}, soy ${yo}, mensajero de Variedades JYB. Voy en camino con tu pedido por ${pesos(p.total)}.`
    );
  }

  mapa(p: { direccion: string | null; barrio: string | null }): string {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.direccion ?? ''}, ${p.barrio ?? ''}, Cali`);
  }
}
