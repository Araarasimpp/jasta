import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';

/**
 * Pantalla que tapa la app hasta que el dispositivo cumpla lo necesario para
 * trabajar: en el celular, la app instalada (en iPhone es la única forma de
 * recibir avisos) y, en todos, los avisos activos. Así a cada quien le llegan
 * los pedidos y los mensajes del chat aunque tenga la app cerrada.
 */
@Component({
  selector: 'app-requisitos',
  standalone: true,
  styles: [
    `
      :host { position: fixed; inset: 0; z-index: 900; display: block; overflow-y: auto; background: var(--bg); color: var(--text); }
      .caja { max-width: 460px; margin: 0 auto; padding: calc(28px + env(safe-area-inset-top)) 20px calc(28px + env(safe-area-inset-bottom));
        display: flex; flex-direction: column; gap: 16px; }
      .logo { width: 64px; height: 64px; border-radius: 16px; background: #fff; object-fit: contain; box-shadow: var(--shadow-pop); }
      .paso { font-size: 12.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--oro-texto); }
      h1 { margin: 0; font-size: 24px; line-height: 1.2; }
      p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--text-soft); }
      ol { margin: 0; padding: 16px 16px 16px 36px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface);
        font-size: 15px; line-height: 1.5; }
      li + li { margin-top: 10px; }
      li strong { color: var(--text); }
      .aviso { padding: 12px 14px; border-radius: var(--radius); background: var(--oro-wash); color: var(--oro-texto); font-size: 14px; line-height: 1.45; }
      .ok { padding: 12px 14px; border-radius: var(--radius); background: var(--ok-wash); color: var(--efectivo-texto); font-size: 15px; font-weight: 600; }
      .grande { width: 100%; height: 52px; font-size: 16px; }
      .copiar { display: flex; gap: 8px; }
      .copiar code { flex: 1; min-width: 0; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .girando { width: 28px; height: 28px; border: 3px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: gira .8s linear infinite; }
      @keyframes gira { to { transform: rotate(360deg); } }
      .pie { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
      .link { padding: 0; border: 0; background: none; color: var(--text-muted); font: inherit; font-size: 13.5px; text-decoration: underline; cursor: pointer; }
    `,
  ],
  template: `
    <div class="caja">
      <img class="logo" src="assets/icon/logo.png" alt="" />

      @switch (n.requisito()) {
        @case ('instalar') {
          <span class="paso">Paso 1 de 2</span>
          <h1>Instala Jasta en tu celular</h1>
          <p>Para usar Jasta necesitas tenerla instalada y con los avisos activos. Así te llegan los pedidos y los mensajes del domiciliario aunque el celular esté bloqueado.</p>

          @if (n.recienInstalada()) {
            <div class="ok">¡Listo, ya quedó instalada! Ahora cierra esta pestaña y abre <strong>Jasta</strong> desde el ícono en tu pantalla de inicio.</div>
          } @else if (n.ios) {
            @if (!enSafari) {
              <div class="aviso">
                Estás en otro navegador o dentro de WhatsApp. En iPhone, Jasta se instala desde <strong>Safari</strong>:
                copia el enlace y pégalo en Safari (o toca "Abrir en Safari").
              </div>
              <div class="copiar"><code>{{ origen }}</code><button class="b" (click)="copiar()">{{ copiado() ? 'Copiado' : 'Copiar' }}</button></div>
            }
            <ol>
              <li>Abre <strong>{{ origen }}</strong> en <strong>Safari</strong>.</li>
              <li>Toca el botón <strong>Compartir</strong> (el cuadrito con la flecha hacia arriba ⬆️), abajo en el centro.</li>
              <li>Baja y toca <strong>"Agregar a pantalla de inicio"</strong> y luego <strong>Agregar</strong>.</li>
              <li>Cierra Safari y abre <strong>Jasta</strong> desde el ícono nuevo en tu pantalla de inicio.</li>
            </ol>
          } @else {
            @if (n.instalable()) {
              <button class="b b-pri grande" (click)="n.instalar()">Instalar Jasta</button>
              <p>Se abre una ventana: toca <strong>Instalar</strong>. Después abre Jasta desde el ícono en tu pantalla de inicio.</p>
            } @else {
              <ol>
                <li>Abre esta página en <strong>Chrome</strong>.</li>
                <li>Toca el menú <strong>⋮</strong> (arriba a la derecha).</li>
                <li>Toca <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla principal"</strong> y confirma.</li>
                <li>Abre <strong>Jasta</strong> desde el ícono nuevo en tu pantalla de inicio.</li>
              </ol>
            }
          }
          <p>¿Ya la tienes instalada? Ábrela desde el ícono de <strong>Jasta</strong>, no desde el navegador.</p>
        }

        @case ('permiso') {
          <span class="paso">{{ n.esMovil ? 'Paso 2 de 2' : 'Un último paso' }}</span>
          <h1>Activa los avisos</h1>
          <p>Te avisamos de pedidos nuevos, mensajes del domiciliario, entregas y cuadres, aunque tengas la app cerrada. Sin esto no puedes usar Jasta.</p>
          <button class="b b-pri grande" (click)="activar()" [disabled]="ocupado()">{{ ocupado() ? 'Activando…' : 'Activar avisos' }}</button>
          <p>Cuando {{ n.esMovil ? 'el celular' : 'el navegador' }} pregunte, toca <strong>Permitir</strong>.</p>
        }

        @case ('activando') {
          <h1>Activando los avisos…</h1>
          <div class="girando" aria-hidden="true"></div>
          <p>Un momento, estamos conectando este dispositivo.</p>
        }

        @case ('bloqueado') {
          <h1>Los avisos están bloqueados</h1>
          <p>En algún momento se tocó "No permitir". Sin los avisos no puedes usar Jasta: actívalos así y vuelve aquí.</p>
          <ol>
            @if (n.ios) {
              <li>Abre <strong>Ajustes</strong> del iPhone.</li>
              <li>Entra a <strong>Notificaciones</strong> y busca <strong>Jasta</strong>.</li>
              <li>Activa <strong>Permitir notificaciones</strong>.</li>
            } @else if (n.esMovil) {
              <li>Mantén presionado el ícono de <strong>Jasta</strong> y toca <strong>Información de la app</strong> (ⓘ).</li>
              <li>Entra a <strong>Notificaciones</strong> y actívalas.</li>
              <li>Si no aparece, en Chrome: menú ⋮ → <strong>Configuración</strong> → <strong>Configuración de sitios</strong> → <strong>Notificaciones</strong> → permite {{ dominio }}.</li>
            } @else {
              <li>Toca el <strong>candado</strong> (o el ícono de ajustes) a la izquierda de la dirección {{ dominio }}.</li>
              <li>En <strong>Notificaciones</strong>, elige <strong>Permitir</strong>.</li>
              <li>Recarga la página.</li>
            }
            <li>Vuelve a Jasta y toca <strong>Ya las activé</strong>.</li>
          </ol>
          <button class="b b-pri grande" (click)="revisar()">Ya las activé</button>
          @if (sigue()) { <div class="aviso">Todavía aparecen bloqueadas. Revisa el paso anterior o cierra y vuelve a abrir la app.</div> }
        }

        @case ('error') {
          <h1>No pudimos activar los avisos</h1>
          <p>Revisa tu conexión a internet e inténtalo otra vez.</p>
          <button class="b b-pri grande" (click)="activar()" [disabled]="ocupado()">{{ ocupado() ? 'Activando…' : 'Intentar de nuevo' }}</button>
        }

        @case ('no-soportado') {
          <h1>Este navegador no recibe avisos</h1>
          <p>{{ n.ios ? 'Instala Jasta desde Safari y ábrela desde el ícono de la pantalla de inicio.' : 'Abre Jasta en Google Chrome (o Edge) para poder recibir los avisos.' }}</p>
          @if (n.ios) { <p>Si el iPhone es muy viejo, actualízalo en Ajustes → General → Actualización de software.</p> }
          <div class="copiar"><code>{{ origen }}</code><button class="b" (click)="copiar()">{{ copiado() ? 'Copiado' : 'Copiar' }}</button></div>
        }
      }

      <div class="pie">
        <button class="link" (click)="salir.emit()">Cerrar sesión</button>
        @if (esAdmin()) { <button class="link" (click)="n.saltarRequisitos()">Entrar sin esto por ahora (admin)</button> }
      </div>
    </div>
  `,
})
export class RequisitosComponent {
  n = inject(NotificacionesService);
  private sb = inject(SupabaseService);
  @Output() salir = new EventEmitter<void>();

  ocupado = signal(false);
  copiado = signal(false);
  sigue = signal(false);
  esAdmin = computed(() => this.sb.tiene('admin'));
  origen = location.origin;
  dominio = location.host;
  /** En iPhone solo Safari (no los navegadores de adentro de WhatsApp, Instagram, Chrome…) deja instalar bien */
  enSafari = !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|WhatsApp|Line\//i.test(navigator.userAgent) &&
    !(navigator as unknown as { brave?: unknown }).brave;

  constructor() {
    // Si ya tenía permiso pero la conexión de avisos no arrancó sola, se intenta de nuevo
    setTimeout(() => {
      if (this.n.requisito() === 'activando') void this.n.revisarPermiso();
    }, 3000);
  }

  async activar(): Promise<void> {
    this.ocupado.set(true);
    await this.n.pedirPermiso().catch(() => this.n.push.set('error'));
    this.ocupado.set(false);
  }

  async revisar(): Promise<void> {
    await this.n.revisarPermiso();
    this.sigue.set(this.n.requisito() === 'bloqueado');
  }

  async copiar(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.origen);
      this.copiado.set(true);
    } catch {
      /* lo copia a mano */
    }
  }
}
