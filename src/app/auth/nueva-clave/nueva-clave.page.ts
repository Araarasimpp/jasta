import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-nueva-clave',
  standalone: true,
  imports: [FormsModule],
  styleUrls: ['../auth-shell.scss'],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-head">
          <img class="brand-mark" src="assets/icon/logo.png" alt="Jasta" />
          <div><h1>Nueva contraseña</h1><p>Escribe la contraseña que vas a usar de ahora en adelante.</p></div>
        </div>
        <form class="auth-form" (ngSubmit)="guardar()">
          <div class="field">
            <label for="password">Contraseña nueva <span>(mínimo 8 caracteres)</span></label>
            <input id="password" name="password" type="password" autocomplete="new-password" [(ngModel)]="password" />
          </div>
          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }
          <button type="submit" class="submit-btn" [disabled]="cargando()">{{ cargando() ? 'Guardando…' : 'Guardar' }}</button>
        </form>
      </div>
    </div>
  `,
})
export class NuevaClavePage {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  password = '';
  cargando = signal(false);
  error = signal('');

  async guardar(): Promise<void> {
    if (this.password.length < 8) return this.error.set('La contraseña debe tener al menos 8 caracteres.');
    this.cargando.set(true);
    const { error } = await this.sb.cambiarClave(this.password);
    this.cargando.set(false);
    if (error) return this.error.set('El enlace venció. Pide uno nuevo desde "¿La olvidaste?".');
    await this.sb.cargarUsuario();
    this.router.navigateByUrl(this.sb.inicioSegunRoles());
  }
}
