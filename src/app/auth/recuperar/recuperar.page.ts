import { Component, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { CAPTCHA_ACTIVO, CaptchaComponent } from '../../shared/captcha/captcha.component';

@Component({
  selector: 'app-recuperar',
  standalone: true,
  imports: [FormsModule, RouterLink, CaptchaComponent],
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
            <app-captcha (token)="captcha.set($event)" />
            @if (error()) {
              <p class="error-msg" role="alert">{{ error() }}</p>
            }
            <button type="submit" class="submit-btn" [disabled]="cargando() || (captchaActivo && !captcha())">{{ cargando() ? 'Enviando…' : 'Enviar enlace' }}</button>
          </form>
        }
        <p class="switch-link"><a routerLink="/auth/login">Volver a iniciar sesión</a></p>
      </div>
    </div>
  `,
})
export class RecuperarPage {
  @ViewChild(CaptchaComponent) private captchaCmp?: CaptchaComponent;
  private sb = inject(SupabaseService);
  readonly captchaActivo = CAPTCHA_ACTIVO;
  captcha = signal('');
  email = '';
  cargando = signal(false);
  enviado = signal(false);
  error = signal('');

  async enviar(): Promise<void> {
    if (!this.email.trim()) return this.error.set('Escribe tu correo.');
    if (this.captchaActivo && !this.captcha()) return this.error.set('Completa la verificación de seguridad.');
    this.cargando.set(true);
    this.error.set('');
    const { error } = await this.sb.recuperar(this.email, this.captcha());
    this.captchaCmp?.reiniciar();
    this.cargando.set(false);
    // Respuesta igual exista o no la cuenta, para no revelar qué correos están registrados
    if (error && (error.status === 429 || /rate limit|captcha/i.test(error.message))) {
      this.error.set(/captcha/i.test(error.message) ? 'No pasó la verificación de seguridad. Inténtalo otra vez.' : 'Ya pediste un enlace hace poco. Espera un minuto y revisa tu correo (también la carpeta de spam).');
    } else this.enviado.set(true);
  }
}
