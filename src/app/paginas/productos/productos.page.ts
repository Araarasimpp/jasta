import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, searchOutline, closeOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Producto, ProductoColor } from '../../shared/modelos';
import { mensajeError, numero, pesos, urlImagen } from '../../shared/formato';
import { STOCK_BAJO } from '../../shared/stock';
import { VisorService } from '../../shared/visor/visor.service';
import { ColoresProductoComponent } from '../../shared/colores-producto/colores-producto.component';

type Filtro = 'activos' | 'agotados' | 'bajo' | 'inactivos' | 'todos';

function normal(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const VACIO: Omit<Producto, 'id'> = {
  nombre: '', sku: '', codigo_barras: '', precio_venta: 0, precio_base: 0, precio_compra: 0,
  stock: 0, controla_stock: true, imagen_url: null, activo: true, descripcion: '',
};

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [FormsModule, IonIcon, ColoresProductoComponent],
  styles: [
    `
      .tonos { display: inline-flex; gap: 3px; margin-left: 8px; vertical-align: middle; }
      .tonos span { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px var(--border-strong); }
      .colores-sec { padding-top: 6px; }
      .foto-btn { display: block; padding: 0; border: none; background: none; cursor: zoom-in; border-radius: 8px; }
      .foto { width: 34px; height: 34px; border-radius: 6px; object-fit: cover; background: var(--surface-2); display: block; }
      .neg { color: var(--danger); font-weight: 500; }
      .check { display: flex; align-items: center; gap: 8px; font-size: 14px; }
      .check input { width: 18px; height: 18px; }
      .margen { font-size: 13px; color: var(--text-soft); }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Productos <small class="num">{{ numero(filtrados().length) }}</small></h1>
        <button class="b b-pri" (click)="nuevo()"><ion-icon name="add"></ion-icon>Nuevo producto</button>
      </div>
      <div class="barra">
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="Nombre, SKU o código" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </label>
        <div class="chips">
          @for (f of filtros; track f.id) {
            <button class="chip" [class.on]="filtro() === f.id" (click)="filtro.set(f.id)">{{ f.label }}</button>
          }
        </div>
      </div>
      <div class="tabla-wrap">
        <table class="tabla tarjetas-cel con-foto">
          <thead>
            <tr><th></th><th>Producto</th><th>SKU</th><th class="der">Venta</th><th class="der">Base</th><th class="der">Compra</th><th class="der">Stock</th></tr>
          </thead>
          <tbody>
            @for (p of visibles(); track p.id) {
              <tr class="click" (click)="editar(p)">
                <td class="media" style="width: 34px">
                  @if (p.imagen_url) {
                    <button type="button" class="foto-btn" (click)="verFoto(p.imagen_url, p.nombre, $event)" [attr.aria-label]="'Ver foto de ' + p.nombre">
                      <img class="foto" [src]="urlImagen(p.imagen_url)" alt="" loading="lazy" />
                    </button>
                  } @else {
                    <span class="foto"></span>
                  }
                </td>
                <td class="corta titulo" style="max-width: 320px">{{ p.nombre }}
                  @if (p.colores?.length) {
                    <span class="tonos" [title]="p.colores!.length + ' colores'">
                      @for (c of p.colores!.slice(0, 6); track c.id) { <span [style.background]="c.hex || '#ccc'"></span> }
                    </span>
                  }
                </td>
                <td class="suave" data-etq="SKU">{{ p.sku || '—' }}</td>
                <td class="der num" data-etq="Venta">{{ pesos(p.precio_venta) }}</td>
                <td class="der num suave" data-etq="Base">{{ pesos(p.precio_base) }}</td>
                <td class="der num suave" data-etq="Compra">{{ pesos(p.precio_compra) }}</td>
                <td class="der num" data-etq="Stock" [class.neg]="p.controla_stock && p.stock <= 0">{{ p.controla_stock ? p.stock : '—' }}</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="suave">{{ cargando() ? 'Cargando…' : 'No hay productos.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (filtrados().length > limite()) {
        <div class="paginar"><span></span><button class="b" (click)="limite.set(limite() + 100)">Ver más</button></div>
      }
    </div>

    @if (form(); as f) {
      <button class="velo" aria-label="Cerrar" (click)="form.set(null)"></button>
      <aside class="hoja" role="dialog" aria-labelledby="t-prod">
        <div class="hoja-head">
          <h2 id="t-prod">{{ editId() ? 'Editar producto' : 'Nuevo producto' }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="form.set(null)"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="hoja-body">
          <div class="campo"><label for="pn">Nombre</label><input id="pn" [(ngModel)]="f.nombre" /></div>
          <div class="fila-campos">
            <div class="campo"><label for="ps">SKU</label><input id="ps" [(ngModel)]="f.sku" /></div>
            <div class="campo"><label for="pc">Código de barras</label><input id="pc" [(ngModel)]="f.codigo_barras" /></div>
          </div>
          <div class="fila-campos">
            <div class="campo"><label for="pv">Precio de venta</label><input id="pv" type="number" inputmode="numeric" [(ngModel)]="f.precio_venta" /></div>
            <div class="campo"><label for="pb">Precio base</label><input id="pb" type="number" inputmode="numeric" [(ngModel)]="f.precio_base" /></div>
            <div class="campo"><label for="pco">Precio de compra</label><input id="pco" type="number" inputmode="numeric" [(ngModel)]="f.precio_compra" /></div>
          </div>
          <p class="margen">
            Precio base: lo mínimo que puede cobrar una vendedora. Ganancia por unidad a precio de venta:
            <strong class="num">{{ pesos((f.precio_venta || 0) - (f.precio_compra || 0)) }}</strong>
          </p>
          <div class="fila-campos">
            <div class="campo"><label for="pst">Stock</label><input id="pst" type="number" inputmode="numeric" [(ngModel)]="f.stock" [disabled]="!f.controla_stock" /></div>
          </div>
          <label class="check"><input type="checkbox" [(ngModel)]="f.controla_stock" />Controlar inventario (descuenta al entregar)</label>
          <label class="check"><input type="checkbox" [(ngModel)]="f.activo" />Activo (aparece al crear pedidos)</label>
          <div class="campo"><label for="pd">Descripción <small class="suave">(sale en el catálogo)</small></label>
            <textarea id="pd" rows="3" [(ngModel)]="f.descripcion" placeholder="Ej: color sujeto a disponibilidad, medidas, material…"></textarea></div>
          <div class="campo"><label for="pi">Foto (URL)</label><input id="pi" [(ngModel)]="f.imagen_url" placeholder="https://…" /></div>
          @if (f.imagen_url) {
            <button type="button" class="foto-btn" (click)="verFoto(f.imagen_url, f.nombre, $event)" aria-label="Ver foto en grande">
              <img [src]="urlImagen(f.imagen_url)" alt="" style="width: 120px; height: 120px; object-fit: cover; border-radius: 8px; display: block" />
            </button>
          }
          <section class="colores-sec">
            <h3 class="seccion-titulo">Colores y fotos</h3>
            @if (editId(); as pid) {
              <app-colores-producto [productoId]="pid" [nombreProducto]="f.nombre" (cambio)="coloresCambiaron(pid, $event)"></app-colores-producto>
            } @else {
              <p class="ayuda">Guarda el producto primero y luego agrega sus colores con sus fotos.</p>
            }
          </section>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="form.set(null)">Cancelar</button>
          <button class="b b-pri" [disabled]="guardando()" (click)="guardar(f)">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </aside>
    }
  `,
})
export class ProductosPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private visor = inject(VisorService);

  productos = signal<Producto[]>([]);
  cargando = signal(true);
  q = signal('');
  filtro = signal<Filtro>('activos');
  limite = signal(100);
  form = signal<Omit<Producto, 'id'> | null>(null);
  editId = signal<number | null>(null);
  guardando = signal(false);
  error = signal('');

  filtros: { id: Filtro; label: string }[] = [
    { id: 'activos', label: 'Activos' },
    { id: 'agotados', label: 'Sin stock' },
    { id: 'bajo', label: 'Stock bajo' },
    { id: 'inactivos', label: 'Inactivos' },
    { id: 'todos', label: 'Todos' },
  ];

  filtrados = computed(() => {
    const t = normal(this.q().trim());
    const f = this.filtro();
    return this.productos().filter((p) => {
      if (f === 'activos' && !p.activo) return false;
      if (f === 'inactivos' && p.activo) return false;
      if (f === 'agotados' && !(p.activo && p.controla_stock && p.stock <= 0)) return false;
      if (f === 'bajo' && !(p.activo && p.controla_stock && p.stock > 0 && p.stock < STOCK_BAJO)) return false;
      if (!t) return true;
      return normal(`${p.nombre} ${p.sku ?? ''} ${p.codigo_barras ?? ''}`).includes(t);
    });
  });
  visibles = computed(() => this.filtrados().slice(0, this.limite()));

  pesos = pesos;
  numero = numero;
  urlImagen = urlImagen;

  constructor() {
    addIcons({ add, searchOutline, closeOutline });
  }

  async ngOnInit(): Promise<void> {
    // Desde "Necesita atención" en Inicio llega ?filtro=agotados o ?filtro=bajo
    const f = this.route.snapshot.queryParamMap.get('filtro') as Filtro | null;
    if (f && this.filtros.some((x) => x.id === f)) this.filtro.set(f);
    await this.cargar();
  }

  async cargar(): Promise<void> {
    const { data, error } = await this.sb.client.from('productos').select('*, colores:producto_colores(id, nombre, hex, imagen_url, orden)').order('nombre');
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.productos.set((data ?? []) as Producto[]);
  }

  nuevo(): void {
    this.error.set('');
    this.editId.set(null);
    this.form.set({ ...VACIO });
  }

  editar(p: Producto): void {
    this.error.set('');
    this.editId.set(p.id);
    const { id: _id, ...resto } = p;
    this.form.set({ ...resto });
  }

  async guardar(f: Omit<Producto, 'id'>): Promise<void> {
    if (!f.nombre.trim()) return this.error.set('Escribe el nombre.');
    if (Number(f.precio_base) > Number(f.precio_venta)) return this.error.set('El precio base no puede ser mayor al de venta.');
    this.guardando.set(true);
    const datos = {
      nombre: f.nombre.trim(),
      sku: f.sku?.trim() || null,
      codigo_barras: f.codigo_barras?.trim() || null,
      precio_venta: Number(f.precio_venta) || 0,
      precio_base: Number(f.precio_base) || 0,
      precio_compra: Number(f.precio_compra) || 0,
      stock: Math.trunc(Number(f.stock) || 0),
      controla_stock: !!f.controla_stock,
      activo: !!f.activo,
      imagen_url: f.imagen_url?.trim() || null,
      descripcion: f.descripcion?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const id = this.editId();
    const r = id
      ? await this.sb.client.from('productos').update(datos).eq('id', id)
      : await this.sb.client.from('productos').insert(datos);
    this.guardando.set(false);
    if (r.error) return this.error.set(mensajeError(r.error));
    this.toast.ok(id ? 'Producto actualizado' : 'Producto creado');
    this.form.set(null);
    await this.cargar();
  }

  /** La foto en grande, sin abrir el formulario de edición */
  verFoto(ruta: string | null, nombre: string, e: Event): void {
    e.stopPropagation();
    this.visor.abrir([{ url: urlImagen(ruta) ?? '', titulo: nombre }]);
  }

  /** Al cambiar los colores en la hoja, la lista también se actualiza */
  coloresCambiaron(id: number, colores: ProductoColor[]): void {
    this.productos.update((l) => l.map((p) => (p.id === id ? { ...p, colores } : p)));
  }
}
