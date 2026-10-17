import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addOutline, chevronBackOutline, chevronForwardOutline, closeOutline, copyOutline, expandOutline, shareSocialOutline } from 'ionicons/icons';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { Producto } from '../../shared/modelos';
import { pesos } from '../../shared/formato';

export interface FotoCatalogo {
  url: string;
  titulo: string;
  /** id del color de esa foto; null = principal; -1 = foto adicional */
  color: number | null;
}

/**
 * Ficha completa de un producto del catálogo: todas sus fotos en un carrusel
 * (se desliza o se tocan las miniaturas), los colores (llevan a su foto), las
 * tallas, la descripción entera, los precios y la ganancia, y botones para
 * compartir el producto o hacer un pedido con él.
 */
@Component({
  selector: 'app-producto-detalle',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      .hoja { width: min(620px, 100vw); }
      .hoja-body { padding: 0 0 20px; gap: 0; }
      .hoja-body > * { flex-shrink: 0; }
      .hoja-head h2 { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

      /* Carrusel */
      .galeria { position: relative; background: #fff; border-bottom: var(--perfora); }
      .carrusel { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; overscroll-behavior-x: contain; }
      .carrusel::-webkit-scrollbar { display: none; }
      .slide { flex: 0 0 100%; aspect-ratio: 1; max-height: 50dvh; scroll-snap-align: center; scroll-snap-stop: always; display: block; position: relative;
        padding: 0; border: 0; background: none; cursor: zoom-in; }
      .slide img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; padding: 14px; box-sizing: border-box; display: block; }
      .sin-foto { aspect-ratio: 16 / 9; display: grid; place-items: center; background: var(--oro-wash); color: var(--oro-texto); font-size: 56px; font-weight: 650; }
      .flecha { position: absolute; top: 50%; translate: 0 -50%; width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid var(--border);
        border-radius: 50%; background: rgba(255, 255, 255, 0.92); color: #171511; font-size: 18px; cursor: pointer; box-shadow: var(--shadow-pop); transition: opacity 160ms; }
      .flecha:disabled { opacity: 0; pointer-events: none; }
      .flecha.izq { left: 10px; } .flecha.der { right: 10px; }
      .contador { position: absolute; top: 10px; right: 10px; padding: 3px 9px; border-radius: 11px; background: rgba(20, 18, 14, 0.66); color: #fff;
        font-size: 11.5px; font-weight: 600; font-family: var(--mono-font); }
      .ampliar { position: absolute; bottom: 10px; right: 10px; width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 50%;
        background: rgba(20, 18, 14, 0.66); color: #fff; font-size: 16px; cursor: pointer; }
      .agotado { position: absolute; top: 10px; left: 10px; padding: 3px 8px; border-radius: 5px; background: rgba(23, 21, 17, 0.72); color: #fff; font-size: 11.5px; font-weight: 600; }
      .miniaturas { display: flex; gap: 8px; padding: 10px 20px; overflow-x: auto; scrollbar-width: none; border-bottom: var(--perfora); }
      .miniaturas::-webkit-scrollbar { display: none; }
      .mini { flex: none; width: 56px; height: 56px; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: #fff; overflow: hidden; cursor: pointer;
        opacity: 0.65; transition: opacity 160ms, box-shadow 160ms, transform 160ms; }
      .mini img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .mini.on { opacity: 1; box-shadow: 0 0 0 2px var(--oro); transform: translateY(-1px); }

      /* Información */
      .info { display: flex; flex-direction: column; gap: 18px; padding: 18px 24px 0; }
      .titulo h3 { margin: 0; font-size: 20px; font-weight: 650; line-height: 1.25; }
      .titulo p { margin: 4px 0 0; font-size: 12.5px; color: var(--text-muted); }
      .precios { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
      .precios div { display: flex; flex-direction: column; gap: 3px; padding: 11px 14px; box-shadow: 1px 0 0 var(--border); }
      .precios span { font-size: 10.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
      .precios strong { font-family: var(--mono-font); font-size: 17px; font-weight: 650; white-space: nowrap; }
      .precios .gana { background: var(--oro-wash); }
      .precios .gana span, .precios .gana strong { color: var(--oro-texto); }
      .bloque h4 { margin: 0 0 8px; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-muted); }
      .bloque h4 em { font-style: normal; text-transform: none; letter-spacing: 0; color: var(--text); font-weight: 600; font-size: 13px; margin-left: 6px; }
      .colores { display: flex; flex-wrap: wrap; gap: 8px; }
      .color { display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px 0 6px; border: 1px solid var(--border-strong); border-radius: 17px;
        background: var(--surface); color: var(--text); font: inherit; font-size: 13px; cursor: pointer; transition: border-color 140ms, box-shadow 140ms; }
      .color .tono { width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12); }
      .color.on { border-color: var(--oro); box-shadow: 0 0 0 1px var(--oro); font-weight: 600; }
      .color small { color: var(--text-muted); font-size: 11px; }
      .tallas { display: flex; flex-wrap: wrap; gap: 6px; }
      .tallas span { min-width: 36px; height: 32px; padding: 0 10px; display: inline-grid; place-items: center; border: 1px solid var(--border-strong); border-radius: 7px;
        font-family: var(--mono-font); font-size: 13px; font-weight: 600; }
      .desc { margin: 0; font-size: 14px; line-height: 1.55; color: var(--text-soft); white-space: pre-line; }
      .datos { grid-template-columns: 110px 1fr; }
      .datos dt { color: var(--text-muted); }
      .datos dd { margin: 0; }
      .neg { color: var(--danger); font-weight: 600; }
      .bajo { color: var(--danger); }
      .hoja-pie .b ion-icon { font-size: 17px; }
      @media (max-width: 760px) {
        .info { padding: 16px 16px 0; }
        .miniaturas { padding: 10px 16px; }
        .precios strong { font-size: 15px; }
        .precios div { padding: 10px 11px; }
        .flecha { display: none; }
      }
      @media (prefers-reduced-motion: reduce) { .carrusel { scroll-behavior: auto; } }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <aside class="hoja" role="dialog" aria-labelledby="t-ficha">
      <div class="hoja-head">
        <h2 id="t-ficha">{{ producto.nombre }}</h2>
        <button class="b b-icono" aria-label="Cerrar" (click)="cerrar.emit()"><ion-icon name="close-outline"></ion-icon></button>
      </div>
      <div class="hoja-body">
        @if (fotos.length) {
          <div class="galeria">
            <div class="carrusel" #carrusel (scroll)="alDeslizar()" aria-label="Fotos del producto" tabindex="0" (keydown.arrowRight)="ir(actual() + 1)" (keydown.arrowLeft)="ir(actual() - 1)">
              @for (f of fotos; track f.url; let i = $index) {
                <button type="button" class="slide" (click)="ampliar(i)" [attr.aria-label]="'Ver en grande: ' + f.titulo">
                  <img [src]="f.url" alt="" [attr.loading]="i < 2 ? 'eager' : 'lazy'" decoding="async" />
                </button>
              }
            </div>
            @if (fotos.length > 1) {
              <span class="contador" aria-live="polite">{{ actual() + 1 }} / {{ fotos.length }}</span>
              <button type="button" class="flecha izq" (click)="ir(actual() - 1)" [disabled]="actual() === 0" aria-label="Foto anterior"><ion-icon name="chevron-back-outline"></ion-icon></button>
              <button type="button" class="flecha der" (click)="ir(actual() + 1)" [disabled]="actual() === fotos.length - 1" aria-label="Foto siguiente"><ion-icon name="chevron-forward-outline"></ion-icon></button>
            }
            <button type="button" class="ampliar" (click)="ampliar(actual())" aria-label="Ver en grande"><ion-icon name="expand-outline"></ion-icon></button>
            @if (agotado()) { <span class="agotado">Sin stock</span> }
          </div>
          @if (fotos.length > 1) {
            <div class="miniaturas" #miniaturas>
              @for (f of fotos; track f.url; let i = $index) {
                <button type="button" class="mini" [class.on]="actual() === i" (click)="ir(i)" [attr.aria-label]="'Foto ' + (i + 1)"><img [src]="f.url" alt="" loading="lazy" /></button>
              }
            </div>
          }
        } @else {
          <div class="sin-foto" aria-hidden="true">{{ producto.nombre.charAt(0) }}</div>
        }

        <div class="info">
          <div class="titulo">
            <h3>{{ producto.nombre }}</h3>
            @if (producto.sku) { <p>SKU {{ producto.sku }}</p> }
          </div>

          <div class="precios">
            <div><span>Precio</span><strong>{{ pesos(producto.precio_venta) }}</strong></div>
            <div><span>Base</span><strong>{{ pesos(producto.precio_base) }}</strong></div>
            <div class="gana"><span>Ganas</span><strong>{{ pesos(ganancia()) }}</strong></div>
          </div>

          @if (producto.colores?.length) {
            <div class="bloque">
              <h4>Colores <em>{{ colorVisto()?.nombre ?? producto.colores!.length + (producto.colores!.length === 1 ? ' color' : ' colores') }}</em></h4>
              <div class="colores">
                @for (c of producto.colores!; track c.id) {
                  <button type="button" class="color" [class.on]="colorVisto()?.id === c.id" (click)="verColor(c.id)" [attr.aria-pressed]="colorVisto()?.id === c.id">
                    <span class="tono" [style.background]="c.hex || '#ccc'"></span>{{ c.nombre }}
                    @if (!c.imagen_url) { <small>sin foto</small> }
                  </button>
                }
              </div>
            </div>
          }

          @if (producto.tallas?.length) {
            <div class="bloque">
              <h4>Tallas disponibles</h4>
              <div class="tallas">@for (t of producto.tallas!; track t) { <span>{{ t }}</span> }</div>
            </div>
          }

          @if (producto.descripcion) {
            <div class="bloque">
              <h4>Descripción</h4>
              <p class="desc">{{ producto.descripcion }}</p>
            </div>
          }

          <div class="bloque">
            <h4>Disponibilidad</h4>
            <dl class="datos">
              <dt>Stock</dt>
              <dd>
                @if (!producto.controla_stock) { Disponible }
                @else if (producto.stock <= 0) { <span class="neg">Sin stock</span> }
                @else { <span [class.bajo]="producto.stock < 5">{{ producto.stock === 1 ? 'Queda 1 unidad' : 'Quedan ' + producto.stock + ' unidades' }}</span> }
              </dd>
              <dt>Fotos</dt><dd>{{ fotos.length || 'Sin fotos' }}</dd>
            </dl>
          </div>
        </div>
      </div>
      <div class="hoja-pie">
        <button class="b" (click)="compartir()" [disabled]="compartiendo()">
          <ion-icon [name]="puedeCompartir ? 'share-social-outline' : 'copy-outline'"></ion-icon>{{ compartiendo() ? 'Preparando…' : puedeCompartir ? 'Compartir' : 'Copiar info' }}
        </button>
        <button class="b b-pri" (click)="pedir()"><ion-icon name="add-outline"></ion-icon>Hacer pedido</button>
      </div>
    </aside>
  `,
})
export class ProductoDetalleComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) producto!: Producto;
  @Input() fotos: FotoCatalogo[] = [];
  /** Color que se estaba viendo en la tarjeta: la ficha abre en su foto */
  @Input() colorInicial: number | null = null;
  @Output() cerrar = new EventEmitter<void>();

  @ViewChild('carrusel') carrusel?: ElementRef<HTMLDivElement>;
  @ViewChild('miniaturas') miniaturas?: ElementRef<HTMLDivElement>;

  private visor = inject(VisorService);
  private toast = inject(ToastService);
  private router = inject(Router);

  actual = signal(0);
  /** Color tocado aunque no tenga foto propia */
  colorTocado = signal<number | null>(null);
  compartiendo = signal(false);
  readonly puedeCompartir = typeof navigator !== 'undefined' && 'share' in navigator;
  pesos = pesos;

  ganancia = computed(() => Number(this.producto.precio_venta) - Number(this.producto.precio_base));
  agotado = computed(() => this.producto.controla_stock && this.producto.stock <= 0);
  colorVisto = computed(() => {
    const id = this.colorTocado() ?? this.fotos[this.actual()]?.color;
    return (this.producto.colores ?? []).find((c) => c.id === id) ?? null;
  });

  private raf = 0;
  private teclas = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.cerrar.emit();
  };

  constructor() {
    addIcons({ addOutline, chevronBackOutline, chevronForwardOutline, closeOutline, copyOutline, expandOutline, shareSocialOutline });
  }

  ngAfterViewInit(): void {
    document.addEventListener('keydown', this.teclas);
    const i = this.colorInicial !== null ? this.fotos.findIndex((f) => f.color === this.colorInicial) : -1;
    if (i > 0) requestAnimationFrame(() => this.ir(i, false));
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.teclas);
    cancelAnimationFrame(this.raf);
  }

  /** Lleva el carrusel a la foto i */
  ir(i: number, suave = true): void {
    const el = this.carrusel?.nativeElement;
    if (!el || i < 0 || i >= this.fotos.length) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: suave ? 'smooth' : 'auto' });
    this.marcar(i);
  }

  alDeslizar(): void {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      const el = this.carrusel?.nativeElement;
      if (!el) return;
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (i !== this.actual()) this.marcar(i);
    });
  }

  private marcar(i: number): void {
    this.actual.set(i);
    this.colorTocado.set(null);
    // La miniatura activa queda a la vista
    const m = this.miniaturas?.nativeElement.children[i] as HTMLElement | undefined;
    m?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  verColor(id: number): void {
    const i = this.fotos.findIndex((f) => f.color === id);
    if (i >= 0) this.ir(i);
    // Sin foto propia: solo se marca el color
    else this.colorTocado.set(id);
  }

  ampliar(i: number): void {
    this.visor.abrir(this.fotos.map((f) => ({ url: f.url, titulo: `${f.titulo} · ${pesos(this.producto.precio_venta)}` })), i);
  }

  /** Texto para mandarle al cliente (sin precio base ni ganancia) */
  private texto(): string {
    const p = this.producto;
    return [
      `*${p.nombre}*`,
      `Precio: ${pesos(p.precio_venta)}`,
      p.colores?.length ? `Colores: ${p.colores.map((c) => c.nombre).join(', ')}` : '',
      p.tallas?.length ? `Tallas: ${p.tallas.join(', ')}` : '',
      p.descripcion ?? '',
    ].filter(Boolean).join('\n');
  }

  /** En el celular comparte la foto que se ve con la información (WhatsApp, etc.); si no, copia el texto */
  async compartir(): Promise<void> {
    const texto = this.texto();
    if (!this.puedeCompartir) {
      try {
        await navigator.clipboard.writeText(texto);
        this.toast.ok('Información copiada');
      } catch {
        this.toast.error('No se pudo copiar');
      }
      return;
    }
    this.compartiendo.set(true);
    try {
      const foto = this.fotos[this.actual()];
      let files: File[] | undefined;
      if (foto) {
        try {
          const blob = await (await fetch(foto.url)).blob();
          const f = new File([blob], `${this.producto.nombre.replace(/[^\w-]+/g, '_').slice(0, 40)}.jpg`, { type: blob.type || 'image/jpeg' });
          if (navigator.canShare?.({ files: [f] })) files = [f];
        } catch {
          /* sin foto: se comparte solo el texto */
        }
      }
      await navigator.share({ title: this.producto.nombre, text: texto, ...(files ? { files } : {}) });
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') this.toast.error('No se pudo compartir');
    } finally {
      this.compartiendo.set(false);
    }
  }

  /** Abre "Nuevo pedido" con este producto (y el color que se está viendo) */
  pedir(): void {
    const color = this.colorVisto()?.nombre;
    this.cerrar.emit();
    void this.router.navigate(['/app/pedidos/nuevo'], { queryParams: { producto: this.producto.id, ...(color ? { color } : {}) } });
  }
}
