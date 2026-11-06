import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { fotoFondoGuardada } from '../../core/services/fondo.service';

/**
 * Lado de la foto en las pantallas de cuenta (login, registro, recuperar, nueva clave):
 * carrusel de fotos (la del tema primero) con corte en diagonal, logo arriba y puntos abajo.
 */
@Component({
  selector: 'app-auth-marca',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  styles: [
    `
      :host { position: relative; display: block; overflow: hidden; background: #0e1015; color: #fff; }
      .foto { position: absolute; inset: 0; background: center / cover no-repeat; opacity: 0; transform: scale(1.08);
        transition: opacity 1.2s ease, transform 7s ease-out; }
      .foto.on { opacity: 1; transform: scale(1); }
      .sombra { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,12,16,.35), transparent 30%, transparent 60%, rgba(10,12,16,.55)); }
      .marca { position: absolute; top: 28px; left: 30px; display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; letter-spacing: -.01em;
        animation: entra 600ms ease 200ms both; }
      .marca span { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 12px; background: #fff; box-shadow: 0 8px 20px rgba(0,0,0,.25); }
      .marca img { width: 28px; height: 28px; object-fit: contain; }
      .texto { position: absolute; left: 30px; bottom: 64px; max-width: 360px; animation: entra 700ms ease 350ms both; }
      .texto strong { display: block; font-size: 40px; font-weight: 800; letter-spacing: -.04em; line-height: 1.05; }
      .texto strong i { font-style: normal; color: #8fb3ff; }
      .texto p { margin: 10px 0 0; font-size: 16px; line-height: 1.45; color: rgba(255,255,255,.82); }
      .puntos { position: absolute; left: 30px; bottom: 30px; display: flex; gap: 6px; }
      .puntos button { width: 10px; height: 4px; padding: 0; border: 0; border-radius: 999px; background: rgba(255,255,255,.45); cursor: pointer; transition: width 300ms ease, background 300ms ease; }
      .puntos button.on { width: 26px; background: #fff; }
      @keyframes entra { from { opacity: 0; transform: translateY(10px); } }
      @media (max-width: 820px) {
        .marca { top: calc(18px + env(safe-area-inset-top)); left: 22px; }
        .texto { display: none; }
        .puntos { display: none; }
      }
      @media (prefers-reduced-motion: reduce) { .foto { transition: opacity 300ms; transform: none; } }
    `,
  ],
  template: `
    @for (f of fotos; track f; let i = $index) {
      <div class="foto" [class.on]="i === actual()" [style.background-image]="'url(' + f + ')'"></div>
    }
    <div class="sombra"></div>
    <div class="marca"><span><img src="assets/icon/logo.png" alt="" /></span>Jasta</div>
    <div class="texto">
      <strong>Jasta<i>.</i></strong>
      <p>Hobbies y accesorios,<br />tus pedidos en orden.</p>
    </div>
    @if (fotos.length > 1) {
      <div class="puntos">
        @for (f of fotos; track f; let i = $index) {
          <button type="button" tabindex="-1" [class.on]="i === actual()" (click)="ir(i)"></button>
        }
      </div>
    }
  `,
})
export class AuthMarcaComponent implements OnInit, OnDestroy {
  /** La foto del tema primero y luego dos más (sin repetir) */
  readonly fotos = [...new Set([fotoFondoGuardada(), 'assets/fondos/estrellas.webp', 'assets/fondos/lago.webp'])].slice(0, 3);
  actual = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.reiniciar();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  ir(i: number): void {
    this.actual.set(i);
    this.reiniciar();
  }

  private reiniciar(): void {
    clearInterval(this.timer);
    if (this.fotos.length > 1) this.timer = setInterval(() => this.actual.set((this.actual() + 1) % this.fotos.length), 6000);
  }
}
