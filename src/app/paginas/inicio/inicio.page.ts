import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { diaColombiaDe, formatoFechaCO, formatoHoraCO, hoyColombiaISO } from '../../shared/fecha-colombia';
import { diaLargo, sumarDias } from '../../shared/rango/rango.component';
import { STOCK_BAJO } from '../../shared/stock';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

// Solo lo que usa la gráfica, para no cargar Chart.js entero
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

interface Resumen {
  pedidos: number;
  entregados: number;
  cancelados: number;
  ventas: number;
  domicilios: number;
  margen_vendedoras: number;
  alcancia?: number;
  efectivo: number;
  transferencia: number;
  por_estado: Record<string, number>;
  vendedoras: { nombre: string; pedidos: number; ventas: number }[];
  productos: { nombre: string; cantidad: number; ventas: number }[];
}

type Periodo = 7 | 30 | 90;

interface Barra {
  etiqueta: string; // eje X
  titulo: string; // tooltip
  ganancia: number;
  pedidos: number;
  actual: boolean; // hoy o la semana en curso
}

interface Tarea {
  tipo: 'cuadre' | 'alistar' | 'despachar' | 'negativo' | 'bajo';
  titulo: string;
  detalle: string;
  monto: number | null;
  accion: string;
  ruta: string;
  query?: Record<string, string>;
}

/** Inicio (admin y cuadres): lo de hoy, la ganancia de la tienda y lo que necesita atención */
@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [EsqueletoComponent, RouterLink],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 1100px; }
      .head .acciones { display: flex; gap: 8px; }
      a.kpi { color: inherit; text-decoration: none; }
      @media (hover: hover) { a.kpi:hover { background: var(--hover); } }
      .chart { position: relative; height: 240px; }
      .chart.cargando { opacity: 0.5; transition: opacity 150ms; }
      .panel-foot { margin: 10px 0 0; font-size: 12px; color: var(--text-muted); }
      .variacion { margin-left: 6px; font-size: 12px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
      .variacion.sube { color: var(--efectivo-texto); }
      .variacion.baja { color: var(--danger); }
      .titulo-mes { margin: 4px 0 -4px; font-size: 13px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
      .kpi-valor.neg { color: var(--danger); }
      .cols { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 16px; align-items: start; }
      .lado { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
      .cuenta { margin-left: 8px; font-family: var(--mono-font); font-size: 13px; font-weight: 500; color: var(--text-muted); }

      /* Necesita atención: renglones del tiquete con punto de color */
      .tareas { display: flex; flex-direction: column; }
      .tarea { display: grid; grid-template-columns: 10px minmax(0, 1fr) auto auto; align-items: center; gap: 12px; padding: 11px 0; border-bottom: var(--perfora); }
      .tarea:last-child { border-bottom: none; padding-bottom: 0; }
      .tarea:first-child { padding-top: 0; }
      .punto { width: 8px; height: 8px; border-radius: 50%; background: var(--border-strong); }
      .punto.cuadre { background: var(--efectivo); }
      .punto.alistar { background: var(--st-pendiente); }
      .punto.despachar { background: var(--st-alistado); }
      .punto.negativo { background: var(--danger); }
      .punto.bajo { background: var(--oro); }
      .tarea-texto { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .tarea-titulo { font-size: 14px; font-weight: 550; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tarea-detalle { font-size: 12.5px; color: var(--text-soft); }
      .tarea-detalle.neg { color: var(--danger); font-weight: 550; }
      .tarea-monto { font-family: var(--mono-font); font-size: 13px; font-weight: 600; white-space: nowrap; }
      .tarea .b { height: 32px; padding: 0 12px; font-size: 13px; white-space: nowrap; }
      .al-dia { margin: 0; padding: 18px 0 4px; text-align: center; font-size: 14px; color: var(--text-soft); }
      .al-dia strong { display: block; margin-bottom: 4px; font-size: 15px; color: var(--text); }

      .renglones dt small { font-size: 12px; }
      .en-curso > a > :last-child { font-size: 18px; font-weight: 600; }
      .ranking { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
      .ranking li { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; font-size: 13px; }
      .ranking .nom { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ranking .val { color: var(--text-soft); text-align: right; }
      .ranking .pista { grid-column: 1 / -1; height: 4px; border-radius: 2px; background: var(--selected); overflow: hidden; }
      .ranking .pista span { display: block; height: 100%; border-radius: 2px; background: var(--oro); }
      .suave { color: var(--text-muted); }

      @media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
      @media (max-width: 640px) {
        .head .acciones { width: 100%; }
        .head .acciones .b { flex: 1; justify-content: center; }
        .chart { height: 200px; }
        .tarea { grid-template-columns: 10px minmax(0, 1fr) auto; }
        .tarea-monto { grid-column: 2; grid-row: 2; margin-top: -6px; }
        .tarea .b { grid-column: 3; grid-row: 1 / span 2; }
      }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">{{ hoyLargo }}</p><h1>Inicio</h1></div>
        <div class="acciones">
          <a class="b" routerLink="/app/pedidos">Ver pedidos</a>
          @if (puedeVender()) { <a class="b b-pri" routerLink="/app/pedidos/nuevo">Nuevo pedido</a> }
        </div>
      </div>

      <!-- Hoy -->
      <div class="kpis" role="list" [attr.aria-busy]="cargando()">
        <div class="kpi kpi-principal" role="listitem">
          <span class="kpi-label">Ganancia tienda hoy</span>
          <span class="kpi-valor num">{{ cargando() ? '…' : pesos(gananciaHoy()) }}</span>
          <span class="kpi-nota">Precio base − compra</span>
        </div>
        <div class="kpi" role="listitem">
          <span class="kpi-label">Ventas de hoy</span>
          <span class="kpi-valor num">{{ cargando() ? '…' : pesos(r()?.ventas) }}</span>
          <span class="kpi-nota">Entregadas, sin domicilios</span>
        </div>
        <div class="kpi" role="listitem">
          <span class="kpi-label">Pedidos de hoy</span>
          <span class="kpi-valor num">{{ numero(r()?.pedidos) }}</span>
          <span class="kpi-nota num">{{ numero(r()?.entregados) }} entregados · {{ numero(r()?.cancelados) }} cancelados</span>
        </div>
        <a class="kpi" role="listitem" routerLink="/app/cuadres">
          <span class="kpi-label">Por recibir en cuadres</span>
          <span class="kpi-valor num">{{ pesos(porRecibir()) }}</span>
          <span class="kpi-nota">{{ cuadres().length ? mensajerosPorCuadrar() + (mensajerosPorCuadrar() === 1 ? ' mensajero' : ' mensajeros') : 'Todo cuadrado' }}</span>
        </a>
      </div>

      <!-- Este mes: ganancia, gastos, utilidad real y comisiones por pagar -->
      @if (mes(); as m) {
        <h2 class="titulo-mes">Este mes</h2>
        <div class="kpis" role="list">
          <div class="kpi" role="listitem">
            <span class="kpi-label">Ganancia tienda</span>
            <span class="kpi-valor num">{{ pesos(m.ganancia_tienda) }}</span>
            <span class="kpi-nota">Pedidos entregados</span>
          </div>
          <a class="kpi" role="listitem" routerLink="/app/gastos">
            <span class="kpi-label">Gastos</span>
            <span class="kpi-valor num">{{ pesos(m.gastos) }}</span>
            <span class="kpi-nota">{{ m.gastos ? 'Ver en qué se gastó' : 'Registra arriendo, nómina…' }}</span>
          </a>
          <a class="kpi kpi-principal" role="listitem" routerLink="/app/gastos">
            <span class="kpi-label">Utilidad real</span>
            <span class="kpi-valor num" [class.neg]="m.utilidad < 0">{{ pesos(m.utilidad) }}</span>
            <span class="kpi-nota">Ganancia − gastos</span>
          </a>
          <a class="kpi" role="listitem" routerLink="/app/comisiones">
            <span class="kpi-label">Comisiones por pagar</span>
            <span class="kpi-valor num">{{ pesos(m.comisiones) }}</span>
            <span class="kpi-nota">{{ m.vendedoras ? m.vendedoras + (m.vendedoras === 1 ? ' vendedora' : ' vendedoras') : 'Todo pagado' }}</span>
          </a>
        </div>
      }

      <!-- Ganancia de la tienda -->
      <section class="panel" aria-labelledby="t-ganancia">
        <div class="panel-head">
          <div>
            <h2 id="t-ganancia">Ganancia de la tienda</h2>
            <p class="panel-sub">
              <strong class="num">{{ pesos(totalPeriodo()) }}</strong>
              en {{ periodo() === 90 ? 'los últimos 3 meses' : 'los últimos ' + periodo() + ' días' }}
              @if (variacion() !== null) {
                <span class="variacion" [class.sube]="variacion()! > 0" [class.baja]="variacion()! < 0"
                  [title]="'Comparado con los ' + (periodo() === 90 ? '3 meses' : periodo() + ' días') + ' anteriores'">
                  {{ variacion()! > 0 ? '↑' : variacion()! < 0 ? '↓' : '' }} {{ abs(variacion()!) }}% vs. periodo anterior
                </span>
              }
            </p>
          </div>
          <div class="segmented" role="group" aria-label="Periodo de la gráfica">
            @for (p of periodos; track p.valor) {
              <button [class.on]="periodo() === p.valor" [attr.aria-pressed]="periodo() === p.valor" (click)="cambiarPeriodo(p.valor)">{{ p.etiqueta }}</button>
            }
          </div>
        </div>
        <div class="chart" [class.cargando]="cargandoGrafica()">
          <canvas #lienzo role="img" [attr.aria-label]="'Gráfica de ganancia de la tienda, ' + (periodo() === 90 ? 'últimos 3 meses' : 'últimos ' + periodo() + ' días')"></canvas>
        </div>
        <p class="panel-foot">Pedidos entregados, por el día en que se subieron (igual que en Reportes). Toca una barra para ver el detalle.</p>
      </section>

      <div class="cols">
        <!-- Necesita atención -->
        <section class="panel" aria-labelledby="t-atencion">
          <div class="panel-head"><h2 id="t-atencion">Necesita atención<span class="cuenta">{{ tareas().length }}</span></h2></div>
          @if (tareas().length) {
            <div class="tareas">
              @for (t of tareas(); track $index) {
                <div class="tarea">
                  <span [class]="'punto ' + t.tipo" aria-hidden="true"></span>
                  <span class="tarea-texto">
                    <span class="tarea-titulo">{{ t.titulo }}</span>
                    <span class="tarea-detalle" [class.neg]="t.tipo === 'negativo'">{{ t.detalle }}</span>
                  </span>
                  @if (t.monto !== null) { <span class="tarea-monto">{{ pesos(t.monto) }}</span> } @else { <span></span> }
                  <a class="b" [routerLink]="t.ruta" [queryParams]="t.query ?? {}">{{ t.accion }}</a>
                </div>
              }
            </div>
          } @else {
            @if (cargando()) { <app-esqueleto forma="texto" [filas]="3"></app-esqueleto> } @else { <p class="al-dia"><strong>{{ 'Todo al día' }}</strong>
              @if (!cargando()) { No hay cuadres pendientes, pedidos por mover ni productos con stock bajo. }</p> }
          }
        </section>

        <div class="lado">
          <section class="panel">
            <div class="panel-head"><div><h2>En curso</h2><p class="panel-sub">Lo que falta mover ahora</p></div></div>
            <div class="renglones en-curso">
              <a routerLink="/app/pedidos" [queryParams]="{ estado: 'por_alistar' }"><span><span class="estado por_alistar">Por alistar</span></span><span class="num">{{ r()?.por_estado?.['por_alistar'] ?? 0 }}</span></a>
              <a routerLink="/app/pedidos" [queryParams]="{ estado: 'alistado' }"><span><span class="estado alistado">Alistados sin despachar</span></span><span class="num">{{ r()?.por_estado?.['alistado'] ?? 0 }}</span></a>
              <a routerLink="/app/pedidos" [queryParams]="{ estado: 'despachado' }"><span><span class="estado despachado">En ruta</span></span><span class="num">{{ r()?.por_estado?.['despachado'] ?? 0 }}</span></a>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head"><div><h2>Resumen de hoy</h2><p class="panel-sub">Pedidos entregados hoy</p></div></div>
            <dl class="renglones">
              <div><dt>Efectivo</dt><dd>{{ pesos(r()?.efectivo) }}</dd></div>
              <div><dt>Transferencias</dt><dd>{{ pesos(r()?.transferencia) }}</dd></div>
              <div><dt>Domicilios <small class="suave">(de los mensajeros)</small></dt><dd>{{ pesos(r()?.domicilios) }}</dd></div>
              <div><dt>Ganancia vendedoras</dt><dd>{{ pesos(r()?.margen_vendedoras) }}</dd></div>
              @if (r()?.alcancia) { <div><dt>Servicio local <small class="suave">(ventas del local)</small></dt><dd>{{ pesos(r()?.alcancia) }}</dd></div> }
              <div class="total"><dt>Ganancia tienda</dt><dd>{{ pesos(gananciaHoy()) }}</dd></div>
            </dl>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Vendedoras hoy</h2></div>
            <ol class="ranking">
              @for (v of r()?.vendedoras ?? []; track v.nombre) {
                <li>
                  <span class="nom">{{ v.nombre }}</span><span class="val num">{{ pesos(v.ventas) }} · {{ v.pedidos }}</span>
                  <span class="pista"><span [style.width.%]="(v.ventas / maxVend()) * 100"></span></span>
                </li>
              } @empty {
                <li class="suave">Sin ventas entregadas hoy.</li>
              }
            </ol>
          </section>

          <section class="panel">
            <div class="panel-head"><h2>Más vendidos hoy</h2></div>
            <ol class="ranking">
              @for (p of r()?.productos ?? []; track p.nombre) {
                <li>
                  <span class="nom">{{ p.nombre }}</span><span class="val num">{{ p.cantidad }} und · {{ pesos(p.ventas) }}</span>
                  <span class="pista"><span [style.width.%]="(p.cantidad / maxProd()) * 100"></span></span>
                </li>
              } @empty {
                <li class="suave">Sin ventas entregadas hoy.</li>
              }
            </ol>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class InicioPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  readonly hoyLargo = diaLargo(hoyColombiaISO());
  readonly periodos: { valor: Periodo; etiqueta: string }[] = [
    { valor: 7, etiqueta: '7 días' },
    { valor: 30, etiqueta: '30 días' },
    { valor: 90, etiqueta: '3 meses' },
  ];

  r = signal<Resumen | null>(null);
  cargando = signal(true);
  gananciaHoy = signal(0);
  cuadres = signal<Awaited<ReturnType<PedidosService['cuadresPendientes']>>>([]);
  tareas = signal<Tarea[]>([]);

  periodo = signal<Periodo>(7);
  barras = signal<Barra[]>([]);
  totalPeriodo = signal(0);
  variacion = signal<number | null>(null);
  cargandoGrafica = signal(false);

  puedeVender = computed(() => this.sb.tiene('admin', 'vendedora'));
  /** Un mensajero puede tener varios cuadres pendientes (uno por día de entrega) */
  mensajerosPorCuadrar = computed(() => new Set(this.cuadres().map((c) => c.mensajero_id)).size);
  porRecibir = computed(() => this.cuadres().reduce((s, c) => s + Number(c.efectivo) - Number(c.domicilios), 0));
  maxVend = computed(() => Math.max(1, ...(this.r()?.vendedoras ?? []).map((d) => Number(d.ventas))));
  maxProd = computed(() => Math.max(1, ...(this.r()?.productos ?? []).map((d) => Number(d.cantidad))));

  pesos = pesos;
  numero = numero;
  abs = Math.abs;

  @ViewChild('lienzo') set lienzo(ref: ElementRef<HTMLCanvasElement> | undefined) {
    this.refLienzo = ref;
    if (ref) queueMicrotask(() => this.dibujar());
  }
  private refLienzo?: ElementRef<HTMLCanvasElement>;
  private grafica: Chart | null = null;
  private observadorTema: MutationObserver | null = null;
  private dejarDeEscuchar?: () => void;
  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    void this.cargarTodo();
    // Pedidos que cambian (de otros usuarios) actualizan Inicio, agrupados en una sola recarga
    this.dejarDeEscuchar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargarTodo(), 800);
    });
    // Al cambiar de modo claro/oscuro la gráfica toma los colores nuevos
    this.observadorTema = new MutationObserver(() => {
      this.grafica?.destroy();
      this.grafica = null;
      this.dibujar();
    });
    this.observadorTema.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar?.();
    clearTimeout(this.timer);
    this.observadorTema?.disconnect();
    this.grafica?.destroy();
  }

  async cargarTodo(): Promise<void> {
    try {
      await Promise.all([this.cargarHoy(), this.cargarAtencion(), this.cargarGrafica(), this.cargarMes()]);
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  // -------------------------------------------------------------- Este mes
  mes = signal<{ ganancia_tienda: number; gastos: number; utilidad: number; comisiones: number; vendedoras: number } | null>(null);

  private async cargarMes(): Promise<void> {
    const hoy = hoyColombiaISO();
    const [g, c] = await Promise.all([
      this.sb.client.rpc('gastos_resumen', { p_desde: hoy.slice(0, 8) + '01', p_hasta: hoy }),
      this.sb.client.rpc('liquidaciones_pendientes'),
    ]);
    // Si algo falla, el resto del Inicio se ve igual
    if (g.error || c.error) return;
    const res = g.data as { ganancia_tienda: number; gastos: number; utilidad: number };
    const pend = (c.data ?? []) as { total: number }[];
    this.mes.set({
      ganancia_tienda: Number(res.ganancia_tienda), gastos: Number(res.gastos), utilidad: Number(res.utilidad),
      comisiones: pend.reduce((s, x) => s + Number(x.total), 0), vendedoras: pend.length,
    });
  }

  // ------------------------------------------------------------------- Hoy
  private async cargarHoy(): Promise<void> {
    const hoy = hoyColombiaISO();
    const [res, gan] = await Promise.all([
      this.sb.client.rpc('resumen', { p_desde: hoy, p_hasta: hoy }),
      this.sb.client.rpc('ganancia_por_dia', { p_desde: hoy, p_hasta: hoy }),
    ]);
    if (res.error) throw res.error;
    if (gan.error) throw gan.error;
    this.r.set(res.data as Resumen);
    this.gananciaHoy.set(Number(((gan.data ?? []) as { ganancia: number }[])[0]?.ganancia ?? 0));
  }

  // ------------------------------------------------------ Necesita atención
  private async cargarAtencion(): Promise<void> {
    const db = this.sb.client;
    const [cuadres, porAlistar, alistados, negativos, bajos] = await Promise.all([
      this.ps.cuadresPendientes(),
      db.from('pedidos').select('created_at', { count: 'exact' }).eq('estado', 'por_alistar').order('created_at').limit(1),
      db.from('pedidos').select('alistado_at', { count: 'exact' }).eq('estado', 'alistado').order('alistado_at').limit(1),
      db.from('productos').select('id, nombre, stock', { count: 'exact' }).eq('activo', true).eq('controla_stock', true)
        .lt('stock', 0).order('stock').limit(5),
      db.from('productos').select('id, nombre, stock', { count: 'exact' }).eq('activo', true).eq('controla_stock', true)
        .gte('stock', 0).lt('stock', STOCK_BAJO).order('stock').limit(5),
    ]);
    for (const x of [porAlistar, alistados, negativos, bajos]) if (x.error) throw x.error;
    this.cuadres.set(cuadres);

    // Lo más urgente primero: plata por recibir, pedidos detenidos, inventario
    const tareas: Tarea[] = cuadres.map((c) => ({
      tipo: 'cuadre',
      titulo: `Cuadre de ${c.nombre}`,
      detalle: `${c.pedidos} ${c.pedidos === 1 ? 'entrega' : 'entregas'} desde ${this.cuando(c.desde)}`,
      monto: Number(c.efectivo) - Number(c.domicilios),
      accion: 'Revisar',
      ruta: '/app/cuadres',
    }));

    const nAlistar = porAlistar.count ?? 0;
    if (nAlistar) {
      const viejo = (porAlistar.data ?? [])[0] as { created_at: string } | undefined;
      tareas.push({
        tipo: 'alistar',
        titulo: nAlistar === 1 ? '1 pedido por alistar' : `${nAlistar} pedidos por alistar`,
        detalle: viejo ? `El más antiguo entró ${this.cuando(viejo.created_at)}` : '',
        monto: null,
        accion: 'Alistar',
        ruta: '/app/pedidos',
        query: { estado: 'por_alistar' },
      });
    }

    const nAlistados = alistados.count ?? 0;
    if (nAlistados) {
      const viejo = (alistados.data ?? [])[0] as { alistado_at: string | null } | undefined;
      tareas.push({
        tipo: 'despachar',
        titulo: nAlistados === 1 ? '1 pedido alistado sin despachar' : `${nAlistados} pedidos alistados sin despachar`,
        detalle: viejo?.alistado_at ? `El primero se alistó ${this.cuando(viejo.alistado_at)}` : 'Esperan mensajero',
        monto: null,
        accion: 'Despachar',
        ruta: '/app/pedidos',
        query: { estado: 'alistado' },
      });
    }

    type Prod = { id: number; nombre: string; stock: number };
    const agregarStock = (tipo: 'negativo' | 'bajo', res: { data: unknown; count: number | null }) => {
      const prods = (res.data ?? []) as Prod[];
      for (const p of prods) {
        tareas.push({
          tipo,
          titulo: p.nombre,
          detalle:
            p.stock < 0 ? `Stock negativo: ${p.stock}` : p.stock === 0 ? 'Agotado' : p.stock === 1 ? 'Queda 1 unidad' : `Quedan ${p.stock} unidades`,
          monto: null,
          accion: 'Ver producto',
          ruta: '/app/productos',
          query: { filtro: tipo === 'negativo' || p.stock === 0 ? 'agotados' : 'bajo' },
        });
      }
      const resto = (res.count ?? 0) - prods.length;
      if (resto > 0) {
        tareas.push({
          tipo,
          titulo: tipo === 'negativo' ? `Y ${numero(resto)} productos más con stock negativo` : `Y ${numero(resto)} productos más con stock bajo`,
          detalle: tipo === 'negativo' ? 'Se vendieron más unidades de las que había registradas' : `Menos de ${STOCK_BAJO} unidades`,
          monto: null,
          accion: 'Ver todos',
          ruta: '/app/productos',
          query: { filtro: tipo === 'negativo' ? 'agotados' : 'bajo' },
        });
      }
    };
    agregarStock('negativo', negativos);
    agregarStock('bajo', bajos);
    this.tareas.set(tareas);
  }

  // --------------------------------------------------------------- Gráfica
  async cambiarPeriodo(p: Periodo): Promise<void> {
    if (p === this.periodo()) return;
    this.periodo.set(p);
    this.cargandoGrafica.set(true);
    try {
      await this.cargarGrafica();
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargandoGrafica.set(false);
    }
  }

  private async cargarGrafica(): Promise<void> {
    const dias = this.periodo();
    const hoy = hoyColombiaISO();
    // Se trae también el periodo anterior, para comparar
    const { data, error } = await this.sb.client.rpc('ganancia_por_dia', { p_desde: sumarDias(hoy, -(dias * 2 - 1)), p_hasta: hoy });
    if (error) throw error;
    const porDia = new Map<string, { ganancia: number; pedidos: number }>();
    for (const f of (data ?? []) as { dia: string; ganancia: number; pedidos: number }[]) {
      porDia.set(f.dia, { ganancia: Number(f.ganancia), pedidos: Number(f.pedidos) });
    }
    const de = (hace: number) => porDia.get(sumarDias(hoy, -hace)) ?? { ganancia: 0, pedidos: 0 };
    const sumar = (desde: number, hasta: number) => {
      let ganancia = 0;
      let pedidos = 0;
      for (let i = desde; i <= hasta; i++) {
        ganancia += de(i).ganancia;
        pedidos += de(i).pedidos;
      }
      return { ganancia, pedidos };
    };

    const actual = sumar(0, dias - 1);
    const anterior = sumar(dias, dias * 2 - 1);
    this.totalPeriodo.set(actual.ganancia);
    this.variacion.set(anterior.ganancia > 0 ? Math.round(((actual.ganancia - anterior.ganancia) / anterior.ganancia) * 100) : null);

    const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
      new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', { timeZone: 'UTC', ...o });
    const barras: Barra[] = [];
    if (dias <= 30) {
      // Una barra por día
      for (let i = dias - 1; i >= 0; i--) {
        const iso = sumarDias(hoy, -i);
        barras.push({
          etiqueta: i === 0 ? 'Hoy' : dias === 7 ? fmt(iso, { weekday: 'short' }) : fmt(iso, { day: 'numeric' }),
          titulo: i === 0 ? 'Hoy' : fmt(iso, { weekday: 'long', day: 'numeric', month: 'long' }),
          ...de(i),
          actual: i === 0,
        });
      }
    } else {
      // Una barra por semana (13 semanas ≈ 3 meses)
      for (let s = Math.ceil(dias / 7) - 1; s >= 0; s--) {
        const ini = sumarDias(hoy, -(s * 7 + 6));
        const fin = sumarDias(hoy, -(s * 7));
        barras.push({
          etiqueta: fmt(ini, { day: 'numeric', month: 'short' }),
          titulo: `Del ${fmt(ini, { day: 'numeric', month: 'short' })} al ${fmt(fin, { day: 'numeric', month: 'short' })}`,
          ...sumar(s * 7, s * 7 + 6),
          actual: s === 0,
        });
      }
    }
    this.barras.set(barras);
    this.dibujar();
  }

  private css(nombre: string): string {
    return getComputedStyle(document.body).getPropertyValue(nombre).trim();
  }

  private dibujar(): void {
    const canvas = this.refLienzo?.nativeElement;
    const barras = this.barras();
    if (!canvas || !barras.length) return;

    const oro = this.css('--oro');
    const neutro = this.css('--border-strong');
    const peligro = this.css('--danger');
    const texto = this.css('--text-muted');
    const linea = this.css('--border-soft');
    const fuente = this.css('--ui-font');
    const valores = barras.map((b) => b.ganancia);
    const colores = barras.map((b) => (b.ganancia < 0 ? peligro : b.actual ? oro : neutro));

    if (this.grafica) {
      // Se actualiza en sitio para que el cambio sea suave
      const g = this.grafica;
      g.data.labels = barras.map((b) => b.etiqueta);
      g.data.datasets[0].data = valores;
      (g.data.datasets[0] as unknown as { backgroundColor: string[] }).backgroundColor = colores;
      g.update();
      return;
    }

    this.grafica = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: barras.map((b) => b.etiqueta),
        datasets: [{ data: valores, backgroundColor: colores, hoverBackgroundColor: oro, borderRadius: 4, borderSkipped: 'bottom', maxBarThickness: 36 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            padding: 10,
            titleFont: { family: fuente, weight: 600 },
            bodyFont: { family: fuente },
            callbacks: {
              title: (items) => this.barras()[items[0].dataIndex]?.titulo ?? '',
              label: (item) => {
                const b = this.barras()[item.dataIndex];
                return [`Ganancia tienda: ${pesos(b.ganancia)}`, `Pedidos entregados: ${b.pedidos}`];
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: texto, font: { family: fuente, size: 11 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 8 },
          },
          y: {
            beginAtZero: true,
            border: { display: false },
            grid: { color: linea },
            ticks: { color: texto, font: { family: fuente, size: 11 }, maxTicksLimit: 5, callback: (v) => this.monedaCorta(Number(v)) },
          },
        },
      },
    });
  }

  // --------------------------------------------------------------- Formatos
  private monedaCorta(v: number): string {
    const s = v < 0 ? '−' : '';
    const a = Math.abs(v);
    if (a >= 1_000_000) return `${s}$${(a / 1_000_000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
    if (a >= 1_000) return `${s}$${Math.round(a / 1_000)} mil`;
    return `${s}$${a}`;
  }

  /** "hoy a las 8:32 a. m.", "ayer a las …" o "el 12 oct" */
  private cuando(iso: string): string {
    const dia = diaColombiaDe(iso);
    const hoy = hoyColombiaISO();
    if (dia === hoy) return `hoy a las ${formatoHoraCO(iso)}`;
    if (dia === sumarDias(hoy, -1)) return `ayer a las ${formatoHoraCO(iso)}`;
    return 'el ' + formatoFechaCO(iso, { day: 'numeric', month: 'short' });
  }
}
