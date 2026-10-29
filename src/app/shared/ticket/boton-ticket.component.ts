import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { printOutline, ellipsisHorizontal } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../toast/toast.service';
import { Pedido } from '../modelos';
import { DatosNegocio, cargarDatosNegocio } from '../rotulo/rotulo';
import { mensajeError } from '../formato';
import { ImpresoraService } from './impresora.service';
import { lineasTicket, ticketEscPos, ticketHtml } from './ticket';

let negocioCache: Promise<DatosNegocio> | null = null;

/** Botón "Imprimir ticket" de una venta en el local, con sus opciones (ver ticket, RawBT, cambiar impresora) */
@Component({
  selector: 'app-boton-ticket',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      :host { display: contents; }
      .grupo { flex: 1 1 100%; display: flex; gap: 6px; position: relative; }
      .grupo .b:first-child { flex: 1; }
      .grupo .b-icono { flex: 0 0 44px; }
      .menu { position: absolute; bottom: calc(100% + 8px); left: 0; z-index: 20; width: min(300px, calc(100vw - 32px)); padding: 8px; border: 1px solid var(--border);
        border-radius: var(--radius-lg); background: var(--surface); box-shadow: 0 12px 32px rgba(0, 0, 0, .16); display: flex; flex-direction: column; gap: 2px; }
      .menu button, .menu label { display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 10px; border: 0; border-radius: 8px; background: none;
        color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
      .menu button:hover, .menu label:hover { background: var(--surface-2); }
      .menu small { display: block; margin-top: 2px; font-size: 12px; color: var(--text-muted); line-height: 1.35; }
      .menu input { margin-top: 3px; accent-color: var(--accent); }
    `,
  ],
  template: `
    <div class="grupo">
      <button type="button" class="b" [class.b-pri]="principal" (click)="imprimir()" [disabled]="ocupado()">
        <ion-icon name="print-outline"></ion-icon>{{ ocupado() ? 'Imprimiendo…' : 'Imprimir ticket' }}
      </button>
      <button type="button" class="b b-icono" aria-label="Opciones del ticket" [attr.aria-expanded]="menu()" (click)="menu.set(!menu())">
        <ion-icon name="ellipsis-horizontal"></ion-icon>
      </button>
      @if (menu()) {
        <div class="menu" role="menu">
          <button type="button" role="menuitem" (click)="ver()">
            <span>Ver ticket<small>Para imprimirlo de otra forma o guardarlo en PDF</small></span>
          </button>
          @if (imp.esAndroid) {
            <label>
              <input type="checkbox" [checked]="imp.usarRawbt()" (change)="imp.ponerRawbt($any($event.target).checked)" />
              <span>Imprimir con la app RawBT<small>Si la impresora no aparece al buscarla (Bluetooth clásico). Instala RawBT de Play Store y vincula ahí la impresora.</small></span>
            </label>
          }
          @if (imp.nombre(); as n) {
            <button type="button" role="menuitem" (click)="imp.olvidar(); menu.set(false)">
              <span>Cambiar de impresora<small>Ahora: {{ n }}</small></span>
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class BotonTicketComponent implements OnInit {
  /** La venta ya cargada (con productos); si no, se busca por id */
  @Input() venta: Pedido | null = null;
  @Input() pedidoId: number | null = null;
  /** Botón azul (después de registrar la venta) */
  @Input() principal = false;

  imp = inject(ImpresoraService);
  private sb = inject(SupabaseService);
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  ocupado = signal(false);
  menu = signal(false);

  constructor() {
    addIcons({ printOutline, ellipsisHorizontal });
  }

  ngOnInit(): void {
    // Los datos del negocio se traen de una vez, para que al tocar el ticket salga sin esperar
    void this.negocio().catch(() => undefined);
  }

  private negocio(): Promise<DatosNegocio> {
    return (negocioCache ??= cargarDatosNegocio(this.sb.client).catch((e) => { negocioCache = null; throw e; }));
  }

  private async lineas() {
    const negocioP = this.negocio();
    const [negocio, venta] = await Promise.all([negocioP, this.venta ?? this.ps.detalle(this.pedidoId!).then((d) => d.pedido)]);
    return lineasTicket(venta, negocio);
  }

  async imprimir(): Promise<void> {
    this.menu.set(false);
    this.ocupado.set(true);
    try {
      await this.imp.preparar();
      const como = await this.imp.imprimir(ticketEscPos(await this.lineas()));
      if (como === 'bluetooth') this.toast.ok(`Ticket enviado a ${this.imp.nombre() ?? 'la impresora'}`);
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  async ver(): Promise<void> {
    this.menu.set(false);
    // La ventana se abre ya (en el toque) para que el navegador no la bloquee
    const w = window.open('', '_blank');
    try {
      const html = ticketHtml(await this.lineas());
      if (!w) return this.toast.error('El navegador bloqueó la ventana del ticket.');
      w.document.open();
      w.document.write(html);
      w.document.close();
    } catch (e) {
      w?.close();
      this.toast.error(mensajeError(e));
    }
  }
}
