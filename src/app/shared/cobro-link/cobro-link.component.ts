import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { Pedido } from '../modelos';
import { mensajeError, pesos } from '../formato';
import { enlaceWhatsapp } from '../whatsapp';
import { recargoWompi } from '../recargo-wompi';

/**
 * Cobrar un pedido con un link de pago de Wompi (tarjeta, PSE, Nequi, Daviplata). Cuando el cliente
 * paga, el pedido queda pagado solo: el domiciliario no cobra y no hay que revisar comprobantes.
 */
@Component({
  selector: 'app-cobro-link',
  standalone: true,
  imports: [FormsModule],
  styles: [
    `
      .resumen { display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border-radius: var(--radius); background: var(--surface-2); font-size: 14px; }
      .resumen div { display: flex; justify-content: space-between; gap: 10px; }
      .resumen .fin { font-size: 16px; font-weight: 700; }
      .resumen .num { font-family: var(--mono-font); }
      .check { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; line-height: 1.35; cursor: pointer; }
      .check input { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      .link-box { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: var(--radius); background: var(--ok-wash); }
      .link-box code { font-size: 13px; overflow-wrap: anywhere; color: var(--efectivo-texto); }
      .acc { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .acc .b { height: 44px; }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-cobro">
      <div class="hoja-head"><h2 id="t-cobro">Cobrar por link · pedido #{{ pedido.id }}</h2></div>
      <div class="hoja-body">
        @if (!url()) {
          <p class="ayuda" style="margin: 0">Le mandas al cliente un link para que pague con tarjeta, PSE, Nequi o Daviplata. Cuando paga, el pedido queda pagado solo y te llega el aviso.</p>
          <label class="check"><input type="checkbox" [(ngModel)]="conRecargo" />El cliente paga el costo del pago en línea (comisión de Wompi)</label>
          <div class="resumen">
            <div><span>Pedido</span><span class="num">{{ pesos(pedido.total) }}</span></div>
            @if (conRecargo) { <div><span>Costo del pago en línea</span><span class="num">{{ pesos(recargo()) }}</span></div> }
            <div class="fin"><span>El cliente paga</span><span class="num">{{ pesos(+pedido.total + (conRecargo ? recargo() : 0)) }}</span></div>
          </div>
          @if (!conRecargo) { <p class="ayuda" style="margin: 0">La comisión de Wompi (unos {{ pesos(recargo()) }}) la asumes tú.</p> }
        } @else {
          <div class="link-box">
            <strong>Link listo: {{ pesos(totalLink()) }}</strong>
            <code>{{ url() }}</code>
            <small>Vale 3 días. Si vence, vuelve a tocar "Cobrar por link".</small>
          </div>
          <div class="acc">
            @if (pedido.cliente_telefono) { <a class="b b-pri" [href]="whatsapp()" target="_blank" rel="noopener">Mandar por WhatsApp</a> }
            <button class="b" (click)="copiar()">{{ copiado() ? '¡Copiado!' : 'Copiar mensaje' }}</button>
          </div>
        }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      </div>
      <div class="hoja-pie">
        <button class="b" (click)="cerrar.emit()">{{ url() ? 'Listo' : 'Cancelar' }}</button>
        @if (!url()) { <button class="b b-pri" [disabled]="creando()" (click)="crear()">{{ creando() ? 'Creando link…' : 'Crear link de pago' }}</button> }
      </div>
    </div>
  `,
})
export class CobroLinkComponent implements OnInit {
  @Input({ required: true }) pedido!: Pedido;
  @Output() cerrar = new EventEmitter<void>();
  private sb = inject(SupabaseService);

  conRecargo = true;
  recargo = signal(0);
  url = signal('');
  totalLink = signal(0);
  creando = signal(false);
  copiado = signal(false);
  error = signal('');
  pesos = pesos;

  ngOnInit(): void {
    this.recargo.set(recargoWompi(Number(this.pedido.total)));
  }

  async crear(): Promise<void> {
    this.error.set('');
    this.creando.set(true);
    try {
      const prep = await this.sb.client.rpc('preparar_cobro_link', { p_pedido: this.pedido.id, p_con_recargo: this.conRecargo });
      if (prep.error) throw prep.error;
      const seg = (prep.data as { seguimiento: string }).seguimiento;
      const { data, error } = await this.sb.client.functions.invoke('wompi-pagar', { body: { seguimiento: seg, origen: location.origin } });
      const r = (data ?? {}) as { url?: string; total?: number; error?: string };
      if (!r.url) {
        let msg = r.error;
        const ctx = (error as { context?: Response } | null)?.context;
        if (!msg && ctx?.json) msg = await ctx.json().then((j: { error?: string }) => j.error).catch(() => undefined);
        throw new Error(msg || 'No se pudo crear el link de pago. Intenta otra vez.');
      }
      this.url.set(r.url);
      this.totalLink.set(Number(r.total) || 0);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.creando.set(false);
    }
  }

  private mensaje(): string {
    const nombre = (this.pedido.cliente_nombre || '').split(' ')[0];
    return `Hola ${nombre}, este es el link para pagar tu pedido #${this.pedido.id} por ${pesos(this.totalLink())} con tarjeta, PSE, Nequi o Daviplata: ${this.url()} `
      + 'Apenas pagues nos llega la confirmación. ¡Gracias!';
  }

  whatsapp(): string {
    return enlaceWhatsapp(this.pedido.cliente_telefono, this.mensaje());
  }

  async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.mensaje());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.error.set('No se pudo copiar');
    }
  }
}
