import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircleOutline, closeOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { ComprobantesInputComponent } from '../../shared/comprobantes/comprobantes-input.component';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';
import { PesosDirective } from '../../shared/pesos/pesos.directive';
import { urlsComprobantes } from '../../shared/comprobantes';
import { enlaceWhatsapp } from '../../shared/whatsapp';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO, hoyColombiaISO } from '../../shared/fecha-colombia';

interface Cuenta { id: number; nombre: string; telefono: string | null; entregado: number; abonado: number; saldo: number; ultima_entrega: string | null; ultimo_abono: string | null }
interface ItemEntrega { producto_id: number; nombre: string; cantidad: number; costo: number }
interface Entrega { id: number; fecha: string; total: number; nota: string | null; quien: string | null; items: ItemEntrega[] }
interface Abono { id: number; fecha: string; valor: number; metodo: string; comprobantes: string[]; nota: string | null; quien: string | null }
interface Detalle { id: number; nombre: string; telefono: string | null; entregas: Entrega[]; abonos: Abono[] }
interface Prod { id: number; nombre: string; sku: string | null; costo: number | null }
interface Linea { id: number; nombre: string; cantidad: number | null; costo: number | null }
type Mov = { tipo: 'entrega'; fecha: string; e: Entrega } | { tipo: 'abono'; fecha: string; a: Abono };

const METODOS = [
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'otro', label: 'Otro' },
] as const;
const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Cuentas por cobrar: mercancía que se le entrega al costo a una persona de confianza y lo que va
 * abonando. No es una venta: no suma en Ventas del local, caja ni reportes.
 */
@Component({
  selector: 'app-cuentas',
  standalone: true,
  imports: [FormsModule, IonIcon, ComprobantesInputComponent, EsqueletoComponent, PesosDirective],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 820px; }
      .lista { display: flex; flex-direction: column; gap: 12px; }
      .cuenta { display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
      .cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .cab h3 { margin: 0; font-size: 17px; }
      .cab small { display: block; font-size: 12.5px; color: var(--text-muted); }
      .saldo { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: var(--radius); background: var(--oro-wash); }
      .saldo.cero { background: var(--ok-wash); }
      .saldo span { font-size: 12px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--oro-texto); }
      .saldo.cero span { color: var(--efectivo-texto); }
      .saldo strong { font-family: var(--mono-font); font-size: 28px; }
      .saldo small { font-size: 12.5px; color: var(--text-soft); }
      .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .acciones .b { height: 42px; }
      .link { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
      .link.peligro { color: var(--danger); }
      .movs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .mov { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-top: 1px solid var(--border-soft); font-size: 13.5px; }
      .mov-top { display: flex; justify-content: space-between; gap: 10px; align-items: baseline; }
      .mov-top strong { font-family: var(--mono-font); white-space: nowrap; }
      .mov.abono .mov-top strong { color: var(--efectivo-texto); }
      .mov small { color: var(--text-muted); }
      .mov ul { margin: 0; padding-left: 18px; color: var(--text-soft); font-size: 13px; }
      .pie-mov { display: flex; gap: 14px; flex-wrap: wrap; }
      .f-buscar { position: relative; }
      .f-sug { position: absolute; left: 0; right: 0; top: 100%; z-index: 5; margin: 4px 0 0; padding: 4px; list-style: none; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); box-shadow: 0 6px 20px rgba(0,0,0,.12); max-height: 240px; overflow-y: auto; }
      .f-sug button { width: 100%; display: flex; justify-content: space-between; gap: 8px; padding: 9px 10px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
      .f-sug small { color: var(--text-muted); white-space: nowrap; }
      .f-lineas { display: flex; flex-direction: column; gap: 6px; }
      .f-linea { display: grid; grid-template-columns: minmax(0, 1fr) 60px 100px 32px; gap: 6px; align-items: center; }
      .f-linea .nom { font-size: 13.5px; line-height: 1.25; overflow-wrap: anywhere; }
      .f-linea input { height: 38px; padding: 0 8px; font-size: 14px; min-width: 0; }
      .f-linea .quitar { height: 32px; border: 0; border-radius: var(--radius-sm); background: var(--danger-wash); color: var(--danger); cursor: pointer; }
      .f-total { display: flex; justify-content: space-between; align-items: baseline; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: 13.5px; }
      .f-total strong { font-family: var(--mono-font); font-size: 18px; }
      .metodos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .metodo { height: 40px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; cursor: pointer; }
      .metodo.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .rapidos { display: flex; gap: 6px; flex-wrap: wrap; }
      .rapidos button { height: 32px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text-soft); font: inherit; font-size: 13px; cursor: pointer; }
      .vacio-txt { margin: 0; padding: 20px 0; text-align: center; font-size: 14px; color: var(--text-soft); }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">Mercancía entregada al costo y sus abonos</p><h1>Cuentas por cobrar</h1></div>
        <button class="b b-pri" (click)="abrirCuenta(null)"><ion-icon name="add-circle-outline"></ion-icon>Nueva cuenta</button>
      </div>
      <p class="ayuda" style="margin: 0">Aquí llevas lo que le entregas a tu precio de compra a alguien de confianza y lo que te va pasando. No cuenta como venta: no suma en Ventas del local, caja ni reportes. Sí descuenta inventario y cuenta como vendido en Deudas.</p>

      <div class="lista">
        @for (c of cuentas(); track c.id) {
          <article class="cuenta">
            <div class="cab">
              <div><h3>{{ c.nombre }}</h3><small>{{ c.telefono || 'Sin celular' }}</small></div>
              <button class="link" (click)="abrirCuenta(c)">Editar</button>
            </div>
            <div class="saldo" [class.cero]="+c.saldo <= 0">
              <span>{{ +c.saldo > 0 ? 'Te debe' : 'Está al día' }}</span>
              <strong>{{ pesos(c.saldo) }}</strong>
              <small>Le has entregado {{ pesos(c.entregado) }} · te ha pasado {{ pesos(c.abonado) }}</small>
            </div>
            <div class="acciones">
              <button class="b" (click)="abrirEntrega(c)">Entregar mercancía</button>
              <button class="b b-ok" [disabled]="+c.saldo <= 0" (click)="abrirAbono(c)">Registrar abono</button>
            </div>
            <div class="pie-mov">
              <button class="link" (click)="verDetalle(c)">{{ abierta() === c.id ? 'Ocultar movimientos' : 'Ver movimientos' }}</button>
              @if (c.telefono) { <a class="link" [href]="whatsappEstado(c)" target="_blank" rel="noopener">Mandarle el estado de cuenta</a> }
            </div>
            @if (abierta() === c.id) {
              @if (detalle(); as d) {
                <ul class="movs">
                  @for (m of movimientos(); track m.tipo + (m.tipo === 'entrega' ? m.e.id : m.a.id)) {
                    @if (m.tipo === 'entrega') {
                      <li class="mov">
                        <div class="mov-top"><span>{{ fecha(m.fecha) }} · <b>Le entregaste</b></span><strong>+ {{ pesos(m.e.total) }}</strong></div>
                        <ul>@for (i of m.e.items; track $index) { <li>{{ i.cantidad }} × {{ i.nombre }} · {{ pesos(i.costo) }} c/u</li> }</ul>
                        @if (m.e.nota) { <small>{{ m.e.nota }}</small> }
                        <div><button class="link peligro" (click)="eliminarEntrega(m.e)">Eliminar entrega</button></div>
                      </li>
                    } @else {
                      <li class="mov abono">
                        <div class="mov-top"><span>{{ fecha(m.fecha) }} · <b>Te abonó</b> · {{ metodo(m.a.metodo) }}</span><strong>− {{ pesos(m.a.valor) }}</strong></div>
                        @if (m.a.nota) { <small>{{ m.a.nota }}</small> }
                        <div class="pie-mov">
                          @if (m.a.comprobantes.length) { <button class="link" (click)="verSoporte(m.a)">Ver comprobante</button> }
                          <button class="link peligro" (click)="eliminarAbono(m.a)">Eliminar abono</button>
                        </div>
                      </li>
                    }
                  } @empty {
                    <li class="vacio-txt">Todavía no hay movimientos.</li>
                  }
                </ul>
              } @else { <app-esqueleto forma="texto" [filas]="3"></app-esqueleto> }
            }
          </article>
        } @empty {
          @if (cargando()) { <app-esqueleto forma="lista" [filas]="2"></app-esqueleto> }
          @else { <p class="vacio-txt">Todavía no tienes cuentas. Toca "Nueva cuenta" y crea la de la persona a la que le entregas mercancía al costo.</p> }
        }
      </div>
    </div>

    @if (editCuenta()) {
      <button class="velo" aria-label="Cerrar" (click)="editCuenta.set(null)"></button>
      <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-cta">
        <div class="hoja-head"><h2 id="t-cta">{{ editCuenta()!.id ? 'Editar cuenta' : 'Nueva cuenta' }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="editCuenta.set(null)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <div class="campo"><label for="cta-n">Nombre</label><input id="cta-n" maxlength="80" [(ngModel)]="cNombre" placeholder="Ej: Mi hermano Carlos" /></div>
          <div class="campo"><label for="cta-t">Celular (opcional)</label><input id="cta-t" inputmode="tel" maxlength="20" [(ngModel)]="cTelefono" placeholder="Para mandarle el estado de cuenta" /></div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="editCuenta.set(null)">Cancelar</button>
          <button class="b b-pri" [disabled]="ocupado()" (click)="guardarCuenta()">{{ ocupado() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>
    }

    @if (entregaDe(); as c) {
      <button class="velo" aria-label="Cerrar" (click)="entregaDe.set(null)"></button>
      <div class="hoja" role="dialog" aria-labelledby="t-ent">
        <div class="hoja-head"><h2 id="t-ent">Entregar mercancía a {{ c.nombre }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="entregaDe.set(null)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <p class="ayuda" style="margin: 0">Cada producto queda a tu precio de compra. Si el precio de compra está desactualizado, cámbialo aquí.</p>
          <div class="campo f-buscar">
            <label for="ent-b">Agregar producto</label>
            <input id="ent-b" [ngModel]="busca()" (ngModelChange)="busca.set($event)" placeholder="Escribe el nombre o el SKU" autocomplete="off" />
            @if (sugerencias().length) {
              <ul class="f-sug">
                @for (p of sugerencias(); track p.id) {
                  <li><button type="button" (click)="agregar(p)"><span>{{ p.nombre }}</span><small>{{ p.costo ? pesos(p.costo) : 'sin costo' }}</small></button></li>
                }
              </ul>
            }
          </div>
          @if (lineas().length) {
            <div class="f-lineas">
              @for (l of lineas(); track l.id; let i = $index) {
                <div class="f-linea">
                  <span class="nom">{{ l.nombre }}</span>
                  <input class="num" type="number" inputmode="numeric" min="1" [(ngModel)]="l.cantidad" (ngModelChange)="tocar()" aria-label="Cantidad" />
                  <input pesos class="num" [(ngModel)]="l.costo" (ngModelChange)="tocar()" aria-label="Costo por unidad" placeholder="Costo c/u" />
                  <button type="button" class="quitar" (click)="quitar(i)" aria-label="Quitar">✕</button>
                </div>
              }
            </div>
            <div class="f-total"><span>{{ unidades() }} unidades</span><strong>{{ pesos(totalEntrega()) }}</strong></div>
          } @else { <p class="vacio-txt" style="padding: 6px 0">Todavía no has agregado productos.</p> }
          <div class="fila-campos">
            <div class="campo"><label for="ent-f">Fecha</label><input id="ent-f" type="date" [max]="hoy" [(ngModel)]="fechaMov" /></div>
            <div class="campo"><label for="ent-n">Nota (opcional)</label><input id="ent-n" maxlength="300" [(ngModel)]="nota" /></div>
          </div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="entregaDe.set(null)">Cancelar</button>
          <button class="b b-pri" [disabled]="ocupado() || !lineas().length" (click)="guardarEntrega()">{{ ocupado() ? 'Guardando…' : 'Registrar entrega · ' + pesos(totalEntrega()) }}</button>
        </div>
      </div>
    }

    @if (abonoDe(); as c) {
      <button class="velo" aria-label="Cerrar" (click)="abonoDe.set(null)"></button>
      <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-ab">
        <div class="hoja-head"><h2 id="t-ab">Abono de {{ c.nombre }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="abonoDe.set(null)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <p class="ayuda" style="margin: 0">Debe {{ pesos(c.saldo) }}.</p>
          <div class="campo"><label for="ab-v">¿Cuánto te pasó?</label><input id="ab-v" pesos [(ngModel)]="valor" placeholder="$ 0" />
            <div class="rapidos"><button type="button" (click)="valor = +c.saldo">Pagó todo · {{ pesos(c.saldo) }}</button></div></div>
          <div class="campo"><span class="etq">¿Cómo te pagó?</span>
            <div class="metodos">@for (m of metodos; track m.id) { <button type="button" class="metodo" [class.on]="metodoSel() === m.id" (click)="metodoSel.set(m.id)">{{ m.label }}</button> }</div>
          </div>
          <div class="campo"><label for="ab-f">Fecha</label><input id="ab-f" type="date" [max]="hoy" [(ngModel)]="fechaMov" /></div>
          <app-comprobantes-input [obligatorio]="false" titulo="Comprobante (opcional)" [rutas]="soportes()" (cambio)="soportes.set($event)"></app-comprobantes-input>
          <div class="campo"><label for="ab-n">Nota (opcional)</label><input id="ab-n" maxlength="300" [(ngModel)]="nota" /></div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="abonoDe.set(null)">Cancelar</button>
          <button class="b b-ok" [disabled]="ocupado()" (click)="guardarAbono()">{{ ocupado() ? 'Guardando…' : 'Registrar abono' }}</button>
        </div>
      </div>
    }
  `,
})
export class CuentasPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private visor = inject(VisorService);

  cuentas = signal<Cuenta[]>([]);
  cargando = signal(true);
  ocupado = signal(false);
  error = signal('');
  abierta = signal<number | null>(null);
  detalle = signal<Detalle | null>(null);
  pesos = pesos;
  metodos = METODOS;
  hoy = hoyColombiaISO();

  movimientos = computed<Mov[]>(() => {
    const d = this.detalle();
    if (!d) return [];
    const m: Mov[] = [...d.entregas.map((e) => ({ tipo: 'entrega' as const, fecha: e.fecha, e })), ...d.abonos.map((a) => ({ tipo: 'abono' as const, fecha: a.fecha, a }))];
    return m.sort((x, y) => y.fecha.localeCompare(x.fecha));
  });

  // Cuenta
  editCuenta = signal<{ id: number | null } | null>(null);
  cNombre = '';
  cTelefono = '';
  // Entrega
  entregaDe = signal<Cuenta | null>(null);
  private prods = signal<Prod[]>([]);
  busca = signal('');
  lineas = signal<Linea[]>([]);
  private version = signal(0);
  sugerencias = computed(() => {
    const t = normal(this.busca());
    if (t.length < 2) return [];
    const ya = new Set(this.lineas().map((l) => l.id));
    return this.prods().filter((p) => !ya.has(p.id) && (normal(p.nombre).includes(t) || normal(p.sku ?? '').includes(t))).slice(0, 8);
  });
  totalEntrega = computed(() => {
    this.version();
    return this.lineas().reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.costo) || 0), 0);
  });
  unidades = computed(() => {
    this.version();
    return this.lineas().reduce((s, l) => s + (Number(l.cantidad) || 0), 0);
  });
  // Abono
  abonoDe = signal<Cuenta | null>(null);
  valor: number | null = null;
  metodoSel = signal<'efectivo' | 'transferencia' | 'otro'>('efectivo');
  soportes = signal<string[]>([]);
  fechaMov = this.hoy;
  nota = '';

  constructor() {
    addIcons({ addCircleOutline, closeOutline });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const { data, error } = await this.sb.client.rpc('cuentas_lista');
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.cuentas.set((data ?? []) as Cuenta[]);
    if (this.abierta()) await this.cargarDetalle(this.abierta()!);
  }

  async verDetalle(c: Cuenta): Promise<void> {
    if (this.abierta() === c.id) return this.abierta.set(null);
    this.detalle.set(null);
    this.abierta.set(c.id);
    await this.cargarDetalle(c.id);
  }

  private async cargarDetalle(id: number): Promise<void> {
    const { data, error } = await this.sb.client.rpc('cuenta_detalle', { p_cuenta: id });
    if (error) return this.toast.error(mensajeError(error));
    this.detalle.set(data as Detalle);
  }

  abrirCuenta(c: Cuenta | null): void {
    this.error.set('');
    this.cNombre = c?.nombre ?? '';
    this.cTelefono = c?.telefono ?? '';
    this.editCuenta.set({ id: c?.id ?? null });
  }

  async guardarCuenta(): Promise<void> {
    if (this.cNombre.trim().length < 2) return this.error.set('Escribe el nombre.');
    this.ocupado.set(true);
    const { error } = await this.sb.client.rpc('guardar_cuenta', { p_cuenta: this.editCuenta()?.id ?? null, p_nombre: this.cNombre.trim(), p_telefono: this.cTelefono.trim() });
    this.ocupado.set(false);
    if (error) return this.error.set(mensajeError(error));
    this.editCuenta.set(null);
    this.toast.ok('Cuenta guardada');
    await this.cargar();
  }

  async abrirEntrega(c: Cuenta): Promise<void> {
    this.error.set('');
    this.busca.set('');
    this.lineas.set([]);
    this.fechaMov = this.hoy;
    this.nota = '';
    this.entregaDe.set(c);
    if (!this.prods().length) {
      const { data } = await this.sb.client.rpc('inventario');
      this.prods.set((data ?? []) as Prod[]);
    }
  }

  agregar(p: Prod): void {
    this.lineas.update((l) => [...l, { id: p.id, nombre: p.nombre, cantidad: 1, costo: p.costo ?? null }]);
    this.busca.set('');
    setTimeout(() => document.getElementById('ent-b')?.focus(), 0);
  }

  quitar(i: number): void {
    this.lineas.update((l) => l.filter((_, j) => j !== i));
  }

  tocar(): void {
    this.version.update((v) => v + 1);
  }

  async guardarEntrega(): Promise<void> {
    const c = this.entregaDe();
    if (!c) return;
    const ls = this.lineas();
    if (ls.some((l) => !(Number(l.cantidad) > 0))) return this.error.set('Escribe la cantidad de cada producto.');
    if (ls.some((l) => !(Number(l.costo) > 0))) return this.error.set('Escribe el costo de cada producto.');
    this.ocupado.set(true);
    const { error } = await this.sb.client.rpc('entregar_al_costo', {
      p_cuenta: c.id, p_items: ls.map((l) => ({ producto_id: l.id, cantidad: Math.round(Number(l.cantidad)), costo: Number(l.costo) })),
      p_fecha: this.fechaMov || this.hoy, p_nota: this.nota.trim(),
    });
    this.ocupado.set(false);
    if (error) return this.error.set(mensajeError(error));
    this.toast.ok(`Entrega de ${pesos(this.totalEntrega())} a ${c.nombre} registrada`);
    this.entregaDe.set(null);
    await this.cargar();
  }

  abrirAbono(c: Cuenta): void {
    this.error.set('');
    this.valor = null;
    this.metodoSel.set('efectivo');
    this.soportes.set([]);
    this.fechaMov = this.hoy;
    this.nota = '';
    this.abonoDe.set(c);
  }

  async guardarAbono(): Promise<void> {
    const c = this.abonoDe();
    if (!c) return;
    const v = Number(this.valor);
    if (!(v > 0)) return this.error.set('Escribe cuánto te pasó.');
    if (v > Number(c.saldo)) return this.error.set(`Es más de lo que debe (${pesos(c.saldo)}).`);
    this.ocupado.set(true);
    const { error } = await this.sb.client.rpc('abonar_cuenta', {
      p_cuenta: c.id, p_valor: v, p_metodo: this.metodoSel(), p_comprobantes: this.soportes(), p_nota: this.nota.trim(), p_fecha: this.fechaMov || this.hoy,
    });
    this.ocupado.set(false);
    if (error) return this.error.set(mensajeError(error));
    this.toast.ok(`Abono de ${pesos(v)} registrado`);
    this.abonoDe.set(null);
    await this.cargar();
  }

  async eliminarEntrega(e: Entrega): Promise<void> {
    if (!confirm(`¿Eliminar la entrega de ${pesos(e.total)} del ${this.fecha(e.fecha)}? Los productos vuelven al inventario. No se puede deshacer.`)) return;
    const { error } = await this.sb.client.rpc('eliminar_entrega_costo', { p_entrega: e.id });
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok('Entrega eliminada');
    await this.cargar();
  }

  async eliminarAbono(a: Abono): Promise<void> {
    if (!confirm(`¿Eliminar el abono de ${pesos(a.valor)} del ${this.fecha(a.fecha)}? No se puede deshacer.`)) return;
    const { error } = await this.sb.client.rpc('eliminar_abono_cuenta', { p_abono: a.id });
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok('Abono eliminado');
    await this.cargar();
  }

  verSoporte(a: Abono): void {
    void urlsComprobantes(this.sb.client, a.comprobantes).then((urls) =>
      this.visor.abrir(urls.map((url) => ({ url, titulo: `Abono · ${pesos(a.valor)} · ${this.fecha(a.fecha)}` })), 0));
  }

  whatsappEstado(c: Cuenta): string {
    const nombre = c.nombre.split(' ')[0];
    return enlaceWhatsapp(c.telefono,
      `Hola ${nombre}, te paso cómo va tu cuenta: llevas ${pesos(c.entregado)} en mercancía, me has pasado ${pesos(c.abonado)} y quedan ${pesos(c.saldo)} por pagar.`);
  }

  metodo(m: string): string {
    return METODOS.find((x) => x.id === m)?.label ?? m;
  }

  fecha(d: string): string {
    return formatoFechaCO(d + 'T12:00:00-05:00', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}
