import { Component, Input } from '@angular/core';
import { EstadoPedido } from '../modelos';

/**
 * Ícono de estado de un pedido, como en Home ALS. Cada estado tiene una forma
 * distinta (no solo un color), para que se distinga también en blanco y negro
 * o con daltonismo:
 *  - por alistar: círculo punteado
 *  - alistado: círculo con un punto en el centro
 *  - en ruta: círculo a medio llenar
 *  - entregado: círculo lleno con chulo
 *  - cancelado: círculo con equis
 */
@Component({
  selector: 'app-estado-icon',
  standalone: true,
  template: `
    @switch (estado) {
      @case ('por_alistar') {
        <svg viewBox="0 0 16 16" [attr.width]="size" [attr.height]="size" role="img" aria-label="Por alistar">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--st-pendiente)" stroke-width="1.6" stroke-dasharray="2.4 2" />
        </svg>
      }
      @case ('alistado') {
        <svg viewBox="0 0 16 16" [attr.width]="size" [attr.height]="size" role="img" aria-label="Alistado">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--st-alistado)" stroke-width="1.6" />
          <circle cx="8" cy="8" r="2.6" fill="var(--st-alistado)" />
        </svg>
      }
      @case ('despachado') {
        <svg viewBox="0 0 16 16" [attr.width]="size" [attr.height]="size" role="img" aria-label="En ruta">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--st-ruta)" stroke-width="1.6" />
          <path d="M8 4a4 4 0 0 1 0 8z" fill="var(--st-ruta)" />
        </svg>
      }
      @case ('entregado') {
        <svg viewBox="0 0 16 16" [attr.width]="size" [attr.height]="size" role="img" aria-label="Entregado">
          <circle cx="8" cy="8" r="7" fill="var(--st-entregado)" />
          <path d="m5 8.2 2 2 4-4.2" fill="none" stroke="var(--surface)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      }
      @case ('cancelado') {
        <svg viewBox="0 0 16 16" [attr.width]="size" [attr.height]="size" role="img" aria-label="Cancelado">
          <circle cx="8" cy="8" r="6" fill="none" stroke="var(--st-cancelado)" stroke-width="1.6" />
          <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" stroke="var(--st-cancelado)" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      }
    }
  `,
  styles: [':host { display: inline-flex; flex-shrink: 0; }'],
})
export class EstadoIconComponent {
  @Input({ required: true }) estado!: EstadoPedido;
  @Input() size = 14;
}
