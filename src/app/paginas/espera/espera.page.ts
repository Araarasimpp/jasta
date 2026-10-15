import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';

@Component({
  selector: 'app-espera',
  standalone: true,
  styleUrls: ['../../shared/ui.scss'],
  template: `
    <div class="page">
      <div class="vacio">
        <span class="vacio-titulo">Tu cuenta está lista, {{ sb.usuario()?.nombre }}</span>
        <p>Todavía no tienes un rol asignado. Pídele al administrador que te dé acceso como vendedora, alistamiento, mensajero o cuadres.</p>
        <button class="btn" (click)="revisar()" [disabled]="cargando()">{{ cargando() ? 'Revisando…' : 'Ya me asignaron, revisar' }}</button>
      </div>
    </div>
  `,
})
export class EsperaPage {
  sb = inject(SupabaseService);
  private router = inject(Router);
  cargando = signal(false);

  async revisar(): Promise<void> {
    this.cargando.set(true);
    await this.sb.cargarUsuario();
    this.cargando.set(false);
    const destino = this.sb.inicioSegunRoles();
    if (destino !== '/app/espera') this.router.navigateByUrl(destino);
  }
}
