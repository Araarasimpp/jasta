import { Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { ClienteDireccion, ClienteService } from '../../core/services/cliente.service';
import { CAPTCHA_ACTIVO, CaptchaComponent } from '../../shared/captcha/captcha.component';
import { REGLA_CLAVE, problemaClave } from '../../shared/clave';
import { PAISES, bandera, errorTelefono, limpiarNombre } from '../../shared/paises';
import { mensajeError, pesos } from '../../shared/formato';

type Modo = 'entrar' | 'crear' | 'confirmar' | 'olvide' | 'codigo-clave' | 'nueva-clave';

function normal(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Mi cuenta (clientes de la tienda): ingresar, crear cuenta, recuperar la contraseña,
 * y ya adentro sus datos y sus direcciones guardadas para comprar más rápido.
 */
@Component({
  selector: 'app-cuenta',
  standalone: true,
  imports: [FormsModule, CaptchaComponent],
  styles: [
    `
      :host { display: block; min-height: 100dvh; background: #f4f5f8; color: #12141a; font-family: var(--ui-font, system-ui, sans-serif); overflow-y: auto; height: 100dvh; }
      .cc-barra { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 12px; padding: calc(12px + env(safe-area-inset-top)) 16px 12px; background: #fff; border-bottom: 1px solid #e6e8ee; }
      .cc-barra button { width: 38px; height: 38px; display: grid; place-items: center; border: 0; border-radius: 50%; background: #f1f2f6; color: inherit; font-size: 20px; cursor: pointer; }
      .cc-barra h1 { margin: 0; font-size: 18px; font-weight: 700; }
      .cc-caja { max-width: 520px; margin: 0 auto; padding: 18px 16px calc(40px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; }
      .cc-tarjeta { background: #fff; border: 1px solid #e6e8ee; border-radius: 18px; padding: 18px; }
      .cc-tarjeta h2 { margin: 0 0 4px; font-size: 17px; font-weight: 700; }
      .cc-tarjeta .cc-sub { margin: 0 0 14px; font-size: 13.5px; color: #5b6070; line-height: 1.45; }
      .cc-tabs { display: grid; grid-template-columns: 1fr 1fr; padding: 4px; border-radius: 14px; background: #eceef3; margin-bottom: 16px; }
      .cc-tabs button { height: 40px; border: 0; border-radius: 11px; background: transparent; color: #5b6070; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer; }
      .cc-tabs button.on { background: #fff; color: #12141a; box-shadow: 0 1px 4px rgba(0,0,0,.1); }
      form, .cc-form { display: flex; flex-direction: column; gap: 12px; }
      label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: #3b3f4c; }
      label small { font-weight: 400; color: #8a8f9c; }
      input, select { height: 46px; padding: 0 14px; border: 1px solid #d6d9e1; border-radius: 12px; background: #fff; color: #12141a; font: inherit; font-size: 16px; font-weight: 400; box-sizing: border-box; width: 100%; }
      input:focus, select:focus { outline: 2px solid #6b4fe033; border-color: #6b4fe0; }
      .cc-tel { display: grid; grid-template-columns: 112px 1fr; gap: 8px; }
      .cc-codigo { text-align: center; letter-spacing: .4em; font-size: 22px; font-weight: 700; font-family: var(--mono-font, monospace); }
      .cc-pri { height: 50px; border: 0; border-radius: 14px; background: #6b4fe0; color: #fff; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer; }
      .cc-pri:disabled { opacity: .6; cursor: progress; }
      .cc-sec { height: 46px; border: 1px solid #d6d9e1; border-radius: 14px; background: #fff; color: #12141a; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
      .cc-link { border: 0; background: none; padding: 0; color: #6b4fe0; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-align: left; }
      .cc-centro { text-align: center; }
      .cc-error { margin: 0; padding: 10px 12px; border-radius: 10px; background: #fdecec; color: #c92a2a; font-size: 13.5px; }
      .cc-ok { margin: 0; padding: 10px 12px; border-radius: 10px; background: #e6f7ee; color: #1a7f4b; font-size: 13.5px; line-height: 1.45; }
      .cc-hola { display: flex; align-items: center; gap: 14px; }
      .cc-avatar { width: 54px; height: 54px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; background: #6b4fe0; color: #fff; font-size: 20px; font-weight: 700; }
      .cc-hola strong { display: block; font-size: 18px; }
      .cc-hola small { display: block; font-size: 13px; color: #5b6070; }
      .cc-seccion-cab { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; }
      .cc-seccion-cab h2 { margin: 0; }
      .cc-dirs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
      .cc-dir { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 10px; padding: 14px; border: 1px solid #e6e8ee; border-radius: 14px; }
      .cc-dir.cc-principal { border-color: #6b4fe0; background: #f6f3ff; }
      .cc-dir .cc-pin { color: #6b4fe0; display: grid; padding-top: 1px; }
      .cc-dir strong { display: flex; align-items: center; gap: 6px; font-size: 15px; }
      .cc-dir .cc-lin { display: block; font-size: 13px; color: #5b6070; line-height: 1.4; }
      .cc-chip { display: inline-block; padding: 1px 8px; border-radius: 999px; background: #6b4fe0; color: #fff; font-size: 11px; font-weight: 700; vertical-align: 2px; }
      .cc-acciones { display: flex; gap: 16px; margin-top: 8px; }
      .cc-acciones .cc-link { font-size: 13px; }
      .cc-acciones .cc-link.cc-peligro { color: #c92a2a; }
      .cc-etiquetas { display: flex; gap: 8px; }
      .cc-etiquetas button { height: 36px; padding: 0 14px; border: 1px solid #d6d9e1; border-radius: 999px; background: #fff; color: #3b3f4c; font: inherit; font-size: 14px; cursor: pointer; }
      .cc-etiquetas button.on { border-color: #6b4fe0; background: #f0ecff; color: #6b4fe0; font-weight: 700; }
      .cc-barrio { position: relative; }
      .cc-sug { position: absolute; left: 0; right: 0; top: 100%; z-index: 5; margin: 4px 0 0; padding: 4px; list-style: none; background: #fff; border: 1px solid #d6d9e1; border-radius: 12px; box-shadow: 0 10px 24px rgba(0,0,0,.12); max-height: 240px; overflow-y: auto; }
      .cc-sug button { width: 100%; display: flex; justify-content: space-between; gap: 10px; padding: 10px; border: 0; border-radius: 8px; background: none; color: #12141a; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
      .cc-sug button:hover { background: #f1f2f6; }
      .cc-sug small { color: #8a8f9c; white-space: nowrap; }
      .cc-barrio-ok { margin: 4px 0 0; font-size: 12.5px; color: #1a7f4b; font-weight: 600; }
      .cc-check { flex-direction: row; align-items: center; gap: 10px; font-weight: 500; }
      .cc-check input { width: 20px; height: 20px; accent-color: #6b4fe0; }
      .cc-vacio { margin: 0; padding: 14px; border: 1px dashed #d6d9e1; border-radius: 14px; text-align: center; font-size: 14px; color: #5b6070; }
      .cc-ico-bolsa { width: 40px; height: 40px; flex-shrink: 0; display: grid; place-items: center; border-radius: 12px; background: #f0ecff; color: #6b4fe0; }
      .cc-proximo { display: flex; align-items: center; gap: 12px; color: #5b6070; font-size: 14px; }
      .cc-proximo b { color: #12141a; }
      .cc-salir { color: #c92a2a; }
    `,
  ],
  template: `
    <header class="cc-barra">
      <button type="button" (click)="volver()" aria-label="Volver a la tienda">←</button>
      <h1>{{ c.perfil() ? 'Mi cuenta' : modo() === 'crear' ? 'Crea tu cuenta' : 'Ingresa a tu cuenta' }}</h1>
    </header>

    <div class="cc-caja">
      @if (!c.listo()) {
        <div class="cc-tarjeta cc-centro"><p class="cc-sub" style="margin: 0">Cargando…</p></div>
      } @else if (modo() === 'nueva-clave') {
        <!-- Llegó desde el correo de "olvidé mi contraseña" -->
        <div class="cc-tarjeta">
          <h2>Crea tu nueva contraseña</h2>
          <p class="cc-sub">{{ regla }}.</p>
          <div class="cc-form">
            <label>Nueva contraseña<input type="password" autocomplete="new-password" [(ngModel)]="clave" /></label>
            <label>Repítela<input type="password" autocomplete="new-password" [(ngModel)]="clave2" /></label>
            @if (error()) { <p class="cc-error" role="alert">{{ error() }}</p> }
            <button class="cc-pri" [disabled]="ocupado()" (click)="guardarClaveNueva()">{{ ocupado() ? 'Guardando…' : 'Guardar contraseña' }}</button>
          </div>
        </div>
      } @else if (c.perfil(); as p) {
        <!-- ===== Adentro ===== -->
        <div class="cc-tarjeta cc-hola">
          <span class="cc-avatar" aria-hidden="true">{{ iniciales(p.nombre || p.email || '?') }}</span>
          <div><strong>Hola, {{ primerNombre(p.nombre) || 'cliente' }}</strong><small>{{ p.email }}</small></div>
        </div>
        @if (aviso()) { <p class="cc-ok" role="status">{{ aviso() }}</p> }

        <section class="cc-tarjeta" aria-labelledby="t-datos">
          <h2 id="t-datos">Mis datos</h2>
          <p class="cc-sub">Salen llenos cada vez que compras.</p>
          <div class="cc-form">
            <label>Nombre completo<input autocomplete="name" [ngModel]="nombre" (ngModelChange)="nombre = limpiar($event)" /></label>
            <label>Celular
              <div class="cc-tel">
                <select [(ngModel)]="prefijo" aria-label="Indicativo">
                  @for (x of paises; track x.iso) { <option [value]="x.prefijo">{{ bandera(x.iso) }} +{{ x.prefijo }}</option> }
                </select>
                <input type="tel" inputmode="numeric" autocomplete="tel-national" [(ngModel)]="telefono" />
              </div>
            </label>
            <label>Documento <small>(para envíos a otras ciudades y facturas)</small>
              <div class="cc-tel">
                <select [(ngModel)]="tipoDoc" aria-label="Tipo de documento">
                  <option value="CC">CC</option><option value="CE">CE</option><option value="NIT">NIT</option><option value="PP">Pasaporte</option><option value="TI">TI</option>
                </select>
                <input inputmode="numeric" [(ngModel)]="documento" placeholder="Número" />
              </div>
            </label>
            @if (errorDatos()) { <p class="cc-error" role="alert">{{ errorDatos() }}</p> }
            <button class="cc-pri" [disabled]="ocupado()" (click)="guardarDatos()">{{ ocupado() ? 'Guardando…' : 'Guardar mis datos' }}</button>
          </div>
        </section>

        <section class="cc-tarjeta" aria-labelledby="t-dirs">
          <div class="cc-seccion-cab"><h2 id="t-dirs">Mis direcciones</h2>
            @if (!formDir() && p.direcciones.length < 10) { <button class="cc-link" (click)="nuevaDireccion()">+ Agregar</button> }</div>
          @if (formDir()) {
            <div class="cc-form">
              <div class="cc-etiquetas" role="group" aria-label="Nombre de la dirección">
                @for (e of ['Casa', 'Trabajo', 'Otra']; track e) {
                  <button type="button" [class.on]="dEtiqueta === e" (click)="dEtiqueta = e">{{ e }}</button>
                }
              </div>
              <label>Dirección<input autocomplete="street-address" maxlength="200" [(ngModel)]="dDireccion" placeholder="Ej: Cra 45 # 12-30 apto 201" /></label>
              <label class="cc-barrio">Barrio <small>(si no eres de Cali, escribe tu ciudad)</small>
                <input autocomplete="off" [ngModel]="dBarrio()" (ngModelChange)="escribirBarrio($event)" (focus)="enBarrio.set(true)" (blur)="salirBarrio()" placeholder="Ej: San Fernando" />
                @if (sugerencias().length) {
                  <ul class="cc-sug" role="listbox">
                    @for (b of sugerencias(); track b.barrio) {
                      <li><button type="button" (mousedown)="$event.preventDefault()" (click)="elegirBarrio(b.barrio)"><span>{{ b.barrio }}</span><small>domicilio {{ pesos(b.domicilio) }}</small></button></li>
                    }
                  </ul>
                }
                @if (barrioOk()) { <span class="cc-barrio-ok">✓ {{ barrioOk() }}</span> }
              </label>
              <label>Indicaciones <small>(opcional)</small><input maxlength="200" [(ngModel)]="dIndicaciones" placeholder="Ej: casa esquinera, portón negro" /></label>
              <label class="cc-check"><input type="checkbox" [(ngModel)]="dPrincipal" />Usar como dirección principal</label>
              @if (errorDir()) { <p class="cc-error" role="alert">{{ errorDir() }}</p> }
              <button class="cc-pri" [disabled]="ocupado()" (click)="guardarDireccion()">{{ ocupado() ? 'Guardando…' : 'Guardar dirección' }}</button>
              <button class="cc-sec" (click)="formDir.set(false)">Cancelar</button>
            </div>
          } @else if (p.direcciones.length) {
            <ul class="cc-dirs">
              @for (d of p.direcciones; track d.id) {
                <li class="cc-dir" [class.cc-principal]="d.principal">
                  <span class="cc-pin" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg></span>
                  <div>
                    <strong>{{ d.etiqueta }}@if (d.principal) { <span class="cc-chip">Principal</span> }</strong>
                    <span class="cc-lin">{{ d.direccion }}</span>
                    <span class="cc-lin">{{ d.barrio }}{{ d.indicaciones ? ' · ' + d.indicaciones : '' }}</span>
                    <div class="cc-acciones">
                      <button class="cc-link" (click)="editarDireccion(d)">Editar</button>
                      @if (!d.principal) { <button class="cc-link" (click)="hacerPrincipal(d)">Usar como principal</button> }
                      <button class="cc-link cc-peligro" (click)="quitarDireccion(d)">Quitar</button>
                    </div>
                  </div>
                </li>
              }
            </ul>
          } @else {
            <p class="cc-vacio">Todavía no tienes direcciones. Agrega una y saldrá lista cuando compres.</p>
          }
        </section>

        <section class="cc-tarjeta cc-proximo"><span class="cc-ico-bolsa" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg></span><span><b>Mis compras</b> · muy pronto vas a ver aquí todos tus pedidos y su estado.</span></section>

        <button class="cc-pri" (click)="volver()">Seguir comprando</button>
        <button class="cc-sec cc-salir" (click)="salir()">Cerrar sesión</button>
      } @else if (sb.session() && sb.usuario()) {
        <!-- Sesión del equipo en este celular -->
        <div class="cc-tarjeta">
          <h2>Estás con la cuenta del equipo</h2>
          <p class="cc-sub">Entraste como {{ sb.usuario()!.nombre }}. Para comprar como cliente, cierra esta sesión y entra con tu cuenta de cliente.</p>
          <button class="cc-sec" (click)="salir()">Cerrar sesión</button>
        </div>
      } @else {
        <!-- ===== Afuera: ingresar / crear cuenta ===== -->
        <div class="cc-tarjeta">
          @if (modo() === 'entrar' || modo() === 'crear') {
            <div class="cc-tabs" role="tablist">
              <button type="button" role="tab" [attr.aria-selected]="modo() === 'entrar'" [class.on]="modo() === 'entrar'" (click)="cambiarModo('entrar')">Ingresar</button>
              <button type="button" role="tab" [attr.aria-selected]="modo() === 'crear'" [class.on]="modo() === 'crear'" (click)="cambiarModo('crear')">Crear cuenta</button>
            </div>
          }

          @switch (modo()) {
            @case ('entrar') {
              <form (ngSubmit)="entrar()">
                <label>Correo<input type="email" name="e" autocomplete="username" inputmode="email" autocapitalize="off" [(ngModel)]="email" /></label>
                <label>Contraseña<input type="password" name="c" autocomplete="current-password" [(ngModel)]="clave" /></label>
                <button type="button" class="cc-link" (click)="cambiarModo('olvide')">¿Olvidaste tu contraseña?</button>
                <app-captcha (token)="captcha.set($event)" />
                @if (error()) { <p class="cc-error" role="alert">{{ error() }}</p> }
                <button class="cc-pri" type="submit" [disabled]="ocupado() || (captchaActivo && !captcha())">{{ ocupado() ? 'Ingresando…' : 'Ingresar' }}</button>
              </form>
            }
            @case ('crear') {
              <p class="cc-sub">Guarda tus datos y direcciones, y compra en pocos toques.</p>
              <form (ngSubmit)="crear()">
                <label>Nombre completo<input name="n" autocomplete="name" [ngModel]="nombre" (ngModelChange)="nombre = limpiar($event)" /></label>
                <label>Celular
                  <div class="cc-tel">
                    <select name="pf" [(ngModel)]="prefijo" aria-label="Indicativo">
                      @for (x of paises; track x.iso) { <option [value]="x.prefijo">{{ bandera(x.iso) }} +{{ x.prefijo }}</option> }
                    </select>
                    <input name="t" type="tel" inputmode="numeric" autocomplete="tel-national" [(ngModel)]="telefono" />
                  </div>
                </label>
                <label>Correo<input name="e" type="email" autocomplete="email" inputmode="email" autocapitalize="off" [(ngModel)]="email" /></label>
                <label>Contraseña <small>({{ regla }})</small><input name="c" type="password" autocomplete="new-password" [(ngModel)]="clave" /></label>
                <label>Repite la contraseña<input name="c2" type="password" autocomplete="new-password" [(ngModel)]="clave2" /></label>
                <app-captcha (token)="captcha.set($event)" />
                @if (error()) { <p class="cc-error" role="alert">{{ error() }}</p> }
                <button class="cc-pri" type="submit" [disabled]="ocupado() || (captchaActivo && !captcha())">{{ ocupado() ? 'Creando…' : 'Crear cuenta' }}</button>
              </form>
            }
            @case ('confirmar') {
              <h2>Confirma tu correo</h2>
              <p class="cc-sub">Te enviamos un correo a <b>{{ email }}</b>. Ábrelo y toca el botón para activar tu cuenta. Si el correo trae un código de 6 números, escríbelo aquí.</p>
              <div class="cc-form">
                <input class="cc-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [(ngModel)]="codigo" placeholder="••••••" aria-label="Código" />
                @if (error()) { <p class="cc-error" role="alert">{{ error() }}</p> }
                @if (aviso()) { <p class="cc-ok" role="status">{{ aviso() }}</p> }
                <button class="cc-pri" [disabled]="ocupado() || codigo.length < 6" (click)="confirmarCodigo('signup')">Confirmar</button>
                <app-captcha (token)="captcha.set($event)" />
                <button class="cc-sec" [disabled]="espera() > 0 || ocupado() || (captchaActivo && !captcha())" (click)="reenviar()">{{ espera() > 0 ? 'Reenviar en ' + espera() + ' s' : '¿No llegó? Enviar de nuevo' }}</button>
                <button class="cc-link cc-centro" (click)="cambiarModo('entrar')">Ya la confirmé: ingresar</button>
              </div>
            }
            @case ('olvide') {
              <h2>Recupera tu contraseña</h2>
              <p class="cc-sub">Escribe tu correo y te enviamos cómo crear una nueva.</p>
              <form (ngSubmit)="olvide()">
                <label>Correo<input name="e" type="email" autocomplete="username" inputmode="email" autocapitalize="off" [(ngModel)]="email" /></label>
                <app-captcha (token)="captcha.set($event)" />
                @if (error()) { <p class="cc-error" role="alert">{{ error() }}</p> }
                <button class="cc-pri" type="submit" [disabled]="ocupado() || (captchaActivo && !captcha())">{{ ocupado() ? 'Enviando…' : 'Enviar' }}</button>
                <button type="button" class="cc-link cc-centro" (click)="cambiarModo('entrar')">Volver a ingresar</button>
              </form>
            }
            @case ('codigo-clave') {
              <h2>Revisa tu correo</h2>
              <p class="cc-sub">Te enviamos un correo a <b>{{ email }}</b>. Toca el botón del correo para crear tu nueva contraseña. Si trae un código de 6 números, escríbelo aquí con tu nueva contraseña.</p>
              <div class="cc-form">
                <input class="cc-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="6" [(ngModel)]="codigo" placeholder="••••••" aria-label="Código" />
                <label>Nueva contraseña <small>({{ regla }})</small><input type="password" autocomplete="new-password" [(ngModel)]="clave" /></label>
                @if (error()) { <p class="cc-error" role="alert">{{ error() }}</p> }
                <button class="cc-pri" [disabled]="ocupado() || codigo.length < 6" (click)="confirmarCodigo('recovery')">Cambiar contraseña</button>
                <button class="cc-link cc-centro" (click)="cambiarModo('entrar')">Volver a ingresar</button>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class CuentaPage implements OnInit, OnDestroy {
  sb = inject(SupabaseService);
  c = inject(ClienteService);
  private router = inject(Router);
  private ruta = inject(ActivatedRoute);
  @ViewChild(CaptchaComponent) private captchaCmp?: CaptchaComponent;

  readonly captchaActivo = CAPTCHA_ACTIVO;
  readonly regla = REGLA_CLAVE;
  readonly paises = PAISES;
  readonly bandera = bandera;
  readonly pesos = pesos;

  modo = signal<Modo>('entrar');
  captcha = signal('');
  ocupado = signal(false);
  error = signal('');
  errorDatos = signal('');
  errorDir = signal('');
  aviso = signal('');
  espera = signal(0);
  private reloj?: ReturnType<typeof setInterval>;
  private quitarEscucha?: () => void;

  // Formularios
  email = '';
  clave = '';
  clave2 = '';
  codigo = '';
  nombre = '';
  prefijo = '57';
  telefono = '';
  tipoDoc = 'CC';
  documento = '';

  // Dirección
  formDir = signal(false);
  dId: number | null = null;
  dEtiqueta = 'Casa';
  dDireccion = '';
  dBarrio = signal('');
  dIndicaciones = '';
  dPrincipal = false;
  enBarrio = signal(false);
  private barrios = signal<{ barrio: string; domicilio: number }[]>([]);
  barrioOk = computed(() => {
    const n = normal(this.dBarrio());
    return this.barrios().find((b) => normal(b.barrio) === n)?.barrio ?? null;
  });
  sugerencias = computed(() => {
    const q = normal(this.dBarrio());
    if (!this.enBarrio() || this.barrioOk() || q.length < 2) return [];
    return this.barrios().filter((b) => normal(b.barrio).includes(q))
      .sort((a, b) => Number(!normal(a.barrio).startsWith(q)) - Number(!normal(b.barrio).startsWith(q)) || a.barrio.localeCompare(b.barrio)).slice(0, 6);
  });

  ngOnInit(): void {
    const q = this.ruta.snapshot.queryParamMap;
    if (q.get('crear')) this.modo.set('crear');
    // Viene del correo para cambiar la contraseña
    const { data } = this.sb.client.auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') this.modo.set('nueva-clave');
    });
    this.quitarEscucha = () => data.subscription.unsubscribe();
    // El enlace del correo abre esta página con ?nueva=1 y la sesión ya iniciada
    void this.sb.asegurar().then(async () => {
      if (q.get('nueva') && this.sb.session()) this.modo.set('nueva-clave');
      await this.c.cargar();
      this.llenarDatos();
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
    this.quitarEscucha?.();
  }

  private llenarDatos(): void {
    const p = this.c.perfil();
    if (!p) return;
    this.nombre = p.nombre;
    this.prefijo = p.prefijo || '57';
    this.telefono = p.telefono ?? '';
    this.tipoDoc = p.tipo_doc || 'CC';
    this.documento = p.documento ?? '';
  }

  cambiarModo(m: Modo): void {
    this.modo.set(m);
    this.error.set('');
    this.aviso.set('');
    this.codigo = '';
  }

  volver(): void {
    const v = this.ruta.snapshot.queryParamMap.get('volver');
    void this.router.navigateByUrl(v && v.startsWith('/tienda') ? v : '/tienda');
  }

  limpiar(v: string): string {
    return limpiarNombre(v);
  }

  primerNombre(n: string): string {
    return (n || '').trim().split(/\s+/)[0] ?? '';
  }

  iniciales(n: string): string {
    const p = n.trim().split(/\s+/).filter(Boolean);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || '?';
  }

  private traducir(msg: string, status?: number): string {
    const m = msg.toLowerCase();
    if (m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
    if (m.includes('email not confirmed')) return 'Primero confirma tu correo: te enviamos un enlace al crear la cuenta.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Ese correo ya tiene cuenta. Ingresa o recupera tu contraseña.';
    if (m.includes('captcha')) return 'No pasó la verificación de seguridad. Inténtalo otra vez.';
    if (status === 429 || m.includes('rate limit') || m.includes('security purposes')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
    if (m.includes('token') && (m.includes('expired') || m.includes('invalid'))) return 'Ese código no sirve o ya venció. Pide uno nuevo.';
    if (m.includes('password')) return 'Esa contraseña no es válida: usa al menos 8 caracteres con letras y números.';
    return 'No se pudo completar. Intenta de nuevo.';
  }

  private reiniciarCaptcha(): void {
    this.captchaCmp?.reiniciar();
    this.captcha.set('');
  }

  async entrar(): Promise<void> {
    if (!this.email.trim() || !this.clave) return this.error.set('Escribe tu correo y tu contraseña.');
    this.ocupado.set(true);
    this.error.set('');
    const { error } = await this.c.entrar(this.email, this.clave, this.captcha());
    this.reiniciarCaptcha();
    if (error) {
      this.ocupado.set(false);
      return this.error.set(this.traducir(error.message, error.status));
    }
    await this.c.cargar();
    this.ocupado.set(false);
    this.clave = '';
    this.llenarDatos();
  }

  async crear(): Promise<void> {
    if (!/\p{L}{2}/u.test(this.nombre)) return this.error.set('Escribe tu nombre.');
    const tel = this.telefono.replace(/\D/g, '');
    const malTel = !tel ? 'Escribe tu celular.' : errorTelefono(this.prefijo, tel);
    if (malTel) return this.error.set(malTel);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email.trim())) return this.error.set('Escribe un correo válido.');
    const malo = problemaClave(this.clave, this.email);
    if (malo) return this.error.set(malo);
    if (this.clave !== this.clave2) return this.error.set('Las dos contraseñas no coinciden.');
    this.ocupado.set(true);
    this.error.set('');
    const { data, error } = await this.c.registrar({ nombre: this.nombre, email: this.email, password: this.clave, prefijo: this.prefijo, telefono: tel }, this.captcha());
    this.reiniciarCaptcha();
    this.ocupado.set(false);
    if (error) {
      const m = error.message.toLowerCase();
      return this.error.set(m.includes('database error') || m.includes('no_autorizado') ? 'No se pudo crear la cuenta. Intenta de nuevo en un momento.' : this.traducir(error.message, error.status));
    }
    // Supabase no avisa si el correo ya existía (para no revelar cuentas): llega sin identidades
    if (data.user && !data.user.identities?.length) return this.error.set('Ese correo ya tiene cuenta. Ingresa o toca «¿Olvidaste tu contraseña?».');
    this.clave = '';
    this.clave2 = '';
    if (data.session) {
      await this.c.cargar();
      this.llenarDatos();
    } else {
      this.cambiarModo('confirmar');
      this.iniciarEspera();
    }
  }

  async confirmarCodigo(tipo: 'signup' | 'recovery'): Promise<void> {
    if (tipo === 'recovery') {
      const malo = problemaClave(this.clave, this.email);
      if (malo) return this.error.set(malo);
    }
    this.ocupado.set(true);
    this.error.set('');
    const { error } = await this.c.verificarCodigo(this.email, this.codigo, tipo);
    if (error) {
      this.ocupado.set(false);
      return this.error.set(this.traducir(error.message, error.status));
    }
    if (tipo === 'recovery') {
      const r = await this.c.cambiarClave(this.clave);
      if (r.error) {
        this.ocupado.set(false);
        return this.error.set(this.traducir(r.error.message, r.error.status));
      }
    }
    await this.c.cargar();
    this.ocupado.set(false);
    this.clave = '';
    this.llenarDatos();
    this.aviso.set(tipo === 'recovery' ? 'Listo, tu contraseña quedó cambiada.' : '¡Bienvenido! Tu cuenta quedó activa.');
  }

  async reenviar(): Promise<void> {
    this.ocupado.set(true);
    const { error } = await this.c.reenviarConfirmacion(this.email, this.captcha());
    this.reiniciarCaptcha();
    this.ocupado.set(false);
    if (error) return this.error.set(this.traducir(error.message, error.status));
    this.aviso.set('Te enviamos el correo otra vez.');
    this.iniciarEspera();
  }

  async olvide(): Promise<void> {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.email.trim())) return this.error.set('Escribe tu correo.');
    this.ocupado.set(true);
    this.error.set('');
    const { error } = await this.c.recuperar(this.email, this.captcha());
    this.reiniciarCaptcha();
    this.ocupado.set(false);
    if (error) return this.error.set(this.traducir(error.message, error.status));
    this.cambiarModo('codigo-clave');
  }

  async guardarClaveNueva(): Promise<void> {
    const malo = problemaClave(this.clave);
    if (malo) return this.error.set(malo);
    if (this.clave !== this.clave2) return this.error.set('Las dos contraseñas no coinciden.');
    this.ocupado.set(true);
    const { error } = await this.c.cambiarClave(this.clave);
    this.ocupado.set(false);
    if (error) return this.error.set(this.traducir(error.message, error.status));
    this.clave = this.clave2 = '';
    history.replaceState(null, '', '/tienda/cuenta');
    this.modo.set('entrar');
    await this.c.cargar();
    this.llenarDatos();
    this.aviso.set('Listo, tu contraseña quedó cambiada.');
  }

  private iniciarEspera(): void {
    clearInterval(this.reloj);
    this.espera.set(60);
    this.reloj = setInterval(() => {
      this.espera.update((s) => s - 1);
      if (this.espera() <= 0) clearInterval(this.reloj);
    }, 1000);
  }

  // ---------- Adentro ----------
  async guardarDatos(): Promise<void> {
    this.errorDatos.set('');
    if (!/\p{L}{2}/u.test(this.nombre)) return this.errorDatos.set('Escribe tu nombre.');
    const tel = this.telefono.replace(/\D/g, '');
    const malTel = !tel ? 'Escribe tu celular.' : errorTelefono(this.prefijo, tel);
    if (malTel) return this.errorDatos.set(malTel);
    this.ocupado.set(true);
    const { error } = await this.c.guardarDatos({ nombre: this.nombre, prefijo: this.prefijo, telefono: tel, tipo_doc: this.tipoDoc, documento: this.documento });
    this.ocupado.set(false);
    if (error) return this.errorDatos.set(mensajeError(error));
    this.aviso.set('Tus datos quedaron guardados.');
  }

  private async cargarBarrios(): Promise<void> {
    if (this.barrios().length) return;
    const { data } = await this.sb.client.rpc('tienda_barrios');
    if (Array.isArray(data)) this.barrios.set(data as { barrio: string; domicilio: number }[]);
  }

  nuevaDireccion(): void {
    this.dId = null;
    this.dEtiqueta = (this.c.perfil()?.direcciones.length ?? 0) ? 'Trabajo' : 'Casa';
    this.dDireccion = '';
    this.dBarrio.set('');
    this.dIndicaciones = '';
    this.dPrincipal = !(this.c.perfil()?.direcciones.length ?? 0);
    this.abrirDir();
  }

  editarDireccion(d: ClienteDireccion): void {
    this.dId = d.id;
    this.dEtiqueta = d.etiqueta;
    this.dDireccion = d.direccion;
    this.dBarrio.set(d.barrio);
    this.dIndicaciones = d.indicaciones ?? '';
    this.dPrincipal = d.principal;
    this.abrirDir();
  }

  private abrirDir(): void {
    this.errorDir.set('');
    this.aviso.set('');
    this.enBarrio.set(false);
    this.formDir.set(true);
    void this.cargarBarrios();
  }

  escribirBarrio(v: string): void {
    this.dBarrio.set(v);
    this.enBarrio.set(true);
  }

  elegirBarrio(b: string): void {
    this.dBarrio.set(b);
    this.enBarrio.set(false);
  }

  salirBarrio(): void {
    setTimeout(() => this.enBarrio.set(false), 150);
  }

  async guardarDireccion(): Promise<void> {
    this.errorDir.set('');
    if (this.dDireccion.trim().length < 5) return this.errorDir.set('Escribe la dirección completa (calle, número y apto o casa).');
    const barrio = this.barrioOk();
    if (!barrio) return this.errorDir.set('Elige tu barrio de la lista. Si no eres de Cali, escribe solo el nombre de tu ciudad y elígela.');
    this.ocupado.set(true);
    const { error } = await this.c.guardarDireccion({ id: this.dId, etiqueta: this.dEtiqueta, direccion: this.dDireccion, barrio, indicaciones: this.dIndicaciones, principal: this.dPrincipal });
    this.ocupado.set(false);
    if (error) return this.errorDir.set(mensajeError(error));
    this.formDir.set(false);
    this.aviso.set('Dirección guardada.');
  }

  async hacerPrincipal(d: ClienteDireccion): Promise<void> {
    const { error } = await this.c.guardarDireccion({ id: d.id, etiqueta: d.etiqueta, direccion: d.direccion, barrio: d.barrio, indicaciones: d.indicaciones ?? '', principal: true });
    if (error) this.aviso.set(mensajeError(error));
  }

  async quitarDireccion(d: ClienteDireccion): Promise<void> {
    if (!confirm(`¿Quitar la dirección "${d.etiqueta}" (${d.direccion})?`)) return;
    const { error } = await this.c.quitarDireccion(d.id);
    this.aviso.set(error ? mensajeError(error) : 'Dirección quitada.');
  }

  async salir(): Promise<void> {
    await this.c.salir();
    this.cambiarModo('entrar');
  }
}
