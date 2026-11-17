import { Component, Injectable, Input, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBack, arrowForward, bagHandleOutline, barChartOutline, bicycleOutline, bookOutline, calendarOutline, cardOutline, chatbubblesOutline,
  checkmarkCircle, closeOutline, cubeOutline, homeOutline, layersOutline, listOutline, lockClosedOutline, peopleOutline, printOutline,
  receiptOutline, returnDownBackOutline, sendOutline, storefrontOutline, trophyOutline, walletOutline, alertCircleOutline, addCircleOutline, cashOutline,
} from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { Rol } from '../modelos';

interface Paso { icono: string; titulo: string; texto: string; ir?: string; boton?: string }
interface Guia { rol: Rol; nombre: string; intro: string; pasos: Paso[] }

/** Versión de las guías: si cambian mucho, se sube y a todos les vuelve a salir */
const VERSION = 1;

/** Guías paso a paso de cada rol: lo que le toca hacer en la app */
const GUIAS: Guia[] = [
  {
    rol: 'admin', nombre: 'Administrador', intro: 'Ves todo el negocio: pedidos, plata, inventario y el equipo.',
    pasos: [
      { icono: 'home-outline', titulo: 'Inicio', texto: 'El resumen del día: ganancia, ventas, pedidos y lo que falta por recibir en cuadres.', ir: '/app/inicio' },
      { icono: 'receipt-outline', titulo: 'Pedidos', texto: 'Aquí se alistan los pedidos, se imprimen los rótulos y se asigna el mensajero. Arriba están las pestañas por estado.', ir: '/app/pedidos' },
      { icono: 'wallet-outline', titulo: 'Cuadres', texto: 'Cuando el mensajero te entrega la plata del día, confírmalo aquí con "Recibí".', ir: '/app/cuadres' },
      { icono: 'lock-closed-outline', titulo: 'Mi cierre del día', texto: 'Al final del día marca la plata que recibiste tú y la app te dice cuánto separar para comisiones, ahorro y mercancía.', ir: '/app/cierre-dia' },
      { icono: 'card-outline', titulo: 'Comisiones', texto: 'Las comisiones de las vendedoras se pagan el viernes, por la semana de sábado a viernes.', ir: '/app/comisiones' },
      { icono: 'layers-outline', titulo: 'Inventario', texto: 'Mira lo que se va a acabar y mándale el pedido a cada proveedor por WhatsApp desde "Qué comprar".', ir: '/app/inventario' },
      { icono: 'bar-chart-outline', titulo: 'Reportes y ranking', texto: 'Ventas, ganancia por vendedora y producto, y el ranking con las metas de cada uno.', ir: '/app/reportes' },
      { icono: 'people-outline', titulo: 'Usuarios', texto: 'Crea las cuentas del equipo y dale a cada uno su rol.', ir: '/app/usuarios' },
    ],
  },
  {
    rol: 'vendedora', nombre: 'Vendedora', intro: 'Subes tus pedidos, sigues cómo van y ves lo que ganas.',
    pasos: [
      { icono: 'add-circle-outline', titulo: 'Subir un pedido', texto: 'Toca Nuevo, escribe el celular del cliente (si ya compró, se llenan sus datos), la dirección, el barrio y los productos.', ir: '/app/pedidos/nuevo' },
      { icono: 'home-outline', titulo: 'Mi panel', texto: 'Tus pedidos, cómo va cada uno, lo que llevas ganado y tu racha de días vendiendo.', ir: '/app/mi-panel' },
      { icono: 'chatbubbles-outline', titulo: 'Chat del pedido', texto: 'Desde cada pedido hablas con el mensajero y la tienda: mensajes, fotos y notas de voz.' },
      { icono: 'storefront-outline', titulo: 'Tu tienda en línea', texto: 'Comparte tu enlace del catálogo: los pedidos que lleguen por ahí salen en Pedidos de la tienda para que los confirmes.', ir: '/app/pedidos-web' },
      { icono: 'card-outline', titulo: 'Tus comisiones', texto: 'Se pagan el viernes, por lo que vendiste de sábado a viernes. Aquí ves cuánto llevas.', ir: '/app/comisiones' },
      { icono: 'trophy-outline', titulo: 'Ranking y metas', texto: 'Mira tu puesto y cuánto te falta para la meta de la semana y del mes.', ir: '/app/ranking' },
    ],
  },
  {
    rol: 'mensajero', nombre: 'Mensajero', intro: 'Entregas los pedidos de tu ruta y al final del día cuadras la plata.',
    pasos: [
      { icono: 'bicycle-outline', titulo: 'Mis entregas', texto: 'Tu ruta en orden. Cada pedido tiene botones para llamar, escribir por WhatsApp y abrir el mapa.', ir: '/app/mis-entregas' },
      { icono: 'checkmark-circle', titulo: 'Entregar', texto: 'Al entregar toca Entregar y escoge cómo pagó el cliente. Si fue por transferencia, sube la foto del comprobante.' },
      { icono: 'alert-circle-outline', titulo: 'No se pudo', texto: 'Si el cliente no estaba o no contestó, toca "No se pudo" y escribe qué pasó: la tienda se entera al instante.' },
      { icono: 'chatbubbles-outline', titulo: 'Chat del pedido', texto: 'Habla con la vendedora y la tienda desde el pedido, con mensajes rápidos como "Voy en camino".' },
      { icono: 'wallet-outline', titulo: 'Cuadre', texto: 'Al terminar, cierra tu cuadre y entrega la plata. Ves cuánto entregas y tus domicilios.', ir: '/app/cuadres' },
    ],
  },
  {
    rol: 'alistador', nombre: 'Alistamiento', intro: 'Alistas los pedidos, imprimes los rótulos y los despachas.',
    pasos: [
      { icono: 'receipt-outline', titulo: 'Por alistar', texto: 'En Pedidos, pestaña Pendientes, están los que hay que alistar. Mira la observación: a veces hay una hora de entrega.', ir: '/app/pedidos' },
      { icono: 'cube-outline', titulo: 'Alistar', texto: 'Cuando tengas el pedido listo toca Alistar. Pasa a la pestaña Alistados.' },
      { icono: 'print-outline', titulo: 'Rótulos', texto: 'Imprime los rótulos de los alistados. El rótulo trae el QR del pedido.' },
      { icono: 'send-outline', titulo: 'Despachar', texto: 'Manda la foto del rótulo al grupo de Telegram del mensajero: el pedido queda En ruta con él, en el orden de las fotos.' },
      { icono: 'layers-outline', titulo: 'Inventario', texto: 'Cuenta el inventario y mira qué hay que comprar a cada proveedor.', ir: '/app/inventario' },
    ],
  },
  {
    rol: 'venta_local', nombre: 'Venta en el local', intro: 'Registras las ventas del local y cuadras la caja.',
    pasos: [
      { icono: 'storefront-outline', titulo: 'Vender', texto: 'En Venta en local agrega los productos, escoge cómo pagó y regístrala. Puedes imprimir el ticket.', ir: '/app/venta-local' },
      { icono: 'list-outline', titulo: 'Ventas del local', texto: 'Las ventas del día. Al final cuenta la plata de la caja y entrégala.', ir: '/app/ventas-local' },
      { icono: 'return-down-back-outline', titulo: 'Devoluciones', texto: 'Si un cliente devuelve o cambia algo, regístralo aquí.', ir: '/app/devoluciones' },
    ],
  },
  {
    rol: 'cuadres', nombre: 'Cuadres', intro: 'Recibes la plata de los mensajeros y la caja del local.',
    pasos: [
      { icono: 'wallet-outline', titulo: 'Cuadres', texto: 'Cuando un mensajero te entrega la plata, confírmalo con "Recibí". Revisa que el efectivo coincida.', ir: '/app/cuadres' },
      { icono: 'cash-outline', titulo: 'Servicio local', texto: 'La plata del servicio del local.', ir: '/app/servicio-local' },
      { icono: 'receipt-outline', titulo: 'Pedidos', texto: 'Puedes ver los pedidos y cómo van.', ir: '/app/pedidos' },
    ],
  },
  {
    rol: 'recolector', nombre: 'Recolector', intro: 'Recoges la mercancía y registras lo que compras.',
    pasos: [
      { icono: 'bag-handle-outline', titulo: 'Recolector', texto: 'Registra lo que compras y la plata que recibes y entregas.', ir: '/app/recolector' },
      { icono: 'calendar-outline', titulo: 'Calendario', texto: 'Mira los días de pago y las fechas importantes.', ir: '/app/calendario' },
    ],
  },
];
const ORDEN: Rol[] = ['admin', 'alistador', 'cuadres', 'vendedora', 'mensajero', 'venta_local', 'recolector'];

@Injectable({ providedIn: 'root' })
export class GuiaService {
  readonly abierta = signal(false);
  abrir(): void { this.abierta.set(true); }
  cerrar(): void { this.abierta.set(false); }
}

/**
 * Guía paso a paso de lo que le toca a cada rol. Sale sola la primera vez que alguien
 * entra con ese rol, y se vuelve a abrir desde el menú ("Guía de la app").
 */
@Component({
  selector: 'app-guia',
  standalone: true,
  imports: [IonIcon],
  styles: [
    `
      .velo { position: fixed; inset: 0; z-index: 900; background: rgba(15, 23, 42, .45); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); animation: aparece .2s ease-out; }
      .caja { position: fixed; z-index: 901; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(440px, calc(100vw - 24px)); max-height: calc(100dvh - 40px);
        display: flex; flex-direction: column; border-radius: 22px; background: var(--surface); color: var(--text); box-shadow: 0 20px 60px rgba(0, 0, 0, .3); overflow: hidden;
        animation: sube .32s cubic-bezier(.2, .9, .3, 1.1); }
      :host(.pagina) .caja { position: static; transform: none; width: auto; max-height: none; box-shadow: none; border: 1px solid var(--border); animation: none; }
      .cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px 6px; }
      .cab small { font-size: 12px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
      .x { all: unset; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; color: var(--text-soft); cursor: pointer; font-size: 20px; }
      .roles { display: flex; gap: 6px; flex-wrap: wrap; padding: 0 16px 6px; }
      .roles button { height: 30px; padding: 0 12px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text-soft); font: inherit; font-size: 13px; cursor: pointer; }
      .roles button.on { border-color: var(--accent); background: var(--accent); color: var(--on-accent); }
      .cuerpo { padding: 8px 22px 6px; text-align: center; overflow-y: auto; }
      .icono { width: 76px; height: 76px; margin: 6px auto 14px; display: grid; place-items: center; border-radius: 24px; background: var(--accent-wash); color: var(--accent); font-size: 38px;
        animation: icono-entra .4s cubic-bezier(.2, 1.4, .4, 1); }
      .cuerpo h2 { margin: 0 0 8px; font-size: 20px; }
      .cuerpo p { margin: 0; font-size: 15px; line-height: 1.5; color: var(--text-soft); }
      .ir { margin-top: 14px; border: 0; background: none; color: var(--accent); font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
      .puntos { display: flex; justify-content: center; gap: 6px; padding: 14px 0 4px; }
      .puntos button { all: unset; width: 8px; height: 8px; border-radius: 4px; background: var(--border-strong); cursor: pointer; transition: width .25s ease, background .25s ease; }
      .puntos button.on { width: 22px; background: var(--accent); }
      .pie { display: flex; gap: 8px; padding: 12px 16px calc(14px + env(safe-area-inset-bottom)); }
      .pie .b { flex: 1; height: 46px; }
      @keyframes aparece { from { opacity: 0; } }
      @keyframes sube { from { opacity: 0; transform: translate(-50%, -46%) scale(.96); } }
      @keyframes icono-entra { from { opacity: 0; transform: scale(.6) rotate(-8deg); } }
      @media (prefers-reduced-motion: reduce) { .velo, .caja, .icono { animation: none; } }
    `,
  ],
  template: `
    @if (visible() && guia(); as g) {
      @if (modo === 'capa') { <button class="velo" aria-label="Cerrar la guía" (click)="cerrar()"></button> }
      <section class="caja" role="dialog" aria-modal="true" [attr.aria-label]="'Guía para ' + g.nombre">
        <div class="cab">
          <small>Guía · {{ g.nombre }}</small>
          @if (modo === 'capa') { <button class="x" type="button" aria-label="Cerrar" (click)="cerrar()"><ion-icon name="close-outline"></ion-icon></button> }
        </div>
        @if (misGuias().length > 1) {
          <div class="roles" role="group" aria-label="Rol">
            @for (o of misGuias(); track o.rol) { <button type="button" [class.on]="o.rol === g.rol" (click)="elegirRol(o.rol)">{{ o.nombre }}</button> }
          </div>
        }
        @if (paso() === -1) {
          <div class="cuerpo">
            <div class="icono"><ion-icon name="book-outline"></ion-icon></div>
            <h2>Bienvenido a Jasta</h2>
            <p>{{ g.intro }} Te mostramos en {{ g.pasos.length }} pasos lo que te toca.</p>
          </div>
        } @else if (g.pasos[paso()]; as p) {
          @for (k of [paso()]; track k) {
            <div class="cuerpo">
              <div class="icono"><ion-icon [name]="p.icono"></ion-icon></div>
              <h2>{{ p.titulo }}</h2>
              <p>{{ p.texto }}</p>
              @if (p.ir) { <button type="button" class="ir" (click)="ir(p.ir)">Ir a {{ p.titulo }}<ion-icon name="arrow-forward"></ion-icon></button> }
            </div>
          }
        }
        <div class="puntos">
          @for (p of g.pasos; track $index) { <button type="button" [class.on]="paso() === $index" [attr.aria-label]="'Paso ' + ($index + 1)" (click)="paso.set($index)"></button> }
        </div>
        <div class="pie">
          @if (paso() > -1) { <button class="b" type="button" (click)="paso.set(paso() - 1)"><ion-icon name="arrow-back"></ion-icon>Atrás</button> }
          @if (paso() < g.pasos.length - 1) {
            <button class="b b-pri" type="button" (click)="paso.set(paso() + 1)">{{ paso() === -1 ? 'Empezar' : 'Siguiente' }}</button>
          } @else {
            <button class="b b-pri" type="button" (click)="cerrar()">{{ modo === 'capa' ? '¡Listo!' : 'Volver al inicio' }}</button>
          }
        </div>
      </section>
    }
  `,
  host: { '[class.pagina]': "modo === 'pagina'" },
})
export class GuiaComponent {
  /** 'capa': encima de la app (sale sola la primera vez); 'pagina': dentro de la página de la guía */
  @Input() modo: 'capa' | 'pagina' = 'capa';
  private sb = inject(SupabaseService);
  private router = inject(Router);
  servicio = inject(GuiaService);

  rolElegido = signal<Rol | null>(null);
  paso = signal(-1);
  misGuias = computed(() => {
    const r = this.sb.roles();
    return ORDEN.filter((x) => r.includes(x)).map((x) => GUIAS.find((g) => g.rol === x)!).filter(Boolean);
  });
  guia = computed(() => this.misGuias().find((g) => g.rol === this.rolElegido()) ?? this.misGuias()[0] ?? null);
  visible = computed(() => this.modo === 'pagina' || this.servicio.abierta());

  constructor() {
    addIcons({
      arrowBack, arrowForward, bagHandleOutline, barChartOutline, bicycleOutline, bookOutline, calendarOutline, cardOutline, chatbubblesOutline,
      checkmarkCircle, closeOutline, cubeOutline, homeOutline, layersOutline, listOutline, lockClosedOutline, peopleOutline, printOutline,
      receiptOutline, returnDownBackOutline, sendOutline, storefrontOutline, trophyOutline, walletOutline, alertCircleOutline, addCircleOutline, cashOutline,
    });
    // La primera vez que alguien entra con su rol, la guía sale sola
    effect(() => {
      if (this.modo !== 'capa') return;
      const u = this.sb.usuario();
      const g = this.misGuias()[0];
      if (!u || !g) return;
      const k = `guia-vista:${u.id}:${g.rol}:${VERSION}`;
      try {
        if (localStorage.getItem(k)) return;
        localStorage.setItem(k, '1');
      } catch { return; }
      setTimeout(() => this.servicio.abrir(), 1200);
    });
    effect(() => { if (this.servicio.abierta()) this.paso.set(-1); });
  }

  elegirRol(r: Rol): void {
    this.rolElegido.set(r);
    this.paso.set(-1);
  }

  ir(ruta: string): void {
    if (this.modo === 'capa') this.servicio.cerrar();
    void this.router.navigateByUrl(ruta);
  }

  cerrar(): void {
    if (this.modo === 'capa') this.servicio.cerrar();
    else void this.router.navigateByUrl('/app');
  }
}
