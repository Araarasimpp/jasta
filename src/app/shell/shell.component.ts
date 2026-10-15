import { Component, computed, inject, signal } from '@angular/core';
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
  peopleCircleOutline,
  timeOutline,
  personCircleOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../core/services/supabase.service';
import { ThemeService } from '../core/services/theme.service';
import { ROLES, Rol } from '../shared/modelos';
import { ToastComponent } from '../shared/toast/toast.component';

interface ItemMenu {
  label: string;
  path: string;
  icon: string;
  roles: Rol[];
}

const MENU: ItemMenu[] = [
  { label: 'Inicio', path: '/app/inicio', icon: 'bar-chart-outline', roles: ['admin', 'cuadres'] },
  { label: 'Pedidos', path: '/app/pedidos', icon: 'receipt-outline', roles: ['admin', 'vendedora', 'alistador', 'cuadres'] },
  { label: 'Mis entregas', path: '/app/mis-entregas', icon: 'bicycle-outline', roles: ['mensajero'] },
  { label: 'Venta en local', path: '/app/venta-local', icon: 'storefront-outline', roles: ['admin', 'vendedora', 'alistador'] },
  { label: 'Ventas del local', path: '/app/ventas-local', icon: 'list-outline', roles: ['admin', 'vendedora', 'alistador', 'cuadres'] },
  { label: 'Cuadres', path: '/app/cuadres', icon: 'wallet-outline', roles: ['admin', 'cuadres', 'mensajero'] },
  { label: 'Ranking', path: '/app/ranking', icon: 'trophy-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador'] },
  { label: 'Clientes', path: '/app/clientes', icon: 'people-circle-outline', roles: ['admin'] },
  { label: 'Productos', path: '/app/productos', icon: 'cube-outline', roles: ['admin'] },
  { label: 'Usuarios', path: '/app/usuarios', icon: 'people-outline', roles: ['admin'] },
  { label: 'Reportes', path: '/app/reportes', icon: 'stats-chart-outline', roles: ['admin', 'cuadres', 'vendedora'] },
  { label: 'Actividad', path: '/app/actividad', icon: 'time-outline', roles: ['admin'] },
  { label: 'Configuración', path: '/app/configuracion', icon: 'settings-outline', roles: ['admin'] },
  { label: 'Mi perfil', path: '/app/perfil', icon: 'person-circle-outline', roles: ['admin', 'cuadres', 'vendedora', 'mensajero', 'alistador'] },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IonIcon, ToastComponent],
  styleUrls: ['../shared/pill-nav.scss', './shell.component.scss'],
  template: `
    <div class="shell" [class.collapsed]="colapsado()">
      <aside class="sidebar">
        <div class="brand">
          <img class="brand-mark" src="assets/icon/logo.png" alt="" />
          @if (!colapsado()) {
            <span class="brand-name">Jasta</span>
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
          @if (!colapsado()) {
            <div class="usuario">
              <strong>{{ sb.usuario()?.nombre }}</strong>
              <span>{{ rolesTexto() }}</span>
            </div>
          }
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
          <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/app/pedidos' }" (click)="mas.set(false)">
            <ion-icon [name]="item.icon"></ion-icon>
            <span class="tab-label">{{ item.label }}</span>
          </a>
        }
        <button class="tab" [class.active]="mas()" (click)="mas.set(!mas())" [attr.aria-expanded]="mas()">
          <ion-icon name="ellipsis-horizontal"></ion-icon>
          <span class="tab-label">Más</span>
        </button>
      </nav>

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
export class ShellComponent {
  sb = inject(SupabaseService);
  theme = inject(ThemeService);
  private router = inject(Router);

  colapsado = signal(this.leerColapsado());
  mas = signal(false);

  menu = computed(() => {
    const roles = this.sb.roles();
    return MENU.filter((m) => m.roles.some((r) => roles.includes(r)));
  });
  /** En el celular caben 3 secciones en la barra; el resto va en "Más" */
  tabs = computed(() => this.menu().slice(0, 3));
  masItems = computed(() => this.menu().slice(3));
  puedeVender = computed(() => this.sb.roles().some((r) => r === 'admin' || r === 'vendedora'));
  rolesTexto = computed(() =>
    this.sb.roles().map((r) => ROLES.find((x) => x.id === r)?.label ?? r).join(' · ') || 'Sin rol asignado'
  );

  constructor() {
    addIcons({
      add, barChartOutline, chevronBackOutline, chevronForwardOutline, cubeOutline, ellipsisHorizontal,
      logOutOutline, moonOutline, peopleOutline, receiptOutline, bicycleOutline, clipboardOutline, sunnyOutline, walletOutline, statsChartOutline, settingsOutline,
      storefrontOutline, listOutline, trophyOutline, peopleCircleOutline, timeOutline, personCircleOutline,
    });
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
    await this.sb.logout();
    this.router.navigateByUrl('/auth/login');
  }
}
