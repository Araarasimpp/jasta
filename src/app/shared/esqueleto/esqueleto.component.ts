import { Component, Input, computed, signal } from '@angular/core';

export type FormaEsqueleto = 'lista' | 'tabla' | 'tarjetas' | 'panel' | 'texto';

/**
 * Silueta de lo que va a aparecer mientras llegan los datos (en vez de "Cargando…").
 * Formas: lista (filas con círculo y dos líneas), tabla (filas de columnas), tarjetas
 * (cuadrícula con foto), panel (cifra grande, indicadores y gráfica) y texto (líneas).
 */
@Component({
  selector: 'app-esqueleto',
  standalone: true,
  styles: [
    `
      :host { display: block; width: 100%; grid-column: 1 / -1; }
      .sk { display: block; height: 11px; border-radius: 5px; background: var(--surface-2);
        background-image: linear-gradient(90deg, transparent 0, color-mix(in srgb, var(--surface) 70%, transparent) 50%, transparent 100%);
        background-size: 200% 100%; background-repeat: no-repeat; animation: brillo 1.4s ease-in-out infinite; }
      @keyframes brillo { from { background-position: 150% 0; } to { background-position: -50% 0; } }
      @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
      .lista .fila { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: var(--perfora); }
      .lista .fila:last-child { border-bottom: 0; }
      .circulo { width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0; }
      .lineas { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
      .derecha { width: 64px; flex-shrink: 0; }
      .tabla .fila { display: flex; gap: 18px; align-items: center; height: 42px; border-bottom: var(--perfora); }
      .tabla .fila:last-child { border-bottom: 0; }
      .tabla .sk:first-child { flex: 2; }
      .tabla .sk { flex: 1; }
      .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
      .tarjeta { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--surface); }
      .tarjeta .foto { height: auto; aspect-ratio: 1; border-radius: 0; }
      .tarjeta .pie { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 8px; }
      .panel { display: flex; flex-direction: column; gap: 14px; }
      .heroe { height: 92px; border-radius: var(--radius-lg); }
      .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
      .kpi { height: 74px; border-radius: var(--radius); }
      .grafica { height: 180px; border-radius: var(--radius-lg); }
      .texto { display: flex; flex-direction: column; gap: 9px; padding: 6px 0; }
      .oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `,
  ],
  template: `
    <div role="status" aria-busy="true" [class]="forma">
      <span class="oculto">Cargando…</span>
      @switch (forma) {
        @case ('lista') {
          @for (i of n(); track i) {
            <div class="fila">
              <span class="sk circulo"></span>
              <span class="lineas"><span class="sk" [style.width.%]="ancho(i, 55, 80)"></span><span class="sk" [style.width.%]="ancho(i + 3, 30, 50)"></span></span>
              <span class="sk derecha"></span>
            </div>
          }
        }
        @case ('tabla') {
          @for (i of n(); track i) {
            <div class="fila">@for (c of cols(); track c) { <span class="sk" [style.max-width.%]="c === 0 ? null : ancho(i + c, 60, 95)"></span> }</div>
          }
        }
        @case ('tarjetas') {
          <div class="rejilla">
            @for (i of n(); track i) {
              <div class="tarjeta"><span class="sk foto"></span>
                <div class="pie"><span class="sk" [style.width.%]="ancho(i, 60, 90)"></span><span class="sk" style="width: 45%"></span></div></div>
            }
          </div>
        }
        @case ('panel') {
          <span class="sk heroe"></span>
          <div class="kpis">@for (i of [0, 1, 2, 3]; track i) { <span class="sk kpi"></span> }</div>
          <span class="sk grafica"></span>
        }
        @default {
          @for (i of n(); track i) { <span class="sk" [style.width.%]="i === filasS() - 1 ? 55 : ancho(i, 80, 100)"></span> }
        }
      }
    </div>
  `,
})
export class EsqueletoComponent {
  @Input() forma: FormaEsqueleto = 'lista';
  @Input() set filas(v: number) {
    this.filasS.set(v);
  }
  @Input() set columnas(v: number) {
    this.columnasS.set(v);
  }
  filasS = signal(5);
  columnasS = signal(4);
  n = computed(() => Array.from({ length: this.filasS() }, (_, i) => i));
  cols = computed(() => Array.from({ length: this.columnasS() }, (_, i) => i));

  /** Anchos que varían un poco entre filas para que no se vea como un bloque */
  ancho(i: number, min: number, max: number): number {
    return min + (((i * 37) % 10) / 10) * (max - min);
  }
}
