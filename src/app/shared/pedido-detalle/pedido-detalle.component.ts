import { Component, EventEmitter, Input, OnChanges, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, callOutline, logoWhatsapp } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../toast/toast.service';
import { EntregarComponent } from '../entregar/entregar.component';
import { RotulosService } from '../rotulo/rotulos.service';
import { enlaceWhatsapp } from '../whatsapp';
import { EstadoPedido, Nota, Pedido, Usuario, estadoLabel } from '../modelos';
import { mensajeError, pesos, urlImagen } from '../formato';
import { formatoFechaCO, formatoHoraCO } from '../fecha-colombia';
import { ChatPedidoComponent } from '../chat-pedido/chat-pedido.component';

/** Hoja lateral con todo el pedido y las acciones que le tocan a cada rol */
@Component({
  selector: 'app-pedido-detalle',
  standalone: true,
  imports: [FormsModule, IonIcon, EntregarComponent, ChatPedidoComponent],
  styles: [
    `
      .resumen { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .total { font-size: 26px; font-weight: 600; letter-spacing: -0.03em; }
      .ruta { list-style: none; margin: -6px 0 0; padding: 0; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
      .ruta li { display: flex; flex-direction: column; gap: 6px; font-size: 12px; font-weight: 500; color: var(--text-muted); }
      .ruta .punto { height: 4px; border-radius: 2px; background: var(--border); transition: background 300ms var(--ease); }
      .ruta li.hecho { color: var(--text-2); }
      .ruta li.hecho .punto { background: var(--text); }
      .ruta li.actual { color: var(--text); font-weight: 650; }
      .ruta li.actual:nth-child(2) .punto { background: var(--st-alistado); }
      .ruta li.actual:nth-child(3) .punto { background: var(--st-ruta); }
      .ruta li.actual:nth-child(4) .punto, .ruta li.hecho:nth-child(4) .punto { background: var(--efectivo); }
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
      .fotos { display: flex; gap: 8px; flex-wrap: wrap; }
      .fotos a { display: block; width: 88px; height: 88px; border-radius: var(--radius-sm); overflow: hidden;
        border: 1px solid var(--border); background: var(--surface-2); }
      .fotos img { width: 100%; height: 100%; object-fit: cover; }
      .historial { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 13px; }
      .historial li { display: grid; grid-template-columns: 92px 1fr; gap: 10px; }
      .historial time { color: var(--text-muted); font-family: var(--mono-font); font-size: 11.5px; }
      .contacto { display: flex; gap: 6px; }
      .despachar { display: flex; gap: 8px; }
      .despachar select { flex: 1; }
      .cargando { padding: 40px 20px; color: var(--text-soft); font-size: 14px; }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <aside class="hoja" role="dialog" aria-labelledby="t-pedido">
      <div class="hoja-head">
        <h2 id="t-pedido">Pedido <span class="guia guia-grande">#{{ pedidoId }}</span></h2>
        <button class="b b-icono" aria-label="Cerrar" (click)="cerrar.emit()"><ion-icon name="close-outline"></ion-icon></button>
      </div>

      @if (pedido(); as p) {
        <div class="hoja-body">
          <div class="resumen">
            <span class="estado {{ p.estado }}">{{ estadoLabel(p.estado) }}</span>
            <span class="total num">{{ pesos(p.total) }}</span>
          </div>

          @if (p.estado !== 'cancelado' && p.canal !== 'local') {
            <ol class="ruta" aria-label="Recorrido del pedido">
              @for (paso of pasos; track paso.id; let i = $index) {
                <li [class.hecho]="i <= pasoActual()" [class.actual]="i === pasoActual()">
                  <span class="punto"></span>{{ paso.label }}
                </li>
              }
            </ol>
          }

          <section>
            <h3 class="seccion-titulo">Cliente</h3>
            <dl class="datos">
              <dt>Nombre</dt><dd>{{ p.cliente_nombre }}</dd>
              <dt>Teléfono</dt>
              <dd>
                @if (p.cliente_telefono) {
                  <span class="contacto">
                    <a [href]="'tel:' + p.cliente_telefono">{{ p.cliente_telefono }}</a>
                    · <a [href]="whatsapp(p.cliente_telefono)" target="_blank" rel="noopener">WhatsApp</a>
                  </span>
                } @else { — }
              </dd>
              <dt>Dirección</dt><dd>{{ p.direccion || '—' }}</dd>
              <dt>Barrio</dt><dd>{{ p.barrio || '—' }}</dd>
              @if (p.observaciones) {
                <dt>Observaciones</dt><dd>{{ p.observaciones }}</dd>
              }
            </dl>
          </section>

          <section>
            <h3 class="seccion-titulo">Productos</h3>
            <table class="lineas">
              <tbody>
                @for (i of p.pedido_items ?? []; track i.id) {
                  <tr><td class="cant num">{{ i.cantidad }}×</td><td><span class="lider">{{ i.nombre }}</span></td><td class="num">{{ pesos(i.total) }}</td></tr>
                }
              </tbody>
              <tfoot>
                <tr><td></td><td><span class="lider">Domicilio</span></td><td class="num">{{ pesos(p.valor_domicilio) }}</td></tr>
                <tr class="fin"><td></td><td><span class="lider">Total</span></td><td class="num">{{ pesos(p.total) }}</td></tr>
              </tfoot>
            </table>
          </section>

          @if (participa()) {
            <section>
              <h3 class="seccion-titulo">Mensajes del pedido</h3>
              <!-- Una conversación nueva por pedido (si cambia el pedido abierto, se vuelve a crear) -->
              @for (id of [pedidoId]; track id) {
                <app-chat-pedido [pedidoId]="id" [enfocar]="chat"></app-chat-pedido>
              }
            </section>
          }

          <section>
            <h3 class="seccion-titulo">Seguimiento</h3>
            <dl class="datos">
              <dt>Canal</dt><dd>{{ p.canal === 'local' ? 'Venta en el local' : 'Domicilio' }}</dd>
              <dt>Creado</dt><dd>{{ fecha(p.created_at) }}</dd>
              <dt>Vendedora</dt><dd>{{ p.vendedora?.nombre || '—' }}</dd>
              <dt>Mensajero</dt><dd>{{ p.mensajero?.nombre || 'Sin asignar' }}</dd>
              @if (p.entregado_at) {
                <dt>Entregado</dt><dd>{{ fecha(p.entregado_at) }}</dd>
              }
              @if (p.tipo_recaudo) {
                <dt>Pago</dt>
                <dd>
                  {{ p.tipo_recaudo === 'mixto' ? 'Mixto' : p.tipo_recaudo === 'efectivo' ? 'Efectivo' : 'Transferencia' }}
                  @if (p.tipo_recaudo === 'mixto') {
                    · efectivo {{ pesos(p.valor_efectivo) }} · transferencia {{ pesos(p.valor_transferencia) }}
                  }
                </dd>
              }
              <dt>Rótulo</dt><dd>{{ p.rotulo_impreso_at ? 'Impreso ' + fechaCorta(p.rotulo_impreso_at) : 'Sin imprimir' }}</dd>
              <dt>Cuadre</dt><dd>{{ p.cuadre_id ? 'Cuadrado' : p.estado === 'entregado' ? 'Pendiente' : '—' }}</dd>
            </dl>
          </section>

          @if (p.evidencias?.length) {
            <section>
              <h3 class="seccion-titulo">Comprobantes</h3>
              <div class="fotos">
                @for (f of p.evidencias; track f) {
                  <a [href]="urlImagen(f)" target="_blank" rel="noopener"><img [src]="urlImagen(f)" alt="Comprobante" loading="lazy" /></a>
                }
              </div>
            </section>
          }

          @if (puedeAsignar()) {
            <section>
              <h3 class="seccion-titulo">{{ p.estado === 'alistado' ? 'Despachar' : 'Mensajero' }}</h3>
              <div class="despachar">
                <select class="inp" [(ngModel)]="mensajeroSel" aria-label="Mensajero">
                  <option [ngValue]="null">Elige un mensajero…</option>
                  @for (m of mensajeros(); track m.id) {
                    <option [ngValue]="m.id">{{ m.nombre }}</option>
                  }
                </select>
                @if (p.estado === 'alistado') {
                  <button class="b b-pri" [disabled]="!mensajeroSel || ocupado()" (click)="accion('despachado', mensajeroSel)">Despachar</button>
                } @else {
                  <button class="b" [disabled]="!mensajeroSel || mensajeroSel === p.mensajero_id || ocupado()" (click)="asignar()">Asignar</button>
                }
              </div>
            </section>
          }

          @if (notas().length) {
            <section>
              <h3 class="seccion-titulo">Historial</h3>
              <ul class="historial">
                @for (n of notas(); track n.id) {
                  <li><time>{{ fechaCorta(n.created_at) }}</time><span>{{ n.nota }}@if (n.autor) { <span class="suave"> · {{ n.autor }}</span> }</span></li>
                }
              </ul>
            </section>
          }
        </div>

        @if (acciones().length) {
          <div class="hoja-pie">
            @for (a of acciones(); track a.id) {
              <button class="b" [class.b-pri]="a.principal" [class.b-peligro]="a.peligro" [disabled]="ocupado()" (click)="ejecutar(a.id)">
                {{ a.label }}
              </button>
            }
          </div>
        }
      } @else {
        <div class="cargando">{{ error() || 'Cargando pedido…' }}</div>
      }
    </aside>

    @if (entregando() && pedido()) {
      <app-entregar [pedido]="pedido()!" (cerrar)="entregando.set(false)" (entregado)="alEntregar()"></app-entregar>
    }
  `,
})
export class PedidoDetalleComponent implements OnChanges {
  @Input({ required: true }) pedidoId!: number;
  /** Abre el pedido directo en la conversación (desde un aviso de mensaje) */
  @Input() chat = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() cambiado = new EventEmitter<void>();

  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private rotulos = inject(RotulosService);

  pedido = signal<Pedido | null>(null);
  notas = signal<Nota[]>([]);
  mensajeros = signal<Usuario[]>([]);
  error = signal('');
  ocupado = signal(false);
  entregando = signal(false);
  mensajeroSel: number | null = null;

  pesos = pesos;
  urlImagen = urlImagen;
  estadoLabel = estadoLabel;

  pasos = [
    { id: 'por_alistar', label: 'Por alistar' },
    { id: 'alistado', label: 'Alistado' },
    { id: 'despachado', label: 'En ruta' },
    { id: 'entregado', label: 'Entregado' },
  ];
  pasoActual = computed(() => this.pasos.findIndex((x) => x.id === this.pedido()?.estado));

  /** La conversación la ven admin, alistamiento y la vendedora y el mensajero del pedido */
  participa = computed(() => {
    const p = this.pedido();
    const yo = this.sb.usuario()?.id;
    return !!p && (this.sb.tiene('admin', 'alistador') || p.vendedora_id === yo || p.mensajero_id === yo);
  });

  puedeAsignar = computed(() => {
    const p = this.pedido();
    return !!p && this.sb.tiene('admin', 'alistador') && ['por_alistar', 'alistado', 'despachado'].includes(p.estado);
  });

  acciones = computed(() => {
    const p = this.pedido();
    if (!p) return [];
    const yo = this.sb.usuario()?.id;
    const admin = this.sb.tiene('admin');
    const out: { id: string; label: string; principal?: boolean; peligro?: boolean }[] = [];
    if (p.estado === 'por_alistar' && this.sb.tiene('admin', 'alistador'))
      out.push({ id: 'alistado', label: 'Marcar alistado', principal: true });
    if (p.estado === 'despachado' && (admin || p.mensajero_id === yo))
      out.push({ id: 'entregar', label: 'Entregar', principal: true });
    if (p.estado !== 'cancelado' && (admin || (p.estado === 'por_alistar' && p.vendedora_id === yo)))
      out.push({ id: 'cancelado', label: 'Cancelar pedido', peligro: true });
    if (p.estado !== 'cancelado' && this.sb.tiene('admin', 'alistador'))
      out.push({ id: 'rotulo', label: p.rotulo_impreso_at ? 'Reimprimir rótulo' : 'Imprimir rótulo' });
    if (p.estado !== 'cancelado' && (admin || (p.estado === 'por_alistar' && p.vendedora_id === yo)))
      out.push({ id: 'editar', label: 'Editar' });
    if (p.estado === 'cancelado' && admin) out.push({ id: 'por_alistar', label: 'Reactivar' });
    return out;
  });

  constructor() {
    addIcons({ closeOutline, callOutline, logoWhatsapp });
  }

  ngOnChanges(): void {
    void this.cargar();
    if (this.sb.tiene('admin', 'alistador') && !this.mensajeros().length) {
      this.ps.mensajeros().then((m) => this.mensajeros.set(m)).catch(() => undefined);
    }
  }

  async cargar(): Promise<void> {
    try {
      const { pedido, notas } = await this.ps.detalle(this.pedidoId);
      this.pedido.set(pedido);
      this.notas.set(notas);
      this.mensajeroSel = pedido.mensajero_id;
    } catch (e) {
      this.error.set('No se pudo cargar el pedido: ' + mensajeError(e));
    }
  }

  async ejecutar(id: string): Promise<void> {
    if (id === 'entregar') return this.entregando.set(true);
    if (id === 'editar') {
      void this.router.navigate(['/app/pedidos', this.pedidoId, 'editar']);
      return;
    }
    if (id === 'rotulo') {
      // Sin await antes: la ventana de impresión tiene que abrirse en el mismo clic
      if (await this.rotulos.imprimir([this.pedido()!])) {
        await this.cargar();
        this.cambiado.emit();
      }
      return;
    }
    if (id === 'cancelado' && !confirm('¿Cancelar el pedido #' + this.pedidoId + '?')) return;
    await this.accion(id as EstadoPedido);
  }

  async accion(estado: EstadoPedido, mensajero: number | null = null): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.ps.cambiarEstado(this.pedidoId, estado, mensajero);
      this.toast.ok(`Pedido #${this.pedidoId}: ${estadoLabel(estado).toLowerCase()}`);
      await this.cargar();
      this.cambiado.emit();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  async asignar(): Promise<void> {
    if (!this.mensajeroSel) return;
    this.ocupado.set(true);
    try {
      await this.ps.asignarMensajero(this.pedidoId, this.mensajeroSel);
      this.toast.ok('Mensajero asignado');
      await this.cargar();
      this.cambiado.emit();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  async alEntregar(): Promise<void> {
    this.entregando.set(false);
    this.toast.ok(`Pedido #${this.pedidoId} entregado`);
    await this.cargar();
    this.cambiado.emit();
  }

  whatsapp(tel: string): string {
    return enlaceWhatsapp(tel, `Hola ${this.pedido()?.cliente_nombre.split(' ')[0] ?? ''}, te escribimos de Jasta por tu pedido #${this.pedidoId}.`);
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + formatoHoraCO(iso);
  }

  fechaCorta(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
