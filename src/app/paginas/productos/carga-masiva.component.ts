import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, cloudUploadOutline, downloadOutline, documentTextOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Producto } from '../../shared/modelos';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { ColumnaExcel, descargarExcel } from '../../shared/exportar';
import { CeldaExcel, leerHojaDeCalculo } from '../../shared/leer-excel';

function normal(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

type Campo = 'sku' | 'nombre' | 'precio_venta' | 'precio_base' | 'precio_compra' | 'stock' | 'codigo_barras' | 'descripcion' | 'tallas' | 'controla_stock' | 'activo';

/** Columnas de la plantilla (en este orden) y otros nombres con que se reconocen */
const COLUMNAS: { campo: Campo; titulo: string; otros: string[] }[] = [
  { campo: 'sku', titulo: 'SKU', otros: ['referencia', 'ref', 'codigo interno'] },
  { campo: 'nombre', titulo: 'Nombre', otros: ['producto', 'nombre del producto', 'descripcion corta'] },
  { campo: 'precio_venta', titulo: 'Precio venta', otros: ['precio de venta', 'venta', 'precio', 'pvp'] },
  { campo: 'precio_base', titulo: 'Precio base', otros: ['base', 'precio minimo', 'precio vendedora'] },
  { campo: 'precio_compra', titulo: 'Precio compra', otros: ['precio de compra', 'compra', 'costo'] },
  { campo: 'stock', titulo: 'Stock', otros: ['cantidad', 'inventario', 'existencias', 'unidades'] },
  { campo: 'codigo_barras', titulo: 'Código de barras', otros: ['codigo barras', 'codigo', 'barras', 'ean'] },
  { campo: 'descripcion', titulo: 'Descripción', otros: ['detalle', 'descripcion larga'] },
  { campo: 'tallas', titulo: 'Tallas', otros: ['talla'] },
  { campo: 'controla_stock', titulo: 'Controla inventario', otros: ['controla stock', 'controlar inventario', 'inventario si/no'] },
  { campo: 'activo', titulo: 'Activo', otros: ['activa', 'visible'] },
];

const ETIQUETA: Record<Campo, string> = Object.fromEntries(COLUMNAS.map((c) => [c.campo, c.titulo])) as Record<Campo, string>;

type Cambios = Partial<Pick<Producto, Campo>>;

interface FilaCarga {
  fila: number;
  tipo: 'nuevo' | 'actualizar' | 'igual' | 'error';
  nombre: string;
  sku: string | null;
  id?: number;
  datos: Cambios;
  cambios: string[];
  error?: string;
}

/** "$ 25.000", "25,000", "25000.5" → número (formato colombiano) */
function aNumero(v: CeldaExcel): number | null {
  if (v === null || v === '') return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return null;
  let s = v.replace(/[$\s]|COP/gi, '');
  if (!s) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function aSiNo(v: CeldaExcel): boolean | null {
  if (v === null || v === '') return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const s = normal(v);
  if (['si', 's', 'x', '1', 'true', 'verdadero', 'activo', 'yes'].includes(s)) return true;
  if (['no', 'n', '0', 'false', 'falso', 'inactivo'].includes(s)) return false;
  return null;
}

function aTexto(v: CeldaExcel): string | null {
  if (v === null || v === undefined) return null;
  // Los números largos (códigos) llegan como número: sin decimales ni notación científica
  const s = typeof v === 'number' ? (Number.isInteger(v) ? BigInt(Math.round(v)).toString() : String(v)) : String(v);
  return s.trim() || null;
}

/** Carga masiva de productos desde Excel: crea los nuevos y actualiza los que ya existen */
@Component({
  selector: 'app-carga-masiva',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      .pasos { display: flex; flex-direction: column; gap: 18px; }
      .paso { display: flex; flex-direction: column; gap: 10px; }
      .paso h3 { margin: 0; font-size: 14px; font-weight: 650; display: flex; align-items: center; gap: 8px; }
      .paso h3 .n { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: var(--oro); color: #0f172a; font-size: 12px; font-weight: 800; }
      .paso p { margin: 0; font-size: 13px; color: var(--text-soft); line-height: 1.5; }
      .botones { display: flex; gap: 8px; flex-wrap: wrap; }
      .soltar { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 22px 14px; border: 1.5px dashed var(--border-strong); border-radius: var(--radius-lg);
        background: var(--surface); text-align: center; cursor: pointer; transition: border-color 140ms var(--ease), background 140ms var(--ease); }
      .soltar.encima, .soltar:focus-within { border-color: var(--accent); background: var(--accent-wash); }
      .soltar ion-icon { font-size: 30px; color: var(--accent); }
      .soltar strong { font-size: 14px; }
      .soltar small { font-size: 12px; color: var(--text-muted); }
      .soltar input { position: absolute; width: 1px; height: 1px; opacity: 0; }
      .resumen { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
      .cuadro { padding: 10px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--surface); text-align: center; }
      .cuadro strong { display: block; font-size: 20px; font-variant-numeric: tabular-nums; }
      .cuadro span { font-size: 11.5px; color: var(--text-muted); }
      .cuadro.nuevo strong { color: var(--efectivo-texto); }
      .cuadro.act strong { color: var(--accent); }
      .cuadro.err strong { color: var(--danger); }
      .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
      .lista li { display: flex; flex-direction: column; gap: 2px; padding: 9px 12px; border-bottom: 1px solid var(--border-soft); font-size: 13px; }
      .lista li:last-child { border-bottom: 0; }
      .lista .cab { display: flex; gap: 8px; align-items: baseline; }
      .lista .cab strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
      .lista small { color: var(--text-muted); font-size: 12px; }
      .tag { flex-shrink: 0; padding: 1px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
      .tag.nuevo { background: var(--ok-wash); color: var(--efectivo-texto); }
      .tag.actualizar { background: var(--accent-wash); color: var(--accent); }
      .tag.error { background: var(--danger-wash); color: var(--danger); }
      .lista .msg-error { color: var(--danger); }
      .filtro { display: flex; gap: 6px; flex-wrap: wrap; }
      .archivo { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-soft); }
      .archivo ion-icon { font-size: 18px; }
      .archivo button { margin-left: auto; }
    `,
  ],
  template: `
    <button class="velo" aria-label="Cerrar" (click)="cerrar.emit()"></button>
    <aside class="hoja" role="dialog" aria-labelledby="t-carga">
      <div class="hoja-head">
        <h2 id="t-carga">Carga masiva con Excel</h2>
        <button class="b b-icono" aria-label="Cerrar" (click)="cerrar.emit()"><ion-icon name="close-outline"></ion-icon></button>
      </div>
      <div class="hoja-body">
        <div class="pasos">
          <section class="paso">
            <h3><span class="n">1</span>Descarga la plantilla</h3>
            <p>Llena una fila por producto. Para cambiar precios o stock de los que ya tienes, descarga tus productos, cambia lo que necesites y vuelve a subir el archivo.</p>
            <div class="botones">
              <button class="b" (click)="plantilla(false)"><ion-icon name="download-outline"></ion-icon>Plantilla vacía</button>
              <button class="b" (click)="plantilla(true)"><ion-icon name="download-outline"></ion-icon>Mis productos ({{ numero(productos.length) }})</button>
            </div>
          </section>

          <section class="paso">
            <h3><span class="n">2</span>Sube el archivo</h3>
            @if (!filas().length) {
              <label class="soltar" [class.encima]="encima()" (dragover)="$event.preventDefault(); encima.set(true)" (dragleave)="encima.set(false)" (drop)="soltar($event)">
                <ion-icon name="cloud-upload-outline" aria-hidden="true"></ion-icon>
                <strong>{{ leyendo() ? 'Leyendo…' : 'Elegir archivo de Excel' }}</strong>
                <small>.xlsx o .csv · también puedes arrastrarlo aquí</small>
                <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" (change)="elegido($event)" />
              </label>
              <p>Se reconocen por el <strong>SKU</strong> (o el código de barras, o el nombre). Si ya existe se actualiza; si no, se crea. Las celdas vacías no cambian nada.</p>
            } @else {
              <div class="archivo"><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon>{{ nombreArchivo() }}
                <button class="b" (click)="reiniciar()">Cambiar archivo</button></div>
            }
            @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
          </section>

          @if (filas().length) {
            <section class="paso">
              <h3><span class="n">3</span>Revisa y carga</h3>
              <div class="resumen">
                <div class="cuadro nuevo"><strong>{{ cuenta().nuevo }}</strong><span>Nuevos</span></div>
                <div class="cuadro act"><strong>{{ cuenta().actualizar }}</strong><span>Se actualizan</span></div>
                <div class="cuadro"><strong>{{ cuenta().igual }}</strong><span>Sin cambios</span></div>
                <div class="cuadro err"><strong>{{ cuenta().error }}</strong><span>Con error</span></div>
              </div>
              @if (cuenta().error) {
                <p>Las filas con error no se cargan. Corrígelas en el Excel y vuelve a subirlo, o carga el resto así.</p>
              }
              <div class="filtro">
                @for (v of vistas; track v.id) {
                  @if (v.id === 'todo' || cuenta()[v.id]) {
                    <button class="chip" [class.on]="ver() === v.id" (click)="ver.set(v.id)">{{ v.label }}</button>
                  }
                }
              </div>
              <ul class="lista">
                @for (f of mostradas(); track f.fila) {
                  <li>
                    <span class="cab"><span class="tag {{ f.tipo }}">{{ f.tipo === 'nuevo' ? 'Nuevo' : f.tipo === 'actualizar' ? 'Cambia' : f.tipo === 'error' ? 'Error' : 'Igual' }}</span>
                      <strong>{{ f.nombre || '(sin nombre)' }}</strong><small>fila {{ f.fila }}</small></span>
                    @if (f.error) { <small class="msg-error">{{ f.error }}</small> }
                    @else if (f.cambios.length) { <small>{{ f.cambios.join(' · ') }}</small> }
                  </li>
                } @empty {
                  <li><small>Nada que mostrar.</small></li>
                }
              </ul>
              @if (filtradas().length > mostradas().length) {
                <small class="suave">… y {{ filtradas().length - mostradas().length }} más</small>
              }
            </section>
          }
        </div>
      </div>
      @if (filas().length) {
        <div class="hoja-pie">
          <button class="b" (click)="cerrar.emit()">Cancelar</button>
          <button class="b b-pri" [disabled]="!aplicables() || cargando()" (click)="cargar()">
            {{ cargando() ? 'Cargando ' + avance() + '…' : aplicables() ? 'Cargar ' + aplicables() + (aplicables() === 1 ? ' producto' : ' productos') : 'Nada por cargar' }}
          </button>
        </div>
      }
    </aside>
  `,
})
export class CargaMasivaComponent {
  @Input({ required: true }) productos: Producto[] = [];
  @Output() cerrar = new EventEmitter<void>();
  @Output() cargado = new EventEmitter<void>();

  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  filas = signal<FilaCarga[]>([]);
  nombreArchivo = signal('');
  error = signal('');
  leyendo = signal(false);
  encima = signal(false);
  cargando = signal(false);
  avance = signal('');
  ver = signal<'todo' | 'nuevo' | 'actualizar' | 'error'>('todo');

  vistas: { id: 'todo' | 'nuevo' | 'actualizar' | 'error'; label: string }[] = [
    { id: 'todo', label: 'Todo' },
    { id: 'nuevo', label: 'Nuevos' },
    { id: 'actualizar', label: 'Cambios' },
    { id: 'error', label: 'Errores' },
  ];

  numero = numero;

  cuenta = computed(() => {
    const c = { nuevo: 0, actualizar: 0, igual: 0, error: 0, todo: 0 };
    for (const f of this.filas()) c[f.tipo]++;
    return c;
  });
  aplicables = computed(() => this.cuenta().nuevo + this.cuenta().actualizar);
  filtradas = computed(() => {
    const v = this.ver();
    return this.filas().filter((f) => (v === 'todo' ? f.tipo !== 'igual' : f.tipo === v));
  });
  mostradas = computed(() => this.filtradas().slice(0, 150));

  constructor() {
    addIcons({ closeOutline, cloudUploadOutline, downloadOutline, documentTextOutline });
  }

  plantilla(conProductos: boolean): void {
    const siNo = (b: boolean) => (b ? 'Sí' : 'No');
    const cols: ColumnaExcel<Producto>[] = [
      { titulo: 'SKU', valor: (p) => p.sku ?? '' },
      { titulo: 'Nombre', valor: (p) => p.nombre },
      { titulo: 'Precio venta', valor: (p) => Number(p.precio_venta) },
      { titulo: 'Precio base', valor: (p) => Number(p.precio_base) },
      { titulo: 'Precio compra', valor: (p) => Number(p.precio_compra) },
      { titulo: 'Stock', valor: (p) => p.stock },
      { titulo: 'Código de barras', valor: (p) => p.codigo_barras ?? '' },
      { titulo: 'Descripción', valor: (p) => p.descripcion ?? '' },
      { titulo: 'Tallas', valor: (p) => (p.tallas ?? []).join(', ') },
      { titulo: 'Controla inventario', valor: (p) => siNo(p.controla_stock) },
      { titulo: 'Activo', valor: (p) => siNo(p.activo) },
    ];
    const filas = conProductos ? [...this.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')) : [];
    descargarExcel(conProductos ? 'productos_jasta' : 'plantilla_productos_jasta', cols, filas, 'Productos');
  }

  elegido(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (f) void this.leer(f);
  }

  soltar(ev: DragEvent): void {
    ev.preventDefault();
    this.encima.set(false);
    const f = ev.dataTransfer?.files?.[0];
    if (f) void this.leer(f);
  }

  reiniciar(): void {
    this.filas.set([]);
    this.error.set('');
    this.ver.set('todo');
  }

  private async leer(archivo: File): Promise<void> {
    this.error.set('');
    this.leyendo.set(true);
    try {
      const celdas = await leerHojaDeCalculo(archivo);
      const filas = this.analizar(celdas);
      if (!filas.length) throw new Error('El archivo no tiene productos debajo de los títulos.');
      this.nombreArchivo.set(archivo.name);
      this.filas.set(filas);
      this.ver.set(filas.some((f) => f.tipo === 'error') ? 'error' : 'todo');
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.leyendo.set(false);
    }
  }

  /** Convierte las celdas en productos nuevos o cambios a los que ya existen */
  private analizar(celdas: CeldaExcel[][]): FilaCarga[] {
    // Los títulos: la primera de las 10 primeras filas que tenga "Nombre" o "SKU"
    const reconocer = (v: CeldaExcel): Campo | null => {
      const t = normal(String(v ?? '')).replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!t) return null;
      return COLUMNAS.find((c) => normal(c.titulo) === t || c.otros.includes(t))?.campo ?? null;
    };
    const iTitulos = celdas.slice(0, 10).findIndex((f) => f.some((v) => ['nombre', 'sku'].includes(reconocer(v) ?? '')));
    if (iTitulos < 0) throw new Error('No encontramos los títulos de las columnas. Usa la plantilla: la primera fila debe decir SKU, Nombre, Precio venta…');
    const mapa = new Map<number, Campo>();
    celdas[iTitulos].forEach((v, i) => {
      const c = reconocer(v);
      if (c && ![...mapa.values()].includes(c)) mapa.set(i, c);
    });
    if (![...mapa.values()].includes('nombre') && ![...mapa.values()].includes('sku')) throw new Error('Falta la columna Nombre o SKU.');

    const porSku = new Map<string, Producto>();
    const porCodigo = new Map<string, Producto>();
    const porNombre = new Map<string, Producto | null>();
    for (const p of this.productos) {
      if (p.sku) porSku.set(normal(p.sku), p);
      if (p.codigo_barras) porCodigo.set(normal(p.codigo_barras), p);
      const n = normal(p.nombre);
      porNombre.set(n, porNombre.has(n) ? null : p); // null = nombre repetido, no sirve para reconocerlo
    }
    const vistos = new Map<number | string, number>();
    const skusArchivo = new Map<string, number>();

    const salida: FilaCarga[] = [];
    for (let r = iTitulos + 1; r < celdas.length; r++) {
      const fila = celdas[r] ?? [];
      if (!fila.some((v) => v !== null && String(v).trim() !== '')) continue;
      const crudo: Partial<Record<Campo, CeldaExcel>> = {};
      for (const [i, campo] of mapa) crudo[campo] = fila[i] ?? null;

      const datos: Cambios = {};
      const errores: string[] = [];
      const txt = (c: Campo) => aTexto(crudo[c] ?? null);
      for (const c of ['sku', 'nombre', 'codigo_barras', 'descripcion'] as const) {
        const v = txt(c);
        if (v !== null) datos[c] = c === 'nombre' ? v.replace(/\s+/g, ' ') : v;
      }
      for (const c of ['precio_venta', 'precio_base', 'precio_compra', 'stock'] as const) {
        const n = aNumero(crudo[c] ?? null);
        if (n === null) continue;
        if (Number.isNaN(n)) errores.push(`${ETIQUETA[c]} no es un número`);
        else if (n < 0 && c !== 'stock') errores.push(`${ETIQUETA[c]} no puede ser negativo`);
        else datos[c] = c === 'stock' ? Math.trunc(n) : Math.round(n);
      }
      for (const c of ['controla_stock', 'activo'] as const) {
        const raw = crudo[c] ?? null;
        const b = aSiNo(raw);
        if (b !== null) datos[c] = b;
        else if (raw !== null && String(raw).trim() !== '') errores.push(`${ETIQUETA[c]}: escribe Sí o No`);
      }
      const tallas = txt('tallas');
      if (tallas !== null) datos.tallas = [...new Set(tallas.split(/[,;/|]+/).map((t) => t.trim()).filter(Boolean))];

      // ¿Ya existe? Por SKU, luego código de barras, luego nombre
      const sku = datos.sku ? normal(datos.sku) : '';
      const existe =
        (sku && porSku.get(sku)) ||
        (datos.codigo_barras && porCodigo.get(normal(datos.codigo_barras))) ||
        (!sku && datos.nombre && porNombre.get(normal(datos.nombre))) ||
        undefined;

      const base: FilaCarga = { fila: r + 1, tipo: 'nuevo', nombre: datos.nombre ?? existe?.nombre ?? '', sku: datos.sku ?? existe?.sku ?? null, datos, cambios: [] };
      const clave = existe ? existe.id : sku || normal(datos.nombre ?? '');
      if (clave && vistos.has(clave)) errores.push(`Repetido: es el mismo producto de la fila ${vistos.get(clave)}`);
      else if (clave) vistos.set(clave, r + 1);
      // Un SKU no puede quedar en dos productos
      if (sku) {
        const otro = porSku.get(sku);
        if (otro && existe && otro.id !== existe.id) errores.push(`El SKU ${datos.sku} ya es de "${otro.nombre}"`);
        if (skusArchivo.has(sku) && !errores.some((e) => e.startsWith('Repetido'))) errores.push(`El SKU ${datos.sku} está también en la fila ${skusArchivo.get(sku)}`);
        skusArchivo.set(sku, r + 1);
      }

      if (existe) {
        base.id = existe.id;
        const cambios: Cambios = {};
        for (const [k, v] of Object.entries(datos) as [Campo, unknown][]) {
          const antes = existe[k as keyof Producto];
          const igual = Array.isArray(v) ? JSON.stringify(v) === JSON.stringify(antes ?? []) : typeof v === 'number' ? Number(antes) === v : (antes ?? null) === v;
          if (!igual) {
            (cambios as Record<string, unknown>)[k] = v;
            base.cambios.push(this.describir(k, antes, v));
          }
        }
        base.datos = cambios;
        const venta = cambios.precio_venta ?? Number(existe.precio_venta);
        const pbase = cambios.precio_base ?? Number(existe.precio_base);
        if (pbase > venta) errores.push(`El precio base (${pesos(pbase)}) es mayor al de venta (${pesos(venta)})`);
        base.tipo = base.cambios.length ? 'actualizar' : 'igual';
      } else {
        if (!datos.nombre) errores.push(datos.sku ? `No existe un producto con SKU ${datos.sku}: para crearlo escribe el nombre` : 'Falta el nombre');
        if ((datos.precio_base ?? 0) > (datos.precio_venta ?? 0)) errores.push('El precio base es mayor al de venta');
        if (!datos.precio_venta) errores.push('Falta el precio de venta');
        base.cambios = [
          datos.precio_venta ? `Venta ${pesos(datos.precio_venta)}` : '',
          datos.precio_base ? `Base ${pesos(datos.precio_base)}` : '',
          datos.stock !== undefined ? `Stock ${datos.stock}` : '',
          datos.sku ? `SKU ${datos.sku}` : '',
        ].filter(Boolean);
      }
      if (errores.length) {
        base.tipo = 'error';
        base.error = errores.join(' · ');
      }
      salida.push(base);
    }
    return salida;
  }

  private describir(campo: Campo, antes: unknown, despues: unknown): string {
    const fmt = (v: unknown) => {
      if (['precio_venta', 'precio_base', 'precio_compra'].includes(campo)) return pesos(Number(v) || 0);
      if (typeof v === 'boolean') return v ? 'Sí' : 'No';
      if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
      const s = String(v ?? '') || '—';
      return s.length > 30 ? s.slice(0, 30) + '…' : s;
    };
    if (campo === 'descripcion') return 'Descripción nueva';
    return `${ETIQUETA[campo]}: ${fmt(antes)} → ${fmt(despues)}`;
  }

  async cargar(): Promise<void> {
    const nuevos = this.filas().filter((f) => f.tipo === 'nuevo');
    const cambios = this.filas().filter((f) => f.tipo === 'actualizar');
    const total = nuevos.length + cambios.length;
    if (!total) return;
    this.cargando.set(true);
    let hechos = 0;
    const fallidos: string[] = [];
    const ahora = new Date().toISOString();
    try {
      for (let i = 0; i < nuevos.length; i += 200) {
        const lote = nuevos.slice(i, i + 200).map((f) => ({
          nombre: f.datos.nombre!,
          sku: f.datos.sku ?? null,
          codigo_barras: f.datos.codigo_barras ?? null,
          precio_venta: f.datos.precio_venta ?? 0,
          precio_base: f.datos.precio_base ?? 0,
          precio_compra: f.datos.precio_compra ?? 0,
          stock: f.datos.stock ?? 0,
          controla_stock: f.datos.controla_stock ?? true,
          activo: f.datos.activo ?? true,
          descripcion: f.datos.descripcion ?? null,
          tallas: f.datos.tallas ?? [],
        }));
        const { error } = await this.sb.client.from('productos').insert(lote);
        if (error) throw error;
        hechos += lote.length;
        this.avance.set(`${hechos}/${total}`);
      }
      // Los cambios van de a varios a la vez (cada uno solo toca las columnas que cambiaron)
      for (let i = 0; i < cambios.length; i += 8) {
        await Promise.all(
          cambios.slice(i, i + 8).map(async (f) => {
            const { error } = await this.sb.client.from('productos').update({ ...f.datos, updated_at: ahora }).eq('id', f.id!);
            if (error) fallidos.push(`Fila ${f.fila} (${f.nombre}): ${mensajeError(error)}`);
            else hechos++;
          })
        );
        this.avance.set(`${hechos}/${total}`);
      }
      if (fallidos.length) {
        this.error.set(`No se pudieron actualizar ${fallidos.length}: ${fallidos.slice(0, 3).join(' · ')}`);
        this.toast.error(`Se cargaron ${hechos} de ${total} productos`);
      } else {
        this.toast.ok(`Listo: ${nuevos.length} nuevos y ${cambios.length} actualizados`);
        this.cerrar.emit();
      }
      this.cargado.emit();
    } catch (e) {
      this.error.set(`Se cargaron ${hechos} de ${total}. ${mensajeError(e)}`);
      if (hechos) this.cargado.emit();
    } finally {
      this.cargando.set(false);
    }
  }
}
