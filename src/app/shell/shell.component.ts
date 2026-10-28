import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  barChartOutline,
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
import { ThemeService } from '../core/services/theme.service';
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
  { label: 'Inicio', path: '/app/inicio', icon: 'bar-chart-outline', roles: ['admin'] },
  // Alistamiento: su propio Inicio, solo con información de los pedidos (sin la ganancia de la tienda)
  { label: 'Inicio', path: '/app/tablero', icon: 'bar-chart-outline', roles: ['alistador'], sinRoles: ['admin'] },
  { label: 'Mi panel', path: '/app/mi-panel', icon: 'grid-outline', roles: ['vendedora'] },
  { label: 'Pedidos', path: '/app/pedidos', icon: 'receipt-outline', roles: ['admin', 'alistador', 'cuadres'] },
  { label: 'Mis entregas', path: '/app/mis-entregas', icon: 'bicycle-outline', roles: ['mensajero'] },
  { label: 'Venta en local', path: '/app/venta-local', icon: 'storefront-outline', roles: ['admin', 'venta_local'], grupo: 'Ventas' },
  { label: 'Ventas del local', path: '/app/ventas-local', icon: 'list-outline', roles: ['admin', 'venta_local'], grupo: 'Ventas' },
  { label: 'Servicio local', path: '/app/servicio-local', icon: 'cash-outline', roles: ['admin', 'venta_local', 'cuadres'], grupo: 'Ventas' },
  { label: 'Catálogo', path: '/app/catalogo', icon: 'book-outline', roles: ['admin', 'vendedora'], grupo: 'Ventas' },
  { label: 'Pedidos de la tienda', path: '/app/pedidos-web', icon: 'globe-outline', roles: ['admin', 'vendedora'], grupo: 'Ventas' },
  { label: 'Recontactar', path: '/app/recontactar', icon: 'chatbubbles-outline', roles: ['admin', 'vendedora'], grupo: 'Ventas' },
  { label: 'Clientes', path: '/app/clientes', icon: 'people-circle-outline', roles: ['admin', 'venta_local'], grupo: 'Ventas' },
  { label: 'Cuadres', path: '/app/cuadres', icon: 'wallet-outline', roles: ['admin', 'cuadres', 'mensajero'], grupo: 'Entregas' },
  { label: 'Mi resumen', path: '/app/mi-resumen', icon: 'analytics-outline', roles: ['mensajero'], grupo: 'Entregas' },
  { label: 'Resumen de mensajeros', path: '/app/mi-resumen', icon: 'analytics-outline', roles: ['admin'], sinRoles: ['mensajero'], grupo: 'Entregas' },
  { label: 'Novedades', path: '/app/novedades', icon: 'alert-circle-outline', roles: ['admin', 'alistador', 'cuadres', 'vendedora', 'mensajero'], grupo: 'Entregas' },
  { label: 'Recolector', path: '/app/recolector', icon: 'bag-handle-outline', roles: ['admin', 'recolector', 'cuadres'], grupo: 'Entregas' },
  { label: 'Barrios', path: '/app/barrios', icon: 'location-outline', roles: ['admin'], grupo: 'Entregas' },
  { label: 'Inventario', path: '/app/inventario', icon: 'layers-outline', roles: ['admin', 'alistador'], grupo: 'Bodega' },
  { label: 'Productos', path: '/app/productos', icon: 'pricetags-outline', roles: ['admin'], grupo: 'Bodega' },
  { label: 'Devoluciones', path: '/app/devoluciones', icon: 'return-down-back-outline', roles: ['admin', 'alistador', 'venta_local', 'cuadres'], grupo: 'Bodega' },
  { label: 'Reportes', path: '/app/reportes', icon: 'stats-chart-outline', roles: ['admin', 'vendedora'], grupo: 'Finanzas' },
  { label: 'Comisiones', path: '/app/comisiones', icon: 'card-outline', roles: ['admin', 'vendedora'], grupo: 'Finanzas' },
  { label: 'Gastos', path: '/app/gastos', icon: 'trending-down-outline', roles: ['admin'], grupo: 'Finanzas' },
  { label: 'Rentabilidad', path: '/app/rentabilidad', icon: 'pie-chart-outline', roles: ['admin'], grupo: 'Finanzas' },
  { label: 'Ranking', path: '/app/ranking', icon: 'trophy-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador'], grupo: 'Equipo' },
  { label: 'Usuarios', path: '/app/usuarios', icon: 'people-outline', roles: ['admin'], grupo: 'Equipo' },
  { label: 'Actividad', path: '/app/actividad', icon: 'time-outline', roles: ['admin'], grupo: 'Equipo' },

  { label: 'Configuración', path: '/app/configuracion', icon: 'settings-outline', roles: ['admin'], grupo: 'Ajustes' },
  { label: 'Actualizaciones', path: '/app/actualizaciones', icon: 'sparkles-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local', 'recolector'], grupo: 'Ajustes' },
  { label: 'Mi perfil', path: '/app/perfil', icon: 'person-circle-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local', 'recolector'], grupo: 'Ajustes' },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IonIcon, ToastComponent, AvatarComponent, AvisosPanelComponent, RequisitosComponent],
  styleUrls: ['../shared/pill-nav.scss', './shell.component.scss'],
  template: `
    <div class="shell" [class.collapsed]="colapsado()">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-mark" src="assets/icon/logo.png" alt="" />
          @if (!colapsado()) {
            <span class="brand-name">Jasta<small>Hobbies &amp; Accesorios</small></span>
          }
          <button class="icon-btn" (click)="alternarMenu()" [attr.aria-label]="colapsado() ? 'Expandir menú' : 'Contraer menú'">
            <ion-icon [name]="colapsado() ? 'chevron-forward-outline' : 'chevron-back-outline'"></ion-icon>
          </button>
        </div>

        @if (puedeVender()) {
          <a routerLink="/app/pedidos/nuevo" class="new-btn" [attr.aria-label]="colapsado() ? 'Nuevo pedido' : null">
            <ion-icon name="add"></ion-icon>
            @if (!colapsado()) {
              <span>Nuevo pedido</span>
            }
          </a>
        }

        <nav class="menu" aria-label="Secciones">
          @if (colapsado()) {
            @for (item of menu(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }"
                class="menu-item" [attr.aria-label]="item.label" [title]="item.label">
                <ion-icon [name]="item.icon"></ion-icon>
              </a>
            }
          } @else {
            @for (item of sueltos(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }" class="menu-item">
                <ion-icon [name]="item.icon"></ion-icon><span>{{ item.label }}</span>
              </a>
            }
            @for (g of grupos(); track g.id) {
              <div class="grupo" [class.abierto]="abierto(g.id)">
                <button type="button" class="grupo-head" (click)="alternarGrupo(g.id)" [attr.aria-expanded]="abierto(g.id)">
                  <ion-icon [name]="g.icon"></ion-icon><span>{{ g.id }}</span>
                  @if (!abierto(g.id) && g.activo) { <span class="grupo-punto" aria-hidden="true"></span> }
                  <ion-icon class="grupo-flecha" name="chevron-down-outline"></ion-icon>
                </button>
                @if (abierto(g.id)) {
                  <div class="grupo-items">
                    @for (item of g.items; track item.path) {
                      <a [routerLink]="item.path" routerLinkActive="active" class="menu-item">
                        <ion-icon [name]="item.icon"></ion-icon><span>{{ item.label }}</span>
                      </a>
                    }
                  </div>
                }
              </div>
            }
          }
        </nav>

        <div class="sidebar-footer">
          <button class="footer-btn avisos-btn" [class.on]="avisos.abierto()" (click)="avisos.toggle()" [attr.aria-expanded]="avisos.abierto()"
            [attr.aria-label]="'Avisos' + (avisos.noLeidas() ? ', ' + avisos.noLeidas() + ' sin leer' : '')">
            <span class="icono-badge">
              <ion-icon name="notifications-outline"></ion-icon>
              @if (avisos.noLeidas()) {
                <span class="badge-num num">{{ avisos.noLeidas() > 9 ? '9+' : avisos.noLeidas() }}</span>
              }
            </span>
            @if (!colapsado()) {
              <span>Avisos</span>
            }
          </button>
          <a class="usuario" routerLink="/app/perfil" [attr.aria-label]="'Mi perfil: ' + sb.usuario()?.nombre">
            <app-avatar [nombre]="sb.usuario()?.nombre" [foto]="sb.usuario()?.avatar_url" [usuario]="sb.usuario()?.id" [tam]="32"></app-avatar>
            @if (!colapsado()) {
              <div>
                <strong>{{ sb.usuario()?.nombre }}</strong>
                <span>{{ rolesTexto() }}</span>
              </div>
            }
          </a>
          <button class="footer-btn" (click)="theme.toggle()">
            <ion-icon [name]="theme.isDark() ? 'sunny-outline' : 'moon-outline'"></ion-icon>
            @if (!colapsado()) {
              <span>{{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}</span>
            }
          </button>
          <button class="footer-btn" (click)="salir()">
            <ion-icon name="log-out-outline"></ion-icon>
            @if (!colapsado()) {
              <span>Cerrar sesión</span>
            }
          </button>
        </div>
      </aside>

      <main class="content">
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
        <button class="tab" [class.active]="mas()" (click)="avisos.cerrar(); mas.set(!mas())" [attr.aria-expanded]="mas()">
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
          <div class="more-grid">
            @for (item of masItems(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" (click)="mas.set(false)" class="more-op">
                <span class="more-ico"><ion-icon [name]="item.icon"></ion-icon></span>
                <span class="more-label">{{ item.label }}</span>
              </a>
            }
          </div>
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
  avisos = inject(NotificacionesService);
  private presencia = inject(PresenciaService);
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
  /** La pantalla principal de cada quien también va suelta arriba, aunque sea de un grupo */
  sueltos = computed(() => this.menu().filter((m) => !m.grupo || m.path === this.sb.inicioSegunRoles()));
  grupos = computed(() => {
    const url = this.url();
    return GRUPOS.map((g) => {
      const items = this.menu().filter((m) => m.grupo === g.id && m.path !== this.sb.inicioSegunRoles());
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
  masItems = computed(() => this.menu().slice(2));
  puedeVender = computed(() => this.sb.roles().some((r) => r === 'admin' || r === 'vendedora'));
  rolesTexto = computed(() =>
    this.sb.roles().map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join(' · ') || 'Sin rol asignado'
  );

  constructor() {
    addIcons({
      sparklesOutline, globeOutline, chatbubblesOutline, analyticsOutline, add, close, chevronDownOutline, layersOutline, pricetagsOutline, returnDownBackOutline, pieChartOutline, alertCircleOutline, cardOutline, trendingDownOutline, barChartOutline, chevronBackOutline, chevronForwardOutline, cubeOutline, ellipsisHorizontal,
      logOutOutline, moonOutline, peopleOutline, receiptOutline, bicycleOutline, clipboardOutline, sunnyOutline, walletOutline, statsChartOutline, settingsOutline,
      storefrontOutline, listOutline, trophyOutline, bookOutline, gridOutline, cashOutline, bagHandleOutline, peopleCircleOutline, timeOutline, personCircleOutline, notificationsOutline, locationOutline,
    });
  }

  ngOnInit(): void {
    this.abrirGrupoActual();
    this.subNav = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) {
        this.url.set(e.urlAfterRedirects);
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
