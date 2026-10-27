import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { invitadoGuard, pedidosGuard, rolGuard, sesionGuard } from './core/guards/guards';
import { SupabaseService } from './core/services/supabase.service';

/** "/" lleva a la pantalla que le toca a cada quien */
const redirigirInicio = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  return router.parseUrl(sb.session() ? sb.inicioSegunRoles() : '/auth/login');
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [redirigirInicio], children: [] },
  { path: 'auth/login', canActivate: [invitadoGuard], loadComponent: () => import('./auth/login/login.page').then((m) => m.LoginPage) },
  { path: 'auth/registro', canActivate: [invitadoGuard], loadComponent: () => import('./auth/registro/registro.page').then((m) => m.RegistroPage) },
  { path: 'auth/recuperar', loadComponent: () => import('./auth/recuperar/recuperar.page').then((m) => m.RecuperarPage) },
  // Público (sin sesión): catálogo con pedido directo (general o de una vendedora)
  { path: 'tienda', loadComponent: () => import('./tienda/tienda.page').then((m) => m.TiendaPage) },
  { path: 'tienda/:codigo', loadComponent: () => import('./tienda/tienda.page').then((m) => m.TiendaPage) },
  // Público (sin sesión): el cliente ve en qué va su pedido con el enlace que le mandaron
  { path: 'seguimiento/:codigo', loadComponent: () => import('./seguimiento/seguimiento.page').then((m) => m.SeguimientoPage) },
  { path: 'auth/nueva-clave', loadComponent: () => import('./auth/nueva-clave/nueva-clave.page').then((m) => m.NuevaClavePage) },
  {
    path: 'app',
    canActivate: [sesionGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [redirigirInicio], children: [] },
      { path: 'espera', loadComponent: () => import('./paginas/espera/espera.page').then((m) => m.EsperaPage) },
      {
        path: 'inicio', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        // Inicio de alistamiento: pedidos, tiempos y lo que hay por alistar (sin plata)
        path: 'tablero', canActivate: [rolGuard], data: { roles: ['admin', 'alistador'] },
        loadComponent: () => import('./paginas/tablero/tablero.page').then((m) => m.TableroPage),
      },
      {
        // La vendedora no ve la lista de pedidos: sus avisos (?id=…&chat=1) la llevan a Mi panel
        path: 'pedidos', canActivate: [pedidosGuard, rolGuard], data: { roles: ['admin', 'alistador', 'cuadres'] },
        loadComponent: () => import('./paginas/pedidos/pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'mi-panel', canActivate: [rolGuard], data: { roles: ['vendedora'] },
        loadComponent: () => import('./paginas/mi-panel/mi-panel.page').then((m) => m.MiPanelPage),
      },
      {
        path: 'pedidos/:id/editar', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/nuevo-pedido/nuevo-pedido.page').then((m) => m.NuevoPedidoPage),
      },
      {
        path: 'venta-local', canActivate: [rolGuard], data: { roles: ['admin', 'venta_local'], modo: 'local' },
        loadComponent: () => import('./paginas/nuevo-pedido/nuevo-pedido.page').then((m) => m.NuevoPedidoPage),
      },
      {
        path: 'ventas-local', canActivate: [rolGuard], data: { roles: ['admin', 'venta_local'] },
        loadComponent: () => import('./paginas/ventas-local/ventas-local.page').then((m) => m.VentasLocalPage),
      },
      {
        path: 'recolector', canActivate: [rolGuard], data: { roles: ['admin', 'recolector', 'cuadres'] },
        loadComponent: () => import('./paginas/recolector/recolector.page').then((m) => m.RecolectorPage),
      },
      { path: 'alcancia', redirectTo: 'servicio-local', pathMatch: 'full' },
      {
        path: 'servicio-local', canActivate: [rolGuard], data: { roles: ['admin', 'venta_local', 'cuadres'] },
        loadComponent: () => import('./paginas/alcancia/alcancia.page').then((m) => m.AlcanciaPage),
      },
      {
        path: 'ranking',
        loadComponent: () => import('./paginas/ranking/ranking.page').then((m) => m.RankingPage),
      },
      {
        path: 'clientes', canActivate: [rolGuard], data: { roles: ['admin', 'venta_local'] },
        loadComponent: () => import('./paginas/clientes/clientes.page').then((m) => m.ClientesPage),
      },
      {
        // Pedidos que no se pudieron entregar (motivo y qué pasó)
        path: 'novedades', canActivate: [rolGuard], data: { roles: ['admin', 'alistador', 'cuadres', 'vendedora', 'mensajero'] },
        loadComponent: () => import('./paginas/novedades/novedades.page').then((m) => m.NovedadesPage),
      },
      {
        // El admin paga las comisiones; la vendedora ve lo que tiene por cobrar y sus pagos
        path: 'comisiones', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora'] },
        loadComponent: () => import('./paginas/comisiones/comisiones.page').then((m) => m.ComisionesPage),
      },
      {
        // Stock, conteos, historial por producto y compras a proveedores
        path: 'inventario', canActivate: [rolGuard], data: { roles: ['admin', 'alistador'] },
        loadComponent: () => import('./paginas/inventario/inventario.page').then((m) => m.InventarioPage),
      },
      {
        path: 'devoluciones', canActivate: [rolGuard], data: { roles: ['admin', 'alistador', 'venta_local', 'cuadres'] },
        loadComponent: () => import('./paginas/devoluciones/devoluciones.page').then((m) => m.DevolucionesPage),
      },
      {
        path: 'rentabilidad', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/rentabilidad/rentabilidad.page').then((m) => m.RentabilidadPage),
      },
      {
        path: 'gastos', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/gastos/gastos.page').then((m) => m.GastosPage),
      },
      {
        path: 'actividad', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/actividad/actividad.page').then((m) => m.ActividadPage),
      },
      {
        // Pedidos que llegan del catálogo público, para confirmar con el cliente
        path: 'pedidos-web', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora'] },
        loadComponent: () => import('./paginas/pedidos-web/pedidos-web.page').then((m) => m.PedidosWebPage),
      },
      {
        // Lo nuevo de la app, explicado (lo leen todos)
        path: 'actualizaciones',
        loadComponent: () => import('./paginas/actualizaciones/actualizaciones.page').then((m) => m.ActualizacionesPage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./paginas/perfil/perfil.page').then((m) => m.PerfilPage),
      },
      {
        path: 'pedidos/nuevo', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora'] },
        loadComponent: () => import('./paginas/nuevo-pedido/nuevo-pedido.page').then((m) => m.NuevoPedidoPage),
      },
      {
        path: 'mis-entregas', canActivate: [rolGuard], data: { roles: ['mensajero', 'admin'] },
        loadComponent: () => import('./paginas/mis-entregas/mis-entregas.page').then((m) => m.MisEntregasPage),
      },
      {
        path: 'cuadres', canActivate: [rolGuard], data: { roles: ['admin', 'cuadres', 'mensajero'] },
        loadComponent: () => import('./paginas/cuadres/cuadres.page').then((m) => m.CuadresPage),
      },
      {
        path: 'reportes', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora'] },
        loadComponent: () => import('./paginas/reportes/reportes.page').then((m) => m.ReportesPage),
      },
      {
        path: 'catalogo', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora'] },
        loadComponent: () => import('./paginas/catalogo/catalogo.page').then((m) => m.CatalogoPage),
      },
      {
        path: 'productos', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/productos/productos.page').then((m) => m.ProductosPage),
      },
      {
        path: 'barrios', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/barrios/barrios.page').then((m) => m.BarriosPage),
      },
      {
        path: 'configuracion', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/configuracion/configuracion.page').then((m) => m.ConfiguracionPage),
      },
      {
        path: 'usuarios', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/usuarios/usuarios.page').then((m) => m.UsuariosPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
