import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  barChartOutline,
  calendarOutline,
  homeOutline,
  colorPaletteOutline,
  hourglassOutline,
  swapHorizontalOutline,
  searchOutline,
  chevronBackOutline,
  chevronDownOutline,
  layersOutline,
  returnDownBackOutline,
  pieChartOutline,
  pricetagsOutline,
  close,
  chevronForwardOutline,
  cubeOutline,
  ellipsisHorizontal,
  logOutOutline,
  moonOutline,
  peopleOutline,
  receiptOutline,
  alertCircleOutline,
  cardOutline,
  trendingDownOutline,
  bicycleOutline,
  clipboardOutline,
  sunnyOutline,
  walletOutline,
  ticketOutline,
  statsChartOutline,
  settingsOutline,
  storefrontOutline,
  listOutline,
  trophyOutline,
  bookOutline,
  gridOutline,
  cashOutline,
  bagHandleOutline,
  peopleCircleOutline,
  timeOutline,
  personCircleOutline,
  notificationsOutline,
  locationOutline,
  sparklesOutline,
  globeOutline,
  chatbubblesOutline,
  analyticsOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../core/services/supabase.service';
import { RequisitosComponent } from '../shared/requisitos/requisitos.component';
import { TransferenciasAlertaComponent } from '../shared/transferencias-alerta/transferencias-alerta.component';
import { ThemeService } from '../core/services/theme.service';
import { FondoService } from '../core/services/fondo.service';
import { ROLES, Rol } from '../shared/modelos';
import { ToastComponent } from '../shared/toast/toast.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { AvisosPanelComponent } from '../shared/avisos/avisos-panel.component';
import { NotificacionesService } from '../core/services/notificaciones.service';
import { PresenciaService } from '../core/services/presencia.service';

interface ItemMenu {
  label: string;
  path: string;
  icon: string;
  roles: Rol[];
  /** No se muestra a quien tenga alguno de estos roles (ya tiene otra versión de la sección) */
  sinRoles?: Rol[];
  /** Grupo desplegable del menú del computador (sin grupo = siempre a la vista, arriba) */
  grupo?: Grupo;
  /** Otras palabras con las que alguien la buscaría en el menú */
  buscar?: string;
}

const CLAVE_USOS = 'jasta-menu-usos';
function leerUsos(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(CLAVE_USOS) || '{}') as Record<string, number>; } catch { return {}; }
}
function normalMenu(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

type Grupo = 'Ventas' | 'Entregas' | 'Bodega' | 'Finanzas' | 'Equipo' | 'Ajustes';
const GRUPOS: { id: Grupo; icon: string }[] = [
  { id: 'Ventas', icon: 'storefront-outline' },
  { id: 'Entregas', icon: 'bicycle-outline' },
  { id: 'Bodega', icon: 'cube-outline' },
  { id: 'Finanzas', icon: 'cash-outline' },
  { id: 'Equipo', icon: 'people-outline' },
  { id: 'Ajustes', icon: 'settings-outline' },
];

const MENU: ItemMenu[] = [
  { label: 'Inicio', path: '/app/inicio', icon: 'home-outline', roles: ['admin'], grupo: 'Finanzas' },
  // Alistamiento: su propio Inicio, solo con información de los pedidos (sin la ganancia de la tienda)
  { label: 'Inicio', path: '/app/tablero', icon: 'home-outline', roles: ['alistador'], sinRoles: ['admin'], grupo: 'Bodega' },
  { label: 'Mi panel', path: '/app/mi-panel', icon: 'grid-outline', roles: ['vendedora'], grupo: 'Ventas' },
  { label: 'Pedidos', path: '/app/pedidos', icon: 'receipt-outline', roles: ['admin', 'alistador', 'cuadres'], grupo: 'Ventas' },
  { label: 'Calendario', path: '/app/calendario', icon: 'calendar-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local', 'recolector'], grupo: 'Equipo', buscar: 'fechas recordatorio agenda festivos quincena dia de la madre' },
  { label: 'Mis entregas', path: '/app/mis-entregas', icon: 'bicycle-outline', roles: ['mensajero'], grupo: 'Entregas' },
  { label: 'Venta en local', path: '/app/venta-local', icon: 'storefront-outline', roles: ['admin', 'venta_local'], grupo: 'Ventas' , buscar: 'vender caja registrar' },
  { label: 'Ventas del local', path: '/app/ventas-local', icon: 'list-outline', roles: ['admin', 'venta_local'], grupo: 'Ventas' , buscar: 'caja ticket cuadrar' },
  { label: 'Servicio local', path: '/app/servicio-local', icon: 'cash-outline', roles: ['admin', 'venta_local', 'cuadres'], grupo: 'Ventas' , buscar: 'alcancia caja' },
  { label: 'Catálogo', path: '/app/catalogo', icon: 'book-outline', roles: ['admin', 'vendedora'], grupo: 'Ventas' },
  { label: 'Cupones', path: '/app/cupones', icon: 'ticket-outline', roles: ['admin'], grupo: 'Ventas', buscar: 'descuento promocion codigo oferta' },
  { label: 'Pedidos de la tienda', path: '/app/pedidos-web', icon: 'globe-outline', roles: ['admin', 'vendedora'], grupo: 'Ventas' , buscar: 'web catalogo publico enlace link' },
  { label: 'Recontactar', path: '/app/recontactar', icon: 'chatbubbles-outline', roles: ['admin', 'vendedora'], grupo: 'Ventas' , buscar: 'clientes dormidos whatsapp' },
  { label: 'Clientes', path: '/app/clientes', icon: 'people-circle-outline', roles: ['admin', 'venta_local'], grupo: 'Ventas' },
  { label: 'Cuadres', path: '/app/cuadres', icon: 'wallet-outline', roles: ['admin', 'cuadres', 'mensajero'], grupo: 'Entregas' , buscar: 'plata efectivo mensajeros' },
  { label: 'Mi resumen', path: '/app/mi-resumen', icon: 'analytics-outline', roles: ['mensajero'], grupo: 'Entregas' },
  { label: 'Resumen de mensajeros', path: '/app/mi-resumen', icon: 'analytics-outline', roles: ['admin'], sinRoles: ['mensajero'], grupo: 'Entregas' },
  { label: 'Novedades', path: '/app/novedades', icon: 'alert-circle-outline', roles: ['admin', 'alistador', 'cuadres', 'vendedora', 'mensajero'], grupo: 'Entregas' , buscar: 'no se pudo entregar problema' },
  { label: 'Recolector', path: '/app/recolector', icon: 'bag-handle-outline', roles: ['admin', 'recolector', 'cuadres'], grupo: 'Entregas' , buscar: 'base recoger' },
  { label: 'Barrios', path: '/app/barrios', icon: 'location-outline', roles: ['admin'], grupo: 'Entregas' , buscar: 'domicilio tarifa valor' },
  { label: 'Inventario', path: '/app/inventario', icon: 'layers-outline', roles: ['admin', 'alistador'], grupo: 'Bodega' , buscar: 'stock compras comprar bodega' },
  { label: 'Productos quietos', path: '/app/quietos', icon: 'hourglass-outline', roles: ['admin'], grupo: 'Bodega', buscar: 'sin vender no se venden rotacion estancados quieta' },
  { label: 'Productos', path: '/app/productos', icon: 'pricetags-outline', roles: ['admin'], grupo: 'Bodega' , buscar: 'precios fotos crear' },
  { label: 'Devoluciones', path: '/app/devoluciones', icon: 'return-down-back-outline', roles: ['admin', 'alistador', 'venta_local', 'cuadres'], grupo: 'Bodega' },
  { label: 'Reportes', path: '/app/reportes', icon: 'stats-chart-outline', roles: ['admin', 'vendedora'], grupo: 'Finanzas' },
  { label: 'Comisiones', path: '/app/comisiones', icon: 'card-outline', roles: ['admin', 'vendedora'], grupo: 'Finanzas' , buscar: 'liquidacion pagar vendedoras ganancia' },
  { label: 'Gastos', path: '/app/gastos', icon: 'trending-down-outline', roles: ['admin'], grupo: 'Finanzas' , buscar: 'arriendo nomina utilidad' },
  { label: 'Transferencias', path: '/app/transferencias', icon: 'swap-horizontal-outline', roles: ['admin'], grupo: 'Finanzas', buscar: 'confirmar banco transferencia nequi pagos verificar' },
  { label: 'Cuentas por cobrar', path: '/app/cuentas', icon: 'wallet-outline', roles: ['admin'], grupo: 'Finanzas', buscar: 'hermano costo fiado abono me debe prestamo' },
  { label: 'Deudas', path: '/app/deudas', icon: 'hourglass-outline', roles: ['admin'], grupo: 'Finanzas', buscar: 'fiado proveedor abono credito pagar' },
  { label: 'Rentabilidad', path: '/app/rentabilidad', icon: 'pie-chart-outline', roles: ['admin'], grupo: 'Finanzas' , buscar: 'ganancia producto' },
  { label: 'Ranking', path: '/app/ranking', icon: 'trophy-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador'], grupo: 'Equipo' , buscar: 'metas puesto' },
  { label: 'Usuarios', path: '/app/usuarios', icon: 'people-outline', roles: ['admin'], grupo: 'Equipo' , buscar: 'equipo roles crear cuenta' },
  { label: 'Actividad', path: '/app/actividad', icon: 'time-outline', roles: ['admin'], grupo: 'Equipo' , buscar: 'historial cambios' },

  { label: 'Configuración', path: '/app/configuracion', icon: 'settings-outline', roles: ['admin'], grupo: 'Ajustes' , buscar: 'qr cuentas telegram whatsapp rotulo' },
  { label: 'Tema', path: '/app/tema', icon: 'color-palette-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local', 'recolector'], grupo: 'Ajustes', buscar: 'fondo pantalla imagen foto apariencia colores modo oscuro claro' },
  { label: 'Actualizaciones', path: '/app/actualizaciones', icon: 'sparkles-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local', 'recolector'], grupo: 'Ajustes' , buscar: 'novedades nuevo ayuda' },
  { label: 'Mi perfil', path: '/app/perfil', icon: 'person-circle-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local', 'recolector'], grupo: 'Ajustes' , buscar: 'foto contraseña' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, IonIcon, ToastComponent, AvatarComponent, AvisosPanelComponent, RequisitosComponent, TransferenciasAlertaComponent],
  styleUrls: ['../shared/pill-nav.scss', './shell.component.scss'],
  template: `
    <div class="vd-fondo" aria-hidden="true"></div>
    <div class="shell" [class.collapsed]="colapsado()">
      <!-- Computador: barra flotante de íconos (cada categoría abre su panel al lado) -->
      <aside class="sidebar rail" aria-label="Menú">
        @if (puedeVender()) {
          <a routerLink="/app/pedidos/nuevo" class="rail-btn rail-nuevo" data-tip="Nuevo pedido" aria-label="Nuevo pedido"><ion-icon name="add"></ion-icon></a>
          <span class="rail-sep" aria-hidden="true"></span>
        }
        @for (item of sueltos(); track item.path) {
          <a [routerLink]="item.path" routerLinkActive="active" class="rail-btn" [attr.data-tip]="item.label" [attr.aria-label]="item.label"><ion-icon [name]="item.icon"></ion-icon></a>
        }
        @for (g of grupos(); track g.id) {
          <button type="button" class="rail-btn" [class.active]="g.activo" [class.abierto]="flotante() === g.id" [attr.data-tip]="g.id" [attr.aria-label]="g.id"
            [attr.aria-expanded]="flotante() === g.id" (click)="flotante.set(flotante() === g.id ? null : g.id)">
            <ion-icon [name]="g.icon"></ion-icon>
          </button>
        }
      </aside>
      @if (grupoFlotante(); as g) {
        <button class="rail-capa" aria-label="Cerrar" (click)="flotante.set(null)"></button>
        <nav class="rail-fly" [attr.aria-label]="g.id">
          <p class="rail-fly-tit">{{ g.id }}</p>
          @for (item of g.items; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" class="rail-fly-op" (click)="flotante.set(null)">
              <ion-icon [name]="item.icon"></ion-icon><span>{{ item.label }}</span>
            </a>
          }
        </nav>
      }

      <main class="content">
        <!-- Barra superior (diseño Vidrio, escritorio): saludo, secciones principales y accesos -->
        <header class="vd-top">
          <a class="vd-logo" routerLink="/app" aria-label="Jasta"><img src="assets/icon/logo.png" alt="" /></a>
          <span class="vd-saludo">{{ saludo() }}</span>
          <nav class="vd-nav" aria-label="Secciones principales">
            @for (item of principales(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }">
                <ion-icon [name]="item.icon"></ion-icon>{{ item.label }}</a>
            }
          </nav>
          <div class="vd-der">
            <button class="vd-circ" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'" [title]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'">
              <ion-icon [name]="theme.isDark() ? 'sunny-outline' : 'moon-outline'"></ion-icon></button>
            <a class="vd-circ" routerLink="/app/tema" aria-label="Tema y fondo" title="Tema y fondo"><ion-icon name="color-palette-outline"></ion-icon></a>
            <button class="vd-circ" (click)="avisos.toggle()" [attr.aria-label]="'Avisos' + (avisos.noLeidas() ? ', ' + avisos.noLeidas() + ' sin leer' : '')">
              <ion-icon name="notifications-outline"></ion-icon>
              @if (avisos.noLeidas()) { <span class="badge-num num">{{ avisos.noLeidas() > 9 ? '9+' : avisos.noLeidas() }}</span> }
            </button>
            <div class="vd-yo">
              <button class="vd-avatar" (click)="menuYo.set(!menuYo())" [attr.aria-expanded]="menuYo()" aria-haspopup="menu" [attr.aria-label]="'Tu cuenta: ' + sb.usuario()?.nombre">
                <app-avatar [nombre]="sb.usuario()?.nombre" [foto]="sb.usuario()?.avatar_url" [usuario]="sb.usuario()?.id" [tam]="38"></app-avatar>
              </button>
              @if (menuYo()) {
                <button class="vd-capa" aria-label="Cerrar" (click)="menuYo.set(false)"></button>
                <div class="vd-menu" role="menu" aria-label="Tu cuenta">
                  <div class="vd-menu-cab">
                    <app-avatar [nombre]="sb.usuario()?.nombre" [foto]="sb.usuario()?.avatar_url" [usuario]="sb.usuario()?.id" [tam]="44"></app-avatar>
                    <div><strong>{{ sb.usuario()?.nombre }}</strong><small>{{ rolesTexto() }}</small></div>
                  </div>
                  <p class="vd-menu-tit">Estado</p>
                  @for (e of estadosYo; track e.valor) {
                    <button type="button" class="vd-menu-op" role="menuitemradio" [attr.aria-checked]="presencia.preferencia() === e.valor" [class.on]="presencia.preferencia() === e.valor"
                      (click)="presencia.elegir(e.valor)">
                      <span class="vd-pres" [class]="'vd-pres ' + e.punto" aria-hidden="true"></span>
                      <span class="vd-menu-txt">{{ e.etiqueta }}<small>{{ e.ayuda }}</small></span>
                      @if (presencia.preferencia() === e.valor) { <span class="vd-ok" aria-hidden="true">✓</span> }
                    </button>
                  }
                  <span class="vd-sep" aria-hidden="true"></span>
                  <a class="vd-menu-op" role="menuitem" routerLink="/app/perfil" (click)="menuYo.set(false)"><ion-icon name="person-circle-outline"></ion-icon><span class="vd-menu-txt">Mi perfil</span></a>
                  <a class="vd-menu-op" role="menuitem" routerLink="/app/tema" (click)="menuYo.set(false)"><ion-icon name="color-palette-outline"></ion-icon><span class="vd-menu-txt">Tema y fondo</span></a>
                  <button type="button" class="vd-menu-op peligro" role="menuitem" (click)="menuYo.set(false); salir()"><ion-icon name="log-out-outline"></ion-icon><span class="vd-menu-txt">Cerrar sesión</span></button>
                </div>
              }
            </div>
          </div>
        </header>
        <app-transferencias-alerta></app-transferencias-alerta>
        <router-outlet></router-outlet>
      </main>

      <nav class="pill-nav mobile-only" aria-label="Secciones">
        @for (item of tabs(); track item.path; let i = $index; let ultimo = $last) {
          <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }" (click)="mas.set(false); avisos.cerrar()">
            <ion-icon [name]="item.icon"></ion-icon>
            <span class="tab-label">{{ item.label }}</span>
          </a>
          @if ((i === 1 || ultimo) && i <= 1 && puedeVender()) {
            <div class="pill-center">
              <a routerLink="/app/pedidos/nuevo" class="pill-action" (click)="mas.set(false)">
                <ion-icon name="add"></ion-icon>
                <span class="tab-label">Nuevo</span>
              </a>
            </div>
          }
        }
        <button class="tab" [class.active]="avisos.abierto()" (click)="mas.set(false); avisos.toggle()" [attr.aria-expanded]="avisos.abierto()">
          <span class="icono-badge">
            <ion-icon name="notifications-outline"></ion-icon>
            @if (avisos.noLeidas()) {
              <span class="badge-num num">{{ avisos.noLeidas() > 9 ? '9+' : avisos.noLeidas() }}</span>
            }
          </span>
          <span class="tab-label">Avisos</span>
        </button>
        <button class="tab" [class.active]="mas()" (click)="avisos.cerrar(); buscarMenu.set(''); mas.set(!mas())" [attr.aria-expanded]="mas()">
          <ion-icon name="ellipsis-horizontal"></ion-icon>
          <span class="tab-label">Más</span>
        </button>
      </nav>
      <app-avisos-panel [posicion]="'barra'"></app-avisos-panel>

      @if (mas()) {
        <button class="more-backdrop" aria-label="Cerrar menú" (click)="mas.set(false)"></button>
        <div class="more-sheet" role="dialog" aria-labelledby="t-mas">
          <span class="more-agarre" aria-hidden="true"></span>
          <div class="more-head">
            <h2 id="t-mas">Menú</h2>
            <button class="more-cerrar" aria-label="Cerrar menú" (click)="mas.set(false)"><ion-icon name="close"></ion-icon></button>
          </div>
          <label class="more-buscar">
            <ion-icon name="search-outline" aria-hidden="true"></ion-icon>
            <input type="search" placeholder="Buscar página (ej: caja, gastos, QR)" aria-label="Buscar en el menú" autocomplete="off"
              [value]="buscarMenu()" (input)="buscarMenu.set($any($event.target).value)" />
          </label>
          <ng-template #opcion let-item>
            <a [routerLink]="item.path" routerLinkActive="active" (click)="mas.set(false)" class="more-op">
              <span class="more-ico"><ion-icon [name]="item.icon"></ion-icon></span>
              <span class="more-label">{{ item.label }}</span>
            </a>
          </ng-template>
          @if (buscarMenu().trim()) {
            <div class="more-grid">
              @for (item of encontradasMenu(); track item.path + item.label) { <ng-container *ngTemplateOutlet="opcion; context: { $implicit: item }"></ng-container> }
            </div>
            @if (!encontradasMenu().length) { <p class="more-vacio">No encontramos esa página. Prueba con otra palabra.</p> }
          } @else {
            @if (frecuentes().length) {
              <h3 class="more-titulo">Lo que más usas</h3>
              <div class="more-grid">
                @for (item of frecuentes(); track item.path + item.label) { <ng-container *ngTemplateOutlet="opcion; context: { $implicit: item }"></ng-container> }
              </div>
            }
            @for (sec of seccionesMas(); track sec.titulo) {
              <h3 class="more-titulo">{{ sec.titulo }}</h3>
              <div class="more-grid">
                @for (item of sec.items; track item.path + item.label) { <ng-container *ngTemplateOutlet="opcion; context: { $implicit: item }"></ng-container> }
              </div>
            }
          }
          <div class="more-pie">
            <button class="more-btn" (click)="theme.toggle()">
              <ion-icon [name]="theme.isDark() ? 'sunny-outline' : 'moon-outline'"></ion-icon>
              {{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}
            </button>
            <button class="more-btn salir" (click)="salir()"><ion-icon name="log-out-outline"></ion-icon>Cerrar sesión</button>
          </div>
        </div>
      }
      <app-toast></app-toast>
      @if (avisos.requisito()) {
        <app-requisitos (salir)="salir()"></app-requisitos>
      }
    </div>
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  sb = inject(SupabaseService);
  theme = inject(ThemeService);
  /** Aplica la foto de fondo del diseño Vidrio (Ajustes → Tema) */
  fondo = inject(FondoService);
  avisos = inject(NotificacionesService);
  presencia = inject(PresenciaService);
  private router = inject(Router);

  colapsado = signal(this.leerColapsado());
  mas = signal(false);

  menu = computed(() => {
    const roles = this.sb.roles();
    const items = MENU.filter((m) => m.roles.some((r) => roles.includes(r)) && !m.sinRoles?.some((r) => roles.includes(r)));
    // La pantalla principal de cada quien va de primera (en el celular es la primera pestaña)
    const inicio = this.sb.inicioSegunRoles();
    const i = items.findIndex((m) => m.path === inicio);
    return i > 0 ? [items[i], ...items.slice(0, i), ...items.slice(i + 1)] : items;
  });
  /** Computador: las secciones sin grupo van arriba y las demás en grupos desplegables */
  /** Todas las secciones van en su categoría (las principales están en la barra de arriba) */
  sueltos = computed(() => this.menu().filter((m) => !m.grupo));
  grupos = computed(() => {
    const url = this.url();
    return GRUPOS.map((g) => {
      const items = this.menu().filter((m) => m.grupo === g.id);
      return { ...g, items, activo: items.some((m) => url.startsWith(m.path)) };
    }).filter((g) => g.items.length);
  });
  /** Grupos abiertos a mano (se recuerdan); el de la página actual siempre se abre */
  private abiertos = signal<Set<string>>(this.leerAbiertos());
  private url = signal(this.router.url);

  abierto(g: string): boolean {
    return this.abiertos().has(g);
  }

  alternarGrupo(g: string): void {
    const s = new Set(this.abiertos());
    if (s.has(g)) s.delete(g);
    else s.add(g);
    this.abiertos.set(s);
    try {
      localStorage.setItem('jasta-menu-grupos', JSON.stringify([...s]));
    } catch {
      /* sin almacenamiento */
    }
  }

  private leerAbiertos(): Set<string> {
    try {
      return new Set(JSON.parse(localStorage.getItem('jasta-menu-grupos') ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  }

  /** Al entrar a una página de un grupo cerrado, ese grupo se abre */
  private abrirGrupoActual(): void {
    const g = this.grupos().find((x) => x.activo);
    if (g && !this.abierto(g.id)) this.alternarGrupo(g.id);
  }

  /** En el celular caben 2 secciones en la barra (más Nuevo, Avisos y Más); el resto va en "Más" */
  tabs = computed(() => this.menu().slice(0, 2));
  /** Categoría abierta en el panel flotante de la barra de íconos */
  flotante = signal<string | null>(null);
  grupoFlotante = computed(() => this.grupos().find((g) => g.id === this.flotante()) ?? null);

  /** Mini pantalla de la foto (arriba a la derecha): estado, Mi perfil y cerrar sesión */
  menuYo = signal(false);
  readonly estadosYo: { valor: 'auto' | 'ausente' | 'invisible'; etiqueta: string; ayuda: string; punto: string }[] = [
    { valor: 'auto', etiqueta: 'Activo', ayuda: 'Pasas a ausente solo si no usas la app', punto: 'activo' },
    { valor: 'ausente', etiqueta: 'Ausente', ayuda: 'Aunque tengas la app abierta', punto: 'ausente' },
    { valor: 'invisible', etiqueta: 'Invisible', ayuda: 'Te ven desconectado', punto: 'desconectado' },
  ];

  /** Desde la barra de íconos: abre el menú completo con ese grupo desplegado */
  abrirGrupo(id: string): void {
    if (this.colapsado()) this.alternarMenu();
    if (!this.abierto(id)) this.alternarGrupo(id);
  }

  /** Las 4 primeras secciones, en la barra superior del diseño Vidrio */
  principales = computed(() => {
    const menu = this.menu();
    // Inicio (el de cada quien), Pedidos, Calendario y Cuadres; si alguna no le toca, se completa con las siguientes
    const quiero = [this.sb.inicioSegunRoles(), '/app/pedidos', '/app/calendario', '/app/cuadres'];
    const elegidas = quiero.map((p) => menu.find((m) => m.path === p)).filter((m): m is ItemMenu => !!m);
    const extra = menu.filter((m) => !elegidas.includes(m));
    return [...elegidas, ...extra].slice(0, 4);
  });
  saludo = computed(() => {
    const h = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date()));
    const nombre = (this.sb.usuario()?.nombre ?? '').trim().split(/\s+/)[0];
    return (h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches') + (nombre ? `, ${nombre}` : '');
  });
  masItems = computed(() => this.menu().slice(2));

  /** Buscador del menú del celular */
  buscarMenu = signal('');
  encontradasMenu = computed(() => {
    const palabras = normalMenu(this.buscarMenu()).split(' ').filter(Boolean);
    return this.masItems().filter((m) => {
      const donde = normalMenu(`${m.label} ${m.grupo ?? ''} ${m.buscar ?? ''}`);
      return palabras.every((w) => donde.includes(w));
    });
  });

  /** Veces que se ha abierto cada página en este celular (para "Lo que más usas") */
  private usos = signal<Record<string, number>>(leerUsos());
  frecuentes = computed(() => {
    const u = this.usos();
    return this.masItems().filter((m) => (u[m.path] ?? 0) >= 3).sort((a, b) => (u[b.path] ?? 0) - (u[a.path] ?? 0)).slice(0, 4);
  });
  /** El resto del menú por secciones (lo que ya sale en "Lo que más usas" no se repite) */
  seccionesMas = computed(() => {
    const ya = new Set(this.frecuentes().map((m) => m.path + m.label));
    const resto = this.masItems().filter((m) => !ya.has(m.path + m.label));
    const sin = resto.filter((m) => !m.grupo);
    return [
      ...(sin.length ? [{ titulo: 'Principal', items: sin }] : []),
      ...GRUPOS.map((g) => ({ titulo: g.id === 'Bodega' ? 'Bodega e inventario' : g.id, items: resto.filter((m) => m.grupo === g.id) })).filter((x) => x.items.length),
    ];
  });

  private contarUso(url: string): void {
    const ruta = url.split(/[?#]/)[0];
    const item = MENU.filter((m) => ruta === m.path || ruta.startsWith(m.path + '/')).sort((a, b) => b.path.length - a.path.length)[0];
    if (!item) return;
    const u = { ...this.usos(), [item.path]: (this.usos()[item.path] ?? 0) + 1 };
    this.usos.set(u);
    try { localStorage.setItem(CLAVE_USOS, JSON.stringify(u)); } catch { /* sin almacenamiento */ }
  }
  puedeVender = computed(() => this.sb.roles().some((r) => r === 'admin' || r === 'vendedora'));
  rolesTexto = computed(() =>
    this.sb.roles().map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join(' · ') || 'Sin rol asignado'
  );

  constructor() {
    addIcons({ homeOutline, colorPaletteOutline, calendarOutline, hourglassOutline, swapHorizontalOutline, searchOutline, 
      sparklesOutline, globeOutline, chatbubblesOutline, analyticsOutline, add, close, chevronDownOutline, layersOutline, pricetagsOutline, returnDownBackOutline, pieChartOutline, alertCircleOutline, cardOutline, trendingDownOutline, barChartOutline, chevronBackOutline, chevronForwardOutline, cubeOutline, ellipsisHorizontal,
      logOutOutline, moonOutline, peopleOutline, receiptOutline, bicycleOutline, clipboardOutline, sunnyOutline, walletOutline, ticketOutline, statsChartOutline, settingsOutline,
      storefrontOutline, listOutline, trophyOutline, bookOutline, gridOutline, cashOutline, bagHandleOutline, peopleCircleOutline, timeOutline, personCircleOutline, notificationsOutline, locationOutline,
    });
  }

  ngOnInit(): void {
    this.abrirGrupoActual();
    this.subNav = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.url.set(e.urlAfterRedirects);
        this.contarUso(e.urlAfterRedirects);
        this.abrirGrupoActual();
      }
    });
    void this.avisos.iniciar();
    // Estado activo / ausente / desconectado (como en Discord)
    void this.presencia.iniciar();
  }

  private subNav?: { unsubscribe(): void };

  ngOnDestroy(): void {
    this.subNav?.unsubscribe();
    this.avisos.detener();
  }

  private leerColapsado(): boolean {
    try {
      return localStorage.getItem('jasta-menu-colapsado') === '1';
    } catch {
      return false;
    }
  }

  alternarMenu(): void {
    this.colapsado.set(!this.colapsado());
    try {
      localStorage.setItem('jasta-menu-colapsado', this.colapsado() ? '1' : '0');
    } catch {
      /* sin almacenamiento */
    }
  }

  async salir(): Promise<void> {
    this.mas.set(false);
    await this.avisos.salir();
    await this.sb.logout();
    this.router.navigateByUrl('/auth/login');
  }
}
