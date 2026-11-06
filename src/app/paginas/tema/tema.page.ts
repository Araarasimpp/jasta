import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FONDOS, FondoService } from '../../core/services/fondo.service';
import { ThemeService } from '../../core/services/theme.service';
import { ToastService } from '../../shared/toast/toast.service';

/**
 * Tema: la foto de fondo de la app (como el fondo de pantalla de Windows), el modo claro u oscuro
 * y qué tan oscuro, desenfocado o sólido se ve todo. Se guarda en este dispositivo.
 */
@Component({
  selector: 'app-tema',
  standalone: true,
  imports: [FormsModule],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 980px; }
      .tp-vista { position: relative; height: 230px; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--border); box-shadow: 0 16px 40px rgba(0,0,0,.2); }
      .tp-vista .tp-foto { position: absolute; inset: -20px; background-size: cover; background-position: center; }
      .tp-vista .tp-osc { position: absolute; inset: 0; }
      .tp-vista .tp-mini { position: absolute; left: 18px; right: 18px; bottom: 18px; display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }
      .tp-vista .tp-mini span { height: 70px; border-radius: 16px; border: 1px solid rgba(255,255,255,.2); background: rgba(var(--vd-rgb), var(--vd-alpha));
        -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); }
      .tp-vista .tp-tit { position: absolute; left: 20px; top: 16px; color: #fff; font-size: 20px; font-weight: 700; text-shadow: 0 2px 10px rgba(0,0,0,.4); }
      .rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
      .fondo { position: relative; padding: 0; border: 2px solid transparent; border-radius: 16px; overflow: hidden; background: var(--surface-2); cursor: pointer; aspect-ratio: 16 / 10; }
      .fondo img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .fondo span { position: absolute; left: 8px; bottom: 6px; color: #fff; font-size: 12.5px; font-weight: 650; text-shadow: 0 1px 6px rgba(0,0,0,.6); }
      .fondo.on { border-color: var(--text); box-shadow: 0 0 0 3px rgba(255,255,255,.35); }
      .fondo.on::after { content: '✓'; position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; display: grid; place-items: center; border-radius: 50%; background: #fff; color: #111; font-weight: 800; font-size: 13px; }
      .subir { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border: 2px dashed var(--border-strong); color: var(--text-soft); font: inherit; font-size: 13px; font-weight: 600; }
      .subir b { font-size: 26px; line-height: 1; }
      .ajuste { display: grid; grid-template-columns: 170px 1fr 52px; gap: 12px; align-items: center; font-size: 14px; }
      .ajuste input { width: 100%; accent-color: var(--accent); }
      .ajuste output { text-align: right; font-family: var(--mono-font); color: var(--text-muted); font-size: 13px; }
      .modos { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 420px; }
      .modo { height: 54px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface-2); color: var(--text); font: inherit; font-size: 14.5px; font-weight: 650; cursor: pointer; }
      .modo.on { background: #fff; color: #111; border-color: #fff; }
      .acc { display: flex; gap: 10px; flex-wrap: wrap; }
      .seccion { display: flex; flex-direction: column; gap: 12px; }
      .seccion h2 { margin: 0; font-size: 16px; }
      @media (max-width: 560px) {
        .tp-vista { height: 190px; }
        .rejilla { grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .ajuste { grid-template-columns: 1fr 52px; }
        .ajuste label { grid-column: 1 / -1; }
      }
    `,
  ],
  template: `
    <div class="page">
      <div class="head"><div><p class="fecha">Apariencia de la app en este dispositivo</p><h1>Tema</h1></div></div>

      <div class="tp-vista" aria-hidden="true">
        <div class="tp-foto" [style.background-image]="'url(' + fondo.url() + ')'" [style.filter]="'blur(' + fondo.ajustes().desenfoque + 'px)'"></div>
        <div class="tp-osc" [style.background]="theme.isDark() ? 'rgba(0,0,0,' + fondo.ajustes().oscurecer + ')' : 'rgba(255,255,255,' + fondo.ajustes().oscurecer * 0.6 + ')'"></div>
        <span class="tp-tit">Así se ve</span>
        <div class="tp-mini"><span></span><span></span><span></span></div>
      </div>

      <section class="panel seccion">
        <h2>Fondo</h2>
        <div class="rejilla">
          @for (f of fondos; track f.id) {
            <button type="button" class="fondo" [class.on]="fondo.ajustes().fondo === f.id" (click)="fondo.cambiar({ fondo: f.id })" [attr.aria-pressed]="fondo.ajustes().fondo === f.id">
              <img [src]="'assets/fondos/' + f.id + '-mini.webp'" alt="" loading="lazy" /><span>{{ f.nombre }}</span>
            </button>
          }
          @if (fondo.propio(); as p) {
            <button type="button" class="fondo" [class.on]="fondo.ajustes().fondo === 'propio'" (click)="fondo.cambiar({ fondo: 'propio' })" [attr.aria-pressed]="fondo.ajustes().fondo === 'propio'">
              <img [src]="p" alt="" /><span>Mi imagen</span>
            </button>
          }
          <button type="button" class="fondo subir" (click)="archivo.click()" [disabled]="subiendo()">
            <b>+</b>{{ subiendo() ? 'Subiendo…' : fondo.propio() ? 'Cambiar mi imagen' : 'Subir mi imagen' }}
          </button>
          <input #archivo type="file" accept="image/*" hidden (change)="subir($event)" />
        </div>
        @if (fondo.propio()) { <div class="acc"><button class="b b-peligro" (click)="fondo.quitarPropio()">Quitar mi imagen</button></div> }
        <p class="ayuda" style="margin: 0">Fotos de Unsplash. Tu imagen se guarda solo en este celular o computador.</p>
      </section>

      <section class="panel seccion">
        <h2>Modo</h2>
        <div class="modos">
          <button type="button" class="modo" [class.on]="theme.isDark()" (click)="!theme.isDark() && theme.toggle()">🌙 Vidrio oscuro</button>
          <button type="button" class="modo" [class.on]="!theme.isDark()" (click)="theme.isDark() && theme.toggle()">☀️ Vidrio claro</button>
        </div>
      </section>

      <section class="panel seccion">
        <h2>Ajustes</h2>
        <div class="ajuste">
          <label for="t-osc">Oscurecer el fondo</label>
          <input id="t-osc" type="range" min="0" max="0.8" step="0.05" [ngModel]="fondo.ajustes().oscurecer" (ngModelChange)="fondo.cambiar({ oscurecer: +$event })" />
          <output>{{ pct(fondo.ajustes().oscurecer / 0.8) }}</output>
        </div>
        <div class="ajuste">
          <label for="t-des">Desenfocar el fondo</label>
          <input id="t-des" type="range" min="0" max="24" step="1" [ngModel]="fondo.ajustes().desenfoque" (ngModelChange)="fondo.cambiar({ desenfoque: +$event })" />
          <output>{{ pct(fondo.ajustes().desenfoque / 24) }}</output>
        </div>
        <div class="ajuste">
          <label for="t-vid">Vidrio más sólido</label>
          <input id="t-vid" type="range" min="0.15" max="0.8" step="0.05" [ngModel]="fondo.ajustes().vidrio" (ngModelChange)="fondo.cambiar({ vidrio: +$event })" />
          <output>{{ pct((fondo.ajustes().vidrio - 0.15) / 0.65) }}</output>
        </div>
        <div class="acc"><button class="b" (click)="fondo.restablecer()">Volver a como venía</button></div>
      </section>
    </div>
  `,
})
export class TemaPage {
  fondo = inject(FondoService);
  theme = inject(ThemeService);
  private toast = inject(ToastService);
  fondos = FONDOS;
  subiendo = signal(false);

  async subir(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    this.subiendo.set(true);
    try {
      await this.fondo.subir(f);
      this.toast.ok('Listo: tu imagen es el fondo');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'No se pudo usar esa imagen');
    } finally {
      this.subiendo.set(false);
    }
  }

  pct(x: number): string {
    return Math.round(Math.max(0, Math.min(1, x)) * 100) + '%';
  }
}
