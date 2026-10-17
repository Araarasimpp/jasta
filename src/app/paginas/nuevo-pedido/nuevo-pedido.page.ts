import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, remove, closeOutline, searchOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Producto, TipoRecaudo, Usuario } from '../../shared/modelos';
import { mensajeError, pesos, urlImagen } from '../../shared/formato';
import { VisorService } from '../../shared/visor/visor.service';

interface Linea {
  /** Para seguir la línea en la lista aunque se repita el producto */
  key: number;
  producto: Producto;
  cantidad: number;
  precio: number;
  color: string | null;
  talla: string | null;
  /** Ya respondió que todas las unidades son iguales (no se vuelve a preguntar) */
  iguales: boolean;
}

let claves = 0;

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
      .linea { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-soft); font-size: 13px; }
      .linea.falta { box-shadow: inset 3px 0 0 var(--oro); padding-left: 8px; }
      .mini { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; background: var(--surface-2); display: block; border: 1px solid var(--border-soft); padding: 0; cursor: zoom-in; overflow: hidden; }
      .mini img { width: 100%; height: 100%; object-fit: cover; display: block; animation: aparece 200ms ease both; }
      span.mini { cursor: default; }
      @keyframes aparece { from { opacity: 0; } }
      .vars { grid-column: 2 / -1; display: flex; flex-direction: column; gap: 8px; }
      .var-fila { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .var-etq { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); min-width: 44px; }
      .var-etq.pide { color: var(--oro-texto); }
      .var { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 15px;
        background: var(--surface); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; transition: border-color 120ms, background 120ms; }
      .var.on { border-color: var(--text); background: var(--text); color: var(--bg); font-weight: 600; }
      .var .tono { width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 0 1px var(--border-strong); flex: none; }
      .var.on .tono { box-shadow: 0 0 0 1.5px var(--bg); }
      .var.talla { min-width: 38px; justify-content: center; padding: 0 9px; font-family: var(--mono-font); }
      .pregunta { grid-column: 2 / -1; display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: var(--radius); background: var(--oro-wash);
        border: 1px solid color-mix(in srgb, var(--oro) 35%, transparent); animation: aparece 180ms ease both; }
      .pregunta p { margin: 0; font-size: 13.5px; font-weight: 550; color: var(--text); }
      .pregunta div { display: flex; gap: 8px; flex-wrap: wrap; }
      .pregunta .b { height: 34px; }
      .unidad { font-size: 11.5px; font-weight: 600; color: var(--oro-texto); margin-left: 6px; }
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
        .linea { grid-template-columns: auto auto minmax(0, 1fr) auto; row-gap: 8px; padding: 10px 0; }
        .linea .mini { grid-row: 1; grid-column: 1; }
        .linea .nom { grid-row: 1; grid-column: 2 / -1; font-size: 14px; }
        .linea .cant { grid-column: 1 / span 2; }
        .vars, .pregunta { grid-column: 1 / -1; }
        .var { height: 34px; padding: 0 12px; font-size: 14px; }
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
            @if (local() && !editId()) {
              <div class="campo">
                <label for="vend">Vendedora</label>
                <select id="vend" [(ngModel)]="vendedora" class="inp">
                  <option [ngValue]="null">Sin vendedora (venta de la tienda)</option>
                  @for (v of vendedoras(); track v.id) {
                    <option [ngValue]="v.id">{{ v.nombre }}</option>
                  }
                </select>
                <p class="ayuda">La venta queda a su nombre: su ganancia (precio de venta − base) suma en Reportes y Ranking, y le llega el aviso.</p>
              </div>
            }
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

            @for (l of lineas(); track l.key; let i = $index) {
              <div class="linea" [class.falta]="falta(l)">
                @if (fotoLinea(l); as u) {
                  <button type="button" class="mini" (click)="verFoto(l)" [attr.aria-label]="'Ver foto de ' + l.producto.nombre"><img [src]="u" alt="" /></button>
                } @else {
                  <span class="mini" aria-hidden="true"></span>
                }
                <span class="nom">{{ l.producto.nombre }}@if (unidadDe(i); as u) {<span class="unidad">{{ u }}</span>}<small>Base {{ pesos(l.producto.precio_base) }}</small></span>
                <span class="cant">
                  <button (click)="cambiarCantidad(i, -1)" aria-label="Menos"><ion-icon name="remove"></ion-icon></button>
                  <span class="num">{{ l.cantidad }}</span>
                  <button (click)="cambiarCantidad(i, 1)" aria-label="Más"><ion-icon name="add"></ion-icon></button>
                </span>
                <input class="inp precio num" type="number" inputmode="numeric" step="1000" [ngModel]="l.precio" (ngModelChange)="cambiarPrecio(i, $event)" aria-label="Precio unitario" />
                <button class="b b-icono" (click)="quitar(i)" aria-label="Quitar"><ion-icon name="close-outline"></ion-icon></button>
                @if (tieneVariantes(l.producto)) {
                  @if (preguntar() === l.key) {
                    <div class="pregunta" role="group" aria-label="Variantes">
                      <p>¿Las {{ l.cantidad }} unidades son del mismo {{ queVaria(l.producto) }}?</p>
                      <div>
                        <button type="button" class="b b-pri" (click)="sonIguales(i)">Sí, iguales</button>
                        <button type="button" class="b" (click)="sonDiferentes(i)">No, son diferentes</button>
                      </div>
                    </div>
                  }
                  <div class="vars">
                    @if (l.producto.colores?.length) {
                      <div class="var-fila" role="radiogroup" [attr.aria-label]="'Color de ' + l.producto.nombre">
                        <span class="var-etq" [class.pide]="!l.color">Color</span>
                        @for (c of l.producto.colores!; track c.id) {
                          <button type="button" class="var" role="radio" [attr.aria-checked]="l.color === c.nombre" [class.on]="l.color === c.nombre" (click)="elegir(i, 'color', c.nombre)">
                            <span class="tono" [style.background]="c.hex || '#ccc'"></span>{{ c.nombre }}</button>
                        }
                      </div>
                    }
                    @if (l.producto.tallas?.length) {
                      <div class="var-fila" role="radiogroup" [attr.aria-label]="'Talla de ' + l.producto.nombre">
                        <span class="var-etq" [class.pide]="!l.talla">Talla</span>
                        @for (t of l.producto.tallas!; track t) {
                          <button type="button" class="var talla" role="radio" [attr.aria-checked]="l.talla === t" [class.on]="l.talla === t" (click)="elegir(i, 'talla', t)">{{ t }}</button>
                        }
                      </div>
                    }
                  </div>
                }
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
  private visor = inject(VisorService);

  /** Línea a la que se le pregunta si sus unidades son iguales o diferentes */
  preguntar = signal<number | null>(null);

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
  /** Venta en el local: a qué vendedora se le suma */
  vendedoras = signal<Usuario[]>([]);
  vendedora: number | null = null;
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
      if (this.local() && !this.editId()) {
        this.ps.vendedoras().then((v) => this.vendedoras.set(v.filter((x) => x.activo))).catch(() => undefined);
      }
      this.productos.set(p);
      this.barrios.set(b);
      if (this.editId()) await this.cargarPedido(this.editId()!);
      else this.agregarDesdeCatalogo();
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
          key: ++claves,
          color: i.color ?? null,
          talla: i.talla ?? null,
          iguales: true,
        }))
      );
    } finally {
      this.cargandoPedido.set(false);
    }
  }

  /** Desde la ficha del catálogo llega ?producto=…&color=… */
  private agregarDesdeCatalogo(): void {
    const q = this.route.snapshot.queryParamMap;
    const p = this.productos().find((x) => x.id === Number(q.get('producto')));
    if (!p) return;
    this.agregar(p);
    const color = q.get('color');
    if (color && p.colores?.some((c) => c.nombre === color) && this.lineas().at(-1)?.color !== color) this.elegir(this.lineas().length - 1, 'color', color);
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
    // Con colores o tallas, cada vez que se agrega es una línea nueva (puede ser otra variante)
    const i = this.tieneVariantes(p) ? -1 : ls.findIndex((l) => l.producto.id === p.id);
    if (i >= 0) ls[i] = { ...ls[i], cantidad: ls[i].cantidad + 1 };
    else ls.push(this.lineaNueva(p));
    this.lineas.set(ls);
    this.busqueda.set('');
  }

  private lineaNueva(p: Producto, base?: Partial<Linea>): Linea {
    // Si solo hay un color o una talla, ya queda elegida
    const color = p.colores?.length === 1 ? p.colores[0].nombre : null;
    const talla = p.tallas?.length === 1 ? p.tallas[0] : null;
    return { key: ++claves, producto: p, cantidad: 1, precio: Number(p.precio_venta), color, talla, iguales: false, ...base };
  }

  cambiarCantidad(i: number, d: number): void {
    const ls = [...this.lineas()];
    const l = ls[i];
    const n = l.cantidad + d;
    if (n <= 0) {
      ls.splice(i, 1);
      if (this.preguntar() === l.key) this.preguntar.set(null);
    } else {
      ls[i] = { ...l, cantidad: n };
      // Al pasar de 1 unidad se pregunta si todas son del mismo color y talla
      if (d > 0 && n >= 2 && !l.iguales && this.tieneVariantes(l.producto)) this.preguntar.set(l.key);
      if (n < 2 && this.preguntar() === l.key) this.preguntar.set(null);
    }
    this.lineas.set(ls);
  }

  // ---------- Colores y tallas ----------
  tieneVariantes(p: Producto): boolean {
    return !!(p.colores?.length || p.tallas?.length);
  }

  /** "color y talla", "color" o "talla" */
  queVaria(p: Producto): string {
    const c = !!p.colores?.length;
    const t = !!p.tallas?.length;
    return c && t ? 'color y talla' : c ? 'color' : 'talla';
  }

  elegir(i: number, campo: 'color' | 'talla', valor: string): void {
    const ls = [...this.lineas()];
    ls[i] = { ...ls[i], [campo]: ls[i][campo] === valor ? null : valor };
    this.lineas.set(ls);
    if (this.error().startsWith('Elige ')) this.error.set('');
  }

  sonIguales(i: number): void {
    const ls = [...this.lineas()];
    ls[i] = { ...ls[i], iguales: true };
    this.lineas.set(ls);
    this.preguntar.set(null);
  }

  /** Separa la línea en una por unidad, para elegir el color y la talla de cada una */
  sonDiferentes(i: number): void {
    const ls = [...this.lineas()];
    const l = ls[i];
    const unidades = Array.from({ length: l.cantidad }, (_, k) =>
      k === 0 ? { ...l, cantidad: 1, iguales: true } : this.lineaNueva(l.producto, { precio: l.precio, iguales: true })
    );
    ls.splice(i, 1, ...unidades);
    this.lineas.set(ls);
    this.preguntar.set(null);
  }

  /** "Unidad 2 de 3" cuando un producto quedó separado en varias líneas */
  unidadDe(i: number): string {
    const ls = this.lineas();
    const l = ls[i];
    if (!this.tieneVariantes(l.producto)) return '';
    const mismas = ls.filter((x) => x.producto.id === l.producto.id);
    if (mismas.length < 2) return '';
    return `${mismas.indexOf(l) + 1} de ${mismas.length}`;
  }

  /** Le falta elegir color o talla */
  falta(l: Linea): boolean {
    return (!!l.producto.colores?.length && !l.color) || (!!l.producto.tallas?.length && !l.talla);
  }

  fotoLinea(l: Linea): string | null {
    const delColor = l.color ? l.producto.colores?.find((c) => c.nombre === l.color)?.imagen_url : null;
    return urlImagen(delColor || l.producto.imagen_url);
  }

  verFoto(l: Linea): void {
    const u = this.fotoLinea(l);
    if (u) this.visor.abrir([{ url: u, titulo: [l.producto.nombre, l.color, l.talla && 'Talla ' + l.talla].filter(Boolean).join(' · ') }]);
  }

  cambiarPrecio(i: number, v: number): void {
    const ls = [...this.lineas()];
    ls[i] = { ...ls[i], precio: Number(v) || 0 };
    this.lineas.set(ls);
  }

  quitar(i: number): void {
    const ls = [...this.lineas()];
    if (this.preguntar() === ls[i].key) this.preguntar.set(null);
    ls.splice(i, 1);
    this.lineas.set(ls);
  }

  volver(): void {
    this.router.navigate([this.sb.rutaPedidos()], { queryParams: { id: this.editId() } });
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
    const sinElegir = this.lineas().find((l) => this.falta(l));
    if (sinElegir) {
      const que = [sinElegir.producto.colores?.length && !sinElegir.color ? 'el color' : '', sinElegir.producto.tallas?.length && !sinElegir.talla ? 'la talla' : '']
        .filter(Boolean).join(' y ');
      return this.error.set(`Elige ${que} de ${sinElegir.producto.nombre}.`);
    }
    // Las líneas iguales (mismo producto, color, talla y precio) se juntan en una
    const juntas = new Map<string, { producto_id: number; cantidad: number; precio_venta: number; color: string | null; talla: string | null }>();
    for (const l of this.lineas()) {
      const k = [l.producto.id, l.color ?? '', l.talla ?? '', l.precio].join('|');
      const ya = juntas.get(k);
      if (ya) ya.cantidad += l.cantidad;
      else juntas.set(k, { producto_id: l.producto.id, cantidad: l.cantidad, precio_venta: l.precio, color: l.color, talla: l.talla });
    }
    const items = [...juntas.values()];
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
          vendedora: this.vendedora,
        });
        const v = this.vendedoras().find((x) => x.id === this.vendedora);
        this.toast.ok(v ? `Venta #${id} registrada a nombre de ${v.nombre}` : `Venta #${id} registrada`);
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
        this.router.navigate([this.sb.rutaPedidos()], { queryParams: { id } });
      }
    } catch (e) {
      const m = mensajeError(e);
      this.error.set(m.includes('editar_pedido') ? 'Editar pedidos aún no está activo en la base de datos.' : m);
    } finally {
      this.guardando.set(false);
    }
  }
}
