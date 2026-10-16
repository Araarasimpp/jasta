import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { downloadOutline, searchOutline, shareOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { Producto } from '../../shared/modelos';
import { mensajeError, numero, pesos, urlImagen } from '../../shared/formato';

type Filtro = 'todos' | 'disponibles';

function normal(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Catálogo para las vendedoras: los productos activos, con foto, descripción y precio, y el PDF para mandar */
@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [FormsModule, IonIcon],
  styles: [
    `
      .barra-cat { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; padding: 0 28px 14px; }
      .barra-cat .buscar { flex: 1 1 260px; max-width: 420px; }
      .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; padding: 4px 28px 28px; }
      .prod { display: flex; flex-direction: column; min-width: 0; border: 1px solid var(--border); border-radius: var(--radius-lg);
        background: var(--surface); overflow: hidden; }
      .foto { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: 0; border: none; border-bottom: var(--perfora);
        background: #fff; cursor: zoom-in; }
      .foto img { width: 100%; height: 100%; object-fit: contain; padding: 8px; box-sizing: border-box; display: block; }
      .foto .inicial { display: grid; place-items: center; width: 100%; height: 100%; background: var(--oro-wash); color: var(--oro-texto);
        font-size: 40px; font-weight: 650; cursor: default; }
      .agotado { position: absolute; top: 8px; left: 8px; padding: 3px 7px; border-radius: 5px; background: rgba(23, 21, 17, 0.72); color: #fff;
        font-size: 11px; font-weight: 600; }
      .datos-prod { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px 12px; flex: 1; }
      .nombre { margin: 0; font-size: 13.5px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .desc { margin: 0; font-size: 12.5px; line-height: 1.35; color: var(--text-soft); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
      .precios { margin-top: auto; padding-top: 8px; display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .precio { font-size: 17px; font-weight: 650; white-space: nowrap; }
      .base { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
      .stock { font-size: 11.5px; color: var(--text-muted); }
      .stock.bajo { color: var(--danger); }
      .mas { display: flex; justify-content: center; padding: 0 28px 32px; }
      .progreso { font-size: 13px; color: var(--text-soft); }
      @media (max-width: 760px) {
        .barra-cat { padding: 0 16px 12px; }
        .barra-cat .buscar { max-width: none; }
        .rejilla { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 4px 16px 20px; }
        .datos-prod { padding: 8px 10px 10px; }
        .precio { font-size: 15px; }
        .precios { flex-direction: column; align-items: flex-start; gap: 1px; }
        .mas { padding: 0 16px 24px; }
      }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Catálogo <small class="num">{{ numero(filtrados().length) }}</small></h1>
        <button class="b b-pri" (click)="descargar()" [disabled]="generando() || !filtrados().length">
          <ion-icon [name]="compartir ? 'share-outline' : 'download-outline'"></ion-icon>
          {{ generando() ? 'Preparando PDF… ' + progreso() + '%' : 'Descargar PDF' }}
        </button>
      </div>

      <div class="barra-cat">
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="Buscar producto o SKU" [ngModel]="q()" (ngModelChange)="q.set($event); limite.set(60)" />
        </label>
        <div class="chips">
          <button class="chip" [class.on]="filtro() === 'todos'" (click)="filtro.set('todos')">Todos</button>
          <button class="chip" [class.on]="filtro() === 'disponibles'" (click)="filtro.set('disponibles')">Con stock</button>
        </div>
        @if (generando()) { <span class="progreso">Cargando fotos para el PDF…</span> }
      </div>

      @if (cargando()) {
        <p class="vacio" style="margin: 0 28px">Cargando catálogo…</p>
      } @else if (!filtrados().length) {
        <p class="vacio" style="margin: 0 28px">No hay productos con esa búsqueda.</p>
      }

      <div class="rejilla">
        @for (p of visibles(); track p.id) {
          <article class="prod">
            @if (urlImagen(p.imagen_url); as u) {
              <button type="button" class="foto" (click)="verFoto(p)" [attr.aria-label]="'Ver foto de ' + p.nombre">
                <img [src]="u" alt="" loading="lazy" decoding="async" />
                @if (agotado(p)) { <span class="agotado">Sin stock</span> }
              </button>
            } @else {
              <div class="foto"><span class="inicial" aria-hidden="true">{{ p.nombre.charAt(0) }}</span>
                @if (agotado(p)) { <span class="agotado">Sin stock</span> }</div>
            }
            <div class="datos-prod">
              <h2 class="nombre">{{ p.nombre }}</h2>
              @if (p.descripcion) { <p class="desc">{{ p.descripcion }}</p> }
              @if (p.controla_stock && p.stock > 0) {
                <span class="stock" [class.bajo]="p.stock < 5">{{ p.stock === 1 ? 'Queda 1' : 'Quedan ' + p.stock }}</span>
              }
              <div class="precios">
                <span class="precio num">{{ pesos(p.precio_venta) }}</span>
                <span class="base num" title="Precio base: lo mínimo que puedes cobrar">Base {{ pesos(p.precio_base) }}</span>
              </div>
            </div>
          </article>
        }
      </div>
      @if (filtrados().length > visibles().length) {
        <div class="mas"><button class="b" (click)="limite.update((n) => n + 60)">Ver más ({{ filtrados().length - visibles().length }})</button></div>
      }
    </div>
  `,
})
export class CatalogoPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private visor = inject(VisorService);

  productos = signal<Producto[]>([]);
  cargando = signal(true);
  q = signal('');
  filtro = signal<Filtro>('todos');
  limite = signal(60);
  generando = signal(false);
  progreso = signal(0);
  readonly compartir = typeof navigator !== 'undefined' && 'canShare' in navigator && /iPhone|iPad|Android/i.test(navigator.userAgent);

  filtrados = computed(() => {
    const t = normal(this.q().trim());
    return this.productos().filter((p) => {
      if (this.filtro() === 'disponibles' && this.agotado(p)) return false;
      return !t || normal(`${p.nombre} ${p.sku ?? ''} ${p.descripcion ?? ''}`).includes(t);
    });
  });
  visibles = computed(() => this.filtrados().slice(0, this.limite()));

  pesos = pesos;
  numero = numero;
  urlImagen = urlImagen;

  constructor() {
    addIcons({ downloadOutline, searchOutline, shareOutline });
  }

  async ngOnInit(): Promise<void> {
    const { data, error } = await this.sb.client
      .from('productos')
      .select('id, nombre, sku, codigo_barras, precio_venta, precio_base, stock, controla_stock, imagen_url, activo, descripcion')
      .eq('activo', true)
      .order('nombre');
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.productos.set((data ?? []) as Producto[]);
  }

  agotado(p: Producto): boolean {
    return p.controla_stock && p.stock <= 0;
  }

  verFoto(p: Producto): void {
    // El visor recorre las fotos de lo que se está viendo, empezando por la tocada
    const conFoto = this.filtrados().filter((x) => urlImagen(x.imagen_url));
    this.visor.abrir(
      conFoto.map((x) => ({ url: urlImagen(x.imagen_url)!, titulo: `${x.nombre} · ${pesos(x.precio_venta)}` })),
      conFoto.findIndex((x) => x.id === p.id)
    );
  }

  /** Arma el PDF con lo que está filtrado. En el celular abre "Compartir" (WhatsApp, Guardar en Archivos…) */
  async descargar(): Promise<void> {
    this.generando.set(true);
    this.progreso.set(0);
    try {
      const { generarCatalogoPdf } = await import('../../shared/catalogo-pdf');
      const yo = this.sb.usuario();
      const archivo = await generarCatalogoPdf({
        productos: this.filtrados(),
        vendedora: yo ? { nombre: yo.nombre, telefono: yo.telefono } : null,
        avance: (f) => this.progreso.set(Math.round(f * 100)),
      });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (this.compartir && nav.canShare?.({ files: [archivo] })) {
        try {
          await nav.share({ files: [archivo], title: 'Catálogo Jasta' });
          return;
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return;
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(archivo);
      a.download = archivo.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      this.toast.ok('Catálogo descargado');
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.generando.set(false);
    }
  }
}
