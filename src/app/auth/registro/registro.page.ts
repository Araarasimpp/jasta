import { Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { CAPTCHA_ACTIVO, CaptchaComponent } from '../../shared/captcha/captcha.component';
import { REGLA_CLAVE, problemaClave } from '../../shared/clave';

@Component({
  selector: 'app-registro',
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
            <h1>Crea tu cuenta</h1>
            <p>Usa el correo que te autorizó el administrador (si ya trabajabas en Jasta, el mismo de antes).</p>
          </div>
        </div>

        @if (enviado()) {
          <p class="ok-msg" role="status">
            Te enviamos un correo a <strong>{{ email }}</strong>. Ábrelo y confirma tu cuenta para poder entrar.
          </p>
          <p class="hint">Suele llegar en menos de un minuto. Si no lo ves, revisa Spam o Promociones y confirma que el correo esté bien escrito. Usa siempre el enlace del último correo.</p>
          <button type="button" class="submit-btn submit-secundario" [disabled]="espera() > 0" (click)="otraVez()">
            {{ espera() > 0 ? 'Puedes pedir otro en ' + espera() + ' s' : '¿No llegó? Enviar de nuevo' }}
          </button>
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
              <label for="password">Contraseña <span>({{ regla }})</span></label>
              <input id="password" name="password" type="password" autocomplete="new-password" [(ngModel)]="password" />
            </div>
            <div class="field">
              <label for="password2">Repite la contraseña</label>
              <input id="password2" name="password2" type="password" autocomplete="new-password" [(ngModel)]="password2" />
            </div>
            <app-captcha (token)="captcha.set($event)" />
            @if (error()) {
              <p class="error-msg" role="alert">{{ error() }}</p>
            }
            <button type="submit" class="submit-btn" [disabled]="cargando() || (captchaActivo && !captcha())">{{ cargando() ? 'Creando…' : 'Crear cuenta' }}</button>
          </form>
        }

        <p class="switch-link">¿Ya tienes cuenta? <a routerLink="/auth/login">Inicia sesión</a>.</p>
      </div>
    </div>
  `,
})
export class RegistroPage implements OnDestroy {
  @ViewChild(CaptchaComponent) private captchaCmp?: CaptchaComponent;
  private sb = inject(SupabaseService);
  readonly captchaActivo = CAPTCHA_ACTIVO;
  readonly regla = REGLA_CLAVE;
  captcha = signal('');
  password2 = '';
  private router = inject(Router);
  nombre = '';
  email = '';
  password = '';
  cargando = signal(false);
  error = signal('');
  enviado = signal(false);
  espera = signal(0);
  private reloj?: ReturnType<typeof setInterval>;

  async crear(): Promise<void> {
    if (!this.nombre.trim() || !this.email.trim()) return this.error.set('Escribe tu nombre y tu correo.');
    const malo = problemaClave(this.password, this.email);
    if (malo) return this.error.set(malo);
    if (this.password !== this.password2) return this.error.set('Las dos contraseñas no coinciden.');
    if (this.captchaActivo && !this.captcha()) return this.error.set('Completa la verificación de seguridad.');
    this.cargando.set(true);
    this.error.set('');
    const { data, error } = await this.sb.registro(this.nombre, this.email, this.password, this.captcha());
    this.captchaCmp?.reiniciar();
    this.cargando.set(false);
    if (error) {
      const msg = error.message.toLowerCase();
      this.error.set(
        msg.includes('registered')
          ? 'Ese correo ya tiene cuenta. Inicia sesión.'
          : msg.includes('database error') || msg.includes('no_autorizado')
            ? 'Ese correo no está autorizado. Pídele a un administrador de Jasta que te agregue y vuelve a intentarlo.'
            : msg.includes('captcha')
              ? 'No pasó la verificación de seguridad. Inténtalo otra vez.'
              : error.status === 429 || msg.includes('rate limit')
                ? 'Demasiados intentos. Espera unos minutos.'
                : msg.includes('password')
                  ? 'Esa contraseña no es válida: usa al menos 8 caracteres con letras y números.'
                  : 'No se pudo crear la cuenta. Intenta de nuevo.'
      );
      return;
    }
    // Supabase no avisa si el correo ya existía (para no revelar cuentas): llega sin identidades
    if (data.user && !data.user.identities?.length) {
      this.error.set('Ese correo ya tiene cuenta, así que no te enviamos ningún correo. Inicia sesión o, si no recuerdas la contraseña, toca «¿La olvidaste?» al iniciar sesión.');
      return;
    }
    if (data.session) {
      await this.sb.cargarUsuario();
      this.router.navigateByUrl(this.sb.inicioSegunRoles());
    } else {
      this.enviado.set(true);
      this.iniciarEspera();
    }
  }

  /** Vuelve al formulario con los datos escritos; registrarse otra vez reenvía la confirmación. */
  otraVez(): void {
    this.error.set('');
    this.enviado.set(false);
  }

  /** Supabase solo deja reenviar un correo por minuto; bloqueamos el botón ese tiempo. */
  private iniciarEspera(): void {
    clearInterval(this.reloj);
    this.espera.set(60);
    this.reloj = setInterval(() => {
      this.espera.update((s) => s - 1);
      if (this.espera() <= 0) clearInterval(this.reloj);
    }, 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
  }
}
