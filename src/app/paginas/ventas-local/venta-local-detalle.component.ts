import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, receiptOutline, storefrontOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { Nota, Pedido, PedidoItem } from '../../shared/modelos';
import { mensajeError, pesos, urlImagen, urlMini } from '../../shared/formato';
import { formatoFechaCO, formatoHoraCO } from '../../shared/fecha-colombia';
import { fotoDeItem, nombreConVariante, variante } from '../../shared/variante';
import { pideComprobante, urlsComprobantes } from '../../shared/comprobantes';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

const PAGO: Record<string, string> = { efectivo: 'Efectivo', transferencia: 'Transferencia', mixto: 'Mixto (efectivo + transferencia)' };

/**
 * Detalle de una venta en el local: no es un pedido a domicilio (no hay
 * dirección, alistamiento ni mensajero). Solo muestra qué se vendió, quién lo
 * vendió, cómo pagó con sus comprobantes, y lo que fue para la vendedora y
 * para la alcancía.
 */
@Component({
  selector: 'app-venta-local-detalle',
  standalone: true,
  imports: [EsqueletoComponent, IonIcon],
  styles: [
    `
      .hoja { width: min(480px, 100vw); }
      .cab { display: flex; align-items: center; gap: 12px; }
      .cab .ico { width: 42px; height: 42px; flex: none; display: grid; place-items: center; border-radius: 12px; background: var(--oro-wash); color: var(--oro-texto); font-size: 20px; }
      .cab p { margin: 0; font-size: 12.5px; color: var(--text-muted); }
      .cab p::first-letter { text-transform: uppercase; }
      .cab strong { display: block; font-size: 15px; }
      .cancelada { padding: 8px 12px; border-radius: var(--radius); background: color-mix(in srgb, var(--danger) 10%, transparent); color: var(--danger); font-size: 13px; font-weight: 600; }
      .prods { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .prod { display: grid; grid-template-columns: 48px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 10px 0; border-bottom: var(--perfora); }
      .prod:last-child { border-bottom: 0; }
      .prod .foto { width: 48px; height: 48px; padding: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface-2); cursor: zoom-in; }
      .prod .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .prod span.foto { cursor: default; }
      .prod .nom { font-size: 14px; font-weight: 550; line-height: 1.3; }
      .prod .nom small { display: block; font-size: 12px; font-weight: 600; color: var(--oro-texto); }
      .prod .cant { display: block; font-size: 12px; color: var(--text-muted); font-weight: 400; }
      .prod .val { font-family: var(--mono-font); font-size: 13.5px; font-weight: 600; white-space: nowrap; }
      .total { display: flex; justify-content: space-between; align-items: baseline; padding-top: 12px; margin-top: 4px; border-top: 3px double var(--text); }
      .total span { font-size: 14px; font-weight: 650; }
      .total strong { font-family: var(--mono-font); font-size: 22px; font-weight: 650; }
      .datos { grid-template-columns: 130px 1fr; }
      .datos dt { color: var(--text-muted); }
      .datos dd { margin: 0; }
      .num { font-family: var(--mono-font); }
      .gana { color: var(--oro-texto); font-weight: 650; }
      .fotos { display: flex; gap: 8px; flex-wrap: wrap; }
      .fotos button { width: 96px; height: 96px; padding: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface-2); cursor: zoom-in; }
      .fotos img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .sin { margin: 0; font-size: 13px; color: var(--text-muted); }
      .sin.alerta { color: var(--danger); }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <aside class="hoja" role="dialog" aria-labelledby="t-venta">
      <div class="hoja-head">
        <h2 id="t-venta">Venta en el local #{{ pedidoId }}</h2>
        <button class="b b-icono" aria-label="Cerrar" (click)="cerrar.emit()"><ion-icon name="close-outline"></ion-icon></button>
      </div>
      <div class="hoja-body">
        @if (venta(); as v) {
          <div class="cab">
            <span class="ico" aria-hidden="true"><ion-icon name="storefront-outline"></ion-icon></span>
            <div><p>{{ fecha(v.created_at) }}</p><strong>{{ v.cliente_nombre }}</strong></div>
          </div>
          @if (v.estado === 'cancelado') { <p class="cancelada">Esta venta fue cancelada: no suma en caja, ganancias ni servicio local.</p> }

          <section>
            <h3 class="seccion-titulo">Productos</h3>
            <ul class="prods">
              @for (i of v.pedido_items ?? []; track i.id) {
                <li class="prod">
                  @if (foto(i); as u) {
                    <button type="button" class="foto" (click)="verProducto(i)" [attr.aria-label]="'Ver foto de ' + i.nombre"><img [src]="urlMini(u)" alt="" loading="lazy" /></button>
                  } @else { <span class="foto" aria-hidden="true"></span> }
                  <span class="nom">{{ i.nombre }}@if (variante(i); as x) {<small>{{ x }}</small>}
                    <span class="cant">{{ i.cantidad }} × {{ pesos(i.precio_venta) }}</span></span>
                  <span class="val">{{ pesos(i.total) }}</span>
                </li>
              }
            </ul>
            <div class="total"><span>Total</span><strong>{{ pesos(v.total) }}</strong></div>
          </section>

          <section>
            <h3 class="seccion-titulo">Quién lo vendió</h3>
            <dl class="datos">
              <dt>Vendedora</dt><dd>{{ v.vendedora?.nombre || 'Sin vendedora (venta de la tienda)' }}</dd>
              @if (registro()) { <dt>Registró</dt><dd>{{ registro() }}</dd> }
              @if (v.vendedora_id && veGanancias()) {
                <dt>Su ganancia</dt><dd><span class="num gana">{{ pesos(ganancia() - aporte()) }}</span>
                  @if (aporte() > 0) { <span class="sin" style="display: block">{{ pesos(ganancia()) }} − {{ pesos(aporte()) }} para el servicio local</span> }</dd>
              }
              @if (aporte() > 0) { <dt>Servicio local</dt><dd class="num">{{ pesos(aporte()) }}</dd> }
            </dl>
          </section>

          <section>
            <h3 class="seccion-titulo">Pago</h3>
            <dl class="datos">
              <dt>Forma de pago</dt><dd>{{ pago(v.tipo_recaudo) }}</dd>
              @if (v.tipo_recaudo === 'mixto' || v.tipo_recaudo === 'efectivo') { <dt>Efectivo</dt><dd class="num">{{ pesos(v.valor_efectivo) }}</dd> }
              @if (v.tipo_recaudo === 'mixto' || v.tipo_recaudo === 'transferencia') { <dt>Transferencia</dt><dd class="num">{{ pesos(v.valor_transferencia) }}</dd> }
            </dl>
          </section>

          @if (pideComprobante(v.tipo_recaudo) || v.evidencias?.length) {
            <section>
              <h3 class="seccion-titulo">Comprobante de la transferencia</h3>
              @if (v.evidencias?.length) {
                <div class="fotos">
                  @for (f of v.evidencias; track f; let n = $index) {
                    <button type="button" (click)="verComprobantes(n)" [attr.aria-label]="'Ver comprobante ' + (n + 1)"><img [src]="comprobantes()[n]" alt="" loading="lazy" /></button>
                  }
                </div>
              } @else {
                <p class="sin alerta">Esta venta no tiene comprobante (se registró antes de que fuera obligatorio).</p>
              }
            </section>
          }

          @if (v.observaciones) {
            <section><h3 class="seccion-titulo">Observaciones</h3><p class="sin" style="color: var(--text-soft)">{{ v.observaciones }}</p></section>
          }
        } @else if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        } @else {
          <app-esqueleto forma="texto" [filas]="5"></app-esqueleto>
        }
      </div>
      <!-- Cancelar, editar y eliminar: solo el admin (también lo exige la base) -->
      @if (esAdmin() && venta(); as v) {
        <div class="hoja-pie">
          @if (v.estado === 'entregado') {
            <button class="b" style="color: var(--danger)" (click)="cancelar()" [disabled]="ocupado()">Cancelar venta</button>
            <button class="b" (click)="editar()">Editar</button>
          }
          <button class="b b-peligro" (click)="eliminar()" [disabled]="ocupado()">Eliminar venta</button>
        </div>
      }
    </aside>
  `,
})
export class VentaLocalDetalleComponent implements OnInit {
  @Input({ required: true }) pedidoId!: number;
  @Output() cerrar = new EventEmitter<void>();
  @Output() cambiado = new EventEmitter<void>();

  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private visor = inject(VisorService);
  private toast = inject(ToastService);
  private router = inject(Router);

  venta = signal<Pedido | null>(null);
  notas = signal<Nota[]>([]);
  comprobantes = signal<string[]>([]);
  error = signal('');
  ocupado = signal(false);

  esAdmin = computed(() => this.sb.tiene('admin'));
  veGanancias = computed(() => this.sb.tiene('admin', 'venta_local'));
  ganancia = computed(() => (this.venta()?.pedido_items ?? []).reduce((a, i) => a + (Number(i.precio_venta) - Number(i.precio_base)) * i.cantidad, 0));
  aporte = computed(() => Number(this.venta()?.aporte_alcancia ?? 0));
  /** Quien la registró (el autor de la primera nota) */
  registro = computed(() => this.notas()[0]?.autor ?? '');

  pesos = pesos;
  urlMini = urlMini;
  variante = variante;
  pideComprobante = pideComprobante;

  constructor() {
    addIcons({ closeOutline, receiptOutline, storefrontOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      const { pedido, notas } = await this.ps.detalle(this.pedidoId);
      this.venta.set(pedido);
      this.notas.set(notas);
      if (pedido.evidencias?.length) this.comprobantes.set(await urlsComprobantes(this.sb.client, pedido.evidencias));
    } catch (e) {
      this.error.set('No se pudo cargar la venta: ' + mensajeError(e));
    }
  }

  foto(i: PedidoItem): string | null {
    return urlImagen(fotoDeItem(i));
  }

  verProducto(i: PedidoItem): void {
    const conFoto = (this.venta()?.pedido_items ?? []).filter((x) => this.foto(x));
    this.visor.abrir(conFoto.map((x) => ({ url: this.foto(x)!, titulo: nombreConVariante(x) })), conFoto.findIndex((x) => x.id === i.id));
  }

  verComprobantes(n: number): void {
    this.visor.abrir(this.comprobantes().map((url, k) => ({ url, titulo: `Comprobante ${k + 1} · venta #${this.pedidoId}` })), n);
  }

  pago(t: string | null): string {
    return t ? (PAGO[t] ?? t) : '—';
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { weekday: 'long', day: 'numeric', month: 'long' }) + ' · ' + formatoHoraCO(iso);
  }

  async cancelar(): Promise<void> {
    if (!confirm(`¿Cancelar la venta #${this.pedidoId}? Se devuelve el stock y deja de sumar en caja, ganancias y servicio local.`)) return;
    this.ocupado.set(true);
    try {
      await this.ps.cambiarEstado(this.pedidoId, 'cancelado');
      this.toast.ok(`Venta #${this.pedidoId} cancelada`);
      this.cambiado.emit();
      this.cerrar.emit();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Borra la venta del todo (solo el admin): devuelve el stock y deja de contar en caja y servicio local */
  async eliminar(): Promise<void> {
    if (!confirm(`¿Eliminar la venta #${this.pedidoId}? Se borra del todo (no queda en el historial) y se devuelve el stock. No se puede deshacer.`)) return;
    this.ocupado.set(true);
    try {
      const { error } = await this.sb.client.rpc('eliminar_venta_local', { p_pedido: this.pedidoId });
      if (error) throw error;
      this.toast.ok(`Venta #${this.pedidoId} eliminada`);
      this.cambiado.emit();
      this.cerrar.emit();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  editar(): void {
    this.cerrar.emit();
    void this.router.navigate(['/app/pedidos', this.pedidoId, 'editar']);
  }
}
