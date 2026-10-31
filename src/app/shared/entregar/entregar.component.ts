import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PedidosService } from '../../core/services/pedidos.service';
import { Pedido, TipoRecaudo } from '../modelos';
import { mensajeError, pesos } from '../formato';
import { pideComprobante } from '../comprobantes';
import { ComprobantesInputComponent } from '../comprobantes/comprobantes-input.component';
import { PesosDirective } from '../../shared/pesos/pesos.directive';

/** Hoja para registrar la entrega y cómo pagó el cliente */
@Component({
  selector: 'app-entregar',
  standalone: true,
  imports: [PesosDirective, FormsModule, ComprobantesInputComponent],
  styles: [
    `
      .tipos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .tipo { height: 44px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface);
        color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer; }
      .tipo.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); }
      .total { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; color: var(--text-soft); }
      .total strong { font-size: 22px; color: var(--text); }
      .link-propina { align-self: flex-start; padding: 4px 0; border: 0; background: none; color: var(--accent); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
      .propina { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--radius); background: var(--ok-wash); }
      .propina .ayuda strong { color: var(--efectivo-texto); }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-entregar">
      <div class="hoja-head">
        <h2 id="t-entregar">Entregar pedido #{{ pedido.id }}</h2>
      </div>
      <div class="hoja-body">
        <div class="total"><span>{{ pedido.cliente_nombre }}</span><strong class="num">{{ pesos(pedido.total) }}</strong></div>
        <div class="campo">
          <span class="etq">¿Cómo pagó?</span>
          <div class="tipos">
            @for (t of tipos; track t.id) {
              <button type="button" class="tipo" [class.on]="tipo() === t.id" (click)="tipo.set(t.id)">{{ t.label }}</button>
            }
          </div>
        </div>
        @if (tipo() === 'mixto') {
          <div class="fila-campos">
            <div class="campo">
              <label for="ef">Efectivo</label>
              <input pesos id="ef" [(ngModel)]="efectivo" (ngModelChange)="transferencia = pedido.total - (efectivo || 0)" />
            </div>
            <div class="campo">
              <label for="tr">Transferencia</label>
              <input pesos id="tr" [(ngModel)]="transferencia" />
            </div>
          </div>
          <p class="ayuda">Deben sumar {{ pesos(pedido.total) }}.</p>
        }
        @if (pideComprobante(tipo()) && conQr) {
          <button type="button" class="b" style="width: 100%" (click)="qr.emit(tipo() === 'mixto' ? (transferencia || 0) : pedido.total)">
            Mostrar QR para que pague {{ pesos(tipo() === 'mixto' ? (transferencia || 0) : pedido.total) }}</button>
        }
        @if (pideComprobante(tipo()) && !alConfirmar) {
          @if (!conPropina()) {
            <button type="button" class="link-propina" (click)="conPropina.set(true)">+ El cliente transfirió de más (propina)</button>
          } @else {
            <div class="propina">
              <div class="campo">
                <label for="prop">Propina: lo que transfirió de más</label>
                <input pesos id="prop" [(ngModel)]="propina" placeholder="Ej: 2000" />
              </div>
              <p class="ayuda" style="margin: 0">
                @if (propina > 0) {
                  El cliente transfirió <strong class="num">{{ pesos(transferido() + propina) }}</strong>
                  ({{ pesos(transferido()) }} del pedido + {{ pesos(propina) }} de propina). La propina es tuya: en el cuadre se te descuenta de lo que entregas.
                } @else {
                  Escribe solo lo que sobró. Ej: si el pedido es de $79.000 y transfirió $81.000, la propina es $2.000.
                }
              </p>
              <button type="button" class="link-propina" (click)="conPropina.set(false); propina = 0">Quitar propina</button>
            </div>
          }
        }
        @if (pideComprobante(tipo())) {
          <app-comprobantes-input [rutas]="evidencias()" (cambio)="evidencias.set($event); error.set('')"></app-comprobantes-input>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </div>
      <div class="hoja-pie">
        <button class="b" (click)="cerrar.emit()">Cancelar</button>
        <button class="b b-ok" [disabled]="!tipo() || guardando() || (pideComprobante(tipo()) && !evidencias().length)" (click)="confirmar()">
          {{ guardando() ? 'Guardando…' : 'Confirmar entrega' }}
        </button>
      </div>
    </div>
  `,
})
export class EntregarComponent {
  @Input({ required: true }) pedido!: Pick<Pedido, 'id' | 'cliente_nombre' | 'total'>;
  /** Para pedidos de otro negocio (Variedades JYB): guarda la entrega allá en vez de en Jasta */
  @Input() alConfirmar?: (tipo: TipoRecaudo, efectivo: number, transferencia: number, evidencias: string[]) => Promise<void>;
  @Output() cerrar = new EventEmitter<void>();
  @Output() entregado = new EventEmitter<void>();
  /** Hay cuentas del negocio con QR: se ofrece mostrarlo cuando paga por transferencia */
  @Input() conQr = false;
  /** Pide mostrar el QR de pago con este valor */
  @Output() qr = new EventEmitter<number>();

  private ps = inject(PedidosService);
  pesos = pesos;
  tipos: { id: TipoRecaudo; label: string }[] = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'mixto', label: 'Mixto' },
  ];
  tipo = signal<TipoRecaudo | null>(null);
  efectivo = 0;
  transferencia = 0;
  guardando = signal(false);
  evidencias = signal<string[]>([]);
  /** Lo que el cliente transfirió de más (solo con transferencia o mixto): es del mensajero */
  conPropina = signal(false);
  propina = 0;
  transferido(): number {
    return this.tipo() === 'mixto' ? Number(this.transferencia) || 0 : Number(this.pedido.total) || 0;
  }
  pideComprobante = pideComprobante;
  error = signal('');

  async confirmar(): Promise<void> {
    const tipo = this.tipo();
    if (!tipo) return;
    if (tipo === 'mixto' && Number(this.efectivo) + Number(this.transferencia) !== Number(this.pedido.total)) {
      this.error.set(`Efectivo + transferencia debe dar ${pesos(this.pedido.total)}.`);
      return;
    }
    const propina = pideComprobante(tipo) && this.conPropina() ? Math.round(Number(this.propina) || 0) : 0;
    if (propina < 0 || propina > Number(this.pedido.total)) {
      this.error.set('Revisa la propina.');
      return;
    }
    if (pideComprobante(tipo) && !this.evidencias().length) {
      this.error.set('Sube la foto del comprobante de la transferencia.');
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    try {
      const evidencias = pideComprobante(tipo) ? this.evidencias() : [];
      if (this.alConfirmar) await this.alConfirmar(tipo, Number(this.efectivo) || 0, Number(this.transferencia) || 0, evidencias);
      else await this.ps.entregar(this.pedido.id, tipo, Number(this.efectivo) || 0, Number(this.transferencia) || 0, evidencias, propina);
      this.entregado.emit();
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
