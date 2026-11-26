import { Component, Input } from '@angular/core';

/** Logo de Waze (la imagen que dio el negocio) para los botones que abren Waze. Hereda el tamaño de la letra. */
@Component({
  selector: 'app-icono-waze',
  standalone: true,
  styles: [`:host { display: inline-flex; line-height: 0; } img { width: 1em; height: 1em; border-radius: 22%; display: block; }`],
  template: `<img src="assets/icon/waze.png" alt="" aria-hidden="true" [style.width.px]="tam" [style.height.px]="tam" />`,
})
export class IconoWazeComponent {
  /** Tamaño en px (si no se da, usa el de la letra) */
  @Input() tam: number | null = null;
}
