import { Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { CAPTCHA_ACTIVO, CaptchaComponent } from '../../shared/captcha/captcha.component';

@Component({
  selector: 'app-login',
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
          <app-captcha (token)="captcha.set($event)" />
          @if (error()) {
            <p class="error-msg" role="alert">{{ error() }}</p>
          }
          <button type="submit" class="submit-btn" [disabled]="cargando() || espera() > 0 || (captchaActivo && !captcha())">
            {{ cargando() ? 'Ingresando…' : espera() > 0 ? 'Espera ' + espera() + ' s' : 'Ingresar' }}
          </button>
        </form>

        @if (puedeBiometria) {
          <div class="bio-sep"><span>o</span></div>
          <button type="button" class="bio-btn" [disabled]="cargando()" (click)="entrarBiometria()">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
              <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2M9 9v1M15 9v1M12 9v4h-1M9 16c1.7 1.3 4.3 1.3 6 0" />
            </svg>
            Entrar con Face ID o huella
          </button>
          @if (errorBio()) { <p class="error-msg" role="alert" style="margin-top: 10px">{{ errorBio() }}</p> }
        }

        <p class="switch-link">
          ¿Primera vez aquí? <a routerLink="/auth/registro">Crea tu cuenta</a> con el mismo correo que usabas en la
          página de Jasta y entrarás con tus permisos de siempre.
        </p>
      </div>
    </div>
  `,
})
export class LoginPage implements OnDestroy {
  @ViewChild(CaptchaComponent) private captchaCmp?: CaptchaComponent;
  private sb = inject(SupabaseService);
  readonly captchaActivo = CAPTCHA_ACTIVO;
  captcha = signal('');
  espera = signal(0);
  private fallos = 0;
  private reloj?: ReturnType<typeof setInterval>;
  private router = inject(Router);
  email = '';
  password = '';
  ver = signal(false);
  cargando = signal(false);
  error = signal('');
  /** El navegador puede usar llaves de acceso (Face ID, huella) */
  readonly puedeBiometria = typeof window !== 'undefined' && 'PublicKeyCredential' in window;

  /** Inicio de sesión con la llave de acceso guardada en el celular (Face ID, Touch ID o huella) */
  errorBio = signal('');

  async entrarBiometria(): Promise<void> {
    this.error.set('');
    this.errorBio.set('');
    this.cargando.set(true);
    if (this.captchaActivo && !this.captcha()) {
      this.cargando.set(false);
      return this.errorBio.set('Primero marca la casilla "Verifique que es un ser humano" y luego toca Face ID.');
    }
    const { error } = await this.sb.client.auth.signInWithPasskey({ options: { captchaToken: this.captcha() || undefined } });
    this.captchaCmp?.reiniciar();
    this.captcha.set('');
    if (error) {
      this.cargando.set(false);
      const code = (error as { code?: string }).code ?? '';
      const msg = (error.message ?? '').toLowerCase();
      if (code === 'captcha_failed') this.errorBio.set('No pasó la verificación de seguridad. Márcala otra vez y vuelve a tocar Face ID.');
      else if (code === 'passkey_disabled') this.errorBio.set('El inicio con Face ID todavía no está activado. Entra con tu contraseña.');
      else if (code === 'webauthn_credential_not_found')
        this.errorBio.set('Este celular no tiene Face ID activado para Jasta. Entra con tu contraseña y actívalo en Mi perfil.');
      else if (msg.includes('notallowed') || msg.includes('cancel') || msg.includes('abort')) return;
      else this.errorBio.set('No se pudo entrar con Face ID. Entra con tu contraseña.');
      return;
    }
    await this.sb.cargarUsuario();
    this.cargando.set(false);
    this.router.navigateByUrl(this.sb.inicioSegunRoles());
  }

  async entrar(): Promise<void> {
    if (!this.email || !this.password) {
      this.error.set('Escribe tu correo y contraseña.');
      return;
    }
    if (this.espera() > 0) return;
    if (this.captchaActivo && !this.captcha()) return this.error.set('Completa la verificación de seguridad.');
    this.cargando.set(true);
    this.error.set('');
    const { error } = await this.sb.login(this.email, this.password, this.captcha());
    this.captchaCmp?.reiniciar();
    if (error) {
      this.cargando.set(false);
      const msg = error.message.toLowerCase();
      if (msg.includes('email not confirmed')) {
        this.error.set('Confirma tu correo: te enviamos un enlace al registrarte.');
      } else if (msg.includes('captcha')) {
        this.error.set('No pasó la verificación de seguridad. Inténtalo otra vez.');
      } else if (error.status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
        this.bloquear(120);
        this.error.set('Demasiados intentos. Espera un momento antes de volver a intentar.');
      } else {
        this.fallos++;
        this.password = '';
        this.error.set('Correo o contraseña incorrectos.');
        // Cada 5 intentos fallidos, una pausa que crece: 30 s, 60 s, 90 s…
        if (this.fallos % 5 === 0) this.bloquear(30 * (this.fallos / 5));
      }
      return;
    }
    this.fallos = 0;
    await this.sb.cargarUsuario();
    this.cargando.set(false);
    this.router.navigateByUrl(this.sb.inicioSegunRoles());
  }

  private bloquear(segundos: number): void {
    clearInterval(this.reloj);
    this.espera.set(segundos);
    this.reloj = setInterval(() => {
      this.espera.update((s) => s - 1);
      if (this.espera() <= 0) clearInterval(this.reloj);
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
  }
}
