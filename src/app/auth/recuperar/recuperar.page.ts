import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-recuperar',
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
            <h1>Recupera tu contraseña</h1>
            <p>Te enviamos un enlace para crear una nueva.</p>
          </div>
        </div>
        @if (enviado()) {
          <p class="ok-msg" role="status">Si <strong>{{ email }}</strong> tiene cuenta, te llegará un correo en unos minutos.</p>
        } @else {
          <form class="auth-form" (ngSubmit)="enviar()">
            <div class="field">
              <label for="email">Correo</label>
              <input id="email" name="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" [(ngModel)]="email" />
            </div>
            @if (error()) {
              <p class="error-msg" role="alert">{{ error() }}</p>
            }
            <button type="submit" class="submit-btn" [disabled]="cargando()">{{ cargando() ? 'Enviando…' : 'Enviar enlace' }}</button>
          </form>
        }
        <p class="switch-link"><a routerLink="/auth/login">Volver a iniciar sesión</a></p>
      </div>
    </div>
  `,
})
export class RecuperarPage {
  private sb = inject(SupabaseService);
  email = '';
  cargando = signal(false);
  enviado = signal(false);
  error = signal('');

  async enviar(): Promise<void> {
    if (!this.email.trim()) return this.error.set('Escribe tu correo.');
    this.cargando.set(true);
    const { error } = await this.sb.recuperar(this.email);
    this.cargando.set(false);
    if (error) this.error.set('No se pudo enviar el correo. Intenta de nuevo en un minuto.');
    else this.enviado.set(true);
  }
}
