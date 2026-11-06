import { bootstrapApplication } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading, withViewTransitions } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { PrecargaDiferida } from './app/core/precarga';
import { entradaEnCascada } from './app/core/cascada';

/** La ruta completa (sin filtros) de una navegación, para no animar cuando solo cambian los filtros */
function ruta(s: ActivatedRouteSnapshot): string {
  let x = s;
  while (x.firstChild) x = x.firstChild;
  return x.pathFromRoot.flatMap((r) => r.url.map((u) => u.path)).join('/');
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    // Sin el gesto de "deslizar desde el borde para volver" de Ionic: la app es
    // una sola página con su propio menú y ese gesto atrapaba toques en el borde
    provideIonicAngular({ swipeBackEnabled: false }),
    provideRouter(
      routes,
      // Precarga las pantallas de a una, cuando el celular está libre y solo las del rol (ver core/precarga.ts)
      withPreloading(PrecargaDiferida),
      withComponentInputBinding(),
      // Animación al cambiar de página (la del navegador; donde no existe, cambia sin animación)
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: ({ transition, from, to }) => {
          const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reducir || ruta(from) === ruta(to)) { transition.skipTransition(); return; }
          // Las tarjetas de la página nueva entran en cascada mientras la anterior se desenfoca
          transition.updateCallbackDone.then(() => entradaEnCascada()).catch(() => {});
        },
      }),
    ),
  ],
})
  // Quita la pantalla de carga (index.html) cuando la app ya arrancó
  .then(() => (window as unknown as { jastaLista?: () => void }).jastaLista?.())
  .catch(() => (window as unknown as { jastaLista?: () => void }).jastaLista?.());
