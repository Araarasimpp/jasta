import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add, searchOutline, printOutline, cubeOutline, checkmarkCircle, close, ellipsisHorizontal, chatbubbleEllipses, alertCircleOutline,
} from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RotulosService } from '../../shared/rotulo/rotulos.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { NovedadComponent } from '../../shared/novedad/novedad.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { EstadoIconComponent } from '../../shared/estado-icon/estado-icon.component';
import { VisorService } from '../../shared/visor/visor.service';
import { EstadoPedido, Pedido, PedidoItem, Producto, Usuario } from '../../shared/modelos';
import { mensajeError, numero, pesos, urlImagen, urlMini } from '../../shared/formato';
import { diaColombiaDe, formatoFechaCO, formatoHoraCO, hoyColombiaISO } from '../../shared/fecha-colombia';
import { sumarDias } from '../../shared/rango/rango.component';
import { fotoDeItem, nombreConVariante, variante } from '../../shared/variante';
import { FotoCatalogo, ProductoDetalleComponent, galeriaProducto } from '../catalogo/producto-detalle.component';

type Filtro = EstadoPedido | 'todos';

interface Grupo {
  estado: EstadoPedido;
  etiqueta: string;
  pedidos: Pedido[];
  /** Cuántos hay en total con estos filtros (puede ser más que los de esta página) */
  total: number;
  subtotal: number;
  /** true si están todos cargados (la suma es la del grupo completo) */
  completo: boolean;
}

/** Estados en curso: se cargan completos. Entregados y cancelados van por páginas. */
const ACTIVOS: EstadoPedido[] = ['por_alistar', 'alistado', 'despachado'];
const CERRADOS: EstadoPedido[] = ['entregado', 'cancelado'];
// Orden en que se muestran los grupos en "Todos"
const ORDEN_GRUPOS: EstadoPedido[] = [...ACTIVOS, ...CERRADOS];
const ETIQUETA_GRUPO: Record<EstadoPedido, string> = {
  por_alistar: 'Por alistar',
  alistado: 'Alistados',
  despachado: 'En ruta',
  entregado: 'Entregados',
  cancelado: 'Cancelados',
};

/**
 * Lista de pedidos, igual que en Home ALS: abre en Pendientes, los pedidos van
 * agrupados por estado con su cantidad y su suma, con las fotos de los
 * productos, el orden de alistamiento (1°, 2°…), el mensajero (asignarlo lo
 * despacha: pasa a En ruta) y un menú por pedido.
 */
@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule, RouterLink, IonIcon, PedidoDetalleComponent, NovedadComponent, AvatarComponent, EstadoIconComponent, ProductoDetalleComponent],
  templateUrl: './pedidos.page.html',
  styleUrls: ['./pedidos.page.scss'],
})
export class PedidosPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private visor = inject(VisorService);
  private toast = inject(ToastService);
  private rotulos = inject(RotulosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  /** Avisos: para marcar los pedidos con mensajes sin leer */
  avisos = inject(NotificacionesService);

  readonly filtros: { id: Filtro; label: string }[] = [
    { id: 'por_alistar', label: 'Pendientes' },
    { id: 'alistado', label: 'Alistados' },
    { id: 'despachado', label: 'En ruta' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'cancelado', label: 'Cancelados' },
    { id: 'todos', label: 'Todos' },
  ];
  readonly hoy = formatoFechaCO(new Date().toISOString(), { weekday: 'long', day: 'numeric', month: 'long' });
  /** Productos que se muestran con foto; el resto se resume como "+N más" */
  readonly maxProductosVisibles = 3;
  readonly porPagina = 50;

  // Se abre en Pendientes: es lo que hay que atender primero
  filtro = signal<Filtro>('por_alistar');
  filas = signal<Pedido[]>([]);
  totalCerrados = signal(0);
  pagina = signal(0);
  cargando = signal(true);
  error = signal('');
  conteos = signal<Record<string, number>>({});
  ordenAlistado = signal<Map<number, number>>(new Map());
  /** Puesto de cada pedido en ruta dentro de los de su mensajero (orden de asignación) */
  ordenRuta = signal<Map<number, number>>(new Map());
  abierto = signal<number | null>(null);
  /** Pedido en ruta al que la oficina le reporta que no se pudo entregar */
  novedadDe = signal<Pedido | null>(null);
  /** El pedido se abrió desde un aviso de mensaje: va directo a la conversación */
  abiertoEnChat = signal(false);
  mensajeros = signal<Usuario[]>([]);
  sel = signal<Set<number>>(new Set());
  menuAbierto = signal<number | null>(null);
  guardandoId = signal<number | null>(null);
  ocupado = signal(false);
  imprimiendo = signal(false);
  texto = '';
  filtroRotulo: 'pendiente' | 'impreso' | null = null;
  filtroMensajero: number | null = null;
  filtroCanal: 'domicilio' | 'local' | null = 'domicilio';

  puedeVender = computed(() => this.sb.tiene('admin', 'vendedora'));
  /** Admin y alistamiento alistan, despachan e imprimen rótulos desde aquí */
  gestiona = computed(() => this.sb.tiene('admin', 'alistador'));
  esAdmin = computed(() => this.sb.tiene('admin'));

  grupos = computed<Grupo[]>(() => {
    const filas = this.filas();
    const conteos = this.conteos();
    return ORDEN_GRUPOS.map((estado) => {
      let pedidos = filas.filter((p) => p.estado === estado);
      // Alistados: el último que se alistó arriba (…3°, 2°, 1°)
      if (estado === 'alistado') pedidos = [...pedidos].sort((a, b) => this.puesto(b) - this.puesto(a));
      // En ruta: por mensajero y en el orden en que se le fueron asignando
      if (estado === 'despachado') {
        const ruta = this.ordenRuta();
        pedidos = [...pedidos].sort((a, b) =>
          this.nombreMensajero(a).localeCompare(this.nombreMensajero(b), 'es') || (ruta.get(a.id) ?? 1e9) - (ruta.get(b.id) ?? 1e9));
      }
      const total = Math.max(conteos[estado] ?? 0, pedidos.length);
      return {
        estado,
        etiqueta: ETIQUETA_GRUPO[estado],
        pedidos,
        total,
        subtotal: pedidos.reduce((s, p) => s + Number(p.total || 0), 0),
        completo: pedidos.length >= total,
      };
    }).filter((g) => g.pedidos.length);
  });
  visibles = computed(() => this.grupos().flatMap((g) => g.pedidos));
  /** Los seleccionados en el orden en que se fueron marcando (así se le asignan al mensajero) */
  selPedidos = computed(() => {
    const porId = new Map(this.visibles().map((p) => [p.id, p]));
    return [...this.sel()].map((id) => porId.get(id)).filter((p): p is Pedido => !!p);
  });
  /** Número de cada pedido en la selección (1, 2, 3…), para saber en qué orden se va a asignar */
  numSel = computed(() => new Map([...this.sel()].map((id, i) => [id, i + 1])));
  selPorAlistar = computed(() => this.selPedidos().filter((p) => this.puedeAlistar(p)));
  selAsignables = computed(() => this.selPedidos().filter((p) => this.puedeAsignar(p)));
  selImprimibles = computed(() => this.selPedidos().filter((p) => this.puedeImprimir(p)));
  todosSel = computed(() => this.visibles().length > 0 && this.visibles().every((p) => this.sel().has(p.id)));
  /** Alistados a los que les falta el rótulo (en la pestaña Alistados la lista está completa) */
  alistadosSinRotulo = computed(() => this.filas().filter((p) => p.estado === 'alistado' && !p.rotulo_impreso_at && p.canal !== 'local').length);
  hayFiltros = computed(() => {
    this.filas();
    return !!(this.texto.trim() || this.filtroRotulo || this.filtroMensajero);
  });
  vacioTitulo = computed(() => {
    const f = this.filtro();
    if (f === 'por_alistar') return 'No hay pedidos por alistar';
    if (f === 'alistado') return 'No hay pedidos alistados';
    if (f === 'despachado') return 'No hay pedidos en ruta';
    return 'Todavía no hay pedidos';
  });

  pesos = pesos;
  urlMini = urlMini;
  numero = numero;
  min = Math.min;
  variante = variante;

  private timer?: ReturnType<typeof setTimeout>;
  private dejarDeEscuchar?: () => void;
  private subParams?: { unsubscribe(): void };
  private cargaPendiente = false;
  private enCarga = false;

  constructor() {
    addIcons({ add, searchOutline, printOutline, cubeOutline, checkmarkCircle, close, ellipsisHorizontal, chatbubbleEllipses, alertCircleOutline });
  }

  ngOnInit(): void {
    // También cuando se toca un aviso estando ya en esta página
    this.subParams = this.route.queryParamMap.subscribe((q) => {
      const id = Number(q.get('id'));
      if (id) {
        this.abiertoEnChat.set(q.get('chat') === '1');
        this.abierto.set(id);
      }
    });
    this.ps.mensajeros().then((m) => this.mensajeros.set(m)).catch(() => undefined);
    // Desde Inicio ("Necesita atención") llega ?estado=alistado, por ejemplo
    const est = this.route.snapshot.queryParamMap.get('estado') as Filtro | null;
    if (est && this.filtros.some((f) => f.id === est)) this.filtro.set(est);
    // Desde el Inicio de alistamiento ("Sin rótulo") llega ?rotulo=pendiente
    const rot = this.route.snapshot.queryParamMap.get('rotulo');
    if (rot === 'pendiente' || rot === 'impreso') this.filtroRotulo = rot;
    this.irPagina(0);
    // Los cambios de otros (realtime) llegan seguidos: se agrupan en una sola recarga
    this.dejarDeEscuchar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 600);
    });
  }

  ngOnDestroy(): void {
    this.subParams?.unsubscribe();
    this.dejarDeEscuchar?.();
    clearTimeout(this.timer);
  }

  /** Nunca dos cargas a la vez: si llega otra mientras tanto, se repite al final */
  async cargar(): Promise<void> {
    if (this.enCarga) {
      this.cargaPendiente = true;
      return;
    }
    this.enCarga = true;
    // Solo se muestra la carga la primera vez; las recargas no parpadean
    if (!this.filas().length) this.cargando.set(true);
    try {
      const f = this.filtro();
      const base = {
        texto: this.texto,
        idsProducto: await this.ps.idsPorProducto(this.texto),
        rotulo: this.filtroCanal === 'local' ? null : this.filtroRotulo,
        canal: this.filtroCanal,
        mensajeroId: this.filtroMensajero,
        conItems: true,
      };
      const activos = f === 'todos' ? ACTIVOS : ACTIVOS.filter((e) => e === f);
      const cerrados = f === 'todos' ? CERRADOS : CERRADOS.filter((e) => e === f);
      const [a, c, conteos, orden, ruta] = await Promise.all([
        activos.length ? this.ps.listar({ ...base, estados: activos, estado: activos.length === 1 ? activos[0] : null, pagina: 0, porPagina: 1000 }) : null,
        cerrados.length ? this.ps.listar({ ...base, estados: cerrados, pagina: this.pagina(), porPagina: this.porPagina }) : null,
        this.ps.conteoPorEstado(base),
        this.ps.ordenAlistados(),
        this.ps.ordenEnRuta(),
      ]);
      this.filas.set([...(a?.filas ?? []), ...(c?.filas ?? [])]);
      this.totalCerrados.set(c?.total ?? 0);
      this.conteos.set({ ...conteos, todos: Object.values(conteos).reduce((s, n) => s + n, 0) });
      this.ordenAlistado.set(orden);
      this.ordenRuta.set(ruta);
      // La selección solo conserva lo que sigue en pantalla
      const ids = new Set(this.filas().map((p) => p.id));
      this.sel.set(new Set([...this.sel()].filter((id) => ids.has(id))));
      this.error.set('');
    } catch (e) {
      this.error.set('No se pudieron cargar los pedidos: ' + mensajeError(e));
    } finally {
      this.cargando.set(false);
      this.enCarga = false;
      if (this.cargaPendiente) {
        this.cargaPendiente = false;
        void this.cargar();
      }
    }
  }

  cambiarFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.sel.set(new Set());
    this.irPagina(0);
  }

  /** Las ventas en local nacen entregadas: al verlas se muestran todas */
  cambioCanal(): void {
    if (this.filtroCanal === 'local') {
      this.filtro.set('todos');
      this.filtroRotulo = null;
    } else if (this.filtro() === 'todos') {
      this.filtro.set('por_alistar');
    }
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

  quitarFiltros(): void {
    this.texto = '';
    this.filtroRotulo = null;
    this.filtroMensajero = null;
    this.filtro.set('todos');
    this.irPagina(0);
  }

  // ---------- Reglas ----------
  editable(p: Pedido): boolean {
    return p.estado !== 'entregado' && p.estado !== 'cancelado';
  }

  /** Mensajero: solo a los alistados (se despachan) y a los en ruta (se cambia de mensajero) */
  puedeAsignar(p: Pedido): boolean {
    return this.gestiona() && (p.estado === 'alistado' || p.estado === 'despachado') && p.canal !== 'local';
  }

  /** Rótulo: solo se imprime a los alistados */
  /** Rótulo: a los alistados y a los que ya van en ruta (por si hay que reimprimirlo) */
  puedeImprimir(p: Pedido): boolean {
    return (p.estado === 'alistado' || p.estado === 'despachado') && p.canal !== 'local';
  }

  puedeAlistar(p: Pedido): boolean {
    return this.gestiona() && p.estado === 'por_alistar' && p.canal !== 'local';
  }

  /** Editar y cancelar: solo el admin */
  puedeEditar(p: Pedido): boolean {
    return this.esAdmin() && p.estado !== 'cancelado';
  }

  puedeCancelar(p: Pedido): boolean {
    return this.esAdmin() && this.editable(p);
  }

  private puesto(p: Pedido): number {
    return this.ordenAlistado().get(p.id) ?? Number.MAX_SAFE_INTEGER;
  }

  /** "1°", "2°"… según el orden en que se alistó */
  ordinal(p: Pedido): string {
    const n = this.ordenAlistado().get(p.id);
    return n ? `${n}°` : '';
  }

  // ---------- Selección ----------
  alternar(id: number): void {
    const s = new Set(this.sel());
    if (s.has(id)) s.delete(id);
    else s.add(id);
    this.sel.set(s);
  }

  alternarTodos(): void {
    this.sel.set(this.todosSel() ? new Set() : new Set(this.visibles().map((p) => p.id)));
  }

  grupoSeleccionado(g: Grupo): boolean {
    return g.pedidos.every((p) => this.sel().has(p.id));
  }

  alternarGrupo(g: Grupo): void {
    const s = new Set(this.sel());
    const todos = this.grupoSeleccionado(g);
    g.pedidos.forEach((p) => (todos ? s.delete(p.id) : s.add(p.id)));
    this.sel.set(s);
  }

  limpiarSel(): void {
    this.sel.set(new Set());
  }

  // ---------- Acciones ----------
  /** Uno por uno, del más viejo al más nuevo, para que el orden de alistamiento siga el de los pedidos */
  async alistar(lista: Pedido[]): Promise<void> {
    this.menuAbierto.set(null);
    const enOrden = [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at));
    await this.enLote(enOrden, (p) => this.ps.cambiarEstado(p.id, 'alistado'), 'alistado(s)');
  }

  async quitarAlistado(p: Pedido): Promise<void> {
    this.menuAbierto.set(null);
    await this.enLote([p], (x) => this.ps.cambiarEstado(x.id, 'por_alistar'), 'devuelto(s) a por alistar');
  }

  /** Elegir mensajero despacha el pedido (pasa a En ruta); quitarlo lo devuelve a Alistados */
  cambioMensajero(p: Pedido, evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    void this.asignar(p, valor ? Number(valor) : null);
  }

  async asignar(p: Pedido, mensajeroId: number | null): Promise<void> {
    if ((mensajeroId ?? null) === (p.mensajero_id ?? null) || this.guardandoId()) return;
    if (!this.editable(p)) {
      await this.cargar();
      return;
    }
    this.guardandoId.set(p.id);
    try {
      if (mensajeroId) {
        if (p.estado === 'despachado') await this.ps.asignarMensajero(p.id, mensajeroId);
        else await this.ps.cambiarEstado(p.id, 'despachado', mensajeroId);
      } else {
        if (p.estado === 'despachado') await this.ps.cambiarEstado(p.id, 'alistado');
        await this.ps.asignarMensajero(p.id, null);
      }
    } catch (e) {
      this.toast.error('No se pudo asignar el mensajero. ' + mensajeError(e));
    } finally {
      this.guardandoId.set(null);
    }
    await this.cargar();
  }

  /**
   * Asigna el mismo mensajero a los seleccionados que todavía se puedan despachar,
   * uno por uno en el orden en que se marcaron: ese es el orden en que le quedan
   */
  asignarLote(evento: Event): void {
    const select = evento.target as HTMLSelectElement;
    const id = Number(select.value);
    select.value = ''; // vuelve a mostrar "Asignar mensajero"
    if (!id) return;
    const lista = this.selAsignables();
    if (!lista.length) return;
    void this.enLote(
      lista,
      (p) => (p.estado === 'despachado' ? this.ps.asignarMensajero(p.id, id) : this.ps.cambiarEstado(p.id, 'despachado', id)),
      'despachado(s)'
    );
  }

  async cancelar(p: Pedido): Promise<void> {
    this.menuAbierto.set(null);
    if (!confirm(`¿Cancelar el pedido #${p.id} de ${p.cliente_nombre}?`)) return;
    await this.enLote([p], (x) => this.ps.cambiarEstado(x.id, 'cancelado'), 'cancelado(s)');
  }

  /** Entregado por error o con el comprobante equivocado: vuelve a En ruta con el mismo mensajero */
  async devolverEntrega(p: Pedido): Promise<void> {
    this.menuAbierto.set(null);
    const quien = p.mensajero?.nombre ?? 'el mensajero';
    if (!confirm(`¿Devolver el pedido #${p.id} a En ruta? Se quita el pago y el comprobante, y ${quien} lo puede volver a marcar como entregado.`)) return;
    await this.enLote([p], (x) => this.ps.devolverEntrega(x.id), 'devuelto(s) a En ruta');
  }

  async eliminar(p: Pedido): Promise<void> {
    this.menuAbierto.set(null);
    if (p.estado === 'entregado') return;
    if (!confirm(`¿Eliminar el pedido #${p.id} de ${p.cliente_nombre}? Esta acción no se puede deshacer.`)) return;
    await this.enLote([p], (x) => this.ps.eliminar(x.id), 'eliminado(s)');
  }

  private async enLote(lista: Pedido[], accion: (p: Pedido) => Promise<void>, texto: string): Promise<void> {
    if (!lista.length || this.ocupado()) return;
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

  // ---------- Rótulos ----------
  /** Trae los pedidos alistados sin rótulo y los imprime */
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

  /** Los alistados salen primero y en el orden en que se alistaron; el resto, en el orden de la lista */
  async imprimirSeleccion(): Promise<void> {
    const ids = this.selImprimibles()
      .sort((a, b) => this.puesto(a) - this.puesto(b))
      .map((p) => p.id);
    if (!ids.length) return;
    this.imprimiendo.set(true);
    try {
      if (await this.rotulos.imprimir(() => this.ps.conItems(ids))) {
        this.sel.set(new Set());
        await this.cargar();
      }
    } finally {
      this.imprimiendo.set(false);
    }
  }

  /** Desde el menú "•••" de un pedido */
  async imprimirUno(p: Pedido): Promise<void> {
    this.menuAbierto.set(null);
    this.imprimiendo.set(true);
    try {
      if (await this.rotulos.imprimir(() => this.ps.conItems([p.id]))) await this.cargar();
    } finally {
      this.imprimiendo.set(false);
    }
  }

  // ---------- Detalle, menú y fotos ----------
  abrir(id: number, chat = false): void {
    this.menuAbierto.set(null);
    this.abiertoEnChat.set(chat);
    this.abierto.set(id);
    this.router.navigate([], { queryParams: { id, chat: chat ? 1 : null }, replaceUrl: true });
  }

  abrirChat(id: number): void {
    this.abrir(id, true);
  }

  cerrarDetalle(): void {
    this.abierto.set(null);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  alternarMenu(id: number): void {
    this.menuAbierto.set(this.menuAbierto() === id ? null : id);
  }

  foto(it: PedidoItem): string | null {
    return urlImagen(fotoDeItem(it));
  }

  /** Ficha del producto tocado en un pedido (como en el catálogo) */
  fichaProducto = signal<{ producto: Producto; fotos: FotoCatalogo[]; color: number | null } | null>(null);

  async abrirProducto(p: Pedido, it: PedidoItem, evento: Event): Promise<void> {
    evento.stopPropagation();
    if (!it.producto_id) return this.foto(it) ? this.verFotos(p, it, evento) : undefined;
    const { data, error } = await this.sb.client
      .from('productos')
      .select('*, colores:producto_colores(id, nombre, hex, imagen_url, orden)')
      .eq('id', it.producto_id)
      .maybeSingle();
    if (error) return this.toast.error(mensajeError(error));
    // Producto borrado: al menos se ven sus fotos
    if (!data) return this.foto(it) ? this.verFotos(p, it, evento) : this.toast.error('Ese producto ya no existe');
    const producto = { ...(data as Producto), colores: [...((data as Producto).colores ?? [])].sort((a, b) => a.orden - b.orden || a.id - b.id) };
    const color = producto.colores.find((c) => c.nombre === it.color)?.id ?? null;
    this.fichaProducto.set({ producto, fotos: galeriaProducto(producto), color });
  }

  /** Abre en el visor las fotos de los productos del pedido, empezando por la tocada */
  verFotos(p: Pedido, it: PedidoItem, evento: Event): void {
    evento.stopPropagation();
    const conFoto = (p.pedido_items ?? []).filter((x) => this.foto(x));
    this.visor.abrir(
      conFoto.map((x) => ({ url: this.foto(x)!, titulo: nombreConVariante(x) })),
      conFoto.findIndex((x) => x.id === it.id)
    );
  }

  inicial(nombre: string): string {
    return (nombre.trim()[0] ?? '?').toUpperCase();
  }

  nombreMensajero(p: Pedido): string {
    return p.mensajero?.nombre || this.mensajeros().find((m) => m.id === p.mensajero_id)?.nombre || 'Sin asignar';
  }

  fotoMensajero(id: number | null): string | null {
    if (!id) return null;
    return this.mensajeros().find((m) => m.id === id)?.avatar_url ?? null;
  }

  productosTexto(p: Pedido): string {
    return (p.pedido_items ?? []).map((i) => (i.cantidad > 1 ? `${nombreConVariante(i)} ×${i.cantidad}` : nombreConVariante(i))).join(', ');
  }

  /** "hoy, 8:32 p. m.", "ayer, …" o "12 oct, …" (y el año si no es este) */
  fecha(iso: string): string {
    const dia = diaColombiaDe(iso);
    const hoy = hoyColombiaISO();
    const hora = formatoHoraCO(iso);
    if (dia === hoy) return `hoy, ${hora}`;
    if (dia === sumarDias(hoy, -1)) return `ayer, ${hora}`;
    const conAno = dia.slice(0, 4) !== hoy.slice(0, 4);
    return formatoFechaCO(iso, { day: 'numeric', month: 'short', ...(conAno ? { year: 'numeric' } : {}) }) + `, ${hora}`;
  }

  fechaCompleta(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'long' }) + ' ' + formatoHoraCO(iso);
  }
}
