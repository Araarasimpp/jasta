import { Component, inject, signal } from '@angular/core';
import { fotoFondoGuardada } from '../../core/services/fondo.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { REGLA_CLAVE, problemaClave } from '../../shared/clave';

@Component({
  selector: 'app-nueva-clave',
  standalone: true,
  imports: [FormsModule],
  styleUrls: ['../auth-shell.scss'],
  template: `
    <div class="auth-shell">
      <!-- Cabecera con la foto del tema (como la pantalla de carga) -->
      <aside class="auth-marca" aria-hidden="true">
        <div class="am-foto" [style.background-image]="'url(' + fotoFondo + ')'"></div>
        <div class="am-txt">
          <span class="am-logo"><img src="assets/icon/logo.png" alt="" /></span>
          <strong class="am-nombre">Jasta<i>.</i></strong>
          <p>Hobbies y accesorios,<br />tus pedidos en orden.</p>
        </div>
      </aside>
      <div class="auth-card">
        <div class="auth-head">
          <img class="brand-mark" src="assets/icon/logo.png" alt="Jasta" />
          <div><h1>Nueva contraseña</h1><p>Escribe la contraseña que vas a usar de ahora en adelante.</p></div>
        </div>
        <form class="auth-form" (ngSubmit)="guardar()">
          <div class="field">
            <label for="password">Contraseña nueva <span>({{ regla }})</span></label>
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
  /** Foto de fondo del tema (la misma de la pantalla de carga) */
  readonly fotoFondo = fotoFondoGuardada();
  private sb = inject(SupabaseService);
  private router = inject(Router);
  readonly regla = REGLA_CLAVE;
  password = '';
  cargando = signal(false);
  error = signal('');

  async guardar(): Promise<void> {
    const malo = problemaClave(this.password, this.sb.usuario()?.email ?? '');
    if (malo) return this.error.set(malo);
    this.cargando.set(true);
    const { error } = await this.sb.cambiarClave(this.password);
    this.cargando.set(false);
    if (error) return this.error.set('El enlace venció. Pide uno nuevo desde "¿La olvidaste?".');
    await this.sb.cargarUsuario();
    this.router.navigateByUrl(this.sb.inicioSegunRoles());
  }
}
