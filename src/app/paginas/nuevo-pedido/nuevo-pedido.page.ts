import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, remove, closeOutline, searchOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Producto } from '../../shared/modelos';
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
      .res:hover { background: var(--hover); }
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
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head"><h1>Nuevo pedido</h1></div>
      <div class="vista-body">
        <div class="grid">
          <section class="panel">
            <h2>Cliente</h2>
            <div class="campo">
              <label for="tel">Teléfono</label>
              <input id="tel" type="tel" inputmode="tel" autocomplete="off" [(ngModel)]="telefono" (blur)="buscarCliente()" />
            </div>
            @if (clientePrevio()) {
              <p class="cliente-previo">Cliente conocido: {{ clientePrevio() }} pedido(s) antes. Llenamos sus datos.</p>
            }
            <div class="campo">
              <label for="nom">Nombre</label>
              <input id="nom" autocomplete="off" [(ngModel)]="nombre" />
            </div>
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
            <div class="campo">
              <label for="obs">Observaciones</label>
              <textarea id="obs" [(ngModel)]="observaciones" placeholder="Ej: llamar antes, entregar antes de las 3 pm"></textarea>
            </div>
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
              <div class="vacio">Busca y agrega los productos del pedido.</div>
            }

            <div class="totales">
              <div><span>Productos</span><span class="num">{{ pesos(subtotal()) }}</span></div>
              <div><span>Domicilio</span><span class="num">{{ pesos(domicilioS()) }}</span></div>
              <div class="fin"><span>Total</span><span class="num">{{ pesos(subtotal() + domicilioS()) }}</span></div>
            </div>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
            <button class="b b-pri b-grande" [disabled]="guardando()" (click)="guardar()">{{ guardando() ? 'Guardando…' : 'Crear pedido' }}</button>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class NuevoPedidoPage implements OnInit {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private router = inject(Router);

  productos = signal<Producto[]>([]);
  barrios = signal<{ barrio: string; domicilio: number; usos: number }[]>([]);
  lineas = signal<Linea[]>([]);
  busqueda = signal('');
  clientePrevio = signal(0);
  guardando = signal(false);
  error = signal('');
  domicilioS = signal(0);

  telefono = '';
  nombre = '';
  direccion = '';
  barrio = '';
  domicilio = 0;
  observaciones = '';

  pesos = pesos;
  urlImagen = urlImagen;

  resultados = computed(() => {
    const q = normal(this.busqueda().trim());
    if (!q) return [];
    const partes = q.split(/\s+/);
    return this.productos()
      .filter((p) => {
        const t = normal(`${p.nombre} ${p.sku ?? ''} ${p.codigo_barras ?? ''}`);
        return partes.every((x) => t.includes(x));
      })
      .slice(0, 30);
  });

  subtotal = computed(() => this.lineas().reduce((a, l) => a + l.cantidad * l.precio, 0));

  constructor() {
    addIcons({ add, remove, closeOutline, searchOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      const [p, b] = await Promise.all([this.ps.productosActivos(), this.ps.barrios()]);
      this.productos.set(p);
      this.barrios.set(b);
    } catch (e) {
      this.error.set('No se pudieron cargar los productos: ' + mensajeError(e));
    }
  }

  async buscarCliente(): Promise<void> {
    const tel = this.telefono.replace(/\D/g, '');
    if (tel.length < 7) return;
    this.telefono = tel;
    try {
      const c = await this.ps.buscarCliente(tel);
      this.clientePrevio.set(c?.pedidos ?? 0);
      if (c) {
        if (!this.nombre) this.nombre = c.cliente_nombre;
        if (!this.direccion) this.direccion = c.direccion ?? '';
        if (!this.barrio) this.barrio = c.barrio ?? '';
        if (!this.domicilio) {
          this.domicilio = Number(c.valor_domicilio) || 0;
          this.domicilioS.set(this.domicilio);
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

  async guardar(): Promise<void> {
    this.error.set('');
    if (!this.nombre.trim()) return this.error.set('Escribe el nombre del cliente.');
    if (!this.direccion.trim()) return this.error.set('Escribe la dirección.');
    if (!this.lineas().length) return this.error.set('Agrega al menos un producto.');
    const admin = this.sb.tiene('admin');
    const bajo = this.lineas().find((l) => l.precio < Number(l.producto.precio_base));
    if (bajo && !admin) return this.error.set(`${bajo.producto.nombre}: el precio no puede ser menor a ${pesos(bajo.producto.precio_base)}.`);
    this.guardando.set(true);
    try {
      const id = await this.ps.crear({
        cliente_nombre: this.nombre,
        cliente_telefono: this.telefono,
        direccion: this.direccion,
        barrio: this.barrio,
        observaciones: this.observaciones,
        valor_domicilio: Number(this.domicilio) || 0,
        items: this.lineas().map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, precio_venta: l.precio })),
      });
      this.toast.ok(`Pedido #${id} creado`);
      this.router.navigate(['/app/pedidos'], { queryParams: { id } });
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.guardando.set(false);
    }
  }
}
