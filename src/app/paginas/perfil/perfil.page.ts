import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { Preferencia, PresenciaService } from '../../core/services/presencia.service';
import { ToastService } from '../../shared/toast/toast.service';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { RecortarFotoComponent } from '../../shared/recortar-foto/recortar-foto.component';
import { TelegramPanelComponent } from '../../shared/telegram/telegram-panel.component';
import { ROLES } from '../../shared/modelos';
import { mensajeError } from '../../shared/formato';

/** Mi perfil y mi seguridad: nombre, teléfono, foto, contraseña y sesiones */
@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [FormsModule, AvatarComponent, RecortarFotoComponent, TelegramPanelComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 620px; }
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
      <div class="head"><div><h1>Mi perfil</h1></div></div>

      <section class="panel">
        <div class="foto">
          <app-avatar [nombre]="nombre" [foto]="foto()" [usuario]="sb.usuario()?.id" [tam]="72"></app-avatar>
          <div class="fila">
            <label class="b">{{ subiendo() ? 'Subiendo…' : 'Cambiar foto' }}
              <input type="file" accept="image/*" (change)="elegirFoto($event)" [disabled]="subiendo()" />
            </label>
            @if (foto()) {
              <button class="b" (click)="quitarFoto()">Quitar foto</button>
            }
          </div>
        </div>
        @if (porRecortar(); as archivo) {
          <app-recortar-foto [archivo]="archivo" [guardando]="subiendo()" (recortada)="subirFoto($event)" (cancelar)="porRecortar.set(null)"></app-recortar-foto>
        }
        <div class="campo"><label for="pn">Nombre</label><input id="pn" [(ngModel)]="nombre" autocomplete="name" /></div>
        <div class="campo"><label for="pt">Teléfono</label><input id="pt" type="tel" [(ngModel)]="telefono" autocomplete="tel" /></div>
        <div class="campo"><span class="etq">Correo</span><span class="suave">{{ sb.usuario()?.email }}</span></div>
        <div class="campo">
          <span class="etq">Roles</span>
          <span class="roles">
            @for (r of roles(); track r) { <span class="etiqueta on">{{ r }}</span> } @empty { <span class="suave">Sin rol asignado</span> }
          </span>
        </div>
        <div><button class="b b-pri" [disabled]="guardando()" (click)="guardar()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button></div>
      </section>

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

  async cerrarTodas(): Promise<void> {
    if (!confirm('Se cerrará tu sesión en todos los dispositivos, incluido este. ¿Continuar?')) return;
    await this.sb.client.auth.signOut({ scope: 'global' });
    this.router.navigateByUrl('/auth/login');
  }
}
