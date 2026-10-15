import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';
import { Rol } from '../../shared/modelos';

/** Requiere sesión iniciada */
export const sesionGuard: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  return sb.session() ? true : router.parseUrl('/auth/login');
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

/** Para login/registro: si ya hay sesión, se va al inicio */
export const invitadoGuard: CanActivateFn = async () => {
  const sb = inject(SupabaseService);
  const router = inject(Router);
  await sb.asegurar();
  return sb.session() ? router.parseUrl(sb.inicioSegunRoles()) : true;
};
