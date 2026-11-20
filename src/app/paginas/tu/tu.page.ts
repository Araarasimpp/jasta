import { AfterViewInit, Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronForwardOutline, closeCircle, createOutline, logOutOutline, moonOutline, notificationsOutline, searchOutline, sunnyOutline } from 'ionicons/icons';
import { ShellComponent } from '../../shell/shell.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { Preferencia } from '../../core/services/presencia.service';

/**
 * "Tú" (pestaña de la barra del celular, como en WhatsApp): tu foto y tu nombre arriba
 * (al tocarlos se abre Mi perfil para cambiar foto, nombre y lo demás) y debajo todas
 * las páginas de la app en listas agrupadas. Reemplaza al antiguo menú "Más".
 */
@Component({
  selector: 'app-tu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IonIcon, AvatarComponent],
  styles: [
    `
      :host { display: block; min-height: 100%; background: var(--bg); color: var(--text); }
      .tu { max-width: 620px; margin: 0 auto; padding: 0 16px 32px; }

      /* Barra de arriba: botones redondos de vidrio; al bajar aparece el nombre en el centro */
      .tu-barra { position: sticky; top: 0; z-index: 5; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center;
        margin: 0 -16px; padding: 10px 16px; transition: background 200ms ease, box-shadow 200ms ease; }
      .tu-barra.chico { background: color-mix(in srgb, var(--bg) 72%, transparent);
        -webkit-backdrop-filter: blur(18px) saturate(180%); backdrop-filter: blur(18px) saturate(180%);
        box-shadow: 0 1px 0 var(--border); }
      .tu-mini { font-size: 16px; font-weight: 700; opacity: 0; transform: translateY(6px); transition: opacity 200ms ease, transform 200ms ease;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 52vw; }
      .tu-barra.chico .tu-mini { opacity: 1; transform: none; }
      .tu-der { display: flex; gap: 8px; justify-self: end; }
      .tu-circ { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; cursor: pointer; text-decoration: none;
        border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); color: var(--text); font-size: 19px;
        background: color-mix(in srgb, var(--surface) 55%, transparent);
        -webkit-backdrop-filter: blur(12px) saturate(180%); backdrop-filter: blur(12px) saturate(180%);
        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25); -webkit-tap-highlight-color: transparent; }
      .tu-circ:active { transform: scale(0.94); }
      .tu-der .tu-circ { width: auto; padding: 0 4px; border-radius: 999px; display: flex; gap: 0; }
      .tu-der .tu-circ > * { width: 36px; height: 34px; display: grid; place-items: center; border: none; background: none; color: inherit; font-size: 19px; cursor: pointer; padding: 0; }

      .tu-campana { position: relative; }
      .tu-badge { position: absolute; top: 1px; right: 0; min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 999px;
        background: var(--danger); color: #fff; font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; }
      .tu-buscar { width: 100%; margin: 4px 0 8px; height: 44px; }
      .tu-buscar input { height: 100%; }
      .tu-buscar .limpiar { border: none; background: none; color: var(--text-muted); font-size: 20px; width: 30px; height: 30px; display: grid; place-items: center; cursor: pointer; padding: 0; }

      /* Cabecera: nota de estado, foto grande, nombre y rol */
      .tu-cab { display: flex; flex-direction: column; align-items: center; padding: 8px 0 18px; position: relative; }
      .tu-nota { position: relative; z-index: 1; margin-bottom: -10px; display: inline-flex; align-items: center; gap: 7px; max-width: 80%;
        padding: 7px 13px; border-radius: 16px; border: none; cursor: pointer; font: inherit; font-size: 12.5px; color: var(--text-soft);
        background: var(--surface-2); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); }
      .tu-nota::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 10px; height: 10px; margin-left: -5px; border-radius: 50%; background: var(--surface-2); }
      .tu-punto { width: 9px; height: 9px; border-radius: 50%; background: #80848e; flex-shrink: 0; }
      .tu-punto.activo { background: #23a55a; }
      .tu-punto.ausente { background: #f0b232; }
      .tu-estados { position: absolute; top: 40px; z-index: 6; min-width: 240px; padding: 6px; border-radius: 18px; background: var(--surface);
        box-shadow: var(--shadow-pop); border: 1px solid var(--border); animation: tu-pop 180ms cubic-bezier(0.3, 1.4, 0.5, 1) both; }
      @keyframes tu-pop { from { opacity: 0; transform: scale(0.9) translateY(-6px); } }
      .tu-estados button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; border-radius: 12px;
        background: none; color: var(--text); font: inherit; font-size: 14.5px; text-align: left; cursor: pointer; }
      .tu-estados button.on { background: var(--surface-2); font-weight: 650; }
      .tu-estados small { display: block; color: var(--text-muted); font-size: 12px; font-weight: 400; }
      .tu-capa { position: fixed; inset: 0; z-index: 4; border: none; background: transparent; padding: 0; }
      .tu-foto { display: block; border-radius: 50%; -webkit-tap-highlight-color: transparent; transition: transform 160ms ease; }
      .tu-foto:active { transform: scale(0.96); }
      .tu-nombre { margin-top: 12px; display: inline-flex; align-items: center; gap: 4px; color: var(--text); text-decoration: none;
        font-size: 25px; font-weight: 750; letter-spacing: -0.02em; text-align: center; }
      .tu-nombre ion-icon { font-size: 17px; color: var(--text-soft); }
      .tu-rol { margin: 2px 0 0; color: var(--text-muted); font-size: 14px; text-align: center; }

      /* Listas agrupadas (tarjetas con filas y flecha) */
      .tu-tit { margin: 18px 4px 7px; font-size: 13px; font-weight: 650; color: var(--text-soft); }
      .tu-grupo { border-radius: 18px; background: var(--surface); overflow: hidden; border: 1px solid var(--border); }
      .tu-fila { display: flex; align-items: center; gap: 14px; min-height: 50px; padding: 0 14px; color: var(--text); text-decoration: none;
        font: inherit; font-size: 15.5px; width: 100%; box-sizing: border-box; border: none; background: none; cursor: pointer; text-align: left;
        -webkit-tap-highlight-color: transparent; }
      .tu-fila + .tu-fila .tu-txt { box-shadow: 0 -1px 0 var(--border); }
      .tu-fila > ion-icon:first-child { font-size: 21px; color: var(--text-soft); flex-shrink: 0; }
      .tu-txt { flex: 1; align-self: stretch; display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
      .tu-txt span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tu-flecha { font-size: 16px; color: var(--text-muted); flex-shrink: 0; }
      .tu-fila:active { background: var(--hover); }
      .tu-fila.active > ion-icon:first-child { color: var(--accent); }
      .tu-fila.peligro, .tu-fila.peligro > ion-icon:first-child { color: var(--danger); }
      .tu-vacio { margin: 24px 0; text-align: center; color: var(--text-soft); font-size: 14px; }
      @media (min-width: 861px) { .tu { padding-top: 16px; } }
    `,
  ],
  template: `
    <div class="tu">
      <header class="tu-barra" [class.chico]="nombreFuera()">
        <button type="button" class="tu-circ" aria-label="Buscar página" (click)="alternarBuscar()"><ion-icon name="search-outline"></ion-icon></button>
        <span class="tu-mini" aria-hidden="true">{{ nombre() }}</span>
        <div class="tu-der">
          <span class="tu-circ">
            <button type="button" (click)="shell.cambiarTemaConCirculo($event, temaToggle)" [attr.aria-label]="shell.theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
              <ion-icon [name]="shell.theme.isDark() ? 'sunny-outline' : 'moon-outline'"></ion-icon></button>
            <button type="button" class="tu-campana" (click)="shell.avisos.toggle()" [attr.aria-expanded]="shell.avisos.abierto()"
              [attr.aria-label]="'Avisos' + (shell.avisos.noLeidas() ? ', ' + shell.avisos.noLeidas() + ' sin leer' : '')">
              <ion-icon class="campana" name="notifications-outline"></ion-icon>
              @if (shell.avisos.noLeidas()) { <span class="tu-badge">{{ shell.avisos.noLeidas() > 9 ? '9+' : shell.avisos.noLeidas() }}</span> }
            </button>
            <a routerLink="/app/perfil" aria-label="Editar perfil"><ion-icon name="create-outline"></ion-icon></a>
          </span>
        </div>
      </header>

      @if (buscando()) {
        <label class="buscar tu-buscar">
          <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
          <input #campo type="search" placeholder="Buscar página (ej: caja, gastos, QR)" aria-label="Buscar página" autocomplete="off"
            [value]="shell.buscarMenu()" (input)="shell.buscarMenu.set($any($event.target).value)" />
          @if (shell.buscarMenu()) {
            <button type="button" class="limpiar" aria-label="Borrar búsqueda" (click)="shell.buscarMenu.set('')"><ion-icon name="close-circle"></ion-icon></button>
          }
        </label>
      }

      <section class="tu-cab">
        <button type="button" class="tu-nota" (click)="estados.set(!estados())" [attr.aria-expanded]="estados()" aria-label="Cambiar mi estado">
          <span class="tu-punto" [class]="'tu-punto ' + shell.presencia.miEstado()"></span>{{ textoEstado() }}
        </button>
        @if (estados()) {
          <button class="tu-capa" aria-label="Cerrar" (click)="estados.set(false)"></button>
          <div class="tu-estados" role="radiogroup" aria-label="Mi estado">
            @for (e of shell.estadosYo; track e.valor) {
              <button type="button" role="radio" [class.on]="shell.presencia.preferencia() === e.valor" [attr.aria-checked]="shell.presencia.preferencia() === e.valor"
                (click)="elegir(e.valor)">
                <span [class]="'tu-punto ' + (e.valor === 'auto' ? 'activo' : e.valor === 'ausente' ? 'ausente' : '')"></span>
                <span>{{ e.etiqueta }}<small>{{ e.ayuda }}</small></span>
              </button>
            }
          </div>
        }
        <a class="tu-foto" routerLink="/app/perfil" aria-label="Mi perfil: cambiar foto y nombre">
          <app-avatar [nombre]="shell.sb.usuario()?.nombre" [foto]="shell.sb.usuario()?.avatar_url" [usuario]="shell.sb.usuario()?.id" [tam]="104"></app-avatar>
        </a>
        <a #nombreEl class="tu-nombre" routerLink="/app/perfil">{{ nombre() }}<ion-icon name="chevron-down-outline" aria-hidden="true"></ion-icon></a>
        <p class="tu-rol">{{ shell.rolesTexto() }}</p>
      </section>

      @if (buscando() && shell.buscarMenu().trim()) {
        <div class="tu-grupo">
          @for (item of shell.encontradasMenu(); track item.path + item.label) {
            <a class="tu-fila" [routerLink]="item.path" routerLinkActive="active">
              <ion-icon [name]="item.icon"></ion-icon>
              <span class="tu-txt"><span>{{ item.label }}</span><ion-icon class="tu-flecha" name="chevron-forward-outline"></ion-icon></span>
            </a>
          }
        </div>
        @if (!shell.encontradasMenu().length) { <p class="tu-vacio">No encontramos esa página. Prueba con otra palabra.</p> }
      } @else {
        @if (shell.frecuentes().length) {
          <h3 class="tu-tit">Lo que más usas</h3>
          <div class="tu-grupo">
            @for (item of shell.frecuentes(); track item.path + item.label) {
              <a class="tu-fila" [routerLink]="item.path" routerLinkActive="active">
                <ion-icon [name]="item.icon"></ion-icon>
                <span class="tu-txt"><span>{{ item.label }}</span><ion-icon class="tu-flecha" name="chevron-forward-outline"></ion-icon></span>
              </a>
            }
          </div>
        }
        @for (sec of secciones(); track sec.titulo) {
          <h3 class="tu-tit">{{ sec.titulo }}</h3>
          <div class="tu-grupo">
            @for (item of sec.items; track item.path + item.label) {
              <a class="tu-fila" [routerLink]="item.path" routerLinkActive="active">
                <ion-icon [name]="item.icon"></ion-icon>
                <span class="tu-txt"><span>{{ item.label }}</span><ion-icon class="tu-flecha" name="chevron-forward-outline"></ion-icon></span>
              </a>
            }
          </div>
        }
        <div class="tu-grupo" style="margin-top: 22px">
          <button type="button" class="tu-fila peligro" (click)="shell.salir()">
            <ion-icon name="log-out-outline"></ion-icon>
            <span class="tu-txt"><span>Cerrar sesión</span></span>
          </button>
        </div>
      }
    </div>
  `,
})
export class TuPage implements AfterViewInit, OnDestroy {
  shell = inject(ShellComponent);
  private nombreEl = viewChild<ElementRef<HTMLElement>>('nombreEl');
  private campo = viewChild<ElementRef<HTMLInputElement>>('campo');
  private io?: IntersectionObserver;

  buscando = signal(false);
  estados = signal(false);
  /** Cuando el nombre grande sube y se esconde, aparece pequeño en la barra de arriba */
  nombreFuera = signal(false);
  nombre = computed(() => this.shell.sb.usuario()?.nombre ?? '');
  textoEstado = computed(() => {
    const p = this.shell.presencia.preferencia();
    return p === 'invisible' ? 'Invisible para los demás' : p === 'ausente' ? 'En este momento estoy ausente' : 'En este momento estoy disponible';
  });
  /** Mi perfil ya está en la foto: no se repite en las listas */
  secciones = computed(() =>
    this.shell
      .seccionesMas()
      .map((s) => ({ ...s, items: s.items.filter((i) => i.path !== '/app/perfil') }))
      .filter((s) => s.items.length)
  );
  temaToggle = () => this.shell.theme.toggle();

  constructor() {
    addIcons({ chevronDownOutline, chevronForwardOutline, closeCircle, createOutline, logOutOutline, moonOutline, notificationsOutline, searchOutline, sunnyOutline });
    this.shell.buscarMenu.set('');
  }

  ngAfterViewInit(): void {
    const el = this.nombreEl()?.nativeElement;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    this.io = new IntersectionObserver(([e]) => this.nombreFuera.set(!e.isIntersecting && e.boundingClientRect.top < 120), {
      rootMargin: '-70px 0px 0px 0px',
    });
    this.io.observe(el);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }

  alternarBuscar(): void {
    this.buscando.set(!this.buscando());
    if (!this.buscando()) this.shell.buscarMenu.set('');
    else setTimeout(() => this.campo()?.nativeElement.focus(), 0);
  }

  elegir(p: Preferencia): void {
    this.shell.presencia.elegir(p);
    this.estados.set(false);
  }
}
