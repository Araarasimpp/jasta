import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { invitadoGuard, rolGuard, sesionGuard } from './core/guards/guards';
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
  { path: 'auth/nueva-clave', loadComponent: () => import('./auth/nueva-clave/nueva-clave.page').then((m) => m.NuevaClavePage) },
  {
    path: 'app',
    canActivate: [sesionGuard],
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', canActivate: [redirigirInicio], children: [] },
      { path: 'espera', loadComponent: () => import('./paginas/espera/espera.page').then((m) => m.EsperaPage) },
      {
        path: 'inicio', canActivate: [rolGuard], data: { roles: ['admin', 'cuadres'] },
        loadComponent: () => import('./paginas/inicio/inicio.page').then((m) => m.InicioPage),
      },
      {
        path: 'pedidos', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora', 'alistador', 'cuadres'] },
        loadComponent: () => import('./paginas/pedidos/pedidos.page').then((m) => m.PedidosPage),
      },
      {
        path: 'pedidos/:id/editar', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora'] },
        loadComponent: () => import('./paginas/nuevo-pedido/nuevo-pedido.page').then((m) => m.NuevoPedidoPage),
      },
      {
        path: 'venta-local', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora', 'alistador'], modo: 'local' },
        loadComponent: () => import('./paginas/nuevo-pedido/nuevo-pedido.page').then((m) => m.NuevoPedidoPage),
      },
      {
        path: 'ventas-local', canActivate: [rolGuard], data: { roles: ['admin', 'vendedora', 'alistador', 'cuadres'] },
        loadComponent: () => import('./paginas/ventas-local/ventas-local.page').then((m) => m.VentasLocalPage),
      },
      {
        path: 'ranking',
        loadComponent: () => import('./paginas/ranking/ranking.page').then((m) => m.RankingPage),
      },
      {
        path: 'clientes', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/clientes/clientes.page').then((m) => m.ClientesPage),
      },
      {
        path: 'actividad', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/actividad/actividad.page').then((m) => m.ActividadPage),
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
        path: 'reportes', canActivate: [rolGuard], data: { roles: ['admin', 'cuadres', 'vendedora'] },
        loadComponent: () => import('./paginas/reportes/reportes.page').then((m) => m.ReportesPage),
      },
      {
        path: 'productos', canActivate: [rolGuard], data: { roles: ['admin'] },
        loadComponent: () => import('./paginas/productos/productos.page').then((m) => m.ProductosPage),
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
