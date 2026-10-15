import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrls: ['../auth-shell.scss'],
  template: `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-head">
          <img class="brand-mark" src="assets/icon/logo.png" alt="Jasta" />
          <div>
            <h1>Inicia sesión</h1>
            <p>Pedidos, alistamiento, entregas y cuadres de Jasta.</p>
          </div>
        </div>

        <form class="auth-form" (ngSubmit)="entrar()">
          <div class="field">
            <label for="email">Correo</label>
            <input id="email" name="email" type="email" autocomplete="username" inputmode="email"
              autocapitalize="off" spellcheck="false" [(ngModel)]="email" placeholder="nombre@correo.com"
              [attr.aria-invalid]="!!error()" />
          </div>
          <div class="field">
            <div class="field-row">
              <label for="password">Contraseña</label>
              <a class="field-link" routerLink="/auth/recuperar">¿La olvidaste?</a>
            </div>
            <div class="password-wrap">
              <input id="password" name="password" [type]="ver() ? 'text' : 'password'" autocomplete="current-password"
                [(ngModel)]="password" [attr.aria-invalid]="!!error()" />
              <button type="button" class="reveal-btn" (click)="ver.set(!ver())">{{ ver() ? 'Ocultar' : 'Mostrar' }}</button>
            </div>
          </div>
          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }
          <button type="submit" class="submit-btn" [disabled]="cargando()">{{ cargando() ? 'Ingresando…' : 'Ingresar' }}</button>
        </form>

        <p class="switch-link">
          ¿Primera vez aquí? <a routerLink="/auth/registro">Crea tu cuenta</a> con el mismo correo que usabas en la
          página de Jasta y entrarás con tus permisos de siempre.
        </p>
      </div>
    </div>
  `,
})
export class LoginPage {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  email = '';
  password = '';
  ver = signal(false);
  cargando = signal(false);
  error = signal('');

  async entrar(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Escribe tu correo y contraseña.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    const { error } = await this.sb.login(this.email, this.password);
    if (error) {
      this.cargando.set(false);
      this.error.set(
        error.message.includes('Email not confirmed')
          ? 'Confirma tu correo: te enviamos un enlace al registrarte.'
          : 'Correo o contraseña incorrectos.'
      );
      return;
    }
    await this.sb.cargarUsuario();
    this.cargando.set(false);
    this.router.navigateByUrl(this.sb.inicioSegunRoles());
  }
}
