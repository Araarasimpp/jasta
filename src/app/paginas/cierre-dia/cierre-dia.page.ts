import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO, formatoHoraCO, hoyColombiaISO } from '../../shared/fecha-colombia';

interface PlataCuadre {
  id: number; mensajero: string | null; pedidos: number; fecha_entrega: string; efectivo: number; transferencia: number;
  recibio: string | null; recibio_id: number | null; hora: string; comisiones: number; ganancia: number; en_cierre: string | null;
}
interface PlataCaja {
  fecha: string; efectivo: number; recibio: string | null; hora: string; comisiones: number; ganancia: number; en_cierre: string | null;
}
interface Cierre {
  id: number; fecha: string; admin_id: number; admin_nombre: string; cuadres: number[]; cajas: string[]; efectivo: number; transferencia: number;
  comisiones: number; ganancia: number; ahorro_pct: number; ahorro: number; gastos: number; libre: number; nota: string | null; created_at: string;
}
interface Datos {
  cuadres: PlataCuadre[];
  cajas: PlataCaja[];
  dia: { pedidos: number; ventas: number; ganancia: number; comisiones: number };
  gastos: number;
  mi_cierre: Cierre | null;
  ahorro_total: number;
  ahorro_mio: number;
}

/** Una fila para elegir: un cuadre de un mensajero o la caja del local */
interface Fila {
  clave: string; titulo: string; detalle: string; recibio: string; hora: string; esMio: boolean;
  efectivo: number; transferencia: number; comisiones: number; ganancia: number; bloqueada: string | null;
}

const normal = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Cierre del día del administrador: marca la plata que recibió él mismo (a veces la recibe
 * otra persona), y la app le dice cuánto separar para las comisiones de las vendedoras y
 * cuánto guardar de ahorro (10 % de la ganancia de esa plata, por defecto).
 */
@Component({
  selector: 'app-cierre-dia',
  standalone: true,
  imports: [FormsModule, EsqueletoComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 920px; }
      .dia-sel { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .dia-sel input { max-width: 180px; }
      .ayuda { margin: 0; font-size: 13.5px; color: var(--text-soft); }
      .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      .fila { display: grid; grid-template-columns: 26px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 14px;
        border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); cursor: pointer; }
      .fila.on { border-color: var(--efectivo); background: color-mix(in srgb, var(--efectivo) 7%, var(--surface)); }
      .fila.bloq { cursor: default; opacity: .6; }
      .fila input { width: 20px; height: 20px; margin: 0; accent-color: var(--efectivo); }
      .fila .t1 { display: block; font-size: 14.5px; font-weight: 650; }
      .fila .t2 { display: block; font-size: 12.5px; color: var(--text-muted); }
      .fila .otro { color: var(--st-pendiente-text); font-weight: 600; }
      .fila .cifras { text-align: right; font-family: var(--mono-font); font-size: 14px; font-weight: 650; white-space: nowrap; }
      .fila .cifras small { display: block; white-space: normal; font-family: inherit; font-size: 11.5px; font-weight: 500; color: var(--text-muted); }
      .botones { display: flex; gap: 8px; flex-wrap: wrap; }
      .link { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }

      .recibo { position: relative; padding: 18px 22px 22px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); overflow: hidden; }
      .recibo::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 6px;
        background: radial-gradient(circle at 6px 6px, var(--bg) 3px, transparent 3.5px) 0 0 / 12px 12px repeat-x; }
      .recibo h2 { margin: 0 0 10px; font-size: 12px; font-weight: 650; letter-spacing: .1em; text-transform: uppercase; color: var(--text-muted); text-align: center; }
      .renglon { display: flex; align-items: baseline; gap: 10px; padding: 8px 0; font-size: 15px; }
      .renglon .lbl { min-width: 0; }
      .renglon .lbl small { display: block; font-size: 12px; color: var(--text-muted); font-weight: 400; }
      .renglon .punteado { flex: 1; min-width: 12px; border-bottom: 1px dotted var(--border-strong); transform: translateY(-4px); }
      .renglon .val { font-family: var(--mono-font); font-size: 17px; font-weight: 600; white-space: nowrap; }
      .renglon.sub { border-top: 1px solid var(--border); margin-top: 4px; padding-top: 12px; font-weight: 650; }
      .renglon.separa .val { color: var(--info-text); }
      .renglon.ahorro .val { color: var(--st-pendiente-text); }
      .renglon.total { margin-top: 6px; padding-top: 12px; border-top: 3px double var(--text); font-weight: 650; }
      .renglon.total .val { font-size: 24px; font-weight: 700; color: var(--efectivo-texto); }
      .pct { display: inline-flex; align-items: center; gap: 4px; margin-left: 6px; }
      .pct input { width: 58px; height: 30px; padding: 0 6px; text-align: right; }
      .sobres { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
      .sobre { padding: 14px 16px; border-radius: var(--radius); border: 1px dashed var(--border-strong); background: var(--surface-2); }
      .sobre small { display: block; font-size: 12px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
      .sobre strong { display: block; margin-top: 4px; font-family: var(--mono-font); font-size: 22px; }
      .sobre span { display: block; font-size: 12.5px; color: var(--text-soft); margin-top: 2px; }
      .sobre.com strong { color: var(--info-text); }
      .sobre.aho strong { color: var(--st-pendiente-text); }
      .sobre.lib strong { color: var(--efectivo-texto); }
      .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
      .kpi { padding: 12px 14px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); }
      .kpi small { display: block; font-size: 12px; color: var(--text-muted); }
      .kpi strong { font-family: var(--mono-font); font-size: 17px; }
      .hist { list-style: none; margin: 0; padding: 0; }
      .hist li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 10px 0; border-bottom: var(--perfora); font-size: 13.5px; }
      .hist li:last-child { border-bottom: 0; }
      .hist .t2 { display: block; font-size: 12px; color: var(--text-muted); }
      .hist .v { text-align: right; font-family: var(--mono-font); font-weight: 650; white-space: nowrap; }
      .hist .v small { display: block; font-family: inherit; font-size: 11.5px; font-weight: 500; color: var(--st-pendiente-text); }
      textarea.inp { width: 100%; min-height: 60px; resize: vertical; }
      .vacio-txt { margin: 0; padding: 12px 0; text-align: center; font-size: 13.5px; color: var(--text-soft); }
      @media (max-width: 640px) {
        .renglon.total .val { font-size: 21px; } .recibo { padding: 16px; }
        .fila { grid-template-columns: 26px minmax(0, 1fr); }
        .fila .cifras { grid-column: 2; text-align: left; }
      }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">{{ etiquetaDia() }}</p><h1>Mi cierre del día</h1></div>
        <div class="dia-sel">
          <input class="inp" type="date" [max]="hoy" [ngModel]="fecha()" (ngModelChange)="cambiarDia($event)" aria-label="Día del cierre" />
          @if (fecha() !== hoy) { <button class="b" type="button" (click)="cambiarDia(hoy)">Hoy</button> }
        </div>
      </div>

      @if (cargando() && !d()) {
        <app-esqueleto forma="tarjetas" [filas]="3"></app-esqueleto>
      } @else if (d(); as datos) {
        @if (datos.mi_cierre; as c) {
          <!-- Ya cerró este día: se muestra lo que separó -->
          <section class="recibo" aria-labelledby="t-hecho">
            <h2 id="t-hecho">Día cerrado · {{ hora(c.created_at) }}</h2>
            <div class="renglon"><span class="lbl">Plata que recibiste<small>{{ c.cuadres.length }} {{ c.cuadres.length === 1 ? 'cuadre' : 'cuadres' }}@if (c.cajas.length) { y la caja del local }</small></span><span class="punteado"></span><span class="val">{{ pesos(c.efectivo + c.transferencia) }}</span></div>
            <div class="renglon separa"><span class="lbl">Comisiones de las vendedoras</span><span class="punteado"></span><span class="val">− {{ pesos(c.comisiones) }}</span></div>
            <div class="renglon ahorro"><span class="lbl">Ahorro ({{ c.ahorro_pct }} % de {{ pesos(c.ganancia) }} de ganancia)</span><span class="punteado"></span><span class="val">− {{ pesos(c.ahorro) }}</span></div>
            <div class="renglon total"><span class="lbl">Te quedó libre</span><span class="punteado"></span><span class="val">{{ pesos(c.libre) }}</span></div>
            @if (c.nota) { <p class="ayuda" style="margin-top: 10px">📝 {{ c.nota }}</p> }
          </section>
          <div class="botones"><button class="b" type="button" [disabled]="guardando()" (click)="anular(c)">Anular y volver a cerrar</button></div>
        } @else {
          <section class="panel" aria-labelledby="t-plata">
            <div class="panel-head"><div>
              <h2 id="t-plata">¿Qué plata recibiste tú?</h2>
              <p class="ayuda">Marca solo lo que te entregaron a ti en la mano o a tu cuenta. Lo que recibió otra persona lo cierra ella.</p>
            </div></div>
            @if (filas().length) {
              <ul class="lista">
                @for (f of filas(); track f.clave) {
                  <li>
                    <label class="fila" [class.on]="elegidas().has(f.clave)" [class.bloq]="!!f.bloqueada">
                      <input type="checkbox" [checked]="elegidas().has(f.clave)" [disabled]="!!f.bloqueada" (change)="alternar(f.clave)" />
                      <span>
                        <span class="t1">{{ f.titulo }}</span>
                        <span class="t2">{{ f.detalle }}</span>
                        @if (f.bloqueada) {
                          <span class="t2 otro">Ya está en el cierre de {{ f.bloqueada }}</span>
                        } @else {
                          <span class="t2" [class.otro]="!f.esMio">Recibió {{ f.esMio ? 'tú' : f.recibio }} · {{ hora(f.hora) }}</span>
                        }
                      </span>
                      <span class="cifras">{{ pesos(f.efectivo + f.transferencia) }}
                        @if (f.transferencia) { <small>{{ pesos(f.efectivo) }} efectivo · {{ pesos(f.transferencia) }} transf.</small> }
                        <small>comisión {{ pesos(f.comisiones) }}</small>
                      </span>
                    </label>
                  </li>
                }
              </ul>
              <div class="botones"><button type="button" class="link" (click)="soloMios()">Marcar solo lo que dice que recibí yo</button></div>
            } @else {
              <p class="vacio-txt">Ese día no se confirmó ningún cuadre ni caja del local.</p>
            }
          </section>

          <section class="recibo" aria-labelledby="t-cuenta">
            <h2 id="t-cuenta">Cuentas de lo que marcaste</h2>
            <div class="renglon"><span class="lbl">Efectivo</span><span class="punteado"></span><span class="val">{{ pesos(suma().efectivo) }}</span></div>
            <div class="renglon"><span class="lbl">Transferencias</span><span class="punteado"></span><span class="val">{{ pesos(suma().transferencia) }}</span></div>
            <div class="renglon sub"><span class="lbl">Total que recibiste</span><span class="punteado"></span><span class="val">{{ pesos(suma().total) }}</span></div>
            <div class="renglon separa"><span class="lbl">Separa: comisiones de las vendedoras<small>Se les paga el viernes</small></span><span class="punteado"></span><span class="val">− {{ pesos(suma().comisiones) }}</span></div>
            <div class="renglon ahorro"><span class="lbl">Separa: ahorro
                <span class="pct"><input class="inp" type="number" min="0" max="100" step="1" [ngModel]="pct()" (ngModelChange)="pct.set(+$event || 0)" aria-label="Porcentaje de ahorro" /> %</span>
                <small>de {{ pesos(suma().ganancia) }} de ganancia de la tienda</small></span>
              <span class="punteado"></span><span class="val">− {{ pesos(ahorro()) }}</span></div>
            <div class="renglon total"><span class="lbl">Te queda libre</span><span class="punteado"></span><span class="val">{{ pesos(libre()) }}</span></div>
          </section>

          @if (suma().total > 0) {
            <div class="sobres" aria-label="Cómo repartir la plata">
              <div class="sobre com"><small>Sobre comisiones</small><strong>{{ pesos(suma().comisiones) }}</strong><span>No es tuya: es de las vendedoras</span></div>
              <div class="sobre aho"><small>Sobre ahorro</small><strong>{{ pesos(ahorro()) }}</strong><span>Llevas {{ pesos(datos.ahorro_mio + ahorro()) }} ahorrados con este</span></div>
              <div class="sobre lib"><small>Libre</small><strong>{{ pesos(libre()) }}</strong><span>Para gastos, mercancía y lo del negocio</span></div>
            </div>
          }

          <section class="panel">
            <label class="campo"><span>Nota (opcional)</span>
              <textarea class="inp" maxlength="500" [(ngModel)]="nota" placeholder="Ej: faltaron 5.000 de Andrés, me los da mañana"></textarea></label>
            <button class="b b-pri b-grande" type="button" [disabled]="guardando() || !elegidas().size" (click)="cerrar()">
              {{ guardando() ? 'Cerrando…' : elegidas().size ? 'Cerrar mi día' : 'Marca la plata que recibiste' }}</button>
          </section>
        }

        <section class="panel" aria-labelledby="t-tienda">
          <div class="panel-head"><div><h2 id="t-tienda">Así fue el día en toda la tienda</h2>
            <p class="ayuda">Todos los pedidos entregados ese día, sin importar quién recibió la plata.</p></div></div>
          <div class="kpis">
            <div class="kpi"><small>Pedidos entregados</small><strong>{{ datos.dia.pedidos }}</strong></div>
            <div class="kpi"><small>Ventas</small><strong>{{ pesos(datos.dia.ventas) }}</strong></div>
            <div class="kpi"><small>Ganancia de la tienda</small><strong>{{ pesos(datos.dia.ganancia) }}</strong></div>
            <div class="kpi"><small>Comisiones vendedoras</small><strong>{{ pesos(datos.dia.comisiones) }}</strong></div>
            @if (datos.gastos) { <div class="kpi"><small>Gastos registrados</small><strong>{{ pesos(datos.gastos) }}</strong></div> }
          </div>
        </section>

        <section class="panel" aria-labelledby="t-hist">
          <div class="panel-head"><div><h2 id="t-hist">Ahorro y cierres</h2>
            <p class="ayuda">Ahorro de todos los administradores: <b class="num">{{ pesos(datos.ahorro_total) }}</b> · tuyo: <b class="num">{{ pesos(datos.ahorro_mio) }}</b></p></div></div>
          @if (historial().length) {
            <ul class="hist">
              @for (h of historial(); track h.id) {
                <li>
                  <span><b>{{ diaLargo(h.fecha) }}</b> · {{ h.admin_nombre }}<span class="t2">Recibió {{ pesos(h.efectivo + h.transferencia) }} · comisiones {{ pesos(h.comisiones) }}</span></span>
                  <span class="v">{{ pesos(h.libre) }}<small>ahorro {{ pesos(h.ahorro) }}</small></span>
                </li>
              }
            </ul>
          } @else {
            <p class="vacio-txt">Todavía no hay cierres.</p>
          }
        </section>
      }
    </div>
  `,
})
export class CierreDiaPage {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  pesos = pesos;

  readonly hoy = hoyColombiaISO();
  fecha = signal(this.hoy);
  d = signal<Datos | null>(null);
  historial = signal<Cierre[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  elegidas = signal(new Set<string>());
  pct = signal(10);
  nota = '';

  etiquetaDia = computed(() => (this.fecha() === this.hoy ? 'Hoy, ' : '') + this.diaLargo(this.fecha()));

  filas = computed<Fila[]>(() => {
    const d = this.d();
    if (!d) return [];
    const yo = this.sb.usuario();
    const miNombre = normal(yo?.nombre);
    const cu: Fila[] = d.cuadres.map((c) => ({
      clave: 'c' + c.id,
      titulo: 'Cuadre de ' + (c.mensajero ?? 'mensajero'),
      detalle: `${c.pedidos} ${c.pedidos === 1 ? 'pedido' : 'pedidos'} · entregas del ${this.diaCorto(c.fecha_entrega)}`,
      recibio: c.recibio ?? 'alguien', hora: c.hora, esMio: c.recibio_id === yo?.id,
      efectivo: +c.efectivo, transferencia: +c.transferencia, comisiones: +c.comisiones, ganancia: +c.ganancia, bloqueada: c.en_cierre,
    }));
    const ca: Fila[] = d.cajas.map((k) => ({
      clave: 'k' + k.fecha,
      titulo: 'Caja del local',
      detalle: 'Ventas del ' + this.diaCorto(k.fecha),
      recibio: k.recibio ?? 'alguien', hora: k.hora, esMio: !!miNombre && normal(k.recibio) === miNombre,
      efectivo: +k.efectivo, transferencia: 0, comisiones: +k.comisiones, ganancia: +k.ganancia, bloqueada: k.en_cierre,
    }));
    return [...cu, ...ca].sort((a, b) => a.hora.localeCompare(b.hora));
  });

  suma = computed(() => {
    const s = { efectivo: 0, transferencia: 0, comisiones: 0, ganancia: 0, total: 0 };
    for (const f of this.filas()) {
      if (!this.elegidas().has(f.clave)) continue;
      s.efectivo += f.efectivo;
      s.transferencia += f.transferencia;
      s.comisiones += f.comisiones;
      s.ganancia += f.ganancia;
    }
    s.total = s.efectivo + s.transferencia;
    return s;
  });
  ahorro = computed(() => Math.round((Math.max(this.suma().ganancia, 0) * Math.min(Math.max(this.pct(), 0), 100)) / 100));
  libre = computed(() => this.suma().total - this.suma().comisiones - this.ahorro());

  constructor() {
    void this.cargar();
  }

  cambiarDia(f: string): void {
    if (!f || f > this.hoy) return;
    this.fecha.set(f);
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    const [r, h] = await Promise.all([
      this.sb.client.rpc('cierre_dia_datos', { p_fecha: this.fecha() }),
      this.sb.client.rpc('cierres_dia_lista', { p_limite: 30 }),
    ]);
    this.cargando.set(false);
    if (r.error) return this.toast.error(mensajeError(r.error));
    this.d.set(r.data as Datos);
    this.historial.set((h.data ?? []) as Cierre[]);
    this.nota = '';
    this.soloMios();
  }

  /** Deja marcado solo lo que, según la app, recibió quien está cerrando */
  soloMios(): void {
    this.elegidas.set(new Set(this.filas().filter((f) => f.esMio && !f.bloqueada).map((f) => f.clave)));
  }

  alternar(clave: string): void {
    const s = new Set(this.elegidas());
    if (s.has(clave)) s.delete(clave);
    else s.add(clave);
    this.elegidas.set(s);
  }

  async cerrar(): Promise<void> {
    const sel = [...this.elegidas()];
    const ajenas = this.filas().filter((f) => this.elegidas().has(f.clave) && !f.esMio).length;
    if (ajenas && !confirm(`Marcaste ${ajenas === 1 ? 'una entrega que la app dice que recibió otra persona' : ajenas + ' entregas que la app dice que recibió otra persona'}. ¿De verdad esa plata la tienes tú?`)) return;
    this.guardando.set(true);
    const { error } = await this.sb.client.rpc('cerrar_dia', {
      p_fecha: this.fecha(),
      p_cuadres: sel.filter((c) => c.startsWith('c')).map((c) => Number(c.slice(1))),
      p_cajas: sel.filter((c) => c.startsWith('k')).map((c) => c.slice(1)),
      p_ahorro_pct: this.pct(),
      p_nota: this.nota,
    });
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok(`Día cerrado: separa ${pesos(this.suma().comisiones)} de comisiones y ${pesos(this.ahorro())} de ahorro`);
    await this.cargar();
  }

  async anular(c: Cierre): Promise<void> {
    if (!confirm('¿Anular este cierre? Podrás volver a marcar la plata y cerrarlo de nuevo.')) return;
    this.guardando.set(true);
    const { error } = await this.sb.client.rpc('anular_cierre_dia', { p_id: c.id });
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    await this.cargar();
  }

  hora(iso: string): string {
    return formatoHoraCO(iso);
  }
  diaCorto(dia: string): string {
    return formatoFechaCO(dia + 'T12:00:00-05:00', { day: 'numeric', month: 'short' });
  }
  diaLargo(dia: string): string {
    return formatoFechaCO(dia + 'T12:00:00-05:00', { weekday: 'long', day: 'numeric', month: 'long' });
  }
}
