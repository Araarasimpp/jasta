import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrls: ['../auth-shell.scss'],
  template: `
    <div class="auth-shell">
      <aside class="auth-marca" aria-hidden="true">
        <img class="sello" src="assets/icon/logo.png" alt="" />
        <p>Pedidos, despachos y cuadres del día, en un solo lugar.</p>
      </aside>
      <div class="auth-card">
        <div class="auth-head">
          <img class="brand-mark" src="assets/icon/logo.png" alt="Jasta" />
          <div>
            <h1>Crea tu cuenta</h1>
            <p>Si ya trabajabas en Jasta, usa el mismo correo de antes y quedarás con tus permisos.</p>
          </div>
        </div>

        @if (enviado()) {
          <p class="ok-msg" role="status">
            Te enviamos un correo a <strong>{{ email }}</strong>. Ábrelo y confirma tu cuenta para poder entrar.
          </p>
          <a class="submit-btn submit-secundario submit-link" routerLink="/auth/login">Ir a iniciar sesión</a>
        } @else {
          <form class="auth-form" (ngSubmit)="crear()">
            <div class="field">
              <label for="nombre">Nombre completo</label>
              <input id="nombre" name="nombre" autocomplete="name" [(ngModel)]="nombre" />
            </div>
            <div class="field">
              <label for="email">Correo</label>
              <input id="email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" [(ngModel)]="email" />
            </div>
            <div class="field">
              <label for="password">Contraseña <span>(mínimo 8 caracteres)</span></label>
              <input id="password" name="password" type="password" autocomplete="new-password" [(ngModel)]="password" />
            </div>
            @if (error()) {
              <p class="error-msg" role="alert">{{ error() }}</p>
            }
            <button type="submit" class="submit-btn" [disabled]="cargando()">{{ cargando() ? 'Creando…' : 'Crear cuenta' }}</button>
          </form>
        }

        <p class="switch-link">¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a>.</p>
      </div>
    </div>
  `,
})
export class RegistroPage {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  nombre = '';
  email = '';
  password = '';
  cargando = signal(false);
  error = signal('');
  enviado = signal(false);

  async crear(): Promise<void> {
    if (!this.nombre.trim() || !this.email.trim()) return this.error.set('Escribe tu nombre y tu correo.');
    if (this.password.length < 8) return this.error.set('La contraseña debe tener al menos 8 caracteres.');
    this.cargando.set(true);
    this.error.set('');
    const { data, error } = await this.sb.registro(this.nombre, this.email, this.password);
    this.cargando.set(false);
    if (error) {
      this.error.set(error.message.includes('registered') ? 'Ese correo ya tiene cuenta. Inicia sesión.' : error.message);
      return;
    }
    if (data.session) {
      await this.sb.cargarUsuario();
      this.router.navigateByUrl(this.sb.inicioSegunRoles());
    } else {
      this.enviado.set(true);
    }
  }
}
