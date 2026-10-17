import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  add,
  barChartOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cubeOutline,
  ellipsisHorizontal,
  logOutOutline,
  moonOutline,
  peopleOutline,
  receiptOutline,
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
  peopleCircleOutline,
  timeOutline,
  personCircleOutline,
  notificationsOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../core/services/supabase.service';
import { ThemeService } from '../core/services/theme.service';
import { ROLES, Rol } from '../shared/modelos';
import { ToastComponent } from '../shared/toast/toast.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { AvisosPanelComponent } from '../shared/avisos/avisos-panel.component';
import { NotificacionesService } from '../core/services/notificaciones.service';

interface ItemMenu {
  label: string;
  path: string;
  icon: string;
  roles: Rol[];
}

const MENU: ItemMenu[] = [
  { label: 'Inicio', path: '/app/inicio', icon: 'bar-chart-outline', roles: ['admin', 'cuadres'] },
  { label: 'Mi panel', path: '/app/mi-panel', icon: 'grid-outline', roles: ['vendedora'] },
  { label: 'Pedidos', path: '/app/pedidos', icon: 'receipt-outline', roles: ['admin', 'alistador', 'cuadres'] },
  { label: 'Mis entregas', path: '/app/mis-entregas', icon: 'bicycle-outline', roles: ['mensajero'] },
  { label: 'Venta en local', path: '/app/venta-local', icon: 'storefront-outline', roles: ['admin', 'venta_local'] },
  { label: 'Ventas del local', path: '/app/ventas-local', icon: 'list-outline', roles: ['admin', 'venta_local'] },
  { label: 'Cuadres', path: '/app/cuadres', icon: 'wallet-outline', roles: ['admin', 'cuadres', 'mensajero'] },
  { label: 'Catálogo', path: '/app/catalogo', icon: 'book-outline', roles: ['admin', 'vendedora'] },
  { label: 'Ranking', path: '/app/ranking', icon: 'trophy-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador'] },
  { label: 'Clientes', path: '/app/clientes', icon: 'people-circle-outline', roles: ['admin'] },
  { label: 'Productos', path: '/app/productos', icon: 'cube-outline', roles: ['admin'] },
  { label: 'Usuarios', path: '/app/usuarios', icon: 'people-outline', roles: ['admin'] },
  { label: 'Reportes', path: '/app/reportes', icon: 'stats-chart-outline', roles: ['admin', 'cuadres', 'vendedora'] },
  { label: 'Actividad', path: '/app/actividad', icon: 'time-outline', roles: ['admin'] },
  { label: 'Configuración', path: '/app/configuracion', icon: 'settings-outline', roles: ['admin'] },
  { label: 'Mi perfil', path: '/app/perfil', icon: 'person-circle-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador', 'venta_local'] },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IonIcon, ToastComponent, AvatarComponent, AvisosPanelComponent],
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
          @for (item of menu(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }"
              class="menu-item" [attr.aria-label]="colapsado() ? item.label : null">
              <ion-icon [name]="item.icon"></ion-icon>
              @if (!colapsado()) {
                <span>{{ item.label }}</span>
              }
            </a>
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
            <app-avatar [nombre]="sb.usuario()?.nombre" [foto]="sb.usuario()?.avatar_url" [tam]="32"></app-avatar>
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
        @for (item of tabs(); track item.path; let i = $index) {
          @if (i === 1 && puedeVender()) {
            <div class="pill-center">
              <a routerLink="/app/pedidos/nuevo" class="pill-action" (click)="mas.set(false)">
                <ion-icon name="add"></ion-icon>
                <span class="tab-label">Nuevo</span>
              </a>
            </div>
          }
          <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }" (click)="mas.set(false); avisos.cerrar()">
            <ion-icon [name]="item.icon"></ion-icon>
            <span class="tab-label">{{ item.label }}</span>
          </a>
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
        <div class="more-sheet">
          @for (item of masItems(); track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" (click)="mas.set(false)">
              <ion-icon [name]="item.icon"></ion-icon>{{ item.label }}
            </a>
          }
          @if (masItems().length) {
            <hr />
          }
          <button (click)="theme.toggle()">
            <ion-icon [name]="theme.isDark() ? 'sunny-outline' : 'moon-outline'"></ion-icon>
            {{ theme.isDark() ? 'Modo claro' : 'Modo oscuro' }}
          </button>
          <button (click)="salir()"><ion-icon name="log-out-outline"></ion-icon>Cerrar sesión ({{ sb.usuario()?.nombre }})</button>
        </div>
      }
      <app-toast></app-toast>
    </div>
  `,
})
export class ShellComponent implements OnInit, OnDestroy {
  sb = inject(SupabaseService);
  theme = inject(ThemeService);
  avisos = inject(NotificacionesService);
  private router = inject(Router);

  colapsado = signal(this.leerColapsado());
  mas = signal(false);

  menu = computed(() => {
    const roles = this.sb.roles();
    return MENU.filter((m) => m.roles.some((r) => roles.includes(r)));
  });
  /** En el celular caben 2 secciones en la barra (más Nuevo, Avisos y Más); el resto va en "Más" */
  tabs = computed(() => this.menu().slice(0, 2));
  masItems = computed(() => this.menu().slice(2));
  puedeVender = computed(() => this.sb.roles().some((r) => r === 'admin' || r === 'vendedora'));
  rolesTexto = computed(() =>
    this.sb.roles().map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join(' · ') || 'Sin rol asignado'
  );

  constructor() {
    addIcons({
      add, barChartOutline, chevronBackOutline, chevronForwardOutline, cubeOutline, ellipsisHorizontal,
      logOutOutline, moonOutline, peopleOutline, receiptOutline, bicycleOutline, clipboardOutline, sunnyOutline, walletOutline, statsChartOutline, settingsOutline,
      storefrontOutline, listOutline, trophyOutline, bookOutline, gridOutline, peopleCircleOutline, timeOutline, personCircleOutline, notificationsOutline,
    });
  }

  ngOnInit(): void {
    void this.avisos.iniciar();
  }

  ngOnDestroy(): void {
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
