import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Cuadre, EstadoPedido, Nota, Pedido, Producto, TipoRecaudo, Usuario } from '../../shared/modelos';

export const SELECT_PEDIDO =
  '*, vendedora:usuarios!pedidos_vendedora_id_fkey(nombre), mensajero:usuarios!pedidos_mensajero_id_fkey(nombre)';

export interface FiltroPedidos {
  estado?: EstadoPedido | 'activos' | null;
  texto?: string;
  desde?: string | null; // ISO
  hasta?: string | null; // ISO
  vendedoraId?: number | null;
  mensajeroId?: number | null;
  rotulo?: 'pendiente' | 'impreso' | null;
  conItems?: boolean;
  canal?: 'domicilio' | 'local' | null;
  tipoRecaudo?: string | null;
  pagina?: number;
  porPagina?: number;
}

export interface ItemNuevo {
  producto_id: number;
  cantidad: number;
  precio_venta: number;
}

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private sb = inject(SupabaseService);

  private get db() {
    return this.sb.client;
  }

  private check<T>(r: { data: T; error: unknown }): T {
    if (r.error) throw r.error;
    return r.data;
  }

  async listar(f: FiltroPedidos): Promise<{ filas: Pedido[]; total: number }> {
    const porPagina = f.porPagina ?? 50;
    const pagina = f.pagina ?? 0;
    const campos = f.conItems ? SELECT_PEDIDO + ', pedido_items(id, nombre, cantidad)' : SELECT_PEDIDO;
    let q = this.db.from('pedidos').select(campos, { count: 'exact' });
    if (f.estado === 'activos') q = q.in('estado', ['por_alistar', 'alistado', 'despachado']);
    else if (f.estado) q = q.eq('estado', f.estado);
    if (f.desde) q = q.gte('created_at', f.desde);
    if (f.hasta) q = q.lte('created_at', f.hasta);
    if (f.vendedoraId) q = q.eq('vendedora_id', f.vendedoraId);
    if (f.mensajeroId) q = q.eq('mensajero_id', f.mensajeroId);
    if (f.canal) q = q.eq('canal', f.canal);
    if (f.tipoRecaudo) q = q.eq('tipo_recaudo', f.tipoRecaudo);
    if (f.rotulo === 'pendiente') q = q.is('rotulo_impreso_at', null);
    if (f.rotulo === 'impreso') q = q.not('rotulo_impreso_at', 'is', null);
    const t = (f.texto ?? '').trim().replace(/[,()%]/g, ' ').trim();
    if (t) {
      if (/^\d+$/.test(t)) q = q.or(`id.eq.${t},cliente_telefono.ilike.%${t}%`);
      else q = q.or(`cliente_nombre.ilike.%${t}%,barrio.ilike.%${t}%,direccion.ilike.%${t}%`);
    }
    // Los alistados van en el orden en que se alistaron (1°, 2°, 3°…), como en Kaesuri
    q = f.estado === 'alistado'
      ? q.order('alistado_at', { ascending: true, nullsFirst: true }).order('id')
      : q.order('created_at', { ascending: false });
    const r = await q.range(pagina * porPagina, pagina * porPagina + porPagina - 1);
    if (r.error) throw r.error;
    return { filas: (r.data ?? []) as unknown as Pedido[], total: r.count ?? 0 };
  }

  /** Pedidos completos (con productos) por id, para imprimir rótulos */
  async conItems(ids: number[]): Promise<Pedido[]> {
    if (!ids.length) return [];
    const r = this.check(await this.db.from('pedidos').select(SELECT_PEDIDO + ', pedido_items(*)').in('id', ids));
    const porId = new Map(((r ?? []) as unknown as Pedido[]).map((p) => [p.id, p]));
    return ids.map((id) => porId.get(id)).filter((p): p is Pedido => !!p);
  }

  /** Alistados sin rótulo, en orden de alistamiento */
  async alistadosSinRotulo(): Promise<Pedido[]> {
    const r = this.check(
      await this.db
        .from('pedidos')
        .select(SELECT_PEDIDO + ', pedido_items(*)')
        .eq('estado', 'alistado')
        .is('rotulo_impreso_at', null)
        .order('alistado_at', { ascending: true, nullsFirst: true })
        .order('id')
    );
    return (r ?? []) as unknown as Pedido[];
  }

  async conteoPorEstado(): Promise<Record<string, number>> {
    const estados: EstadoPedido[] = ['por_alistar', 'alistado', 'despachado'];
    const res = await Promise.all(
      estados.map((e) => this.db.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', e))
    );
    const out: Record<string, number> = {};
    estados.forEach((e, i) => (out[e] = res[i].count ?? 0));
    return out;
  }

  async cola(estados: EstadoPedido[], mensajeroId?: number): Promise<Pedido[]> {
    let q = this.db.from('pedidos').select(SELECT_PEDIDO + ', pedido_items(*)').in('estado', estados);
    if (mensajeroId) q = q.eq('mensajero_id', mensajeroId);
    return this.check(await q.order('created_at', { ascending: true }).limit(300)) as unknown as Pedido[];
  }

  async detalle(id: number): Promise<{ pedido: Pedido; notas: Nota[] }> {
    const [p, n] = await Promise.all([
      this.db.from('pedidos').select(SELECT_PEDIDO + ', pedido_items(*)').eq('id', id).single(),
      this.db.from('pedido_notas').select('id, created_at, autor, nota').eq('pedido_id', id).order('created_at').order('id'),
    ]);
    return { pedido: this.check(p) as unknown as Pedido, notas: (this.check(n) ?? []) as Nota[] };
  }

  async crearVentaLocal(datos: {
    cliente_nombre: string;
    cliente_telefono: string;
    observaciones: string;
    items: ItemNuevo[];
    tipo: string;
    efectivo: number;
    transferencia: number;
  }): Promise<number> {
    return this.check(
      await this.db.rpc('crear_venta_local', {
        p_cliente_nombre: datos.cliente_nombre,
        p_cliente_telefono: datos.cliente_telefono,
        p_observaciones: datos.observaciones,
        p_items: datos.items,
        p_tipo: datos.tipo,
        p_efectivo: datos.efectivo,
        p_transferencia: datos.transferencia,
      })
    ) as number;
  }

  async editar(
    id: number,
    datos: { cliente_nombre: string; cliente_telefono: string; direccion: string; barrio: string; observaciones: string; valor_domicilio: number; items: ItemNuevo[] }
  ): Promise<void> {
    this.check(
      await this.db.rpc('editar_pedido', {
        p_pedido: id,
        p_cliente_nombre: datos.cliente_nombre,
        p_cliente_telefono: datos.cliente_telefono,
        p_direccion: datos.direccion,
        p_barrio: datos.barrio,
        p_observaciones: datos.observaciones,
        p_valor_domicilio: datos.valor_domicilio,
        p_items: datos.items,
      })
    );
  }

  async crear(datos: {
    cliente_nombre: string;
    cliente_telefono: string;
    direccion: string;
    barrio: string;
    observaciones: string;
    valor_domicilio: number;
    items: ItemNuevo[];
  }): Promise<number> {
    return this.check(
      await this.db.rpc('crear_pedido', {
        p_cliente_nombre: datos.cliente_nombre,
        p_cliente_telefono: datos.cliente_telefono,
        p_direccion: datos.direccion,
        p_barrio: datos.barrio,
        p_observaciones: datos.observaciones,
        p_valor_domicilio: datos.valor_domicilio,
        p_items: datos.items,
      })
    ) as number;
  }

  async cambiarEstado(id: number, estado: EstadoPedido, mensajeroId: number | null = null): Promise<void> {
    this.check(await this.db.rpc('cambiar_estado', { p_pedido: id, p_estado: estado, p_mensajero: mensajeroId }));
  }

  async asignarMensajero(id: number, mensajeroId: number): Promise<void> {
    this.check(await this.db.rpc('asignar_mensajero', { p_pedido: id, p_mensajero: mensajeroId }));
  }

  async entregar(id: number, tipo: TipoRecaudo, efectivo: number, transferencia: number): Promise<void> {
    this.check(
      await this.db.rpc('entregar_pedido', { p_pedido: id, p_tipo: tipo, p_efectivo: efectivo, p_transferencia: transferencia })
    );
  }

  async mensajeros(): Promise<Usuario[]> {
    const r = this.check(
      await this.db.from('usuarios').select('*').contains('roles', ['mensajero']).eq('activo', true).order('nombre')
    );
    return (r ?? []) as Usuario[];
  }

  async usuarios(): Promise<Usuario[]> {
    return (this.check(await this.db.from('usuarios').select('*').order('activo', { ascending: false }).order('nombre')) ??
      []) as Usuario[];
  }

  async productosActivos(): Promise<Producto[]> {
    return (this.check(
      await this.db
        .from('productos')
        .select('id,nombre,sku,codigo_barras,precio_venta,precio_base,precio_compra,stock,controla_stock,imagen_url,activo')
        .eq('activo', true)
        .order('nombre')
    ) ?? []) as Producto[];
  }

  async barrios(): Promise<{ barrio: string; domicilio: number; usos: number }[]> {
    return (this.check(await this.db.rpc('barrios')) ?? []) as { barrio: string; domicilio: number; usos: number }[];
  }

  async buscarCliente(tel: string) {
    const r = this.check(await this.db.rpc('buscar_cliente', { p_telefono: tel })) as {
      cliente_nombre: string;
      direccion: string;
      barrio: string;
      valor_domicilio: number;
      pedidos: number;
    }[];
    return r?.[0] ?? null;
  }

  async cuadresPendientes() {
    return (this.check(await this.db.rpc('cuadres_pendientes')) ?? []) as {
      mensajero_id: number;
      nombre: string;
      pedidos: number;
      efectivo: number;
      transferencia: number;
      domicilios: number;
      desde: string;
    }[];
  }

  async cerrarCuadre(mensajeroId: number): Promise<number> {
    return this.check(await this.db.rpc('cerrar_cuadre', { p_mensajero: mensajeroId })) as number;
  }

  async historialCuadres(pagina: number, mensajeroId?: number | null, desde?: string | null, hasta?: string | null): Promise<Cuadre[]> {
    let q = this.db.from('cuadres').select('*, mensajero:usuarios!cuadres_mensajero_id_fkey(nombre)');
    if (mensajeroId) q = q.eq('mensajero_id', mensajeroId);
    if (desde) q = q.gte('cerrado_at', desde);
    if (hasta) q = q.lte('cerrado_at', hasta);
    return (this.check(await q.order('cerrado_at', { ascending: false }).range(pagina * 30, pagina * 30 + 29)) ??
      []) as unknown as Cuadre[];
  }

  async pedidosDeCuadre(cuadreId: number): Promise<Pedido[]> {
    return (this.check(
      await this.db.from('pedidos').select(SELECT_PEDIDO).eq('cuadre_id', cuadreId).order('entregado_at')
    ) ?? []) as unknown as Pedido[];
  }

  /** Pedidos que entregó un mensajero en un rango (por fecha de entrega) */
  async entregadosPor(mensajeroId: number, desde: string | null, hasta: string | null): Promise<Pedido[]> {
    let q = this.db.from('pedidos').select(SELECT_PEDIDO).eq('mensajero_id', mensajeroId).eq('estado', 'entregado');
    if (desde) q = q.gte('entregado_at', desde);
    if (hasta) q = q.lte('entregado_at', hasta);
    return (this.check(await q.order('entregado_at', { ascending: false }).limit(300)) ?? []) as unknown as Pedido[];
  }

  async pendientesDe(mensajeroId: number): Promise<Pedido[]> {
    return (this.check(
      await this.db
        .from('pedidos')
        .select(SELECT_PEDIDO)
        .eq('mensajero_id', mensajeroId)
        .eq('estado', 'entregado')
        .is('cuadre_id', null)
        .order('entregado_at')
    ) ?? []) as unknown as Pedido[];
  }

  /** Avisa cuando cambia cualquier pedido (para refrescar listas) */
  escuchar(cb: () => void): () => void {
    const canal = this.db
      .channel('pedidos-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => cb())
      .subscribe();
    return () => void this.db.removeChannel(canal);
  }
}
