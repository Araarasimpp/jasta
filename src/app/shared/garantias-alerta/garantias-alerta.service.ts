import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';

/**
 * Garantías sin resolver (admin y alistamiento). Desde la 1 p. m. se muestra una franja arriba
 * de la app mientras haya alguna, como con las transferencias sin revisar. A esa misma hora
 * la base manda el aviso al celular (privado.recordar_garantias).
 */
@Injectable({ providedIn: 'root' })
export class GarantiasAlertaService {
  private sb = inject(SupabaseService);
  readonly n = signal(0);
  /** Hora de Colombia (0-23), se actualiza cada minuto */
  private readonly hora = signal(horaColombia());
  /** La franja sale desde la 1 p. m. */
  readonly mostrar = computed(() => this.n() > 0 && this.hora() >= 13);
  private timer?: ReturnType<typeof setInterval>;
  private ultimaConsulta = 0;

  constructor() {
    effect(() => {
      const puede = this.puede();
      clearInterval(this.timer);
      if (!puede) {
        this.n.set(0);
        return;
      }
      void this.refrescar();
      this.timer = setInterval(() => {
        this.hora.set(horaColombia());
        // La lista se vuelve a pedir cada 5 minutos
        if (Date.now() - this.ultimaConsulta > 5 * 60_000) void this.refrescar();
      }, 60_000);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.puede()) {
        this.hora.set(horaColombia());
        void this.refrescar();
      }
    });
  }

  private puede(): boolean {
    return this.sb.roles().some((r) => r === 'admin' || r === 'alistador');
  }

  async refrescar(): Promise<void> {
    if (!this.puede()) return;
    this.ultimaConsulta = Date.now();
    const { data } = await this.sb.client.rpc('garantias_pendientes');
    this.n.set(Number((data as { n?: number } | null)?.n) || 0);
  }
}

function horaColombia(): number {
  return Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hour12: false, timeZone: 'America/Bogota' }).format(new Date())) % 24;
}
