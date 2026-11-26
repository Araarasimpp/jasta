import { Component, Input } from '@angular/core';

/**
 * Ícono para el botón de Waze (dibujado para la app, al estilo de Waze): una carita
 * redonda con ojos, sonrisa y dos ruedas. Hereda el tamaño de la letra.
 */
@Component({
  selector: 'app-icono-waze',
  standalone: true,
  styles: [`:host { display: inline-flex; line-height: 0; } svg { width: 1em; height: 1em; }`],
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" [attr.width]="tam" [attr.height]="tam">
      <path d="M5.1 14.6C3.9 13.4 3.3 11.9 3.3 10.3 3.3 6.4 7.1 3.3 11.9 3.3s8.7 3.1 8.7 7.2c0 3.9-3.4 6.9-7.8 7.2H9.7c-1.6 0-3.1-.6-4.2-1.5-.6.6-1.5 1-2.3 1 .9-.7 1.6-1.6 1.9-2.6z"
        fill="#fff" stroke="#0b2a3a" stroke-width="1.5" stroke-linejoin="round" />
      <circle cx="9.4" cy="9.3" r="1" fill="#0b2a3a" />
      <circle cx="14.6" cy="9.3" r="1" fill="#0b2a3a" />
      <path d="M9.2 12.3c1.5 1.4 4.1 1.4 5.6 0" fill="none" stroke="#0b2a3a" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="8.6" cy="19.4" r="1.7" fill="#0b2a3a" />
      <circle cx="15.4" cy="19.4" r="1.7" fill="#0b2a3a" />
    </svg>
  `,
})
export class IconoWazeComponent {
  /** Tamaño en px (si no se da, usa el de la letra) */
  @Input() tam: number | null = null;
}
