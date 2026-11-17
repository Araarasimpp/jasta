import { IonIcon } from '@ionic/angular';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { pesos } from '../formato';
import { TransferenciasAlertaService } from './transferencias-alerta.service';

/** Franja roja arriba de todas las páginas (admins) mientras haya transferencias sin revisar */
@Component({
  selector: 'app-transferencias-alerta',
  standalone: true,
  imports: [RouterLink, IonIcon],
  styles: [
    `
      :host { display: contents; }
      a { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap;
        padding: 10px 16px; padding-top: calc(10px + env(safe-area-inset-top)); background: var(--danger); color: #fff; font-size: 14px; font-weight: 650;
        text-decoration: none; text-align: center; animation: latido 1.8s ease-in-out infinite; }
      a .ir { padding: 3px 12px; border-radius: 999px; background: #fff; color: var(--danger); font-size: 13px; font-weight: 750; white-space: nowrap; }
      @keyframes latido { 50% { filter: brightness(1.18); } }
      a .ico { display: inline-block; transform-origin: 50% 20%; animation: timbre 3s ease-in-out infinite; }
      @keyframes timbre { 0%, 80%, 100% { transform: rotate(0); } 84% { transform: rotate(16deg); } 88% { transform: rotate(-14deg); } 92% { transform: rotate(9deg); } 96% { transform: rotate(-5deg); } }
      @media (prefers-reduced-motion: reduce) { a, a .ico { animation: none; } }
    `,
  ],
  template: `
    @if (alerta.n() && !enPagina()) {
      <a routerLink="/app/transferencias" role="alert">
        <span><ion-icon class="ico" name="alert-circle" aria-hidden="true"></ion-icon>{{ alerta.n() }} {{ alerta.n() === 1 ? 'transferencia sin revisar' : 'transferencias sin revisar' }} · {{ pesos(alerta.valor()) }}</span>
        <span class="ir">Revisar ahora</span>
      </a>
    }
  `,
})
export class TransferenciasAlertaComponent {
  alerta = inject(TransferenciasAlertaService);
  private router = inject(Router);
  pesos = pesos;
  enPagina = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url.startsWith('/app/transferencias'))),
    { initialValue: this.router.url.startsWith('/app/transferencias') }
  );
}
