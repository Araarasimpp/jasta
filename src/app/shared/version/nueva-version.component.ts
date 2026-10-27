import { Component, OnDestroy, OnInit, signal } from '@angular/core';

/**
 * Aviso de "hay una actualización": cada tanto (y al volver a la app) se revisa si se
 * publicó una versión nueva comparando el archivo principal de index.html con el que
 * está cargado. Si cambió, aparece arriba un aviso con el botón para actualizar.
 */
@Component({
  selector: 'app-nueva-version',
  standalone: true,
  styles: [
    `
      .aviso { position: fixed; top: calc(10px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 200;
        display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 24px); padding: 8px 8px 8px 16px; border-radius: 999px;
        background: var(--text); color: var(--bg); box-shadow: var(--shadow-pop); font-size: 14px; font-weight: 600; animation: baja 260ms var(--ease) both; }
      @keyframes baja { from { opacity: 0; transform: translate(-50%, -12px); } }
      .aviso span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .aviso button { flex-shrink: 0; height: 32px; padding: 0 14px; border: 0; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; }
      .act { background: var(--oro); color: #1a1408; }
      .luego { background: transparent; color: inherit; opacity: .7; }
    `,
  ],
  template: `
    @if (hay()) {
      <div class="aviso" role="status">
        <span>✨ Nueva versión de Jasta</span>
        <button class="act" (click)="actualizar()">Actualizar</button>
        <button class="luego" (click)="luego()" aria-label="Recordar más tarde">Luego</button>
      </div>
    }
  `,
})
export class NuevaVersionComponent implements OnInit, OnDestroy {
  hay = signal(false);
  private actual = NuevaVersionComponent.principalCargado();
  private reloj?: ReturnType<typeof setInterval>;
  private callarHasta = 0;

  ngOnInit(): void {
    // Solo en la app publicada (en desarrollo el archivo no lleva huella)
    if (!this.actual) return;
    this.reloj = setInterval(() => void this.revisar(), 5 * 60 * 1000);
    document.addEventListener('visibilitychange', this.alVolver);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
    document.removeEventListener('visibilitychange', this.alVolver);
  }

  private alVolver = (): void => {
    if (document.visibilityState === 'visible') void this.revisar();
  };

  private static principalCargado(): string | null {
    const s = document.querySelector<HTMLScriptElement>('script[src*="main-"]');
    return s?.getAttribute('src')?.match(/main-[\w-]+\.js/)?.[0] ?? null;
  }

  private async revisar(): Promise<void> {
    if (this.hay() || Date.now() < this.callarHasta) return;
    try {
      const r = await fetch('/index.html?v=' + Date.now(), { cache: 'no-store' });
      const html = await r.text();
      const nuevo = html.match(/main-[\w-]+\.js/)?.[0];
      if (nuevo && nuevo !== this.actual) this.hay.set(true);
    } catch {
      /* sin internet: se revisa la próxima vez */
    }
  }

  actualizar(): void {
    location.reload();
  }

  luego(): void {
    this.hay.set(false);
    this.callarHasta = Date.now() + 30 * 60 * 1000;
  }
}
