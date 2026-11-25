import { IonIcon } from '@ionic/angular';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { GarantiasAlertaService } from './garantias-alerta.service';

/** Franja arriba de todas las páginas (admin y alistamiento) desde la 1 p. m. si hay garantías sin resolver */
@Component({
  selector: 'app-garantias-alerta',
  standalone: true,
  imports: [RouterLink, IonIcon],
  styles: [
    `
      :host { display: contents; }
      a { position: sticky; top: 0; z-index: 29; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
        padding: 10px 16px; padding-top: calc(10px + env(safe-area-inset-top)); background: #b7791f; color: #fff; font-size: 14px; font-weight: 650;
        text-decoration: none; text-align: center; }
      a .ir { padding: 3px 12px; border-radius: 999px; background: #fff; color: #8a5a12; font-size: 13px; font-weight: 750; white-space: nowrap; }
      a ion-icon { vertical-align: -2px; margin-right: 6px; }
    `,
  ],
  template: `
    @if (alerta.mostrar() && !enPagina()) {
      <a routerLink="/app/devoluciones" role="alert">
        <span><ion-icon name="construct" aria-hidden="true"></ion-icon>{{ alerta.n() === 1 ? 'Hay 1 garantía pendiente' : 'Hay ' + alerta.n() + ' garantías pendientes' }}</span>
        <span class="ir">Revisar</span>
      </a>
    }
  `,
})
export class GarantiasAlertaComponent {
  alerta = inject(GarantiasAlertaService);
  private router = inject(Router);
  enPagina = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url.startsWith('/app/devoluciones'))),
    { initialValue: this.router.url.startsWith('/app/devoluciones') }
  );
}
