import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

/** Foto en grande sobre fondo oscuro; se cierra tocando afuera o la equis */
@Component({
  selector: 'app-imagen-preview',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      .fondo { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center;
        padding: calc(24px + env(safe-area-inset-top)) 24px calc(24px + env(safe-area-inset-bottom));
        border: none; background: rgba(0, 0, 0, 0.85); cursor: zoom-out; }
      img { max-width: 100%; max-height: 100%; border-radius: 8px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); cursor: default; }
      .cerrar { position: fixed; z-index: 2001; top: max(16px, env(safe-area-inset-top)); right: 16px; width: 38px; height: 38px;
        display: flex; align-items: center; justify-content: center; border: none; border-radius: 50%;
        background: rgba(255, 255, 255, 0.15); color: #fff; font-size: 20px; cursor: pointer; }
    `,
  ],
  template: `
    <div class="fondo" (click)="cerrar.emit()">
      <button class="cerrar" aria-label="Cerrar foto" (click)="cerrar.emit()"><ion-icon name="close-outline"></ion-icon></button>
      @if (url) {
        <img [src]="url" [alt]="alt" (click)="$event.stopPropagation()" />
      }
    </div>
  `,
})
export class ImagenPreviewComponent {
  @Input() url: string | null = null;
  @Input() alt = '';
  @Output() cerrar = new EventEmitter<void>();

  constructor() {
    addIcons({ closeOutline });
  }
}
