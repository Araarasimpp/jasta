import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { chevronDownOutline, chevronUpOutline, printOutline, refreshOutline } from 'ionicons/icons';
import { JybService, PedidoRotuloJybFila, RotulosJyb } from '../../core/services/jyb.service';
import { RotulosService } from '../rotulo/rotulos.service';
import { ToastService } from '../toast/toast.service';
import { Pedido } from '../modelos';
import { mensajeError, pesos } from '../formato';
import { formatoHoraCO } from '../fecha-colombia';

const CLAVE_ABIERTO = 'jasta-jyb-rotulos-abierto';

/**
 * Pedidos de Variedades JYB por despachar, en Pedidos de Jasta: para imprimir sus rótulos
 * (con el diseño y el QR de Variedades JYB) desde el mismo computador, solos o junto con
 * los de Jasta en una sola impresión. Lo ve quien es admin o alistador en Jasta, o admin o
 * despachador en Variedades JYB con el mismo correo.
 */
@Component({
  selector: 'app-jyb-rotulos',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      :host { display: block; }
      .caja { margin: 0 0 14px; border: 1px solid var(--border); border-left: 4px solid var(--oro); border-radius: var(--radius-lg, 14px);
        background: var(--surface); }
      .cab { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; }
      .marca { padding: 2px 9px; border-radius: 999px; background: var(--oro-wash); color: var(--oro-texto); font-size: 11.5px; font-weight: 750;
        letter-spacing: 0.04em; text-transform: uppercase; }
      .txt { font-size: 14px; color: var(--text-soft); }
      .txt strong { color: var(--text); font-family: var(--mono-font); }
      .esp { flex: 1; }
      .b { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 12px; border: 1px solid var(--border-strong);
        border-radius: var(--radius-sm, 8px); background: var(--surface); color: var(--text); font: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer; }
      .b.pri { border-color: var(--oro); background: var(--oro); color: #1a1405; }
      .b.todo { border-color: var(--accent); background: var(--accent); color: var(--on-accent, #fff); }
      .b:disabled { opacity: 0.5; cursor: default; }
      .b ion-icon { font-size: 17px; }
      .icono { width: 38px; padding: 0; justify-content: center; }
      .lista { margin: 0; padding: 0 14px 10px; list-style: none; }
      .fila { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 8px 0;
        border-top: 1px solid var(--border-soft, var(--border)); font-size: 13.5px; }
      .num { font-family: var(--mono-font); font-weight: 700; }
      .cli { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .cli small { display: block; color: var(--text-muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
      .est { font-size: 11.5px; font-weight: 650; padding: 2px 8px; border-radius: 999px; background: var(--surface-2); color: var(--text-soft); white-space: nowrap; }
      .est.ok { background: var(--accent-wash); color: var(--accent); }
      .tot { font-family: var(--mono-font); white-space: nowrap; }
      .aviso { margin: 0; padding: 0 14px 12px; font-size: 13px; color: var(--text-soft); }
      @media (max-width: 640px) { .fila { grid-template-columns: auto minmax(0, 1fr) auto; } .tot { display: none; } }
    `,
  ],
  template: `
    @if (datos()?.vinculado) {
      <section class="caja" aria-label="Pedidos de Variedades JYB">
        <div class="cab">
          <span class="marca">Variedades JYB</span>
          <span class="txt"><strong>{{ pedidos().length }}</strong> por despachar · <strong>{{ alistadosSinRotulo().length }}</strong> alistados sin rótulo</span>
          <span class="esp"></span>
          <button type="button" class="b icono" (click)="cargar()" [disabled]="cargando()" aria-label="Actualizar pedidos de Variedades JYB">
            <ion-icon name="refresh-outline" aria-hidden="true"></ion-icon>
          </button>
          @if (alistadosSinRotulo().length) {
            <button type="button" class="b pri" (click)="imprimirJyb()" [disabled]="imprimiendo()"
              title="Rótulos de los alistados de Variedades JYB que no lo tienen, en el orden en que se alistaron">
              <ion-icon name="print-outline" aria-hidden="true"></ion-icon>Imprimir JYB ({{ alistadosSinRotulo().length }})
            </button>
          }
          @if (alistadosSinRotulo().length) {
            <button type="button" class="b todo" (click)="imprimirTodo()" [disabled]="imprimiendo()"
              title="Rótulos de los alistados de Jasta y de Variedades JYB en una sola impresión, en el orden en que se alistaron">
              <ion-icon name="print-outline" aria-hidden="true"></ion-icon>Imprimir todo (Jasta + JYB)
            </button>
          }
          @if (pedidos().length) {
            <button type="button" class="b icono" (click)="alternar()" [attr.aria-expanded]="abierto()"
              [attr.aria-label]="abierto() ? 'Ocultar pedidos de Variedades JYB' : 'Ver pedidos de Variedades JYB'">
              <ion-icon [name]="abierto() ? 'chevron-up-outline' : 'chevron-down-outline'" aria-hidden="true"></ion-icon>
            </button>
          }
        </div>
        @if (abierto() && pedidos().length) {
          <ul class="lista">
            @for (p of pedidos(); track p.id) {
              <li class="fila">
                <span class="num">#{{ p.numero }}</span>
                <span class="cli">{{ p.cliente_nombre }}<small>{{ p.barrio || 'Sin barrio' }}@if (p.vendedor) { · {{ p.vendedor }} } · {{ resumen(p) }}</small></span>
                <span class="est" [class.ok]="!!p.rotulo_impreso_at">{{ p.rotulo_impreso_at ? 'Rótulo ' + hora(p.rotulo_impreso_at) : p.alistado_at ? 'Alistado' : 'Por alistar' }}</span>
                <span class="tot">{{ pesos(p.total) }}</span>
                <button type="button" class="b icono" (click)="imprimirUno(p)" [disabled]="imprimiendo()"
                  [attr.aria-label]="(p.rotulo_impreso_at ? 'Reimprimir' : 'Imprimir') + ' rótulo de Variedades JYB #' + p.numero">
                  <ion-icon name="print-outline" aria-hidden="true"></ion-icon>
                </button>
              </li>
            }
          </ul>
        } @else if (!pedidos().length) {
          <p class="aviso">No hay pedidos de Variedades JYB por despachar.</p>
        }
      </section>
    }
  `,
})
export class JybRotulosComponent implements OnInit, OnDestroy {
  /** Alistados de Jasta sin rótulo (los trae la página, para "Imprimir todo") */
  @Input() jastaAlistados?: () => Promise<Pedido[]>;
  /** Se imprimieron rótulos de Jasta (la página recarga) */
  @Output() impreso = new EventEmitter<void>();

  private jyb = inject(JybService);
  private rotulos = inject(RotulosService);
  private toast = inject(ToastService);
  pesos = pesos;

  datos = signal<RotulosJyb | null>(null);
  cargando = signal(false);
  imprimiendo = signal(false);
  abierto = signal(this.leerAbierto());
  pedidos = computed(() => this.datos()?.pedidos ?? []);
  alistadosSinRotulo = computed(() => this.pedidos().filter((p) => p.alistado_at && !p.rotulo_impreso_at));
  private reloj?: ReturnType<typeof setInterval>;

  constructor() {
    addIcons({ chevronDownOutline, chevronUpOutline, printOutline, refreshOutline });
  }

  ngOnInit(): void {
    void this.cargar();
    // Llegan pedidos nuevos de Variedades JYB: se revisa cada minuto mientras la página está a la vista
    this.reloj = setInterval(() => {
      if (document.visibilityState === 'visible') void this.cargar();
    }, 60_000);
    document.addEventListener('visibilitychange', this.alVolver);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
    document.removeEventListener('visibilitychange', this.alVolver);
  }

  private alVolver = (): void => {
    if (document.visibilityState === 'visible') void this.cargar();
  };

  async cargar(): Promise<void> {
    if (this.cargando()) return;
    this.cargando.set(true);
    try {
      this.datos.set(await this.jyb.rotulos());
    } catch {
      /* sin conexión con Variedades JYB: se deja lo que se veía */
    } finally {
      this.cargando.set(false);
    }
  }

  async imprimirJyb(): Promise<void> {
    await this.imprimir([], this.alistadosSinRotulo());
  }

  async imprimirTodo(): Promise<void> {
    let jasta: Pedido[] = [];
    try {
      jasta = (await this.jastaAlistados?.()) ?? [];
    } catch (e) {
      this.toast.error(mensajeError(e));
      return;
    }
    await this.imprimir(jasta, this.alistadosSinRotulo());
  }

  async imprimirUno(p: PedidoRotuloJybFila): Promise<void> {
    await this.imprimir([], [p]);
  }

  private async imprimir(jasta: Pedido[], jyb: PedidoRotuloJybFila[]): Promise<void> {
    if (this.imprimiendo()) return;
    this.imprimiendo.set(true);
    try {
      const ok = await this.rotulos.imprimirConJyb(jasta, jyb, this.datos()?.negocio ?? null);
      if (ok && jasta.length) this.impreso.emit();
      if (ok) await this.cargar();
    } finally {
      this.imprimiendo.set(false);
    }
  }

  alternar(): void {
    this.abierto.set(!this.abierto());
    try {
      localStorage.setItem(CLAVE_ABIERTO, this.abierto() ? '1' : '0');
    } catch {
      /* sin almacenamiento */
    }
  }

  private leerAbierto(): boolean {
    try {
      return localStorage.getItem(CLAVE_ABIERTO) !== '0';
    } catch {
      return true;
    }
  }

  resumen(p: PedidoRotuloJybFila): string {
    return p.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ') || 'Sin productos';
  }

  hora(iso: string): string {
    return formatoHoraCO(iso);
  }
}
