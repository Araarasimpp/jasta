import { Injectable, inject } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, from, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { SupabaseService } from './services/supabase.service';

/** Páginas de los clientes: no necesitan nada de la parte de adentro de la app */
const PUBLICA = /^\/(tienda|seguimiento|pago)(\/|$)/;

/**
 * Precarga las pantallas para que abran al instante, pero sin estorbar al arrancar:
 * · espera a que la página cargue y el celular esté libre, y baja una pantalla a la vez;
 * · solo las que la persona puede abrir según su rol;
 * · nada en el catálogo, seguimiento o pago de los clientes, ni con ahorro de datos o 2G.
 * (Antes se bajaban todas las pantallas apenas abría la app, unos 2,5 MB.)
 */
@Injectable({ providedIn: 'root' })
export class PrecargaDiferida implements PreloadingStrategy {
  private sb = inject(SupabaseService);
  private cola: Promise<unknown> = this.listo();

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (PUBLICA.test(location.pathname) || this.ahorroDeDatos()) return of(null);
    const path = route.path ?? '';
    // Las páginas públicas no las necesita el equipo
    if (/^(tienda|seguimiento|pago)/.test(path)) return of(null);
    return from(this.turno()).pipe(
      mergeMap(() => {
        // Con sesión: solo lo que su rol puede abrir (sin sesión, solo el login y la cuenta)
        const roles = (route.data?.['roles'] as string[] | undefined) ?? null;
        const mios = this.sb.roles() as string[];
        if (roles && !roles.some((r) => mios.includes(r))) return of(null);
        if (!this.sb.session() && path === 'app') return of(null);
        return load();
      }),
    );
  }

  /** Una pantalla a la vez, cada una cuando el celular está libre */
  private turno(): Promise<void> {
    const t = this.cola.then(() => new Promise<void>((ok) => this.libre(ok)));
    this.cola = t;
    return t;
  }

  /** Empieza 3 s después de que la página terminó de cargar */
  private listo(): Promise<void> {
    return new Promise((ok) => {
      const empezar = () => setTimeout(ok, 3000);
      if (document.readyState === 'complete') empezar();
      else window.addEventListener('load', empezar, { once: true });
    });
  }

  private libre(ok: () => void): void {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => ok(), { timeout: 2000 });
    else setTimeout(ok, 200);
  }

  private ahorroDeDatos(): boolean {
    const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ''));
  }
}
