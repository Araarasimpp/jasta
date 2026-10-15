import { Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  template: `
    @if (t.mensaje(); as m) {
      <div class="toast" [class.mal]="m.mal" role="status">{{ m.texto }}</div>
    }
  `,
})
export class ToastComponent {
  t = inject(ToastService);
}
