import { Component, OnInit, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { formatoFechaCO } from '../../shared/fecha-colombia';

interface Llave { id: string; friendly_name?: string | null; created_at: string; last_used_at?: string | null }

/** Mi perfil → Entrar con Face ID o huella: llaves de acceso de los celulares de la persona */
@Component({
  selector: 'app-face-id',
  standalone: true,
  styles: [
    `
      :host { display: flex; flex-direction: column; gap: 12px; }
      ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
      li { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); background: var(--surface-2); font-size: 14px; }
      li small { display: block; font-size: 12px; color: var(--text-muted); }
      .quitar { border: 0; background: none; color: var(--danger); font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }
    `,
  ],
  template: `
    <h2>Entrar con Face ID o huella</h2>
    @if (!soporta) {
      <p class="ayuda" style="margin: 0">Este navegador no permite entrar con Face ID o huella. En el iPhone usa Safari; en Android, Chrome.</p>
    } @else {
      <p class="ayuda" style="margin: 0">Actívalo en cada celular que uses. La próxima vez, en la pantalla de inicio toca "Entrar con Face ID o huella" y listo, sin escribir la contraseña.</p>
      @if (llaves().length) {
        <ul>
          @for (l of llaves(); track l.id) {
            <li><span>{{ l.friendly_name || 'Llave de acceso' }}<small>Activada el {{ fecha(l.created_at) }}{{ l.last_used_at ? ' · usada el ' + fecha(l.last_used_at) : '' }}</small></span>
              <button type="button" class="quitar" (click)="quitar(l)">Quitar</button></li>
          }
        </ul>
      }
      <div><button class="b b-pri" [disabled]="ocupado()" (click)="activar()">{{ ocupado() ? 'Esperando Face ID…' : 'Activar en este celular' }}</button></div>
    }
  `,
})
export class FaceIdComponent implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  readonly soporta = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  llaves = signal<Llave[]>([]);
  ocupado = signal(false);

  ngOnInit(): void {
    if (this.soporta) void this.cargar();
  }

  private async cargar(): Promise<void> {
    const { data } = await this.sb.client.auth.passkey.list();
    this.llaves.set((data ?? []) as Llave[]);
  }

  async activar(): Promise<void> {
    this.ocupado.set(true);
    const { error } = await this.sb.client.auth.registerPasskey();
    this.ocupado.set(false);
    if (error) {
      const code = (error as { code?: string }).code ?? '';
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('notallowed') || msg.includes('cancel') || msg.includes('abort')) return;
      if (code === 'passkey_disabled') return this.toast.error('El inicio con Face ID todavía no está activado en el sistema.');
      if (code === 'webauthn_credential_exists') return this.toast.error('Este celular ya tiene Face ID activado.');
      return this.toast.error('No se pudo activar: ' + error.message);
    }
    this.toast.ok('¡Listo! La próxima vez entra con Face ID o huella');
    await this.cargar();
  }

  async quitar(l: Llave): Promise<void> {
    if (!confirm(`¿Quitar "${l.friendly_name || 'Llave de acceso'}"? Ese celular tendrá que entrar con contraseña.`)) return;
    const { error } = await this.sb.client.auth.passkey.delete({ passkeyId: l.id });
    if (error) return this.toast.error('No se pudo quitar: ' + error.message);
    this.toast.ok('Quitada');
    await this.cargar();
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
