import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, searchOutline, refreshOutline, printOutline, cubeOutline, checkmarkCircle, closeOutline, bicycleOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RotulosService } from '../../shared/rotulo/rotulos.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';
import { EstadoPedido, Pedido, Usuario, estadoLabel } from '../../shared/modelos';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';

type Filtro = EstadoPedido | 'activos' | 'todos';

/**
 * Lista de pedidos. Como en Kaesuri, el alistamiento se hace aquí mismo:
 * botón Alistar en cada pedido, pestaña Alistados en orden (1°, 2°…), despacho
 * con mensajero, rótulos y acciones para varios pedidos seleccionados.
 */
@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule, RouterLink, IonIcon, PedidoDetalleComponent, RangoComponent],
  styles: [
    `
      .check { width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent); }
      .col-check { width: 28px; padding-right: 0 !important; }
      .cliente { display: flex; flex-direction: column; gap: 2px; min-width: 200px; max-width: 320px; white-space: normal; }
      .cliente strong { font-weight: 500; }
      .cliente small { color: var(--text-muted); font-size: 12px; line-height: 1.35; }
      .tabla tr.sel td { background: var(--accent-wash); }
      .tabla td { white-space: nowrap; }
      .alistar { height: 28px; padding: 0 10px; font-size: 12px; }
      .orden { display: inline-flex; align-items: center; gap: 4px; color: var(--st-entregado); font-size: 12px; font-weight: 500; }
      .rot { font-size: 12px; }
      .rot.pend { color: var(--st-ruta-text); }
      .rot.ok { color: var(--text-muted); }
      .sel-mens { height: 30px; font-size: 12px; max-width: 170px; }
      .acciones-fila { display: flex; gap: 6px; align-items: center; }
      .lote { position: fixed; z-index: 150; left: 50%; transform: translateX(-50%); bottom: calc(16px + var(--tabbar-offset, 0px));
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; max-width: calc(100vw - 24px);
        padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); box-shadow: var(--shadow-pop); }
      .lote span { font-size: 13px; font-weight: 500; padding: 0 4px; }
      .lote select { height: 34px; max-width: 180px; }
      .tarjeta .meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--text-muted); }
      .tarjeta .fila-top { display: flex; gap: 10px; align-items: flex-start; }
      .tarjeta .fila-top > div { flex: 1; min-width: 0; cursor: pointer; }
      .rango-wrap { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Pedidos <small class="num">{{ numero(total()) }}</small></h1>
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="N.º, cliente, teléfono o barrio" [(ngModel)]="texto" (ngModelChange)="buscarLuego()" />
        </label>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
        @if (puedeVender()) {
          <a class="b b-pri" routerLink="/app/pedidos/nuevo"><ion-icon name="add"></ion-icon>Nuevo pedido</a>
        }
      </div>

      <div class="barra">
        <div class="chips" role="tablist">
          @for (f of filtros; track f.id) {
            <button class="chip" [class.on]="filtro() === f.id" (click)="cambiarFiltro(f.id)">
              {{ f.label }}
              @if (conteos()[f.id] !== undefined) {
                <span class="n num">{{ conteos()[f.id] }}</span>
              }
            </button>
          }
        </div>
      </div>

      <div class="barra">
        <div class="rango-wrap">
          <app-rango [conTodo]="true" inicial="todo" (cambio)="cambiarRango($event)"></app-rango>
        </div>
        <select class="inp inp-chico" [(ngModel)]="filtroCanal" (change)="irPagina(0)" aria-label="Canal">
          <option ngValue="domicilio">Domicilios</option>
          <option ngValue="local">Ventas en local</option>
          <option [ngValue]="null">Domicilios y local</option>
        </select>
        @if (gestiona()) {
          <select class="inp inp-chico" [(ngModel)]="filtroRotulo" (change)="irPagina(0)" aria-label="Rótulo">
            <option [ngValue]="null">Rótulo: todos</option>
            <option ngValue="pendiente">Rótulo: sin imprimir</option>
            <option ngValue="impreso">Rótulo: impreso</option>
          </select>
          <select class="inp inp-chico" [(ngModel)]="filtroMensajero" (change)="irPagina(0)" aria-label="Mensajero">
            <option [ngValue]="null">Todos los mensajeros</option>
            @for (m of mensajeros(); track m.id) {
              <option [ngValue]="m.id">{{ m.nombre }}</option>
            }
          </select>
        }
        @if (filtro() === 'alistado' && gestiona()) {
          <button class="b b-pri" [disabled]="imprimiendo()" (click)="imprimirAlistados()">
            <ion-icon name="print-outline"></ion-icon>{{ imprimiendo() ? 'Preparando…' : 'Imprimir alistados sin rótulo' }}
          </button>
        }
      </div>

      @if (error()) {
        <div class="vista-body"><p class="error">{{ error() }}</p></div>
      }

      <!-- Escritorio -->
      <div class="tabla-wrap solo-pc">
        <table class="tabla">
          <thead>
            <tr>
              @if (gestiona()) {
                <th class="col-check"><input type="checkbox" class="check" [checked]="todosSel()" (change)="alternarTodos()" aria-label="Seleccionar todos" /></th>
              }
              <th>N.º</th><th>Cliente y productos</th><th>Barrio</th><th>Vendedora</th><th>Mensajero</th>
              @if (gestiona()) { <th>Rótulo</th> }
              <th>Estado</th><th class="der">Total</th><th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filas(); track p.id; let i = $index) {
              <tr [class.sel]="sel().has(p.id)">
                @if (gestiona()) {
                  <td class="col-check"><input type="checkbox" class="check" [checked]="sel().has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'Seleccionar #' + p.id" /></td>
                }
                <td class="num suave"><a class="click" (click)="abrir(p.id)" style="cursor: pointer">#{{ p.id }}</a></td>
                <td>
                  <div class="cliente">
                    <strong (click)="abrir(p.id)" style="cursor: pointer">{{ p.cliente_nombre }}</strong>
                    <small>{{ productosTexto(p) }}</small>
                    @if (gestiona() && p.estado === 'por_alistar') {
                      <span><button class="b alistar" [disabled]="ocupado()" (click)="alistar([p])"><ion-icon name="cube-outline"></ion-icon>Alistar</button></span>
                    }
                    @if (p.estado === 'alistado' && filtro() === 'alistado') {
                      <span class="orden"><ion-icon name="checkmark-circle"></ion-icon>{{ pagina() * porPagina + i + 1 }}° alistado</span>
                    }
                  </div>
                </td>
                <td class="suave corta">{{ p.barrio || '—' }}</td>
                <td class="corta">{{ p.vendedora?.nombre || '—' }}</td>
                <td>
                  @if (gestiona() && (p.estado === 'por_alistar' || p.estado === 'alistado' || p.estado === 'despachado')) {
                    <div class="acciones-fila">
                      <select class="inp sel-mens" [ngModel]="p.mensajero_id" (ngModelChange)="asignar(p, $event)" aria-label="Mensajero">
                        <option [ngValue]="null">Sin asignar</option>
                        @for (m of mensajeros(); track m.id) {
                          <option [ngValue]="m.id">{{ m.nombre }}</option>
                        }
                      </select>
                      @if (p.estado === 'alistado') {
                        <button class="b alistar b-pri" [disabled]="!p.mensajero_id || ocupado()" (click)="despachar([p])">Despachar</button>
                      }
                    </div>
                  } @else {
                    {{ p.mensajero?.nombre || '—' }}
                  }
                </td>
                @if (gestiona()) {
                  <td>
                    @if (p.rotulo_impreso_at) {
                      <span class="rot ok">Impreso</span>
                    } @else if (p.estado !== 'entregado' && p.estado !== 'cancelado') {
                      <span class="rot pend">Pendiente</span>
                    } @else { <span class="suave">—</span> }
                  </td>
                }
                <td><span class="estado {{ p.estado }}">{{ estadoLabel(p.estado) }}</span></td>
                <td class="der num">{{ pesos(p.total) }}</td>
                <td class="suave">{{ fecha(p.created_at) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="10" class="suave">{{ cargando() ? 'Cargando…' : 'No hay pedidos con estos filtros.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Celular -->
      <div class="vista-body solo-cel">
        <div class="tarjetas" style="width: 100%">
          @for (p of filas(); track p.id; let i = $index) {
            <div class="tarjeta" [style.border-color]="sel().has(p.id) ? 'var(--accent)' : null">
              <div class="fila-top">
                @if (gestiona()) {
                  <input type="checkbox" class="check" [checked]="sel().has(p.id)" (change)="alternar(p.id)" [attr.aria-label]="'Seleccionar #' + p.id" />
                }
                <div (click)="abrir(p.id)">
                  <div class="tarjeta-top"><h3>{{ p.cliente_nombre }}</h3><strong class="num">{{ pesos(p.total) }}</strong></div>
                  <p>{{ productosTexto(p) }}</p>
                  <p>{{ p.barrio || 'Sin barrio' }} · {{ p.vendedora?.nombre || '—' }}@if (p.mensajero) { · 🛵 {{ p.mensajero.nombre }} }</p>
                </div>
              </div>
              <div class="meta">
                <span class="estado {{ p.estado }}">{{ estadoLabel(p.estado) }}@if (p.estado === 'alistado' && filtro() === 'alistado') { · {{ pagina() * porPagina + i + 1 }}° }</span>
                <span>#{{ p.id }} · {{ fecha(p.created_at) }}</span>
              </div>
              @if (gestiona() && (p.estado === 'por_alistar' || p.estado === 'alistado')) {
                <div class="acciones">
                  @if (p.estado === 'por_alistar') {
                    <button class="b" style="flex: 1" [disabled]="ocupado()" (click)="alistar([p])"><ion-icon name="cube-outline"></ion-icon>Alistar</button>
                  } @else {
                    <select class="inp" style="flex: 1" [ngModel]="p.mensajero_id" (ngModelChange)="asignar(p, $event)" aria-label="Mensajero">
                      <option [ngValue]="null">Mensajero…</option>
                      @for (m of mensajeros(); track m.id) {
                        <option [ngValue]="m.id">{{ m.nombre }}</option>
                      }
                    </select>
                    <button class="b b-pri" [disabled]="!p.mensajero_id || ocupado()" (click)="despachar([p])">Despachar</button>
                  }
                </div>
              }
            </div>
          } @empty {
            <div class="vacio">{{ cargando() ? 'Cargando…' : 'No hay pedidos con estos filtros.' }}</div>
          }
        </div>
      </div>

      @if (total() > porPagina) {
        <div class="paginar">
          <span class="num">{{ pagina() * porPagina + 1 }}–{{ min((pagina() + 1) * porPagina, total()) }} de {{ numero(total()) }}</span>
          <span style="display: flex; gap: 8px">
            <button class="b" [disabled]="pagina() === 0" (click)="irPagina(pagina() - 1)">Anterior</button>
            <button class="b" [disabled]="(pagina() + 1) * porPagina >= total()" (click)="irPagina(pagina() + 1)">Siguiente</button>
          </span>
        </div>
      }
      <div style="height: 72px"></div>
    </div>

    <!-- Acciones para varios pedidos -->
    @if (sel().size) {
      <div class="lote" role="toolbar" aria-label="Acciones para los seleccionados">
        <span class="num">{{ sel().size }} seleccionado(s)</span>
        @if (selPorAlistar().length) {
          <button class="b" [disabled]="ocupado()" (click)="alistar(selPorAlistar())"><ion-icon name="cube-outline"></ion-icon>Alistar ({{ selPorAlistar().length }})</button>
        }
        @if (selAlistados().length) {
          <select class="inp" [(ngModel)]="mensajeroLote" aria-label="Mensajero para despachar">
            <option [ngValue]="null">Mensajero…</option>
            @for (m of mensajeros(); track m.id) {
              <option [ngValue]="m.id">{{ m.nombre }}</option>
            }
          </select>
          <button class="b b-pri" [disabled]="!mensajeroLote || ocupado()" (click)="despachar(selAlistados(), mensajeroLote)">
            <ion-icon name="bicycle-outline"></ion-icon>Despachar ({{ selAlistados().length }})
          </button>
        }
        <button class="b" [disabled]="imprimiendo()" (click)="imprimirSeleccion()"><ion-icon name="print-outline"></ion-icon>Rótulos</button>
        <button class="b b-icono" aria-label="Quitar selección" (click)="limpiarSel()"><ion-icon name="close-outline"></ion-icon></button>
      </div>
    }

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="cerrarDetalle()" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class PedidosPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private rotulos = inject(RotulosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  filtros: { id: Filtro; label: string }[] = [
    { id: 'activos', label: 'Activos' },
    { id: 'por_alistar', label: 'Por alistar' },
    { id: 'alistado', label: 'Alistados' },
    { id: 'despachado', label: 'En ruta' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'cancelado', label: 'Cancelados' },
    { id: 'todos', label: 'Todos' },
  ];

  filtro = signal<Filtro>('activos');
  filas = signal<Pedido[]>([]);
  total = signal(0);
  pagina = signal(0);
  cargando = signal(true);
  error = signal('');
  conteos = signal<Record<string, number>>({});
  abierto = signal<number | null>(null);
  mensajeros = signal<Usuario[]>([]);
  sel = signal<Set<number>>(new Set());
  ocupado = signal(false);
  imprimiendo = signal(false);
  texto = '';
  filtroRotulo: 'pendiente' | 'impreso' | null = null;
  filtroMensajero: number | null = null;
  filtroCanal: 'domicilio' | 'local' | null = 'domicilio';
  mensajeroLote: number | null = null;
  private rango: RangoFechas = { desde: '', hasta: '', etiqueta: '' };
  readonly porPagina = 50;

  puedeVender = computed(() => this.sb.tiene('admin', 'vendedora'));
  /** Admin y alistamiento alistan, despachan e imprimen rótulos desde aquí */
  gestiona = computed(() => this.sb.tiene('admin', 'alistador'));
  selPedidos = computed(() => this.filas().filter((p) => this.sel().has(p.id)));
  selPorAlistar = computed(() => this.selPedidos().filter((p) => p.estado === 'por_alistar'));
  selAlistados = computed(() => this.selPedidos().filter((p) => p.estado === 'alistado'));
  todosSel = computed(() => this.filas().length > 0 && this.filas().every((p) => this.sel().has(p.id)));

  pesos = pesos;
  numero = numero;
  estadoLabel = estadoLabel;
  min = Math.min;

  private timer?: ReturnType<typeof setTimeout>;
  private dejarDeEscuchar?: () => void;
  private iniciado = false;

  constructor() {
    addIcons({ add, searchOutline, refreshOutline, printOutline, cubeOutline, checkmarkCircle, closeOutline, bicycleOutline });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    if (id) this.abierto.set(id);
    if (this.gestiona()) this.ps.mensajeros().then((m) => this.mensajeros.set(m)).catch(() => undefined);
    this.dejarDeEscuchar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 600);
    });
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar?.();
    clearTimeout(this.timer);
  }

  cambiarRango(r: RangoFechas): void {
    this.rango = r;
    this.iniciado = true;
    this.irPagina(0);
  }

  async cargar(): Promise<void> {
    if (!this.iniciado) return;
    this.cargando.set(true);
    try {
      const f = this.filtro();
      const [r, c] = await Promise.all([
        this.ps.listar({
          estado: f === 'todos' ? null : f,
          texto: this.texto,
          desde: this.rango.desde ? inicioDiaColombia(this.rango.desde).toISOString() : null,
          hasta: this.rango.hasta ? finDiaColombia(this.rango.hasta).toISOString() : null,
          rotulo: this.filtroRotulo,
          canal: this.filtroCanal,
          mensajeroId: this.filtroMensajero,
          conItems: true,
          pagina: this.pagina(),
          porPagina: this.porPagina,
        }),
        this.ps.conteoPorEstado(),
      ]);
      this.filas.set(r.filas);
      this.total.set(r.total);
      this.conteos.set({ ...c, activos: (c['por_alistar'] ?? 0) + (c['alistado'] ?? 0) + (c['despachado'] ?? 0) });
      // La selección solo conserva lo que sigue en pantalla
      const visibles = new Set(r.filas.map((p) => p.id));
      this.sel.set(new Set([...this.sel()].filter((id) => visibles.has(id))));
      this.error.set('');
    } catch (e) {
      this.error.set('No se pudieron cargar los pedidos: ' + mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.sel.set(new Set());
    this.irPagina(0);
  }

  irPagina(n: number): void {
    this.pagina.set(n);
    void this.cargar();
  }

  buscarLuego(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.irPagina(0), 350);
  }

  alternar(id: number): void {
    const s = new Set(this.sel());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.sel.set(s);
  }

  alternarTodos(): void {
    this.sel.set(this.todosSel() ? new Set() : new Set(this.filas().map((p) => p.id)));
  }

  async alistar(lista: Pedido[]): Promise<void> {
    await this.enLote(lista, (p) => this.ps.cambiarEstado(p.id, 'alistado'), 'alistado(s)');
  }

  async despachar(lista: Pedido[], mensajero: number | null = null): Promise<void> {
    await this.enLote(lista, (p) => this.ps.cambiarEstado(p.id, 'despachado', mensajero ?? p.mensajero_id), 'despachado(s)');
    this.mensajeroLote = null;
  }

  private async enLote(lista: Pedido[], accion: (p: Pedido) => Promise<void>, texto: string): Promise<void> {
    if (!lista.length) return;
    this.ocupado.set(true);
    let ok = 0;
    const errores: string[] = [];
    for (const p of lista) {
      try {
        await accion(p);
        ok++;
      } catch (e) {
        errores.push(`#${p.id}: ${mensajeError(e)}`);
      }
    }
    this.ocupado.set(false);
    if (errores.length) this.toast.error(errores.slice(0, 2).join(' · '));
    else this.toast.ok(lista.length === 1 ? `#${lista[0].id} ${texto.replace('(s)', '')}` : `${ok} pedidos ${texto.replace('(s)', 's')}`);
    this.sel.set(new Set());
    await this.cargar();
  }

  async asignar(p: Pedido, mensajeroId: number | null): Promise<void> {
    if (!mensajeroId || mensajeroId === p.mensajero_id) return;
    try {
      await this.ps.asignarMensajero(p.id, mensajeroId);
      this.filas.set(
        this.filas().map((x) =>
          x.id === p.id ? { ...x, mensajero_id: mensajeroId, mensajero: { nombre: this.mensajeros().find((m) => m.id === mensajeroId)?.nombre ?? '' } } : x
        )
      );
    } catch (e) {
      this.toast.error(mensajeError(e));
    }
  }

  /** Abre la ventana de impresión en el mismo clic y luego trae los datos */
  async imprimirAlistados(): Promise<void> {
    this.imprimiendo.set(true);
    try {
      if (await this.rotulos.imprimir(() => this.ps.alistadosSinRotulo())) {
        this.toast.ok('Rótulos enviados a imprimir');
        await this.cargar();
      }
    } finally {
      this.imprimiendo.set(false);
    }
  }

  limpiarSel(): void {
    this.sel.set(new Set());
  }

  async imprimirSeleccion(): Promise<void> {
    this.imprimiendo.set(true);
    try {
      const ids = this.selPedidos().map((p) => p.id);
      if (await this.rotulos.imprimir(() => this.ps.conItems(ids))) {
        this.sel.set(new Set());
        await this.cargar();
      }
    } finally {
      this.imprimiendo.set(false);
    }
  }

  abrir(id: number): void {
    this.abierto.set(id);
    this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  cerrarDetalle(): void {
    this.abierto.set(null);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  productosTexto(p: Pedido): string {
    const it = p.pedido_items ?? [];
    return it.map((i) => (i.cantidad > 1 ? `${i.nombre} x${i.cantidad}` : i.nombre)).join(', ') || 'Sin productos';
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
