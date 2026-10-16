import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, remove, closeOutline, searchOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Producto, TipoRecaudo } from '../../shared/modelos';
import { mensajeError, pesos, urlImagen } from '../../shared/formato';

interface Linea {
  producto: Producto;
  cantidad: number;
  precio: number;
}

/** Quita tildes y pasa a minúsculas para buscar sin importar cómo se escriba */
function normal(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Formulario de pedido. Sirve para tres cosas (según la ruta):
 *  - Nuevo pedido a domicilio (/app/pedidos/nuevo)
 *  - Venta en el local, que queda entregada y cobrada de una vez (/app/venta-local)
 *  - Editar un pedido existente (/app/pedidos/:id/editar)
 */
@Component({
  selector: 'app-nuevo-pedido',
  standalone: true,
  imports: [FormsModule, IonIcon],
  styles: [
    `
      .grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr); gap: 20px; align-items: start; }
      .panel { border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 16px; display: flex; flex-direction: column; gap: 14px; }
      .panel h2 { margin: 0; font-size: 14px; font-weight: 600; }
      .resultados { display: flex; flex-direction: column; max-height: 300px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
      .res { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: none; border-bottom: 1px solid var(--border-soft);
        background: none; color: var(--text); text-align: left; cursor: pointer; font-size: 13px; }
      @media (hover: hover) { .res:hover { background: var(--hover); } }
      .res img, .res .ph { width: 36px; height: 36px; border-radius: 6px; object-fit: cover; background: var(--surface-2); flex-shrink: 0; }
      .res .nom { flex: 1; min-width: 0; }
      .res .nom small { display: block; color: var(--text-muted); font-size: 12px; }
      .res .pre { font-weight: 500; white-space: nowrap; }
      .stock-bajo { color: var(--danger); }
      .linea { display: grid; grid-template-columns: 1fr auto auto auto; gap: 8px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border-soft); font-size: 13px; }
      .linea .nom { min-width: 0; }
      .linea .nom small { display: block; color: var(--text-muted); font-size: 12px; }
      .cant { display: flex; align-items: center; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); }
      .cant button { width: 28px; height: 30px; border: none; background: none; color: var(--text); cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; }
      .cant span { min-width: 22px; text-align: center; }
      .precio { width: 104px; height: 32px; }
      .totales { display: flex; flex-direction: column; gap: 4px; font-size: 14px; }
      .totales div { display: flex; justify-content: space-between; color: var(--text-soft); }
      .totales .fin { color: var(--text); font-size: 18px; font-weight: 600; margin-top: 4px; }
      .cliente-previo { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--accent-wash); font-size: 13px; }
      .tipos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .tipo { height: 40px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface);
        color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer; }
      .tipo.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
      /* Celular: nombre arriba; cantidad, precio y quitar en la línea de abajo */
      @media (max-width: 900px) {
        .linea { grid-template-columns: auto minmax(0, 1fr) auto; row-gap: 8px; padding: 10px 0; }
        .linea .nom { grid-column: 1 / -1; font-size: 14px; }
        .linea .precio { width: 100%; height: 38px; }
        .cant button { width: 38px; height: 38px; font-size: 18px; }
        .cant span { min-width: 28px; }
        .res { padding: 10px; font-size: 14px; }
      }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>{{ titulo() }}</h1>
        @if (editId()) {
          <button class="b" (click)="volver()">Cancelar</button>
        }
      </div>
      <div class="vista-body">
        @if (cargandoPedido()) {
          <div class="vacio">Cargando pedido…</div>
        } @else {
        <div class="grid">
          <section class="panel">
            <h2>Cliente</h2>
            <div class="campo">
              <label for="tel">Teléfono{{ local() ? ' (opcional)' : '' }}</label>
              <input id="tel" type="tel" inputmode="tel" autocomplete="off" [(ngModel)]="telefono" (blur)="buscarCliente()" />
            </div>
            @if (clientePrevio()) {
              <p class="cliente-previo">Cliente conocido: {{ clientePrevio() }} pedido(s) antes. Llenamos sus datos.</p>
            }
            <div class="campo">
              <label for="nom">Nombre{{ local() ? ' (opcional)' : '' }}</label>
              <input id="nom" autocomplete="off" [(ngModel)]="nombre" [placeholder]="local() ? 'Cliente del local' : ''" />
            </div>
            @if (!local()) {
              <div class="campo">
                <label for="dir">Dirección</label>
                <input id="dir" autocomplete="off" [(ngModel)]="direccion" />
              </div>
              <div class="fila-campos">
                <div class="campo">
                  <label for="barrio">Barrio</label>
                  <input id="barrio" list="lista-barrios" autocomplete="off" [(ngModel)]="barrio" (change)="sugerirDomicilio()" />
                  <datalist id="lista-barrios">
                    @for (b of barrios(); track b.barrio) {
                      <option [value]="b.barrio"></option>
                    }
                  </datalist>
                </div>
                <div class="campo">
                  <label for="dom">Domicilio</label>
                  <input id="dom" type="number" inputmode="numeric" min="0" step="1000" [(ngModel)]="domicilio" (ngModelChange)="domicilioS.set(+$event || 0)" />
                </div>
              </div>
            }
            <div class="campo">
              <label for="obs">Observaciones</label>
              <textarea id="obs" [(ngModel)]="observaciones" [placeholder]="local() ? '' : 'Ej: llamar antes, entregar antes de las 3 pm'"></textarea>
            </div>
            @if (local()) {
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
                  <div class="campo"><label for="ef">Efectivo</label>
                    <input id="ef" type="number" inputmode="numeric" [(ngModel)]="efectivo" (ngModelChange)="transferencia = subtotal() - (+$event || 0)" /></div>
                  <div class="campo"><label for="tr">Transferencia</label>
                    <input id="tr" type="number" inputmode="numeric" [(ngModel)]="transferencia" /></div>
                </div>
              }
            }
          </section>

          <section class="panel">
            <h2>Productos</h2>
            <label class="buscar" style="width: 100%">
              <ion-icon name="search-outline"></ion-icon>
              <input type="search" placeholder="Busca por nombre, SKU o código" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
            </label>
            @if (busqueda().trim()) {
              <div class="resultados">
                @for (p of resultados(); track p.id) {
                  <button class="res" (click)="agregar(p)">
                    @if (p.imagen_url) {
                      <img [src]="urlImagen(p.imagen_url)" alt="" loading="lazy" />
                    } @else {
                      <span class="ph"></span>
                    }
                    <span class="nom">{{ p.nombre }}
                      <small>{{ p.sku || '' }}@if (p.controla_stock) { · <span [class.stock-bajo]="p.stock <= 0">stock {{ p.stock }}</span> }</small>
                    </span>
                    <span class="pre num">{{ pesos(p.precio_venta) }}</span>
                  </button>
                } @empty {
                  <div class="res">No hay productos con ese nombre.</div>
                }
              </div>
            }

            @for (l of lineas(); track l.producto.id; let i = $index) {
              <div class="linea">
                <span class="nom">{{ l.producto.nombre }}<small>Base {{ pesos(l.producto.precio_base) }}</small></span>
                <span class="cant">
                  <button (click)="cambiarCantidad(i, -1)" aria-label="Menos"><ion-icon name="remove"></ion-icon></button>
                  <span class="num">{{ l.cantidad }}</span>
                  <button (click)="cambiarCantidad(i, 1)" aria-label="Más"><ion-icon name="add"></ion-icon></button>
                </span>
                <input class="inp precio num" type="number" inputmode="numeric" step="1000" [ngModel]="l.precio" (ngModelChange)="cambiarPrecio(i, $event)" aria-label="Precio unitario" />
                <button class="b b-icono" (click)="quitar(i)" aria-label="Quitar"><ion-icon name="close-outline"></ion-icon></button>
              </div>
            } @empty {
              <div class="vacio">Busca y agrega los productos.</div>
            }

            <div class="totales">
              <div><span>Productos</span><span class="num">{{ pesos(subtotal()) }}</span></div>
              @if (!local()) {
                <div><span>Domicilio</span><span class="num">{{ pesos(domicilioS()) }}</span></div>
              }
              <div class="fin"><span>Total</span><span class="num">{{ pesos(subtotal() + (local() ? 0 : domicilioS())) }}</span></div>
            </div>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button class="b b-pri b-grande" [disabled]="guardando()" (click)="guardar()">
              {{ guardando() ? 'Guardando…' : editId() ? 'Guardar cambios' : local() ? 'Registrar venta' : 'Crear pedido' }}
            </button>
          </section>
        </div>
        }
      </div>
    </div>
  `,
})
export class NuevoPedidoPage implements OnInit {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** 'local' = venta en el punto físico */
  local = signal(this.route.snapshot.data['modo'] === 'local');
  editId = signal<number | null>(Number(this.route.snapshot.paramMap.get('id')) || null);
  titulo = computed(() => (this.editId() ? `Editar pedido #${this.editId()}` : this.local() ? 'Venta en el local' : 'Nuevo pedido'));

  productos = signal<Producto[]>([]);
  barrios = signal<{ barrio: string; domicilio: number; usos: number }[]>([]);
  lineas = signal<Linea[]>([]);
  busqueda = signal('');
  clientePrevio = signal(0);
  guardando = signal(false);
  cargandoPedido = signal(false);
  error = signal('');
  domicilioS = signal(0);
  tipo = signal<TipoRecaudo | null>(null);
  tipos: { id: TipoRecaudo; label: string }[] = [
    { id: 'efectivo', label: 'Efectivo' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'mixto', label: 'Mixto' },
  ];

  telefono = '';
  nombre = '';
  direccion = '';
  barrio = '';
  domicilio = 0;
  observaciones = '';
  efectivo = 0;
  transferencia = 0;

  pesos = pesos;
  urlImagen = urlImagen;

  resultados = computed(() => {
    const q = normal(this.busqueda().trim());
    if (!q) return [];
    const partes = q.split(/\s+/);
    return this.productos()
      .filter((p) => partes.every((x) => normal(`${p.nombre} ${p.sku ?? ''} ${p.codigo_barras ?? ''}`).includes(x)))
      .slice(0, 30);
  });

  subtotal = computed(() => this.lineas().reduce((a, l) => a + l.cantidad * l.precio, 0));

  constructor() {
    addIcons({ add, remove, closeOutline, searchOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      const [p, b] = await Promise.all([this.ps.productosActivos(), this.local() ? Promise.resolve([]) : this.ps.barrios()]);
      this.productos.set(p);
      this.barrios.set(b);
      if (this.editId()) await this.cargarPedido(this.editId()!);
    } catch (e) {
      this.error.set('No se pudieron cargar los datos: ' + mensajeError(e));
    }
  }

  private async cargarPedido(id: number): Promise<void> {
    this.cargandoPedido.set(true);
    try {
      const { pedido: p } = await this.ps.detalle(id);
      this.local.set(p.canal === 'local');
      this.telefono = p.cliente_telefono ?? '';
      this.nombre = p.cliente_nombre;
      this.direccion = p.direccion ?? '';
      this.barrio = p.barrio ?? '';
      this.domicilio = Number(p.valor_domicilio) || 0;
      this.domicilioS.set(this.domicilio);
      this.observaciones = p.observaciones ?? '';
      // Los productos que ya no están activos se agregan igual para poder conservarlos
      const porId = new Map(this.productos().map((x) => [x.id, x]));
      this.lineas.set(
        (p.pedido_items ?? []).map((i) => ({
          producto:
            (i.producto_id && porId.get(i.producto_id)) ||
            ({ id: i.producto_id ?? 0, nombre: i.nombre, precio_base: i.precio_base, precio_venta: i.precio_venta } as Producto),
          cantidad: i.cantidad,
          precio: Number(i.precio_venta),
        }))
      );
    } finally {
      this.cargandoPedido.set(false);
    }
  }

  async buscarCliente(): Promise<void> {
    const tel = this.telefono.replace(/\D/g, '');
    if (tel.length < 7 || this.editId()) return;
    this.telefono = tel;
    try {
      const c = await this.ps.buscarCliente(tel);
      this.clientePrevio.set(c?.pedidos ?? 0);
      if (c) {
        if (!this.nombre) this.nombre = c.cliente_nombre;
        if (!this.local()) {
          if (!this.direccion) this.direccion = c.direccion ?? '';
          if (!this.barrio) this.barrio = c.barrio ?? '';
          if (!this.domicilio) {
            this.domicilio = Number(c.valor_domicilio) || 0;
            this.domicilioS.set(this.domicilio);
          }
        }
      }
    } catch {
      /* sin sugerencia */
    }
  }

  sugerirDomicilio(): void {
    const b = this.barrios().find((x) => normal(x.barrio) === normal(this.barrio.trim()));
    if (b && !this.domicilio) {
      this.domicilio = Number(b.domicilio) || 0;
      this.domicilioS.set(this.domicilio);
    }
  }

  agregar(p: Producto): void {
    const ls = [...this.lineas()];
    const i = ls.findIndex((l) => l.producto.id === p.id);
    if (i >= 0) ls[i] = { ...ls[i], cantidad: ls[i].cantidad + 1 };
    else ls.push({ producto: p, cantidad: 1, precio: Number(p.precio_venta) });
    this.lineas.set(ls);
    this.busqueda.set('');
  }

  cambiarCantidad(i: number, d: number): void {
    const ls = [...this.lineas()];
    const n = ls[i].cantidad + d;
    if (n <= 0) ls.splice(i, 1);
    else ls[i] = { ...ls[i], cantidad: n };
    this.lineas.set(ls);
  }

  cambiarPrecio(i: number, v: number): void {
    const ls = [...this.lineas()];
    ls[i] = { ...ls[i], precio: Number(v) || 0 };
    this.lineas.set(ls);
  }

  quitar(i: number): void {
    const ls = [...this.lineas()];
    ls.splice(i, 1);
    this.lineas.set(ls);
  }

  volver(): void {
    this.router.navigate(['/app/pedidos'], { queryParams: { id: this.editId() } });
  }

  async guardar(): Promise<void> {
    this.error.set('');
    const local = this.local();
    if (!local && !this.nombre.trim()) return this.error.set('Escribe el nombre del cliente.');
    if (!local && !this.direccion.trim()) return this.error.set('Escribe la dirección.');
    if (!this.lineas().length) return this.error.set('Agrega al menos un producto.');
    const bajo = this.lineas().find((l) => l.precio < Number(l.producto.precio_base));
    if (bajo && !this.sb.tiene('admin')) return this.error.set(`${bajo.producto.nombre}: el precio no puede ser menor a ${pesos(bajo.producto.precio_base)}.`);
    if (local && !this.editId()) {
      if (!this.tipo()) return this.error.set('Escoge cómo pagó el cliente.');
      if (this.tipo() === 'mixto' && Number(this.efectivo) + Number(this.transferencia) !== this.subtotal())
        return this.error.set(`Efectivo + transferencia debe dar ${pesos(this.subtotal())}.`);
    }
    const items = this.lineas().map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, precio_venta: l.precio }));
    this.guardando.set(true);
    try {
      if (this.editId()) {
        await this.ps.editar(this.editId()!, {
          cliente_nombre: this.nombre || 'Cliente del local',
          cliente_telefono: this.telefono,
          direccion: this.direccion,
          barrio: this.barrio,
          observaciones: this.observaciones,
          valor_domicilio: local ? 0 : Number(this.domicilio) || 0,
          items,
        });
        this.toast.ok(`Pedido #${this.editId()} actualizado`);
        this.volver();
      } else if (local) {
        const id = await this.ps.crearVentaLocal({
          cliente_nombre: this.nombre,
          cliente_telefono: this.telefono,
          observaciones: this.observaciones,
          items,
          tipo: this.tipo()!,
          efectivo: Number(this.efectivo) || 0,
          transferencia: Number(this.transferencia) || 0,
        });
        this.toast.ok(`Venta #${id} registrada`);
        this.router.navigate(['/app/ventas-local']);
      } else {
        const id = await this.ps.crear({
          cliente_nombre: this.nombre,
          cliente_telefono: this.telefono,
          direccion: this.direccion,
          barrio: this.barrio,
          observaciones: this.observaciones,
          valor_domicilio: Number(this.domicilio) || 0,
          items,
        });
        this.toast.ok(`Pedido #${id} creado`);
        this.router.navigate(['/app/pedidos'], { queryParams: { id } });
      }
    } catch (e) {
      const m = mensajeError(e);
      this.error.set(m.includes('editar_pedido') ? 'Editar pedidos aún no está activo en la base de datos.' : m);
    } finally {
      this.guardando.set(false);
    }
  }
}
