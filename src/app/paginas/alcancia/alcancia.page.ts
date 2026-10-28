import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowDownOutline, arrowUpOutline, closeOutline, removeCircleOutline, settingsOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { VentaLocalDetalleComponent } from '../ventas-local/venta-local-detalle.component';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { diaColombiaDe, formatoFechaCO, formatoHoraCO, hoyColombiaISO } from '../../shared/fecha-colombia';
import { diaLargo, sumarDias } from '../../shared/rango/rango.component';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

interface Movimiento {
  tipo: 'entrada' | 'salida';
  fecha: string;
  monto: number;
  pedido_id: number | null;
  vendedora: string | null;
  concepto: string | null;
  quien: string | null;
}

interface Datos {
  saldo: number;
  aporte: number;
  entradas: number;
  ventas: number;
  salidas: number;
  por_vendedora: { nombre: string; avatar_url: string | null; ventas: number; total: number }[];
  movimientos: Movimiento[];
}

type Atajo = 'hoy' | '7' | 'mes' | 'mes_pasado' | null;

/**
 * Alcancía del punto físico: de cada venta en el local asignada a una vendedora
 * se le aparta un aporte (por defecto $2.000) de su ganancia. Aquí se ve lo que
 * hay, lo que entró por vendedora, y el admin registra los retiros (gastos).
 */
@Component({
  selector: 'app-alcancia',
  standalone: true,
  imports: [EsqueletoComponent, FormsModule, IonIcon, AvatarComponent, VentaLocalDetalleComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1000px; }
      .head .acciones { display: flex; gap: 8px; }
      .head p.sub { margin: 4px 0 0; font-size: 13px; color: var(--text-soft); }

      /* Saldo: el "total" del tiquete */
      .saldo { position: relative; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 14px; padding: 22px 24px;
        border: 1px solid color-mix(in srgb, var(--oro) 40%, var(--border)); border-radius: var(--radius-lg); background: var(--oro-wash); overflow: hidden; }
      .saldo::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 6px;
        background: radial-gradient(circle at 6px 6px, var(--bg) 3px, transparent 3.5px) 0 0 / 12px 12px repeat-x; }
      .saldo small { display: block; font-size: 11px; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--oro-texto); }
      .saldo strong { display: block; margin-top: 4px; font-family: var(--mono-font); font-size: 40px; font-weight: 650; letter-spacing: -0.03em; line-height: 1; }
      .saldo .nota { margin: 8px 0 0; font-size: 13px; color: var(--text-soft); }
      .saldo .nota button { margin-left: 6px; padding: 0; border: 0; background: none; color: var(--oro-texto); font: inherit; font-weight: 600; text-decoration: underline; cursor: pointer; }

      .rango { display: flex; gap: 10px 14px; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; }
      .fechas { display: flex; gap: 10px; align-items: flex-end; }
      .fechas label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text-soft); }
      .fechas input { width: 150px; }
      .periodo-txt { margin: 0; width: 100%; font-size: 13px; color: var(--text-soft); }
      .periodo-txt::first-letter { text-transform: uppercase; }
      .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); transition: opacity 150ms; }
      .kpis.cargando { opacity: 0.55; }
      .entra { color: var(--efectivo-texto); }
      .sale { color: var(--danger); }

      .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr); gap: 16px; align-items: start; }
      .vend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
      .vend li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 4px 10px; align-items: center; }
      .vend .nom { font-size: 14px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vend .nom small { display: block; font-size: 12px; font-weight: 400; color: var(--text-muted); }
      .vend .val { font-family: var(--mono-font); font-size: 14px; font-weight: 650; }
      .vend .pista { grid-column: 2 / -1; height: 4px; border-radius: 2px; background: var(--selected); overflow: hidden; }
      .vend .pista span { display: block; height: 100%; background: var(--oro); border-radius: 2px; }

      .movs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; max-height: 560px; overflow-y: auto; }
      .mov { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 10px; align-items: center; width: calc(100% + 16px); margin: 0 -8px; padding: 10px 8px;
        border: 0; border-bottom: var(--perfora); background: none; color: inherit; font: inherit; text-align: left; border-radius: var(--radius); }
      li:last-child .mov { border-bottom: 0; }
      button.mov { cursor: pointer; }
      @media (hover: hover) { button.mov:hover { background: var(--hover); } }
      .mov .ico { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; font-size: 16px; }
      .mov .ico.entrada { background: color-mix(in srgb, var(--st-entregado) 14%, transparent); color: var(--efectivo-texto); }
      .mov .ico.salida { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
      .mov .txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .mov .t1 { font-size: 14px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mov .t2 { font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mov .monto { font-family: var(--mono-font); font-size: 14px; font-weight: 650; white-space: nowrap; }
      .vacio-txt { margin: 0; padding: 12px 0 4px; text-align: center; font-size: 13.5px; color: var(--text-soft); }
      .hoja-centro .hoja-body { gap: 14px; }
      .hoja-head h2 { margin: 0 auto 0 0; }

      @media (max-width: 860px) { .cols { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 640px) {
        .saldo { padding: 18px; }
        .saldo strong { font-size: 32px; }
        .head .acciones { width: 100%; }
        .head .acciones .b { flex: 1; justify-content: center; }
        .rango .segmented { width: 100%; }
        .fechas { width: 100%; display: grid; grid-template-columns: 1fr 1fr; }
        .fechas input { width: 100%; min-width: 0; }
        .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .kpis .kpi-valor { font-size: 15px; }
      }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><h1>Servicio local</h1><p class="sub">Para mantener el punto físico</p></div>
        @if (esAdmin()) {
          <div class="acciones"><button class="b" (click)="abrirRetiro()" [disabled]="!d() || d()!.saldo <= 0"><ion-icon name="remove-circle-outline"></ion-icon>Registrar retiro</button></div>
        }
      </div>

      <div class="saldo">
        <div>
          <small>Disponible</small>
          <strong>{{ d() ? pesos(d()!.saldo) : '…' }}</strong>
          <p class="nota">Cada venta del local a nombre de una vendedora aporta <strong style="display: inline; font-size: inherit; font-family: inherit">{{ pesos(d()?.aporte ?? 2000) }}</strong> de su ganancia.
            @if (esAdmin()) { <button type="button" (click)="abrirAporte()">Cambiar</button> }</p>
        </div>
      </div>

      <div class="rango">
        <div class="segmented" role="group" aria-label="Periodo">
          @for (a of atajos; track a.id) {
            <button [class.on]="atajo() === a.id" [attr.aria-pressed]="atajo() === a.id" (click)="usarAtajo(a.id)">{{ a.label }}</button>
          }
        </div>
        <div class="fechas">
          <label>Desde<input class="inp inp-chico num" type="date" [(ngModel)]="desde" [max]="hoy" (change)="fechasAMano()" /></label>
          <label>Hasta<input class="inp inp-chico num" type="date" [(ngModel)]="hasta" [max]="hoy" (change)="fechasAMano()" /></label>
        </div>
        <p class="periodo-txt">{{ etiqueta() }}</p>
      </div>

      <div class="kpis" role="list" [class.cargando]="cargando()">
        <div class="kpi" role="listitem"><span class="kpi-label">Entró</span><span class="kpi-valor num entra">{{ pesos(d()?.entradas) }}</span>
          <span class="kpi-nota">{{ numero(d()?.ventas) }} {{ d()?.ventas === 1 ? 'venta' : 'ventas' }}</span></div>
        <div class="kpi" role="listitem"><span class="kpi-label">Salió</span><span class="kpi-valor num sale">{{ pesos(d()?.salidas) }}</span>
          <span class="kpi-nota">Retiros</span></div>
        <div class="kpi kpi-principal" role="listitem"><span class="kpi-label">Neto</span><span class="kpi-valor num">{{ pesos(neto()) }}</span>
          <span class="kpi-nota">En el periodo</span></div>
      </div>

      <div class="cols">
        <section class="panel" aria-labelledby="t-vend">
          <div class="panel-head"><div><h2 id="t-vend">Por vendedora</h2><p class="panel-sub">Lo que aportó cada una</p></div></div>
          @if (d()?.por_vendedora?.length) {
            <ol class="vend">
              @for (v of d()!.por_vendedora; track v.nombre) {
                <li>
                  <app-avatar [nombre]="v.nombre" [foto]="v.avatar_url" [tam]="32"></app-avatar>
                  <span class="nom">{{ v.nombre }}<small>{{ v.ventas }} {{ v.ventas === 1 ? 'venta' : 'ventas' }} en el local</small></span>
                  <span class="val">{{ pesos(v.total) }}</span>
                  <span class="pista"><span [style.width.%]="(v.total / maxVend()) * 100"></span></span>
                </li>
              }
            </ol>
          } @else {
            @if (cargando()) { <app-esqueleto forma="lista" [filas]="4"></app-esqueleto> } @else { <p class="vacio-txt">{{ 'Sin aportes en este periodo.' }}</p> }
          }
        </section>

        <section class="panel" aria-labelledby="t-movs">
          <div class="panel-head"><div><h2 id="t-movs">Movimientos</h2><p class="panel-sub">Entradas por venta y retiros</p></div></div>
          @if (d()?.movimientos?.length) {
            <ul class="movs">
              @for (m of d()!.movimientos; track $index) {
                <li>
                  @if (m.tipo === 'entrada') {
                    <button type="button" class="mov" (click)="abierta.set(m.pedido_id)">
                      <span class="ico entrada" aria-hidden="true"><ion-icon name="arrow-down-outline"></ion-icon></span>
                      <span class="txt"><span class="t1">Venta #{{ m.pedido_id }} · {{ m.vendedora || '—' }}</span><span class="t2">{{ cuando(m.fecha) }}</span></span>
                      <span class="monto entra">+{{ pesos(m.monto) }}</span>
                    </button>
                  } @else {
                    <div class="mov">
                      <span class="ico salida" aria-hidden="true"><ion-icon name="arrow-up-outline"></ion-icon></span>
                      <span class="txt"><span class="t1">{{ m.concepto }}</span><span class="t2">Retiro · {{ m.quien || '—' }} · {{ cuando(m.fecha) }}</span></span>
                      <span class="monto sale">−{{ pesos(m.monto) }}</span>
                    </div>
                  }
                </li>
              }
            </ul>
          } @else {
            @if (cargando()) { <app-esqueleto forma="lista" [filas]="4"></app-esqueleto> } @else { <p class="vacio-txt">{{ 'No hubo movimientos en este periodo.' }}</p> }
          }
        </section>
      </div>
    </div>

    @if (abierta(); as id) {
      <app-venta-local-detalle [pedidoId]="id" (cerrar)="abierta.set(null)" (cambiado)="cargar()"></app-venta-local-detalle>
    }

    @if (retiro()) {
      <button class="velo" aria-label="Cerrar" (click)="retiro.set(false)"></button>
      <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-retiro">
        <div class="hoja-head"><h2 id="t-retiro">Retiro del servicio local</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="retiro.set(false)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <p class="ayuda" style="margin: 0">Hay {{ pesos(d()?.saldo) }} en el servicio local.</p>
          <div class="campo"><label for="rm">Valor</label><input id="rm" class="inp num" type="number" inputmode="numeric" min="0" step="1000" [(ngModel)]="monto" /></div>
          <div class="campo"><label for="rc">¿En qué se usó?</label><input id="rc" class="inp" maxlength="200" [(ngModel)]="concepto" placeholder="Ej: bombillos, aseo, arreglo de la vitrina" /></div>
          @if (errorForm()) { <p class="error" role="alert">{{ errorForm() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="retiro.set(false)">Cancelar</button>
          <button class="b b-pri" (click)="guardarRetiro()" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Registrar retiro' }}</button>
        </div>
      </div>
    }

    @if (editAporte()) {
      <button class="velo" aria-label="Cerrar" (click)="editAporte.set(false)"></button>
      <div class="hoja hoja-centro" role="dialog" aria-labelledby="t-aporte">
        <div class="hoja-head"><h2 id="t-aporte">Aporte por venta</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="editAporte.set(false)"><ion-icon name="close-outline"></ion-icon></button></div>
        <div class="hoja-body">
          <p class="ayuda" style="margin: 0">Lo que se le descuenta a la vendedora de su ganancia en cada venta del local, para el servicio local. Aplica a las ventas nuevas.</p>
          <div class="campo"><label for="ap">Valor</label><input id="ap" class="inp num" type="number" inputmode="numeric" min="0" step="500" [(ngModel)]="nuevoAporte" /></div>
          @if (errorForm()) { <p class="error" role="alert">{{ errorForm() }}</p> }
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="editAporte.set(false)">Cancelar</button>
          <button class="b b-pri" (click)="guardarAporte()" [disabled]="guardando()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </div>
    }
  `,
})
export class AlcanciaPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  readonly hoy = hoyColombiaISO();
  readonly atajos: { id: Exclude<Atajo, null>; label: string }[] = [
    { id: 'hoy', label: 'Hoy' },
    { id: '7', label: '7 días' },
    { id: 'mes', label: 'Este mes' },
    { id: 'mes_pasado', label: 'Mes pasado' },
  ];
  atajo = signal<Atajo>('mes');
  desde = this.hoy.slice(0, 8) + '01';
  hasta = this.hoy;
  etiqueta = signal('');

  d = signal<Datos | null>(null);
  cargando = signal(true);
  abierta = signal<number | null>(null);
  retiro = signal(false);
  editAporte = signal(false);
  guardando = signal(false);
  errorForm = signal('');
  monto: number | null = null;
  concepto = '';
  nuevoAporte = 2000;

  esAdmin = computed(() => this.sb.tiene('admin'));
  neto = computed(() => Number(this.d()?.entradas ?? 0) - Number(this.d()?.salidas ?? 0));
  maxVend = computed(() => Math.max(1, ...(this.d()?.por_vendedora ?? []).map((v) => Number(v.total))));

  pesos = pesos;
  numero = numero;
  private consulta = 0;
  private dejar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ arrowDownOutline, arrowUpOutline, closeOutline, removeCircleOutline, settingsOutline });
  }

  ngOnInit(): void {
    this.usarAtajo('mes');
    // Una venta nueva en el local suma de una vez
    this.dejar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 700);
    });
  }

  ngOnDestroy(): void {
    this.dejar?.();
    clearTimeout(this.timer);
  }

  usarAtajo(a: Exclude<Atajo, null>): void {
    const inicioMes = this.hoy.slice(0, 8) + '01';
    if (a === 'hoy') [this.desde, this.hasta] = [this.hoy, this.hoy];
    else if (a === '7') [this.desde, this.hasta] = [sumarDias(this.hoy, -6), this.hoy];
    else if (a === 'mes') [this.desde, this.hasta] = [inicioMes, this.hoy];
    else {
      const fin = sumarDias(inicioMes, -1);
      [this.desde, this.hasta] = [fin.slice(0, 8) + '01', fin];
    }
    this.atajo.set(a);
    void this.cargar();
  }

  fechasAMano(): void {
    if (!this.desde || !this.hasta) return;
    if (this.desde > this.hasta) [this.desde, this.hasta] = [this.hasta, this.desde];
    if (sumarDias(this.desde, 400) < this.hasta) this.desde = sumarDias(this.hasta, -400);
    this.atajo.set(null);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    const n = ++this.consulta;
    this.etiqueta.set(this.desde === this.hasta ? diaLargo(this.desde) : `${diaLargo(this.desde)} – ${diaLargo(this.hasta)}`);
    this.cargando.set(true);
    const { data, error } = await this.sb.client.rpc('alcancia', { p_desde: this.desde, p_hasta: this.hasta });
    if (n !== this.consulta) return;
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.d.set(data as Datos);
  }

  abrirRetiro(): void {
    this.monto = null;
    this.concepto = '';
    this.errorForm.set('');
    this.retiro.set(true);
  }

  async guardarRetiro(): Promise<void> {
    const monto = Number(this.monto) || 0;
    if (monto <= 0) return this.errorForm.set('Escribe el valor del retiro.');
    if (!this.concepto.trim()) return this.errorForm.set('Escribe en qué se usó la plata.');
    if (monto > Number(this.d()?.saldo ?? 0)) return this.errorForm.set(`En el servicio local solo hay ${pesos(this.d()?.saldo)}.`);
    this.guardando.set(true);
    const { error } = await this.sb.client.rpc('alcancia_retirar', { p_monto: monto, p_concepto: this.concepto.trim() });
    this.guardando.set(false);
    if (error) return this.errorForm.set(mensajeError(error));
    this.toast.ok(`Retiro de ${pesos(monto)} registrado`);
    this.retiro.set(false);
    await this.cargar();
  }

  abrirAporte(): void {
    this.nuevoAporte = Number(this.d()?.aporte ?? 2000);
    this.errorForm.set('');
    this.editAporte.set(true);
  }

  async guardarAporte(): Promise<void> {
    const v = Math.round(Number(this.nuevoAporte));
    if (!(v >= 0 && v <= 100000)) return this.errorForm.set('Escribe un valor entre $0 y $100.000.');
    this.guardando.set(true);
    const { data: fila } = await this.sb.client.from('configuracion').select('id').limit(1).maybeSingle();
    const { error } = fila
      ? await this.sb.client.from('configuracion').update({ aporte_alcancia: v, updated_at: new Date().toISOString() }).eq('id', fila.id)
      : { error: new Error('No hay configuración guardada todavía') };
    this.guardando.set(false);
    if (error) return this.errorForm.set(mensajeError(error));
    this.toast.ok(`Aporte por venta: ${pesos(v)}`);
    this.editAporte.set(false);
    await this.cargar();
  }

  /** "hoy 8:32 p. m.", "ayer 3:10 p. m." o "12 oct 3:10 p. m." */
  cuando(iso: string): string {
    const dia = diaColombiaDe(iso);
    const hora = formatoHoraCO(iso);
    if (dia === this.hoy) return `hoy ${hora}`;
    if (dia === sumarDias(this.hoy, -1)) return `ayer ${hora}`;
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + hora;
  }
}
