import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { Pedido, PedidoItem } from '../modelos';
import { mensajeError, pesos } from '../formato';
import { ComprobantesInputComponent } from '../comprobantes/comprobantes-input.component';
import { nombreConVariante } from '../variante';

type Tipo = 'devolucion' | 'cambio' | 'garantia';

const MOTIVOS = [
  { id: 'defectuoso', label: 'Salió defectuoso' },
  { id: 'llego_danado', label: 'Llegó dañado' },
  { id: 'no_le_gusto', label: 'No le gustó' },
  { id: 'talla_color', label: 'Talla o color' },
  { id: 'incompleto', label: 'Llegó incompleto' },
  { id: 'otro', label: 'Otro motivo' },
];

/**
 * Hoja para registrar una devolución, un cambio o una garantía de un pedido entregado:
 * qué productos y cuántos, por qué, si el producto vuelve al inventario o se dañó,
 * y (en una devolución) cuánto se le devuelve al cliente y si se descuenta la comisión.
 */
@Component({
  selector: 'app-devolucion',
  standalone: true,
  imports: [FormsModule, ComprobantesInputComponent],
  styles: [
    `
      .tipos, .estados { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
      .estados { grid-template-columns: 1fr 1fr; }
      .op { min-height: 44px; padding: 6px 8px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface);
        color: var(--text); font: inherit; font-size: 13.5px; font-weight: 550; cursor: pointer; text-align: center; line-height: 1.2; }
      .op small { display: block; font-size: 11.5px; font-weight: 450; color: var(--text-muted); }
      .op.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); }
      .motivos { display: flex; flex-wrap: wrap; gap: 6px; }
      .chip { height: 34px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text);
        font: inherit; font-size: 13px; cursor: pointer; }
      .chip.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .items { display: flex; flex-direction: column; gap: 8px; }
      .item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-2); }
      .item .nom { font-size: 13.5px; font-weight: 550; }
      .item small { display: block; font-size: 12px; color: var(--text-muted); }
      .paso { display: flex; align-items: center; gap: 6px; }
      .paso button { width: 32px; height: 32px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--surface); color: var(--text); font-size: 18px; cursor: pointer; }
      .paso button:disabled { opacity: .4; cursor: default; }
      .paso span { min-width: 22px; text-align: center; font-family: var(--mono-font); font-weight: 700; }
      .check { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; }
      .nota-com { margin: 0; font-size: 12.5px; color: var(--text-soft); }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-dev">
      <div class="hoja-head"><h2 id="t-dev">Devolución o garantía · #{{ pedido.id }}</h2></div>
      <div class="hoja-body">
        <div class="campo"><span class="etq">¿Qué pasó?</span>
          <div class="tipos">
            <button type="button" class="op" [class.on]="tipo() === 'devolucion'" (click)="tipo.set('devolucion')">Devolución<small>Se le devuelve la plata</small></button>
            <button type="button" class="op" [class.on]="tipo() === 'cambio'" (click)="tipo.set('cambio')">Cambio<small>Lo cambia por otro</small></button>
            <button type="button" class="op" [class.on]="tipo() === 'garantia'" (click)="tipo.set('garantia')">Garantía<small>Falló y se responde</small></button>
          </div>
        </div>

        <div class="campo"><span class="etq">¿Qué productos?</span>
          <div class="items">
            @for (i of items(); track i.id) {
              <div class="item">
                <span><span class="nom">{{ nombre(i) }}</span>
                  <small>Compró {{ i.cantidad }}@if (ya()[i.id]) { · ya devolvió {{ ya()[i.id] }} }</small></span>
                <span class="paso">
                  <button type="button" (click)="cambiar(i, -1)" [disabled]="!cant()[i.id]" aria-label="Menos">−</button>
                  <span>{{ cant()[i.id] || 0 }}</span>
                  <button type="button" (click)="cambiar(i, 1)" [disabled]="(cant()[i.id] || 0) >= maximo(i)" aria-label="Más">+</button>
                </span>
              </div>
            }
          </div>
        </div>

        <div class="campo"><span class="etq">Motivo</span>
          <div class="motivos">
            @for (m of motivos; track m.id) {
              <button type="button" class="chip" [class.on]="motivo() === m.id" (click)="motivo.set(m.id)">{{ m.label }}</button>
            }
          </div>
        </div>

        <div class="campo"><span class="etq">El producto que regresa</span>
          <div class="estados">
            <button type="button" class="op" [class.on]="estado() === 'vuelve_stock'" (click)="estado.set('vuelve_stock')">Está bien<small>Vuelve al inventario</small></button>
            <button type="button" class="op" [class.on]="estado() === 'danado'" (click)="estado.set('danado')">Está dañado<small>No se puede vender</small></button>
          </div>
        </div>

        @if (tipo() === 'devolucion') {
          <div class="fila-campos">
            <div class="campo"><label for="dv-re">Se le devuelve</label><input id="dv-re" class="num" type="number" inputmode="numeric" min="0" [(ngModel)]="reembolso" /></div>
            <div class="campo"><label for="dv-me">¿Cómo?</label>
              <select id="dv-me" [(ngModel)]="metodo"><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></select></div>
          </div>
          <p class="nota-com">Valor de lo que devuelve: {{ pesos(valorSel()) }}</p>
          @if (comisionSel() > 0) {
            <label class="check"><input type="checkbox" [(ngModel)]="descontarComision" />
              <span>Descontarle a {{ pedido.vendedora?.nombre || 'la vendedora' }} su comisión de estas unidades ({{ pesos(comisionSel()) }}) en el próximo pago</span></label>
          }
        } @else {
          <label class="check"><input type="checkbox" [(ngModel)]="reemplazo" /> <span>Se le entregó otro igual (sale del inventario)</span></label>
        }

        @if (puedeFotos()) {
          <app-comprobantes-input [obligatorio]="false" titulo="Fotos (opcional)" pista="Foto del producto o del comprobante del reembolso." [rutas]="fotos()"
            (cambio)="fotos.set($event)"></app-comprobantes-input>
        }
        <div class="campo"><label for="dv-no">Nota (opcional)</label><input id="dv-no" maxlength="300" [(ngModel)]="nota" placeholder="Ej: la pantalla no prende" /></div>
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      </div>
      <div class="hoja-pie">
        <button class="b" (click)="cerrar.emit()">Cancelar</button>
        <button class="b b-pri" (click)="guardar()" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Registrar' }}</button>
      </div>
    </div>
  `,
})
export class DevolucionComponent implements OnInit {
  private sb = inject(SupabaseService);

  @Input({ required: true }) pedido!: Pedido;
  @Output() cerrar = new EventEmitter<void>();
  @Output() registrado = new EventEmitter<void>();

  motivos = MOTIVOS;
  tipo = signal<Tipo>('devolucion');
  motivo = signal('defectuoso');
  estado = signal<'vuelve_stock' | 'danado'>('vuelve_stock');
  cant = signal<Record<number, number>>({});
  ya = signal<Record<number, number>>({});
  fotos = signal<string[]>([]);
  error = signal('');
  guardando = signal(false);
  reemplazo = true;
  descontarComision = true;
  metodo = 'efectivo';
  nota = '';
  reembolso: number | null = null;
  pesos = pesos;
  /** Solo quien puede subir fotos al bucket de comprobantes */
  puedeFotos = computed(() => this.sb.tiene('admin', 'venta_local'));

  items = computed<PedidoItem[]>(() => this.pedido.pedido_items ?? []);
  valorSel = computed(() => this.items().reduce((s, i) => s + (this.cant()[i.id] || 0) * Number(i.precio_venta), 0));
  comisionSel = computed(() => this.items().reduce((s, i) => s + (this.cant()[i.id] || 0) * (Number(i.precio_venta) - Number(i.precio_base)), 0));

  async ngOnInit(): Promise<void> {
    // Con un solo producto, ya queda elegido
    if (this.items().length === 1) this.cant.set({ [this.items()[0].id]: 1 });
    this.reembolso = this.valorSel() || null;
    const { data } = await this.sb.client.rpc('devoluciones_pedido', { p_pedido: this.pedido.id });
    this.ya.set((data ?? {}) as Record<number, number>);
  }

  nombre(i: PedidoItem): string {
    return nombreConVariante(i);
  }

  maximo(i: PedidoItem): number {
    return this.tipo() === 'devolucion' ? Math.max(0, i.cantidad - (this.ya()[i.id] || 0)) : i.cantidad;
  }

  cambiar(i: PedidoItem, d: number): void {
    const antes = this.valorSel();
    const n = Math.min(this.maximo(i), Math.max(0, (this.cant()[i.id] || 0) + d));
    this.cant.update((c) => ({ ...c, [i.id]: n }));
    // El reembolso sigue el valor de lo elegido mientras no lo hayan cambiado a mano
    if (this.reembolso === null || this.reembolso === antes) this.reembolso = this.valorSel();
  }

  async guardar(): Promise<void> {
    const items = Object.entries(this.cant()).filter(([, n]) => n > 0).map(([id, n]) => ({ item_id: Number(id), cantidad: n }));
    if (!items.length) return this.error.set('Elige qué productos y cuántos.');
    const t = this.tipo();
    if (t === 'devolucion' && (this.reembolso ?? 0) > Number(this.pedido.total)) return this.error.set('El reembolso no puede ser mayor que el pedido.');
    this.guardando.set(true);
    const { error } = await this.sb.client.rpc('registrar_devolucion', {
      p_pedido: this.pedido.id, p_items: items, p_tipo: t, p_motivo: this.motivo(), p_estado_producto: this.estado(),
      p_reemplazo: t !== 'devolucion' && this.reemplazo, p_reembolso: t === 'devolucion' ? Number(this.reembolso) || 0 : 0,
      p_metodo: this.metodo, p_descontar_comision: t === 'devolucion' && this.descontarComision, p_nota: this.nota.trim(), p_fotos: this.fotos(),
    });
    this.guardando.set(false);
    if (error) return this.error.set(mensajeError(error));
    this.registrado.emit();
  }
}
