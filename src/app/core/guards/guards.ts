import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { Rol } from '../../shared/modelos';

/** Sesión de un cliente de la tienda (no es del equipo): su lugar es Mi cuenta, no la app de adentro */
async function esCliente(sb: SupabaseService): Promise<boolean> {
  if (!sb.session() || sb.usuario()) return false;
  const { data } = await sb.client.rpc('cliente_yo');
  return !!data;
}

/** Requiere sesión iniciada (del equipo; un cliente va a su cuenta de la tienda) */
export const sesionGuard: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  if (!sb.session()) return router.parseUrl('/auth/login');
  return (await esCliente(sb)) ? router.parseUrl('/tienda/cuenta') : true;
};

/** Requiere alguno de los roles dados (se pasan en data.roles) */
export const rolGuard: CanActivateFn = async (route) => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  const roles = (route.data['roles'] as Rol[] | undefined) ?? [];
  if (!roles.length || sb.tiene(...roles)) return true;
  return router.parseUrl(sb.inicioSegunRoles());
};

/** La vendedora (sin otro rol que vea pedidos) va a Mi panel, con el mismo ?id=…&chat=… */
export const pedidosGuard: CanActivateFn = async (route) => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  if (sb.tiene('admin', 'alistador', 'cuadres') || !sb.tiene('vendedora')) return true;
  return router.createUrlTree(['/app/mi-panel'], { queryParams: route.queryParams });
};

/** Para login/registro: si ya hay sesión, se va al inicio */
export const invitadoGuard: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  if (!sb.session()) return true;
  return router.parseUrl((await esCliente(sb)) ? '/tienda/cuenta' : sb.inicioSegunRoles());
};
