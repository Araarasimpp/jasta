import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';
import { PedidoJyb } from '../../core/services/jyb.service';
import { pesos } from '../formato';
import { formatoFechaCO, formatoHoraCO } from '../fecha-colombia';
import { enlaceWhatsapp } from '../whatsapp';

/** Hoja con el pedido de Variedades JYB (solo lectura: el pedido vive en la otra app) */
@Component({
  selector: 'app-pedido-jyb',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      .resumen { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .total { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; }
      .negocio { padding: 3px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
        background: var(--oro-wash); color: var(--oro-texto); }
      .lineas { width: 100%; border-collapse: collapse; font-size: 13px; }
      .lineas td { padding: 5px 0; vertical-align: baseline; }
      .lineas td:last-child { text-align: right; white-space: nowrap; }
      .lineas .cant { width: 36px; color: var(--text-soft); }
      .lider { display: flex; align-items: baseline; gap: 8px; padding-right: 8px; }
      .lider::after { content: ''; flex: 1; min-width: 16px; border-bottom: 1px dotted var(--border-strong); transform: translateY(-4px); }
      .lineas tfoot tr:first-child td { border-top: var(--perfora); padding-top: 9px; }
      .lineas tfoot td { color: var(--text-soft); }
      .lineas tfoot tr.fin td { padding-top: 9px; border-bottom: 3px double var(--text); color: var(--text); font-size: 15px; font-weight: 650; }
      .lineas tfoot tr.fin td:first-child { border-bottom: none; }
      .contacto { display: flex; gap: 6px; }
      .nota { margin: 0; font-size: 12.5px; color: var(--text-muted); }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <aside class="hoja" role="dialog" aria-labelledby="t-pedido-jyb">
      <div class="hoja-head">
        <h2 id="t-pedido-jyb">Pedido <span class="guia guia-grande">#{{ pedido.numero }}</span></h2>
        <button class="b b-icono" aria-label="Cerrar" (click)="cerrar.emit()"><ion-icon name="close-outline"></ion-icon></button>
      </div>
      <div class="hoja-body">
        <div class="resumen">
          <span class="negocio">Variedades JYB</span>
          <span class="total num">{{ pesos(pedido.total) }}</span>
        </div>

        <section>
          <h3 class="seccion-titulo">Cliente</h3>
          <dl class="datos">
            <dt>Nombre</dt><dd>{{ pedido.cliente_nombre }}</dd>
            <dt>Teléfono</dt>
            <dd>
              @if (pedido.cliente_telefono) {
                <span class="contacto">
                  <a [href]="'tel:' + pedido.cliente_telefono">{{ pedido.cliente_telefono }}</a>
                  · <a [href]="whatsapp()" target="_blank" rel="noopener">WhatsApp</a>
                </span>
              } @else { — }
            </dd>
            <dt>Dirección</dt><dd>{{ pedido.direccion || '—' }}</dd>
            <dt>Barrio</dt><dd>{{ pedido.barrio || '—' }}</dd>
            @if (pedido.observaciones) {
              <dt>Observaciones</dt><dd>{{ pedido.observaciones }}</dd>
            }
          </dl>
        </section>

        <section>
          <h3 class="seccion-titulo">Productos</h3>
          <table class="lineas">
            <tbody>
              @for (i of pedido.items; track $index) {
                <tr><td class="cant num">{{ i.cantidad }}×</td><td><span class="lider">{{ i.nombre }}</span></td><td class="num">{{ i.precio != null ? pesos(i.precio * i.cantidad) : '' }}</td></tr>
              }
            </tbody>
            <tfoot>
              <tr><td></td><td><span class="lider">Domicilio</span></td><td class="num">{{ pesos(pedido.valor_domicilio) }}</td></tr>
              <tr class="fin"><td></td><td><span class="lider">Total</span></td><td class="num">{{ pesos(pedido.total) }}</td></tr>
            </tfoot>
          </table>
        </section>

        <section>
          <h3 class="seccion-titulo">Seguimiento</h3>
          <dl class="datos">
            @if (pedido.created_at) {
              <dt>Creado</dt><dd>{{ fecha(pedido.created_at) }}</dd>
            }
            <dt>Vendedor</dt><dd>{{ pedido.vendedor || '—' }}</dd>
          </dl>
        </section>

        <p class="nota">Este pedido es de Variedades JYB: para cambiarlo o cancelarlo, habla con la tienda.</p>
      </div>
    </aside>
  `,
})
export class PedidoJybComponent {
  @Input({ required: true }) pedido!: PedidoJyb;
  @Output() cerrar = new EventEmitter<void>();
  pesos = pesos;

  constructor() {
    addIcons({ closeOutline });
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }

  whatsapp(): string {
    return enlaceWhatsapp(this.pedido.cliente_telefono);
  }
}
