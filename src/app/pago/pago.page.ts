import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../core/services/supabase.service';
import { mensajeError, pesos } from '../shared/formato';

interface PagoTienda {
  id: number;
  estado: 'por_pagar' | 'por_confirmar' | 'confirmado' | 'cancelado';
  pago: 'contra_entrega' | 'en_linea';
  pago_estado: 'pendiente' | 'aprobado' | 'rechazado' | null;
  pago_metodo: string | null;
  subtotal: number;
  domicilio: number;
  recargo: number;
  total: number;
  cliente: string;
  items: { nombre: string; cantidad: number; precio: number; color: string | null; talla: string | null }[];
  vendedora: string | null;
  vendedora_id: number | null;
}

const METODOS: Record<string, string> = {
  CARD: 'tarjeta', NEQUI: 'Nequi', PSE: 'PSE', BANCOLOMBIA_TRANSFER: 'botón Bancolombia', BANCOLOMBIA_QR: 'QR Bancolombia',
  DAVIPLATA: 'Daviplata', BANCOLOMBIA_BNPL: 'Bancolombia a cuotas',
};

/**
 * Página pública a la que vuelve el cliente después de pagar en Wompi (/pago/:codigo?id=transacción).
 * Verifica el pago con Wompi y muestra si quedó aprobado; si no, deja reintentar o pasar a pagar al recibir.
 */
@Component({
  selector: 'app-pago',
  standalone: true,
  styles: [
    `
      :host { display: block; position: absolute; inset: 0; height: 100vh; height: 100dvh; overflow-y: auto; background: var(--bg); color: var(--text); }
      .caja { max-width: 480px; margin: 0 auto; padding: calc(28px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; }
      .tarjeta { display: flex; flex-direction: column; gap: 10px; padding: 22px 18px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); text-align: center; }
      .icono { width: 64px; height: 64px; margin: 0 auto; display: grid; place-items: center; border-radius: 50%; font-size: 32px; font-weight: 700; background: var(--accent-wash); color: var(--accent); }
      .icono.ok { background: var(--ok-wash); color: var(--efectivo-texto); }
      .icono.mal { background: var(--danger-wash); color: var(--danger); }
      .icono.espera { animation: latir 1.4s ease-in-out infinite; }
      @keyframes latir { 50% { opacity: .45; } }
      h1 { margin: 0; font-size: 22px; line-height: 1.25; }
      p { margin: 0; font-size: 15px; line-height: 1.45; color: var(--text-soft); }
      .monto { font-family: var(--mono-font); font-size: 26px; font-weight: 700; color: var(--text); }
      .items { list-style: none; margin: 0; padding: 0; text-align: left; }
      .items li { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--border-soft); font-size: 14px; }
      .items li span:last-child { font-family: var(--mono-font); white-space: nowrap; }
      .items li.fin { font-weight: 700; border-bottom: 0; }
      .acciones { display: flex; flex-direction: column; gap: 8px; }
      .acciones .b { width: 100%; height: 46px; font-size: 15px; }
      .error { margin: 0; color: var(--danger); font-size: 14px; }
      .seguro { font-size: 12.5px; color: var(--text-muted); }
    `,
  ],
  template: `
    <div class="caja">
      @if (cargando()) {
        <div class="tarjeta"><div class="icono espera" aria-hidden="true">…</div><h1>Cargando tu pedido…</h1></div>
      } @else if (!p()) {
        <div class="tarjeta"><div class="icono mal" aria-hidden="true">!</div><h1>No encontramos este pedido</h1>
          <p>Revisa el enlace o escríbenos por WhatsApp.</p></div>
      } @else {
        @let w = p()!;
        <div class="tarjeta" role="status">
          @if (w.pago_estado === 'aprobado') {
            <div class="icono ok" aria-hidden="true">✓</div>
            <h1>¡Pago recibido, {{ w.cliente }}!</h1>
            <span class="monto">{{ pesos(w.total) }}</span>
            <p>Pagaste{{ w.pago_metodo ? ' con ' + metodo(w.pago_metodo) : '' }}. {{ w.vendedora ? primer(w.vendedora) : 'La tienda' }} te va a contactar para coordinar el envío. Al recibir <strong>no tienes que pagar nada</strong>.</p>
          } @else if (w.pago === 'contra_entrega' && w.estado !== 'cancelado') {
            <div class="icono ok" aria-hidden="true">✓</div>
            <h1>¡Recibimos tu pedido!</h1>
            <p>Pagas al recibir: {{ pesos(+w.subtotal + +w.domicilio) }}. {{ w.vendedora ? primer(w.vendedora) : 'La tienda' }} te va a contactar para confirmarlo.</p>
          } @else if (verificando()) {
            <div class="icono espera" aria-hidden="true">⋯</div>
            <h1>Estamos confirmando tu pago…</h1>
            <p>Esto toma unos segundos. No cierres esta página.</p>
          } @else if (w.pago_estado === 'rechazado') {
            <div class="icono mal" aria-hidden="true">✕</div>
            <h1>El pago no se aprobó</h1>
            <p>No se te cobró nada. Puedes intentarlo otra vez (con otra tarjeta o con PSE o Nequi) o pagar al recibir.</p>
          } @else if (w.estado === 'cancelado') {
            <div class="icono mal" aria-hidden="true">!</div>
            <h1>Tu pedido está en pausa</h1>
            <p>No se completó el pago a tiempo. Si todavía lo quieres, págalo ahora o elige pagar al recibir.</p>
          } @else if (pendienteLargo()) {
            <div class="icono espera" aria-hidden="true">⋯</div>
            <h1>Tu pago está en proceso</h1>
            <p>El banco todavía no confirma. Apenas se apruebe te contactamos; puedes cerrar esta página.</p>
          } @else {
            <div class="icono" aria-hidden="true">$</div>
            <h1>Tu pedido espera el pago</h1>
            <p>Termina el pago para que lo enviemos.</p>
          }
        </div>

        <div class="tarjeta">
          <ul class="items">
            @for (i of w.items; track $index) { <li><span>{{ i.cantidad }} × {{ i.nombre }}{{ i.color ? ' · ' + i.color : '' }}{{ i.talla ? ' · ' + i.talla : '' }}</span><span>{{ pesos(i.precio * i.cantidad) }}</span></li> }
            <li><span>Domicilio</span><span>{{ pesos(w.domicilio) }}</span></li>
            @if (+w.recargo) { <li><span>Pago en línea (5%)</span><span>{{ pesos(w.recargo) }}</span></li> }
            <li class="fin"><span>Total</span><span>{{ pesos(w.pago === 'en_linea' ? w.total : +w.subtotal + +w.domicilio) }}</span></li>
          </ul>
        </div>

        @if (puedePagar()) {
          <div class="acciones">
            <button class="b b-pri" [disabled]="ocupado()" (click)="irAPagar()">{{ ocupado() ? 'Abriendo el pago…' : 'Pagar ' + pesos(w.total) }}</button>
            <button class="b" [disabled]="ocupado()" (click)="alRecibir()">Mejor pago al recibir ({{ pesos(+w.subtotal + +w.domicilio) }})</button>
            <p class="seguro">El pago se hace en Wompi (de Bancolombia). Nosotros nunca vemos los datos de tu tarjeta.</p>
          </div>
        }
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        <a class="b" [href]="'/tienda' + (w.vendedora_id ? '/' + w.vendedora_id : '')">Volver al catálogo</a>
      }
    </div>
  `,
})
export class PagoPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private ruta = inject(ActivatedRoute);

  p = signal<PagoTienda | null>(null);
  cargando = signal(true);
  verificando = signal(false);
  pendienteLargo = signal(false);
  ocupado = signal(false);
  error = signal('');
  pesos = pesos;
  private codigo = '';
  private tx = '';
  private timer?: ReturnType<typeof setTimeout>;
  private intentos = 0;

  async ngOnInit(): Promise<void> {
    this.codigo = this.ruta.snapshot.paramMap.get('codigo') ?? '';
    this.tx = this.ruta.snapshot.queryParamMap.get('id') ?? '';
    await this.cargar();
    this.cargando.set(false);
    if (this.tx && this.p()?.pago_estado !== 'aprobado') {
      this.verificando.set(true);
      void this.verificar();
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  private async cargar(): Promise<void> {
    const { data } = await this.sb.client.rpc('tienda_pago', { p_codigo: this.codigo });
    this.p.set((data as PagoTienda | null) ?? null);
  }

  /** Pregunta a Wompi por la transacción; si sigue en proceso (PSE, Nequi) vuelve a preguntar */
  private async verificar(): Promise<void> {
    this.intentos++;
    const r = await this.sb.client.functions.invoke('wompi-pagar', { body: { codigo: this.codigo, tx: this.tx } });
    const estado = (r.data as { status?: string } | null)?.status;
    await this.cargar();
    const w = this.p();
    if (!w || w.pago_estado === 'aprobado' || w.pago_estado === 'rechazado' || (estado && estado !== 'PENDING')) {
      this.verificando.set(false);
      return;
    }
    if (this.intentos >= 24) {
      this.verificando.set(false);
      this.pendienteLargo.set(true);
      return;
    }
    this.timer = setTimeout(() => void this.verificar(), 5000);
  }

  puedePagar(): boolean {
    const w = this.p();
    if (!w || w.pago !== 'en_linea' || w.pago_estado === 'aprobado' || this.verificando() || this.pendienteLargo()) return false;
    return w.estado === 'por_pagar' || w.estado === 'cancelado';
  }

  async irAPagar(): Promise<void> {
    this.error.set('');
    this.ocupado.set(true);
    const { data, error } = await this.sb.client.functions.invoke('wompi-pagar', { body: { codigo: this.codigo, origen: location.origin } });
    const url = (data as { url?: string } | null)?.url;
    if (url && url.startsWith('https://checkout.wompi.co/')) return location.assign(url);
    this.ocupado.set(false);
    if ((data as { pagado?: boolean } | null)?.pagado) return void this.cargar();
    let msg = (data as { error?: string } | null)?.error;
    const ctx = (error as { context?: Response } | null)?.context;
    if (!msg && ctx?.json) msg = await ctx.json().then((j: { error?: string }) => j.error).catch(() => undefined);
    this.error.set(msg || 'No se pudo abrir el pago. Intenta otra vez o elige pagar al recibir.');
  }

  async alRecibir(): Promise<void> {
    this.error.set('');
    this.ocupado.set(true);
    const { error } = await this.sb.client.rpc('tienda_pagar_al_recibir', { p_codigo: this.codigo });
    this.ocupado.set(false);
    if (error) return this.error.set(mensajeError(error));
    await this.cargar();
  }

  metodo(m: string): string {
    return METODOS[m] ?? m.toLowerCase();
  }

  primer(n: string): string {
    return n.split(' ')[0];
  }
}
