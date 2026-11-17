import { Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';
import { Rol } from '../modelos';

/** Un paso del recorrido: la página (botón del menú) que se resalta y para qué sirve */
interface Paso { ruta?: string; grupo?: string; selector?: string; titulo: string; texto: string }
interface PasoListo extends Paso { el: Element; enMenu: boolean }

/** Versión del recorrido: si cambia mucho se sube y a todos les vuelve a salir una vez */
const VERSION = 2;

const AVISOS: Paso = { selector: '.campana', titulo: 'Avisos', texto: 'Aquí te llegan los avisos: pedidos nuevos, mensajes del chat y todo lo que necesita tu atención.' };

const PASOS: Partial<Record<Rol, Paso[]>> = {
  admin: [
    { ruta: '/app/pedidos/nuevo', titulo: 'Nuevo pedido', texto: 'Sube un pedido: el celular del cliente, la dirección y los productos.' },
    { ruta: '/app/pedidos', grupo: 'Ventas', titulo: 'Pedidos', texto: 'Aquí se alistan los pedidos, se imprimen los rótulos y se asigna el mensajero.' },
    { ruta: '/app/cuadres', grupo: 'Entregas', titulo: 'Cuadres', texto: 'Cuando un mensajero te entrega la plata del día, confírmalo aquí.' },
    { ruta: '/app/cierre-dia', grupo: 'Finanzas', titulo: 'Mi cierre del día', texto: 'Al final del día marca la plata que recibiste y te dice cuánto separar de comisiones, ahorro y mercancía.' },
    { ruta: '/app/inventario', grupo: 'Bodega', titulo: 'Inventario', texto: 'Mira lo que se va a acabar y mándale el pedido a cada proveedor por WhatsApp.' },
    AVISOS,
  ],
  vendedora: [
    { ruta: '/app/pedidos/nuevo', titulo: 'Nuevo pedido', texto: 'Sube tus pedidos aquí. Si el cliente ya compró, sus datos se llenan solos.' },
    { ruta: '/app/mi-panel', grupo: 'Ventas', titulo: 'Mi panel', texto: 'Tus pedidos, cómo va cada uno, lo que llevas ganado y tu racha de días vendiendo.' },
    { ruta: '/app/pedidos-web', grupo: 'Ventas', titulo: 'Pedidos de la tienda', texto: 'Los pedidos que llegan por tu enlace del catálogo: confírmalos aquí.' },
    { ruta: '/app/comisiones', grupo: 'Finanzas', titulo: 'Comisiones', texto: 'Lo que vas ganando. Se paga el viernes, por lo vendido de sábado a viernes.' },
    AVISOS,
  ],
  mensajero: [
    { ruta: '/app/mis-entregas', grupo: 'Entregas', titulo: 'Mis entregas', texto: 'Tu ruta en orden, con botones para llamar, escribir y abrir el mapa. Al entregar, toca Entregar.' },
    { ruta: '/app/cuadres', grupo: 'Entregas', titulo: 'Cuadres', texto: 'Al terminar el día cierra tu cuadre y entrega la plata.' },
    { ruta: '/app/mi-resumen', grupo: 'Entregas', titulo: 'Mi resumen', texto: 'Tus entregas y lo que llevas ganado en domicilios.' },
    AVISOS,
  ],
  alistador: [
    { ruta: '/app/pedidos', grupo: 'Ventas', titulo: 'Pedidos', texto: 'Los pendientes por alistar. Alista, imprime el rótulo y manda la foto al grupo de Telegram del mensajero.' },
    { ruta: '/app/inventario', grupo: 'Bodega', titulo: 'Inventario', texto: 'Cuenta el inventario y mira qué hay que comprar a cada proveedor.' },
    AVISOS,
  ],
  venta_local: [
    { ruta: '/app/venta-local', grupo: 'Ventas', titulo: 'Venta en local', texto: 'Registra cada venta del local y, si quieres, imprime el ticket.' },
    { ruta: '/app/ventas-local', grupo: 'Ventas', titulo: 'Ventas del local', texto: 'Las ventas del día. Al final cuenta la caja y entrégala.' },
    AVISOS,
  ],
  cuadres: [
    { ruta: '/app/cuadres', grupo: 'Entregas', titulo: 'Cuadres', texto: 'Confirma aquí la plata que te entregan los mensajeros.' },
    { ruta: '/app/pedidos', grupo: 'Ventas', titulo: 'Pedidos', texto: 'Mira los pedidos y cómo va cada uno.' },
    AVISOS,
  ],
  recolector: [
    { ruta: '/app/recolector', grupo: 'Entregas', titulo: 'Recolector', texto: 'Registra lo que compras y la plata que recibes y entregas.' },
    AVISOS,
  ],
};
const ORDEN: Rol[] = ['admin', 'alistador', 'cuadres', 'vendedora', 'mensajero', 'venta_local', 'recolector'];

function visible(el: Element | null): el is Element {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
}
function primero(selectores: string[]): Element | null {
  for (const s of selectores) {
    const el = [...document.querySelectorAll(s)].find(visible);
    if (el) return el;
  }
  return null;
}

/**
 * Recorrido de bienvenida, como en las apps: resalta los botones de verdad, uno por uno,
 * con un globo que dice para qué sirve cada uno. Sale una sola vez por persona y rol.
 */
@Component({
  selector: 'app-guia',
  standalone: true,
  styles: [
    `
      .capa { position: fixed; inset: 0; z-index: 2500; }
      .bloqueo { position: absolute; inset: 0; }
      /* El hueco que resalta el botón: todo lo demás queda oscuro */
      .foco { position: fixed; border-radius: 16px; box-shadow: 0 0 0 200vmax rgba(10, 14, 25, .66); pointer-events: none;
        transition: left .35s cubic-bezier(.2, .8, .2, 1), top .35s cubic-bezier(.2, .8, .2, 1), width .35s, height .35s; }
      .foco::after { content: ''; position: absolute; inset: -4px; border-radius: 20px; border: 2px solid rgba(255, 255, 255, .9); animation: anillo 1.6s ease-out infinite; }
      @keyframes anillo { 0% { opacity: .9; transform: scale(1); } 100% { opacity: 0; transform: scale(1.18); } }
      .globo { position: fixed; width: min(300px, calc(100vw - 24px)); padding: 14px 16px 12px; border-radius: 16px; background: #fff; color: #0f172a;
        box-shadow: 0 16px 40px rgba(0, 0, 0, .3); transition: left .35s cubic-bezier(.2, .8, .2, 1), top .35s cubic-bezier(.2, .8, .2, 1); animation: globo .3s ease-out; }
      @keyframes globo { from { opacity: 0; transform: translateY(6px); } }
      .globo::before { content: ''; position: absolute; left: var(--flecha, 50%); width: 14px; height: 14px; margin-left: -7px; background: #fff; transform: rotate(45deg); }
      .globo.abajo::before { top: -6px; }
      .globo.arriba::before { bottom: -6px; }
      .globo small { display: block; font-size: 11.5px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; color: #64748b; }
      .globo strong { display: block; margin: 2px 0 4px; font-size: 16.5px; }
      .globo p { margin: 0; font-size: 14px; line-height: 1.45; color: #334155; }
      .globo .menu { margin-top: 6px; font-size: 12.5px; color: #2563eb; font-weight: 600; }
      .acc { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
      .saltar { border: 0; background: none; padding: 6px 2px; color: #64748b; font: inherit; font-size: 13.5px; cursor: pointer; }
      .sig { height: 38px; padding: 0 18px; border: 0; border-radius: 999px; background: #2563eb; color: #fff; font: inherit; font-size: 14.5px; font-weight: 650; cursor: pointer; }
      @media (prefers-reduced-motion: reduce) { .foco, .globo { transition: none; animation: none; } .foco::after { animation: none; } }
    `,
  ],
  template: `
    @if (actual(); as p) {
      <div class="capa" role="dialog" aria-modal="true" [attr.aria-label]="'Recorrido: ' + p.titulo">
        <div class="bloqueo" (click)="siguiente()"></div>
        <div class="foco" [style.left.px]="caja().x" [style.top.px]="caja().y" [style.width.px]="caja().w" [style.height.px]="caja().h"></div>
        <div class="globo" [class.abajo]="globo().abajo" [class.arriba]="!globo().abajo" [style.left.px]="globo().x" [style.top.px]="globo().y" [style.--flecha.px]="globo().flecha">
          <small>{{ i() + 1 }} de {{ pasos().length }}</small>
          <strong>{{ p.titulo }}</strong>
          <p>{{ p.texto }}</p>
          @if (p.enMenu) { <p class="menu">Está dentro de este menú.</p> }
          <div class="acc">
            <button type="button" class="saltar" (click)="terminar()">{{ i() < pasos().length - 1 ? 'Saltar' : '' }}</button>
            <button type="button" class="sig" (click)="siguiente()">{{ i() < pasos().length - 1 ? 'Siguiente' : '¡Listo!' }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class GuiaComponent implements OnDestroy {
  private sb = inject(SupabaseService);
  pasos = signal<PasoListo[]>([]);
  i = signal(0);
  private rect = signal<DOMRect | null>(null);
  private timer?: ReturnType<typeof setTimeout>;

  actual = computed(() => this.pasos()[this.i()] ?? null);
  caja = computed(() => {
    const r = this.rect();
    const m = 6;
    return r ? { x: r.left - m, y: r.top - m, w: r.width + m * 2, h: r.height + m * 2 } : { x: 0, y: 0, w: 0, h: 0 };
  });
  /** El globo va debajo del botón si cabe; si no, encima. La flecha apunta al botón */
  globo = computed(() => {
    const c = this.caja();
    const w = Math.min(300, innerWidth - 24);
    const x = Math.max(12, Math.min(innerWidth - w - 12, c.x + c.w / 2 - w / 2));
    const abajo = c.y + c.h + 190 < innerHeight;
    const y = abajo ? c.y + c.h + 12 : Math.max(12, c.y - 12 - 170);
    return { x, y, abajo, flecha: Math.max(18, Math.min(w - 18, c.x + c.w / 2 - x)) };
  });

  constructor() {
    effect(() => {
      const u = this.sb.usuario();
      const rol = ORDEN.find((r) => this.sb.roles().includes(r));
      if (!u || !rol) return;
      const k = `guia-vista:${u.id}:${rol}:${VERSION}`;
      try {
        if (localStorage.getItem(k)) return;
      } catch { return; }
      clearTimeout(this.timer);
      // Espera a que la app termine de pintarse
      this.timer = setTimeout(() => this.empezar(rol, k), 1500);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  private empezar(rol: Rol, clave: string): void {
    try { localStorage.setItem(clave, '1'); } catch { /* sin almacenamiento */ }
    const listos: PasoListo[] = [];
    for (const p of PASOS[rol] ?? []) {
      const directo = p.selector ? primero([p.selector]) : p.ruta ? primero([`.pill-nav a[href="${p.ruta}"]`, `.rail a[href="${p.ruta}"]`, `.vd-top-wrap a[href="${p.ruta}"]`]) : null;
      if (directo) { listos.push({ ...p, el: directo.closest('button, a') ?? directo, enMenu: false }); continue; }
      // Si no está a la vista, se señala el menú donde está (el grupo en computador, "Más" en el celular)
      const menu = primero([`.rail button[aria-label="${p.grupo}"]`, '.pill-nav .tab-mas']);
      if (menu) listos.push({ ...p, el: menu, enMenu: true });
    }
    if (!listos.length) return;
    this.pasos.set(listos);
    this.i.set(0);
    this.medir();
  }

  siguiente(): void {
    if (this.i() >= this.pasos().length - 1) return this.terminar();
    this.i.set(this.i() + 1);
    this.medir();
  }

  terminar(): void {
    this.pasos.set([]);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  medir(): void {
    const p = this.actual();
    if (p) this.rect.set(p.el.getBoundingClientRect());
  }
}
