import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { searchOutline, closeOutline, personAddOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PresenciaService } from '../../core/services/presencia.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ROLES, Rol, Usuario } from '../../shared/modelos';
import { mensajeError } from '../../shared/formato';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

type Filtro = 'activos' | 'sin_rol' | 'inactivos' | 'sin_usar' | 'todos';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [EsqueletoComponent, FormsModule, IonIcon],
  styles: [
    `
      .roles { display: flex; gap: 4px; flex-wrap: wrap; }
      /* Estado como en Discord: verde activo, amarillo ausente, gris desconectado */
      .con-punto { display: inline-flex; align-items: center; gap: 8px; }
      .pres { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; background: #80848e; }
      .pres.activo { background: #23a55a; }
      .pres.ausente { background: #f0b232; }
      .cuenta { font-size: 12px; }
      .cuenta.si { color: var(--efectivo-texto); }
      .cuenta.no { color: var(--text-muted); }
      .opciones { display: flex; flex-direction: column; gap: 8px; }
      .check { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; cursor: pointer; }
      .check input { width: 18px; height: 18px; }
      .check small { display: block; color: var(--text-muted); font-size: 12px; }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Usuarios <small class="num">{{ filtrados().length }}</small></h1>
        <button class="b b-pri" (click)="nuevo()"><ion-icon name="person-add-outline"></ion-icon> Autorizar persona</button>
      </div>
      <div class="barra">
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="Nombre o correo" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </label>
        <div class="chips">
          @for (f of filtros; track f.id) {
            <button class="chip" [class.on]="filtro() === f.id" (click)="filtro.set(f.id)">{{ f.label }}</button>
          }
        </div>
      </div>
      <div class="vista-body" style="padding-bottom: 0">
        <p class="ayuda">
          Solo pueden crear cuenta los correos que están en esta lista. Para que alguien nuevo entre, usa
          "Autorizar persona" con su correo y sus roles; luego esa persona se registra con ese mismo correo.
          "Sin cuenta" significa que todavía no se ha registrado en la app nueva.
        </p>
      </div>
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>Nombre</th><th class="solo-pc">Correo</th><th>Roles</th><th>Cuenta</th></tr></thead>
          <tbody>
            @for (u of filtrados(); track u.id) {
              <tr class="click" (click)="abrir(u)" [style.opacity]="u.activo ? 1 : 0.55">
                <td><span class="con-punto"><i [class]="'pres ' + presencia.estado(u.id)" role="img" [attr.aria-label]="presencia.texto(u.id)" [attr.title]="presencia.texto(u.id)"></i>{{ u.nombre }}</span></td>
                <td class="suave corta solo-pc">{{ u.email || '—' }}</td>
                <td>
                  <span class="roles">
                    @for (r of u.roles; track r) {
                      <span class="etiqueta">{{ rolLabel(r) }}</span>
                    } @empty {
                      <span class="suave">Sin rol</span>
                    }
                  </span>
                </td>
                <td><span class="cuenta" [class.si]="!!u.auth_id" [class.no]="!u.auth_id">{{ u.auth_id ? 'Activa' : 'Sin cuenta' }}</span></td>
              </tr>
            } @empty {
              @if (cargando()) { <tr><td colspan="4" class="suave"><app-esqueleto forma="tabla" [filas]="8" [columnas]="4"></app-esqueleto></td></tr> } @else { <tr><td colspan="4" class="suave">{{ 'No hay usuarios.' }}</td></tr> }
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (sel(); as u) {
      <button class="velo" aria-label="Cerrar" (click)="sel.set(null)"></button>
      <aside class="hoja" role="dialog" aria-labelledby="t-user">
        <div class="hoja-head">
          <h2 id="t-user">{{ u.nombre }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="sel.set(null)"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="hoja-body">
          @if (u.auth_id) {
            <dl class="datos">
              <dt>Correo</dt><dd>{{ u.email || '—' }}</dd>
              <dt>Cuenta</dt><dd>Ya entra a la app</dd>
              <dt>Último ingreso</dt><dd>{{ ultimoTexto(u) }}</dd>
            </dl>
          } @else {
            <div class="campo">
              <label for="u-email">Correo autorizado <span class="suave">(con este se registra)</span></label>
              <input id="u-email" type="email" autocapitalize="off" [(ngModel)]="emailSel" placeholder="nombre@correo.com" />
            </div>
          }
          <div class="opciones">
            <span class="seccion-titulo">Roles</span>
            @for (r of roles; track r.id) {
              <label class="check">
                <input type="checkbox" [checked]="rolesSel().includes(r.id)" (change)="alternar(r.id)" />
                <span>{{ r.label }}<small>{{ ayudaRol[r.id] }}</small></span>
              </label>
            }
            <span class="seccion-titulo" style="margin-top: 8px">Estado</span>
            <label class="check">
              <input type="checkbox" [(ngModel)]="activoSel" />
              <span>Activo<small>Si lo desactivas, no puede entrar ni aparece para asignar pedidos.</small></span>
            </label>
          </div>
        </div>
        @if (u.id !== sb.usuario()?.id) {
          <div class="vista-body" style="padding-top: 0">
            <span class="seccion-titulo">Borrar cuenta</span>
            <p class="ayuda" style="margin: 4px 0 8px">Para cuentas que ya no se usan. Se borra su acceso y sus datos personales; si tiene pedidos, comisiones o cuadres, su nombre queda en esos registros. Si solo quieres que no entre por un tiempo, mejor desmarca "Activo".</p>
            <button class="b b-peligro" [disabled]="guardando()" (click)="borrar(u)">Borrar la cuenta de {{ u.nombre.split(' ')[0] }}</button>
          </div>
        }
        <div class="hoja-pie">
          <button class="b" (click)="sel.set(null)">Cancelar</button>
          <button class="b b-pri" [disabled]="guardando()" (click)="guardar(u)">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
        </div>
      </aside>
    }

    @if (creando()) {
      <button class="velo" aria-label="Cerrar" (click)="creando.set(false)"></button>
      <aside class="hoja" role="dialog" aria-labelledby="t-nuevo">
        <div class="hoja-head">
          <h2 id="t-nuevo">Autorizar persona</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="creando.set(false)"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="hoja-body">
          <div class="campo">
            <label for="n-nombre">Nombre</label>
            <input id="n-nombre" autocomplete="off" [(ngModel)]="nombreNuevo" />
          </div>
          <div class="campo">
            <label for="n-email">Correo <span class="suave">(con este se va a registrar)</span></label>
            <input id="n-email" type="email" autocapitalize="off" autocomplete="off" [(ngModel)]="emailSel" placeholder="nombre@correo.com" />
          </div>
          <div class="opciones">
            <span class="seccion-titulo">Roles</span>
            @for (r of roles; track r.id) {
              <label class="check">
                <input type="checkbox" [checked]="rolesSel().includes(r.id)" (change)="alternar(r.id)" />
                <span>{{ r.label }}<small>{{ ayudaRol[r.id] }}</small></span>
              </label>
            }
          </div>
        </div>
        <div class="hoja-pie">
          <button class="b" (click)="creando.set(false)">Cancelar</button>
          <button class="b b-pri" [disabled]="guardando()" (click)="autorizar()">{{ guardando() ? 'Guardando…' : 'Autorizar' }}</button>
        </div>
      </aside>
    }
  `,
})
export class UsuariosPage implements OnInit {
  private ps = inject(PedidosService);
  sb = inject(SupabaseService);
  presencia = inject(PresenciaService);
  private toast = inject(ToastService);

  usuarios = signal<Usuario[]>([]);
  cargando = signal(true);
  q = signal('');
  filtro = signal<Filtro>('activos');
  sel = signal<Usuario | null>(null);
  rolesSel = signal<Rol[]>([]);
  activoSel = true;
  emailSel = '';
  nombreNuevo = '';
  creando = signal(false);
  guardando = signal(false);

  roles = ROLES;
  ayudaRol: Record<Rol, string> = {
    admin: 'Ve y puede cambiar todo',
    vendedora: 'Crea pedidos y ve los suyos',
    alistador: 'Alista y despacha pedidos',
    mensajero: 'Entrega pedidos y ve sus cuadres',
    cuadres: 'Cierra cuadres y ve reportes',
    venta_local: 'Registra las ventas del local y elige a qué vendedora se le suman',
    recolector: 'Recibe bases de dinero y registra las compras a proveedores con la foto de la factura',
  };
  filtros: { id: Filtro; label: string }[] = [
    { id: 'activos', label: 'Activos' },
    { id: 'sin_rol', label: 'Sin rol' },
    { id: 'inactivos', label: 'Inactivos' },
    { id: 'sin_usar', label: 'Sin usar (+60 días)' },
    { id: 'todos', label: 'Todos' },
  ];

  filtrados = computed(() => {
    const t = this.q().trim().toLowerCase();
    const f = this.filtro();
    return this.usuarios().filter((u) => {
      if (u.eliminado_at) return false;
      if (f === 'sin_usar' && !this.sinUsar(u)) return false;
      if (f === 'activos' && !u.activo) return false;
      if (f === 'inactivos' && u.activo) return false;
      if (f === 'sin_rol' && (u.roles.length || !u.activo)) return false;
      return !t || `${u.nombre} ${u.email ?? ''}`.toLowerCase().includes(t);
    });
  });

  constructor() {
    addIcons({ searchOutline, closeOutline, personAddOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  /** Último ingreso de cada cuenta (id → fecha) */
  private ultimo = signal<Record<string, string | null>>({});

  /** No ha entrado en 60 días, o lleva más de 60 días autorizada sin crear la cuenta */
  sinUsar(u: Usuario): boolean {
    const limite = Date.now() - 60 * 86_400_000;
    if (!u.auth_id) return new Date(u.created_at).getTime() < limite;
    const f = this.ultimo()[u.id];
    return !f || new Date(f).getTime() < limite;
  }

  ultimoTexto(u: Usuario): string {
    const f = this.ultimo()[u.id];
    if (!f) return 'Nunca';
    const dias = Math.floor((Date.now() - new Date(f).getTime()) / 86_400_000);
    return dias <= 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} días`;
  }

  async borrar(u: Usuario): Promise<void> {
    const t = prompt(`¿Borrar la cuenta de ${u.nombre}? Pierde el acceso a la app y se borran sus datos personales. No se puede deshacer.\n\nPara confirmar escribe BORRAR:`);
    if (t?.trim().toUpperCase() !== 'BORRAR') return;
    this.guardando.set(true);
    const { data, error } = await this.sb.client.rpc('eliminar_cuenta', { p_usuario: u.id });
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok(data === 'borrada' ? `Cuenta de ${u.nombre} borrada` : `Cuenta de ${u.nombre} borrada. Su nombre queda en sus pedidos y cuadres viejos.`);
    this.sel.set(null);
    await this.cargar();
  }

  async cargar(): Promise<void> {
    void this.sb.client.rpc('usuarios_ultimo_ingreso').then(({ data }) => data && this.ultimo.set(data as Record<string, string | null>));
    try {
      this.usuarios.set(await this.ps.usuarios());
      void this.presencia.cargarVistos(this.usuarios().map((u) => u.id));
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  rolLabel(r: Rol): string {
    return ROLES.find((x) => x.id === r)?.label ?? r;
  }

  abrir(u: Usuario): void {
    this.rolesSel.set([...u.roles]);
    this.activoSel = u.activo;
    this.emailSel = u.email ?? '';
    this.sel.set(u);
  }

  nuevo(): void {
    this.nombreNuevo = '';
    this.emailSel = '';
    this.rolesSel.set([]);
    this.creando.set(true);
  }

  async autorizar(): Promise<void> {
    this.guardando.set(true);
    const { error } = await this.sb.client.rpc('guardar_autorizado', {
      p_id: null,
      p_nombre: this.nombreNuevo,
      p_email: this.emailSel,
      p_roles: this.rolesSel(),
    });
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok('Listo: ya puede crear su cuenta con ese correo');
    this.creando.set(false);
    await this.cargar();
  }

  alternar(r: Rol): void {
    const s = this.rolesSel();
    this.rolesSel.set(s.includes(r) ? s.filter((x) => x !== r) : [...s, r]);
  }

  async guardar(u: Usuario): Promise<void> {
    this.guardando.set(true);
    if (!u.auth_id && this.emailSel.trim().toLowerCase() !== (u.email ?? '').toLowerCase()) {
      const r = await this.sb.client.rpc('guardar_autorizado', { p_id: u.id, p_nombre: u.nombre, p_email: this.emailSel, p_roles: null });
      if (r.error) {
        this.guardando.set(false);
        return this.toast.error(mensajeError(r.error));
      }
    }
    const { error } = await this.sb.client.rpc('actualizar_usuario', {
      p_id: u.id,
      p_roles: this.rolesSel(),
      p_activo: this.activoSel,
    });
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok('Usuario actualizado');
    this.sel.set(null);
    await this.cargar();
    if (u.id === this.sb.usuario()?.id) await this.sb.cargarUsuario();
  }
}
