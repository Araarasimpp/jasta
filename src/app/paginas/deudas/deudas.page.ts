import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { addCircleOutline, chevronDownOutline, chevronUpOutline, closeOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { ComprobantesInputComponent } from '../../shared/comprobantes/comprobantes-input.component';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';
import { PesosDirective } from '../../shared/pesos/pesos.directive';
import { urlsComprobantes } from '../../shared/comprobantes';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO, hoyColombiaISO } from '../../shared/fecha-colombia';

interface Item { producto_id: number; nombre: string; cantidad: number; costo: number; vendidas: number; quedan: number }
interface Abono { id: number; fecha: string; valor: number; metodo: string; comprobantes: string[]; nota: string | null; anulado: boolean; quien: string | null }
interface Deuda {
  id: number; proveedor: string; concepto: string | null; total: number; fecha: string; vence: string | null;
  estado: 'abierta' | 'pagada' | 'anulada'; compra_id: number | null; creado_por: string | null;
  abonado: number; saldo: number; costo_vendido: number | null; unidades: number | null; vendidas: number | null; por_apartar: number;
  items: Item[] | null; abonos: Abono[];
}
interface CompraLibre { id: number; fecha: string; proveedor: string; total: number; productos: string | null }
type Filtro = 'abiertas' | 'pagadas' | 'todas';
type Metodo = 'efectivo' | 'transferencia' | 'otro';

const METODOS: { id: Metodo; label: string }[] = [
  { id: 'transferencia', label: 'Transferencia' },
  { id: 'efectivo', label: 'Efectivo' },
  { id: 'otro', label: 'Otro' },
];

/**
 * Deudas con proveedores (mercancía fiada, préstamos, servicios). De la mercancía fiada se ve
 * cuántas unidades ya se vendieron y cuánto de su costo ya entró: eso es lo que conviene apartar
 * para abonarle al proveedor. Abonos parciales, "abonar lo vendido" y "pagar todo", con soporte.
 */
@Component({
  selector: 'app-deudas',
  standalone: true,
  imports: [FormsModule, RouterLink, IonIcon, ComprobantesInputComponent, EsqueletoComponent, PesosDirective],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 900px; }
      .resumen { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .res { display: flex; flex-direction: column; gap: 3px; padding: 14px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
      .res small { font-size: 11.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted); }
      .res strong { font-family: var(--mono-font); font-size: 20px; }
      .res span { font-size: 12.5px; color: var(--text-soft); }
      .res.clave { background: var(--oro-wash); border-color: transparent; }
      .res.clave small, .res.clave strong { color: var(--oro-texto); }
      .res.mal strong { color: var(--danger); }
      @media (max-width: 640px) { .resumen { grid-template-columns: 1fr 1fr; } .res.clave { grid-column: 1 / -1; } }
      .chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .chips button { height: 34px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text-soft); font: inherit; font-size: 13.5px; cursor: pointer; }
      .chips button.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .lista { display: flex; flex-direction: column; gap: 12px; }
      .deuda { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
      .deuda.pagada { opacity: .75; }
      .top { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
      .top h3 { margin: 0; font-size: 16px; }
      .top p { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); }
      .estado { flex-shrink: 0; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--surface-2); color: var(--text-soft); white-space: nowrap; }
      .estado.vencida { background: var(--danger-wash); color: var(--danger); }
      .estado.pronto { background: var(--oro-wash); color: var(--oro-texto); }
      .estado.pagada { background: var(--ok-wash); color: var(--efectivo-texto); }
      .saldo { display: flex; flex-direction: column; gap: 2px; }
      .saldo strong { font-family: var(--mono-font); font-size: 24px; }
      .saldo span { font-size: 13px; color: var(--text-soft); }
      .barra { height: 8px; border-radius: 999px; background: var(--surface-2); overflow: hidden; }
      .barra i { display: block; height: 8px; border-radius: inherit; background: var(--efectivo-texto); }
      .barra.venta i { background: var(--accent); }
      .vendido { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--radius); background: var(--surface-2); font-size: 13.5px; }
      .vendido .fila { display: flex; justify-content: space-between; gap: 10px; }
      .vendido .num { font-family: var(--mono-font); font-weight: 650; }
      .apartar { color: var(--oro-texto); font-weight: 700; }
      .items { width: 100%; border-collapse: collapse; font-size: 13px; }
      .items th { text-align: left; font-size: 11px; color: var(--text-muted); font-weight: 650; padding: 4px; border-bottom: 1px solid var(--border); }
      .items td { padding: 6px 4px; border-bottom: var(--perfora); }
      .items .der { text-align: right; font-family: var(--mono-font); }
      @media (max-width: 520px) { .items .costo { display: none; } .items { font-size: 12.5px; } }
      .acciones { display: flex; gap: 8px; flex-wrap: wrap; }
      .acciones .b { flex: 1 1 140px; }
      .abonos { list-style: none; margin: 0; padding: 0; font-size: 13px; }
      .abonos li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 0; border-bottom: var(--perfora); }
      .abonos li.anulado { opacity: .5; text-decoration: line-through; }
      .abonos small { display: block; color: var(--text-muted); font-size: 12px; }
      .abonos .der { display: flex; align-items: center; gap: 8px; font-family: var(--mono-font); font-weight: 650; white-space: nowrap; }
      .link { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 13px; cursor: pointer; }
      .link.peligro { color: var(--danger); }
      .vacio-txt { margin: 0; padding: 24px 0; text-align: center; color: var(--text-soft); }
      .metodos { display: flex; gap: 6px; }
      .metodos button { flex: 1; height: 40px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; cursor: pointer; }
      .metodos button.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .atajos { display: flex; gap: 6px; flex-wrap: wrap; }
      .atajos button { height: 32px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text-soft); font: inherit; font-size: 12.5px; cursor: pointer; }
      .tipo-deuda { display: flex; gap: 6px; }
      .tipo-deuda button { flex: 1; height: 40px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; font-size: 14px; cursor: pointer; }
      .tipo-deuda button.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .compras { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; max-height: 280px; overflow-y: auto; }
      .compras button { width: 100%; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); font: inherit; text-align: left; cursor: pointer; }
      .compras button.on { border-color: var(--accent); background: var(--accent-wash); }
      .compras small { color: var(--text-muted); font-size: 12px; }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">Lo que el negocio le debe a proveedores</p><h1>Deudas</h1></div>
        <button class="b b-pri" (click)="abrirNueva()"><ion-icon name="add-circle-outline"></ion-icon>Nueva deuda</button>
      </div>

      <div class="resumen">
        <div class="res"><small>Se debe</small><strong>{{ pesos(totales().saldo) }}</strong><span>{{ totales().abiertas }} {{ totales().abiertas === 1 ? 'deuda abierta' : 'deudas abiertas' }}</span></div>
        <div class="res" [class.mal]="totales().vencidas > 0"><small>Vencidas</small><strong>{{ totales().vencidas }}</strong><span>{{ totales().vencidas ? pesos(totales().saldoVencido) + ' por pagar' : 'Ninguna' }}</span></div>
        <div class="res clave"><small>Ya vendido, por abonar</small><strong>{{ pesos(totales().porApartar) }}</strong><span>Costo de la mercancía fiada que ya se vendió y no se ha abonado</span></div>
      </div>

      <div class="chips" role="group" aria-label="Qué deudas ver">
        @for (f of filtros; track f.id) { <button [class.on]="filtro() === f.id" (click)="cambiarFiltro(f.id)">{{ f.label }}</button> }
      </div>

      <div class="lista">
        @for (d of deudas(); track d.id) {
          <article class="deuda" [class.pagada]="d.estado === 'pagada'">
            <div class="top">
              <div>
                <h3>{{ d.proveedor }}</h3>
                <p>{{ d.concepto || (d.compra_id ? 'Mercancía fiada' : 'Deuda') }} · desde el {{ fecha(d.fecha) }}{{ d.compra_id ? ' · compra #' + d.compra_id : '' }}</p>
              </div>
              <span class="estado" [class]="'estado ' + estadoClase(d)">{{ estadoTexto(d) }}</span>
            </div>

            <div class="saldo">
              <strong>{{ pesos(d.saldo) }}</strong>
              <span>{{ d.estado === 'pagada' ? 'Pagada' : 'Por pagar' }} de {{ pesos(d.total) }} · abonado {{ pesos(d.abonado) }}</span>
            </div>
            <div class="barra" role="progressbar" [attr.aria-valuenow]="pct(d.abonado, d.total)" aria-valuemin="0" aria-valuemax="100" aria-label="Lo abonado">
              <i [style.width.%]="pct(d.abonado, d.total)"></i></div>

            @if (d.compra_id && d.unidades) {
              <div class="vendido">
                <div class="fila"><span>Mercancía vendida</span><span class="num">{{ d.vendidas }} de {{ d.unidades }} unidades</span></div>
                <div class="barra venta"><i [style.width.%]="pct(d.vendidas ?? 0, d.unidades)"></i></div>
                <div class="fila"><span>Costo de lo vendido</span><span class="num">{{ pesos(d.costo_vendido) }}</span></div>
                @if (d.estado === 'abierta') {
                  <div class="fila apartar"><span>Aparta y abona</span><span class="num">{{ pesos(d.por_apartar) }}</span></div>
                }
                <button type="button" class="link" style="align-self: flex-start" (click)="alternar(d.id)">{{ abierta() === d.id ? 'Ocultar productos' : 'Ver productos' }}</button>
                @if (abierta() === d.id) {
                  <table class="items">
                    <thead><tr><th>Producto</th><th class="der">Compradas</th><th class="der">Vendidas</th><th class="der">Quedan</th><th class="der costo">Costo c/u</th></tr></thead>
                    <tbody>
                      @for (i of d.items ?? []; track i.producto_id) {
                        <tr><td>{{ i.nombre }}</td><td class="der">{{ i.cantidad }}</td><td class="der">{{ i.vendidas }}</td><td class="der">{{ i.quedan }}</td><td class="der costo">{{ pesos(i.costo) }}</td></tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            }

            @if (d.estado === 'abierta') {
              <div class="acciones">
                <button class="b" (click)="abrirAbono(d, null)">Abonar</button>
                @if (d.por_apartar > 0 && d.por_apartar < d.saldo) {
                  <button class="b" (click)="abrirAbono(d, d.por_apartar)">Abonar lo vendido · {{ pesos(d.por_apartar) }}</button>
                }
                <button class="b b-ok" (click)="abrirAbono(d, d.saldo)">Pagar todo · {{ pesos(d.saldo) }}</button>
              </div>
            }

            @if (d.abonos.length) {
              <ul class="abonos">
                @for (a of d.abonos; track a.id) {
                  <li [class.anulado]="a.anulado">
                    <div>{{ fecha(a.fecha) }} · {{ metodo(a.metodo) }}@if (a.comprobantes.length) { · <button type="button" class="link" (click)="verSoporte(a)">ver soporte</button>}
                      <small>{{ a.quien || '' }}{{ a.nota ? ' · ' + a.nota : '' }}{{ a.anulado ? ' · anulado' : '' }}</small></div>
                    <span class="der">{{ pesos(a.valor) }}@if (!a.anulado) { <button type="button" class="link peligro" (click)="anularAbono(a)">Anular</button>}</span>
                  </li>
                }
              </ul>
            }
            @if (d.estado !== 'anulada') {
              <button type="button" class="link peligro" style="align-self: flex-start" (click)="anularDeuda(d)">Anular esta deuda</button>
            }
          </article>
        } @empty {
          @if (cargando()) { <app-esqueleto forma="lista" [filas]="3"></app-esqueleto> }
          @else { <p class="vacio-txt">{{ filtro() === 'abiertas' ? 'No hay deudas abiertas. Para registrar mercancía fiada, márcala como "Fiado" al registrar la compra en Inventario, o toca Nueva deuda.' : 'No hay deudas aquí.' }}</p> }
        }
      </div>
      <p class="ayuda" style="margin: 0">¿Cómo se sabe lo vendido? Se cuentan las unidades de cada producto entregadas después de la compra, descontando el stock que ya había antes (se vende primero lo viejo). Para que sea exacto, los productos deben tener <a routerLink="/app/inventario">inventario controlado</a>.</p>
    </div>

    @if (abonando(); as d) {
      <button class="velo" aria-label="Cerrar" (click)="abonando.set(null)"></button>
      <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-abono">
        <div class="hoja-head"><h2 id="t-abono">Abonar a {{ d.proveedor }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="abonando.set(null)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <p class="ayuda" style="margin: 0">Saldo: <strong>{{ pesos(d.saldo) }}</strong> de {{ pesos(d.total) }}.</p>
          <div class="campo"><label for="ab-v">Valor del abono</label><input id="ab-v" pesos [(ngModel)]="valor" placeholder="$ 0" /></div>
          <div class="atajos">
            @if (d.por_apartar > 0) { <button type="button" (click)="valor = d.por_apartar">Lo vendido · {{ pesos(d.por_apartar) }}</button> }
            <button type="button" (click)="valor = mitad(d.saldo)">La mitad · {{ pesos(mitad(d.saldo)) }}</button>
            <button type="button" (click)="valor = d.saldo">Todo · {{ pesos(d.saldo) }}</button>
          </div>
          <div class="campo"><span class="etq">¿Cómo le pagaste?</span>
            <div class="metodos">@for (m of metodos; track m.id) { <button type="button" [class.on]="metodoSel() === m.id" (click)="metodoSel.set(m.id)">{{ m.label }}</button> }</div>
          </div>
          <div class="campo"><label for="ab-f">Fecha</label><input id="ab-f" type="date" [max]="hoy" [(ngModel)]="fechaAbono" /></div>
          <app-comprobantes-input titulo="Soporte del abono" pista="Pantallazo de la transferencia o foto del recibo." [rutas]="soportes()" (cambio)="soportes.set($event)"></app-comprobantes-input>
          <div class="campo"><label for="ab-n">Nota (opcional)</label><input id="ab-n" maxlength="300" [(ngModel)]="nota" placeholder="Ej: abono de la semana" /></div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="abonando.set(null)">Cancelar</button>
          <button class="b b-ok" (click)="guardarAbono()" [disabled]="ocupado()">{{ ocupado() ? 'Guardando…' : (valor || 0) >= d.saldo ? 'Pagar todo · ' + pesos(d.saldo) : 'Abonar ' + pesos(valor || 0) }}</button>
        </div>
      </div>
    }

    @if (nueva()) {
      <button class="velo" aria-label="Cerrar" (click)="nueva.set(false)"></button>
      <div class="hoja" role="dialog" aria-labelledby="t-nueva">
        <div class="hoja-head"><h2 id="t-nueva">Nueva deuda</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="nueva.set(false)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <div class="tipo-deuda" role="group" aria-label="Tipo de deuda">
            <button type="button" [class.on]="deCompra()" (click)="deCompra.set(true)">Mercancía fiada</button>
            <button type="button" [class.on]="!deCompra()" (click)="deCompra.set(false); compraSel.set(null)">Otra deuda</button>
          </div>
          @if (deCompra()) {
            <p class="ayuda" style="margin: 0">Elige la compra que registraste en Inventario. Así la app cuenta cuánto de esa mercancía ya se vendió.</p>
            <ul class="compras">
              @for (c of comprasLibres(); track c.id) {
                <li><button type="button" [class.on]="compraSel()?.id === c.id" (click)="elegirCompra(c)">
                  <strong>{{ c.proveedor }} · {{ pesos(c.total) }}</strong><small>{{ fecha(c.fecha) }} · {{ c.productos || '' }}</small></button></li>
              } @empty {
                <li><p class="vacio-txt" style="padding: 10px 0">No hay compras sin deuda. Primero registra la compra en <a routerLink="/app/inventario" (click)="nueva.set(false)">Inventario → Registrar compra</a> (ahí mismo puedes marcarla como Fiado).</p></li>
              }
            </ul>
          }
          <div class="campo"><label for="nd-p">¿A quién se le debe?</label><input id="nd-p" maxlength="120" [(ngModel)]="nProveedor" placeholder="Ej: Importadora XYZ" /></div>
          <div class="campo"><label for="nd-c">Concepto</label><input id="nd-c" maxlength="300" [(ngModel)]="nConcepto" [placeholder]="deCompra() ? 'Mercancía fiada' : 'Ej: préstamo, arriendo atrasado'" /></div>
          <div class="fila-campos">
            <div class="campo"><label for="nd-t">Valor total</label><input id="nd-t" pesos [(ngModel)]="nTotal" placeholder="$ 0" /></div>
            <div class="campo"><label for="nd-v">Vence (opcional)</label><input id="nd-v" type="date" [(ngModel)]="nVence" /></div>
          </div>
          @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="nueva.set(false)">Cancelar</button>
          <button class="b b-pri" (click)="crear()" [disabled]="ocupado() || (deCompra() && !compraSel())">{{ ocupado() ? 'Guardando…' : 'Registrar deuda' }}</button>
        </div>
      </div>
    }
  `,
})
export class DeudasPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private visor = inject(VisorService);

  filtros: { id: Filtro; label: string }[] = [
    { id: 'abiertas', label: 'Por pagar' },
    { id: 'pagadas', label: 'Pagadas' },
    { id: 'todas', label: 'Todas' },
  ];
  metodos = METODOS;
  filtro = signal<Filtro>('abiertas');
  deudas = signal<Deuda[]>([]);
  cargando = signal(true);
  ocupado = signal(false);
  error = signal('');
  abierta = signal<number | null>(null);
  readonly hoy = hoyColombiaISO();
  pesos = pesos;

  // Abono
  abonando = signal<Deuda | null>(null);
  valor: number | null = null;
  metodoSel = signal<Metodo>('transferencia');
  fechaAbono = this.hoy;
  soportes = signal<string[]>([]);
  nota = '';

  // Nueva deuda
  nueva = signal(false);
  deCompra = signal(true);
  comprasLibres = signal<CompraLibre[]>([]);
  compraSel = signal<CompraLibre | null>(null);
  nProveedor = '';
  nConcepto = '';
  nTotal: number | null = null;
  nVence = '';

  totales = computed(() => {
    const ab = this.deudas().filter((d) => d.estado === 'abierta');
    const venc = ab.filter((d) => d.vence && d.vence < this.hoy);
    return {
      abiertas: ab.length,
      saldo: ab.reduce((s, d) => s + Number(d.saldo), 0),
      vencidas: venc.length,
      saldoVencido: venc.reduce((s, d) => s + Number(d.saldo), 0),
      porApartar: ab.reduce((s, d) => s + Number(d.por_apartar || 0), 0),
    };
  });

  constructor() {
    addIcons({ addCircleOutline, chevronDownOutline, chevronUpOutline, closeOutline });
  }

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const { data, error } = await this.sb.client.rpc('deudas_lista', { p_estado: this.filtro() });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.deudas.set((data ?? []) as Deuda[]);
  }

  cambiarFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.cargando.set(true);
    this.deudas.set([]);
    void this.cargar();
  }

  alternar(id: number): void {
    this.abierta.set(this.abierta() === id ? null : id);
  }

  pct(a: number, b: number | null): number {
    return b ? Math.min(100, Math.round((Number(a) / Number(b)) * 100)) : 0;
  }

  mitad(n: number): number {
    return Math.round(Number(n) / 2 / 100) * 100;
  }

  fecha(d: string): string {
    return formatoFechaCO(d + 'T12:00:00-05:00', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  metodo(m: string): string {
    return METODOS.find((x) => x.id === m)?.label ?? m;
  }

  private diasPara(d: string): number {
    return Math.round((new Date(d + 'T12:00:00Z').getTime() - new Date(this.hoy + 'T12:00:00Z').getTime()) / 864e5);
  }

  estadoClase(d: Deuda): string {
    if (d.estado === 'pagada') return 'pagada';
    if (!d.vence) return '';
    const n = this.diasPara(d.vence);
    return n < 0 ? 'vencida' : n <= 3 ? 'pronto' : '';
  }

  estadoTexto(d: Deuda): string {
    if (d.estado === 'pagada') return 'Pagada ✓';
    if (d.estado === 'anulada') return 'Anulada';
    if (!d.vence) return 'Sin fecha';
    const n = this.diasPara(d.vence);
    if (n < 0) return `Vencida hace ${-n} ${n === -1 ? 'día' : 'días'}`;
    if (n === 0) return 'Vence hoy';
    return n === 1 ? 'Vence mañana' : `Vence en ${n} días`;
  }

  abrirAbono(d: Deuda, valor: number | null): void {
    this.valor = valor;
    this.metodoSel.set('transferencia');
    this.fechaAbono = this.hoy;
    this.soportes.set([]);
    this.nota = valor !== null && valor === d.por_apartar && valor < d.saldo ? 'Abono de lo vendido' : '';
    this.error.set('');
    this.abonando.set(d);
  }

  async guardarAbono(): Promise<void> {
    const d = this.abonando();
    if (!d) return;
    const v = Math.round(Number(this.valor) || 0);
    if (v <= 0) return this.error.set('Escribe el valor del abono.');
    if (v > Number(d.saldo)) return this.error.set(`Es más de lo que se debe (saldo ${pesos(d.saldo)}).`);
    this.ocupado.set(true);
    const { data, error } = await this.sb.client.rpc('abonar_deuda', {
      p_deuda: d.id, p_valor: v, p_metodo: this.metodoSel(), p_comprobantes: this.soportes(), p_nota: this.nota.trim(), p_fecha: this.fechaAbono || this.hoy,
    });
    this.ocupado.set(false);
    if (error) return this.error.set(mensajeError(error));
    const r = data as { saldo: number; pagada: boolean };
    this.toast.ok(r.pagada ? `Deuda con ${d.proveedor} pagada ✓` : `Abono de ${pesos(v)} registrado · queda ${pesos(r.saldo)}`);
    this.abonando.set(null);
    await this.cargar();
  }

  async anularAbono(a: Abono): Promise<void> {
    if (!confirm(`¿Anular el abono de ${pesos(a.valor)} del ${this.fecha(a.fecha)}? Vuelve a sumar a lo que se debe.`)) return;
    const { error } = await this.sb.client.rpc('anular_abono', { p_abono: a.id });
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok('Abono anulado');
    await this.cargar();
  }

  async anularDeuda(d: Deuda): Promise<void> {
    if (!confirm(`¿Anular la deuda con ${d.proveedor} (${pesos(d.total)})? Úsalo solo si se registró por error.`)) return;
    const { error } = await this.sb.client.rpc('anular_deuda', { p_deuda: d.id });
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok('Deuda anulada');
    await this.cargar();
  }

  async abrirNueva(): Promise<void> {
    this.error.set('');
    this.deCompra.set(true);
    this.compraSel.set(null);
    this.nProveedor = '';
    this.nConcepto = '';
    this.nTotal = null;
    this.nVence = '';
    this.nueva.set(true);
    const { data } = await this.sb.client.rpc('compras_sin_deuda');
    this.comprasLibres.set((data ?? []) as CompraLibre[]);
    if (!this.comprasLibres().length) this.deCompra.set(false);
  }

  elegirCompra(c: CompraLibre): void {
    this.compraSel.set(c);
    this.nProveedor = c.proveedor;
    this.nTotal = Number(c.total);
    if (!this.nConcepto) this.nConcepto = 'Mercancía fiada';
  }

  async crear(): Promise<void> {
    if (!this.nProveedor.trim()) return this.error.set('Escribe a quién se le debe.');
    if (!(Number(this.nTotal) > 0)) return this.error.set('Escribe el valor de la deuda.');
    this.ocupado.set(true);
    const { error } = await this.sb.client.rpc('crear_deuda', {
      p_proveedor: this.nProveedor.trim(), p_concepto: this.nConcepto.trim(), p_total: Number(this.nTotal), p_fecha: this.compraSel()?.fecha ?? this.hoy,
      p_vence: this.nVence || null, p_compra: this.deCompra() ? this.compraSel()?.id ?? null : null,
    });
    this.ocupado.set(false);
    if (error) return this.error.set(mensajeError(error));
    this.toast.ok(`Deuda con ${this.nProveedor.trim()} registrada`);
    this.nueva.set(false);
    if (this.filtro() !== 'abiertas') this.filtro.set('abiertas');
    await this.cargar();
  }

  verSoporte(a: Abono): void {
    void urlsComprobantes(this.sb.client, a.comprobantes).then((urls) =>
      this.visor.abrir(urls.map((url) => ({ url, titulo: `Abono · ${pesos(a.valor)} · ${this.fecha(a.fecha)}` })), 0));
  }
}
