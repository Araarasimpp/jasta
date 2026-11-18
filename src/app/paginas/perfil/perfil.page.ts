import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { Preferencia, PresenciaService } from '../../core/services/presencia.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { RecortarFotoComponent } from '../../shared/recortar-foto/recortar-foto.component';
import { TelegramPanelComponent } from '../../shared/telegram/telegram-panel.component';
import { ROLES } from '../../shared/modelos';
import { mensajeError } from '../../shared/formato';
import { MisDatosPagoComponent } from './mis-datos-pago.component';

/** Mi perfil y mi seguridad: nombre, teléfono, foto, contraseña y sesiones */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [FormsModule, IonIcon, AvatarComponent, RecortarFotoComponent, TelegramPanelComponent, MisDatosPagoComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 620px; }
      .pf-barra { display: grid; grid-template-columns: 44px 1fr 44px; align-items: center; margin-bottom: -6px; }
      .pf-barra h1 { margin: 0; text-align: center; font-size: 17px; font-weight: 700; }
      .pf-atras { width: 40px; height: 40px; display: grid; place-items: center; border-radius: 50%; cursor: pointer; font-size: 20px;
        border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); color: var(--text);
        background: color-mix(in srgb, var(--surface) 55%, transparent); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); }
      .pf-cab { display: flex; flex-direction: column; align-items: center; gap: 8px; }
      .pf-foto { cursor: pointer; border-radius: 50%; }
      .pf-foto input, .pf-editar input { display: none; }
      .pf-editar { cursor: pointer; color: var(--accent); font-size: 15px; font-weight: 600; }
      .pf-quitar { border: none; background: none; color: var(--text-muted); font: inherit; font-size: 13px; cursor: pointer; padding: 2px 6px; }
      .pf-grupo { border-radius: 18px; background: var(--surface); border: 1px solid var(--border); overflow: hidden; }
      .pf-fila { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 50px; padding: 0 16px; font-size: 15.5px; }
      .pf-fila + .pf-fila { box-shadow: 0 -1px 0 var(--border); }
      .pf-fila > span { flex-shrink: 0; color: var(--text); }
      .pf-fila input { flex: 1; min-width: 0; text-align: right; border: none; background: none; color: var(--text-soft); font: inherit; font-size: 15px; padding: 12px 0; outline: none; }
      .pf-fila input:focus { color: var(--text); }
      .pf-fila em { font-style: normal; color: var(--text-soft); font-size: 14.5px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pf-nota { margin: -12px 0 0; text-align: center; font-size: 13px; color: var(--text-muted); }
      .panel { display: flex; flex-direction: column; gap: 14px; }
      .foto { display: flex; align-items: center; gap: 16px; }
      .foto label { cursor: pointer; }
      .foto input { display: none; }
      .roles { display: flex; gap: 6px; flex-wrap: wrap; }
      .fila { display: flex; gap: 8px; flex-wrap: wrap; }
      .estados { display: grid; gap: 8px; }
      .estado-op { display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 8px 12px; text-align: left; cursor: pointer;
        border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); font: inherit; }
      .estado-op.on { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-wash); }
      .estado-op strong { display: block; font-size: 14.5px; font-weight: 600; }
      .estado-op small { display: block; font-size: 12.5px; color: var(--text-soft); }
      .pres { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; background: #80848e; }
      .pres.activo { background: #23a55a; }
      .pres.ausente { background: #f0b232; }
    `,
  ],
  template: `
    <div class="page">
      <!-- Como el perfil de WhatsApp: foto al centro con "Editar foto" y los datos en filas -->
      <header class="pf-barra">
        <button type="button" class="pf-atras" aria-label="Volver" (click)="volver()"><ion-icon name="chevron-back-outline"></ion-icon></button>
        <h1>Perfil</h1>
        <span></span>
      </header>
      <div class="pf-cab">
        <label class="pf-foto" aria-label="Cambiar foto">
          <app-avatar [nombre]="nombre" [foto]="foto()" [usuario]="sb.usuario()?.id" [tam]="112"></app-avatar>
          <input type="file" accept="image/*" (change)="elegirFoto($event)" [disabled]="subiendo()" />
        </label>
        <label class="pf-editar">{{ subiendo() ? 'Subiendo…' : 'Editar foto' }}
          <input type="file" accept="image/*" (change)="elegirFoto($event)" [disabled]="subiendo()" />
        </label>
        @if (foto()) { <button type="button" class="pf-quitar" (click)="quitarFoto()">Quitar foto</button> }
      </div>
      @if (porRecortar(); as archivo) {
        <app-recortar-foto [archivo]="archivo" [guardando]="subiendo()" (recortada)="subirFoto($event)" (cancelar)="porRecortar.set(null)"></app-recortar-foto>
      }
      <div class="pf-grupo">
        <label class="pf-fila"><span>Nombre</span><input [(ngModel)]="nombre" autocomplete="name" (blur)="guardarSiCambio()" (keydown.enter)="$any($event.target).blur()" /></label>
        <label class="pf-fila"><span>Número de teléfono</span><input type="tel" [(ngModel)]="telefono" autocomplete="tel" placeholder="Agregar" (blur)="guardarSiCambio()" (keydown.enter)="$any($event.target).blur()" /></label>
        <div class="pf-fila"><span>Correo</span><em>{{ sb.usuario()?.email }}</em></div>
        <div class="pf-fila"><span>Roles</span><em>{{ roles().join(' · ') || 'Sin rol asignado' }}</em></div>
      </div>
      @if (guardando()) { <p class="pf-nota">Guardando…</p> }

      <!-- Como en Discord: así te ven los demás (punto en tu foto y en los chats) -->
      <section class="panel">
        <h2>Mi estado</h2>
        <div class="estados" role="radiogroup" aria-label="Mi estado">
          @for (e of estados; track e.valor) {
            <button type="button" class="estado-op" role="radio" [class.on]="presencia.preferencia() === e.valor"
              [attr.aria-checked]="presencia.preferencia() === e.valor" (click)="presencia.elegir(e.valor)">
              <i [class]="'pres ' + e.punto"></i>
              <span><strong>{{ e.etiqueta }}</strong><small>{{ e.ayuda }}</small></span>
            </button>
          }
        </div>
      </section>

      @if (despacha()) {
        <section class="panel">
          <h2>Telegram</h2>
          <app-telegram-panel modo="perfil"></app-telegram-panel>
        </section>
      }

      <section class="panel">
        <app-mis-datos-pago></app-mis-datos-pago>
      </section>

      <section class="panel">
        <h2>Contraseña</h2>
        <div class="fila-campos">
          <div class="campo"><label for="c1">Nueva contraseña</label><input id="c1" type="password" autocomplete="new-password" [(ngModel)]="clave1" /></div>
          <div class="campo"><label for="c2">Repítela</label><input id="c2" type="password" autocomplete="new-password" [(ngModel)]="clave2" /></div>
        </div>
        <p class="ayuda">Mínimo 8 caracteres. Mezcla letras y números.</p>
        <div><button class="b" [disabled]="cambiando()" (click)="cambiarClave()">{{ cambiando() ? 'Cambiando…' : 'Cambiar contraseña' }}</button></div>
      </section>

      <section class="panel">
        <h2>Sesiones</h2>
        <p class="ayuda">Si perdiste el celular o entraste en un computador ajeno, cierra la sesión en todos los dispositivos. Tendrás que volver a entrar.</p>
        <div><button class="b b-peligro" (click)="cerrarTodas()">Cerrar sesión en todos los dispositivos</button></div>
      </section>

      <section class="panel">
        <h2>Borrar mi cuenta</h2>
        <p class="ayuda">Se borra tu acceso a la app (correo, contraseña y Face ID) y tus datos personales: celular, foto, cédula y cuenta bancaria. Los pedidos, comisiones y cuadres en los que participaste quedan con tu nombre, porque son registros del negocio. No se puede deshacer: para volver a entrar, el admin tendría que autorizarte de nuevo.</p>
        <div><button class="b b-peligro" [disabled]="borrando()" (click)="borrarCuenta()">{{ borrando() ? 'Borrando…' : 'Borrar mi cuenta' }}</button></div>
      </section>
    </div>
  `,
})
export class PerfilPage implements OnInit {
  sb = inject(SupabaseService);
  presencia = inject(PresenciaService);
  /** Como en Discord: automático (activo / ausente según uso), ausente fijo o invisible */
  estados: { valor: Preferencia; etiqueta: string; ayuda: string; punto: string }[] = [
    { valor: 'auto', etiqueta: 'Activo', ayuda: 'Pasas a ausente solo si no usas la app', punto: 'activo' },
    { valor: 'ausente', etiqueta: 'Ausente', ayuda: 'Aunque tengas la app abierta', punto: 'ausente' },
    { valor: 'invisible', etiqueta: 'Invisible', ayuda: 'Te ven desconectado', punto: 'desconectado' },
  ];
  private toast = inject(ToastService);
  private router = inject(Router);

  nombre = '';
  telefono = '';
  clave1 = '';
  clave2 = '';
  foto = signal<string | null>(null);
  guardando = signal(false);
  subiendo = signal(false);
  /** Foto elegida que se está ajustando antes de subir */
  porRecortar = signal<File | null>(null);
  cambiando = signal(false);
  /** Admin y alistamiento despachan (pueden subir fotos de rótulos a Telegram) */
  despacha = computed(() => this.sb.tiene('admin', 'alistador'));
  roles = computed(() => this.sb.roles().map((r) => ROLES.find((x) => x.id === r)?.label ?? r));

  private location = inject(Location);

  constructor() {
    addIcons({ chevronBackOutline });
  }

  volver(): void {
    if (history.length > 1) this.location.back();
    else this.router.navigateByUrl('/app/tu');
  }

  /** Como en WhatsApp: el nombre y el teléfono se guardan solos al salir del campo */
  async guardarSiCambio(): Promise<void> {
    const u = this.sb.usuario();
    if (!this.nombre.trim()) {
      this.nombre = u?.nombre ?? '';
      return this.toast.error('El nombre no puede quedar vacío.');
    }
    if (this.nombre === (u?.nombre ?? '') && this.telefono === (u?.telefono ?? '')) return;
    await this.guardar();
  }

  ngOnInit(): void {
    const u = this.sb.usuario();
    this.nombre = u?.nombre ?? '';
    this.telefono = u?.telefono ?? '';
    this.foto.set(u?.avatar_url ?? null);
  }

  private async guardarPerfil(avatar: string | null): Promise<boolean> {
    const { error } = await this.sb.client.rpc('actualizar_mi_perfil', { p_nombre: this.nombre, p_telefono: this.telefono, p_avatar_url: avatar });
    if (error) {
      this.toast.error(mensajeError(error));
      return false;
    }
    await this.sb.cargarUsuario();
    return true;
  }

  async guardar(): Promise<void> {
    this.guardando.set(true);
    if (await this.guardarPerfil(this.foto())) this.toast.ok('Perfil guardado');
    this.guardando.set(false);
  }

  elegirFoto(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(archivo.name)) {
      return this.toast.error('Elige una foto (JPG, PNG o HEIC).');
    }
    this.porRecortar.set(archivo);
  }

  async subirFoto(blob: Blob): Promise<void> {
    const uid = this.sb.session()?.user.id;
    if (!uid) return;
    this.subiendo.set(true);
    try {
      // Nombre nuevo cada vez: no reemplaza archivos y la foto nueva se ve de una vez (sin caché)
      const ruta = `${uid}/foto-${Date.now()}.jpg`;
      const { error } = await this.sb.client.storage.from('avatars').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      const url = this.sb.client.storage.from('avatars').getPublicUrl(ruta).data.publicUrl;
      if (await this.guardarPerfil(url)) {
        this.foto.set(url);
        this.porRecortar.set(null);
        this.toast.ok('Foto actualizada');
      }
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.subiendo.set(false);
    }
  }

  async quitarFoto(): Promise<void> {
    if (await this.guardarPerfil(null)) this.foto.set(null);
  }

  async cambiarClave(): Promise<void> {
    if (this.clave1.length < 8) return this.toast.error('La contraseña debe tener al menos 8 caracteres.');
    if (this.clave1 !== this.clave2) return this.toast.error('Las contraseñas no coinciden.');
    this.cambiando.set(true);
    const { error } = await this.sb.cambiarClave(this.clave1);
    this.cambiando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.clave1 = this.clave2 = '';
    this.toast.ok('Contraseña cambiada');
  }

  borrando = signal(false);

  async borrarCuenta(): Promise<void> {
    const t = prompt('Esto borra tu cuenta para siempre. Para confirmar escribe BORRAR:');
    if (t?.trim().toUpperCase() !== 'BORRAR') return;
    this.borrando.set(true);
    const { error } = await this.sb.client.rpc('eliminar_mi_cuenta');
    this.borrando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    await this.sb.client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    this.toast.ok('Tu cuenta fue borrada');
    this.router.navigateByUrl('/auth/login');
  }

  async cerrarTodas(): Promise<void> {
    if (!confirm('Se cerrará tu sesión en todos los dispositivos, incluido este. ¿Continuar?')) return;
    await this.sb.client.auth.signOut({ scope: 'global' });
    this.router.navigateByUrl('/auth/login');
  }
}
