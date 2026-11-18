import { Component, HostListener, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../core/services/supabase.service';
import { Rol } from '../modelos';

/**
 * Un paso del recorrido. "ruta" = botón del menú que lleva a esa página; "sel" = una función
 * dentro de la página. "tocar": la persona toca el botón resaltado para seguir (el recorrido
 * avanza solo). "opcional": si no aparece (ej. no hay pedidos por alistar), se salta.
 */
interface Paso { ruta?: string; grupo?: string; sel?: string; titulo: string; texto: string; tocar?: boolean; opcional?: boolean }

/** Versión del recorrido: si cambia mucho se sube y a todos les vuelve a salir una vez */
const VERSION = 3;

const NUEVO_PEDIDO: Paso[] = [
  { ruta: '/app/pedidos/nuevo', titulo: 'Nuevo pedido', texto: 'Toca aquí y te muestro cómo se sube un pedido.', tocar: true },
  { sel: 'app-nuevo-pedido #tel', titulo: 'Celular del cliente', texto: 'Empieza por el celular. Si el cliente ya compró, su nombre y su dirección se llenan solos.' },
  { sel: 'app-nuevo-pedido #dir', titulo: 'Dirección y barrio', texto: 'Escribe la dirección y escoge el barrio de la lista: así sale solo el valor del domicilio.' },
  { sel: 'app-nuevo-pedido input[type="search"]', titulo: 'Productos', texto: 'Busca cada producto por nombre o código, agrégalo y pon la cantidad. Si tiene colores o tallas, escoge cuál.' },
  { sel: 'app-nuevo-pedido .b-grande', titulo: 'Crear pedido', texto: 'Cuando todo esté, toca este botón y el pedido le llega a alistamiento. (Ahora no lo toques.)' },
];
const PEDIDOS: Paso[] = [
  { ruta: '/app/pedidos', grupo: 'Ventas', titulo: 'Pedidos', texto: 'Ahora toca Pedidos.', tocar: true },
  { sel: 'app-pedidos nav.tabs', titulo: 'Estados', texto: 'Los pedidos van pasando por Pendientes, Alistados, En ruta y Entregados. Toca una pestaña para ver los de ese estado.' },
  { sel: 'app-pedidos input[aria-label="Buscar pedidos"]', titulo: 'Buscar', texto: 'Encuentra cualquier pedido por cliente, barrio, producto o número.' },
  { sel: 'app-pedidos .btn-alistar', titulo: 'Alistar', texto: 'Cuando el pedido esté empacado, toca Alistar: pasa a la pestaña Alistados.', opcional: true },
  { sel: 'app-pedidos .btn-imprimir-alistados', titulo: 'Rótulos', texto: 'Imprime de una vez los rótulos de todo lo alistado. Luego manda la foto del rótulo al grupo de Telegram del mensajero.', opcional: true },
];
const AVISOS: Paso = { sel: '.campana', titulo: 'Avisos', texto: 'Aquí te llegan los avisos: pedidos nuevos, mensajes del chat y todo lo que necesita tu atención. La campanita se mueve cuando llega uno.' };
const MAS = (texto: string): Paso => ({ sel: '.pill-nav .tab-tu, .rail button[aria-label="Finanzas"], .rail button[aria-label="Entregas"]', titulo: 'Tú: todo lo demás', texto });

const PASOS: Partial<Record<Rol, Paso[]>> = {
  admin: [...NUEVO_PEDIDO, ...PEDIDOS, AVISOS, MAS('En Tú están Cuadres, Mi cierre del día, Comisiones, Inventario (con el pedido al proveedor) y Reportes.')],
  vendedora: [
    ...NUEVO_PEDIDO,
    { ruta: '/app/mi-panel', grupo: 'Ventas', titulo: 'Mi panel', texto: 'Ahora toca Mi panel.', tocar: true },
    { sel: 'app-mi-panel .racha', titulo: 'Tu racha', texto: 'Los días seguidos que llevas vendiendo. La llama crece con cada día: no la dejes apagar.', opcional: true },
    { sel: 'app-mi-panel .kpis', titulo: 'Lo que ganas', texto: 'Tu ganancia de lo entregado, lo que viene en camino y tus ventas del periodo.' },
    { sel: 'app-mi-panel section[aria-labelledby="t-ped"]', titulo: 'Mis pedidos', texto: 'Toca un pedido para ver cómo va y hablar por chat con el mensajero.' },
    AVISOS,
    MAS('En Tú están tus comisiones (se pagan el viernes), el ranking, tu catálogo y los pedidos de la tienda.'),
  ],
  mensajero: [
    { ruta: '/app/mis-entregas', grupo: 'Entregas', titulo: 'Mis entregas', texto: 'Toca aquí para ver tu ruta.', tocar: true },
    { sel: 'app-mis-entregas .acciones a[href^="tel:"]', titulo: 'Llamar y escribir', texto: 'Con estos botones llamas al cliente o le escribes por WhatsApp.', opcional: true },
    { sel: 'app-mis-entregas .acciones a[href*="maps"]', titulo: 'Mapa', texto: 'Abre la dirección en el mapa para llegar.', opcional: true },
    { sel: 'app-mis-entregas .acciones .b-ok', titulo: 'Entregar', texto: 'Al entregar toca aquí y escoge cómo pagó. Si fue transferencia, sube la foto del comprobante.', opcional: true },
    { sel: 'app-mis-entregas .acciones .b-novedad', titulo: 'No se pudo', texto: 'Si el cliente no estaba, toca aquí y cuenta qué pasó: la tienda se entera al instante.', opcional: true },
    { ruta: '/app/cuadres', grupo: 'Entregas', titulo: 'Cuadres', texto: 'Al terminar el día, aquí cierras tu cuadre y entregas la plata.' },
    AVISOS,
  ],
  alistador: [...PEDIDOS, { ruta: '/app/inventario', grupo: 'Bodega', titulo: 'Inventario', texto: 'Aquí cuentas el inventario y ves qué comprar a cada proveedor.' }, AVISOS],
  venta_local: [
    { ruta: '/app/venta-local', grupo: 'Ventas', titulo: 'Venta en local', texto: 'Toca aquí para registrar una venta del local.', tocar: true },
    { sel: 'app-nuevo-pedido input[type="search"]', titulo: 'Productos', texto: 'Busca lo que se lleva el cliente y agrégalo.' },
    { sel: 'app-nuevo-pedido .b-grande', titulo: 'Registrar venta', texto: 'Escoge cómo pagó y toca aquí. Puedes imprimir el ticket. (Ahora no lo toques.)' },
    { ruta: '/app/ventas-local', grupo: 'Ventas', titulo: 'Ventas del local', texto: 'Las ventas del día. Al final cuenta la caja y entrégala.' },
    AVISOS,
  ],
  cuadres: [
    { ruta: '/app/cuadres', grupo: 'Entregas', titulo: 'Cuadres', texto: 'Toca aquí para ver los cuadres.', tocar: true },
    { sel: 'app-cuadres .b-ok', titulo: 'Recibí', texto: 'Cuando el mensajero te entregue la plata, cuéntala y toca aquí para confirmarla.', opcional: true },
    AVISOS,
  ],
  recolector: [{ ruta: '/app/recolector', grupo: 'Entregas', titulo: 'Recolector', texto: 'Aquí registras lo que compras y la plata que recibes y entregas.' }, AVISOS],
};
const ORDEN: Rol[] = ['admin', 'alistador', 'cuadres', 'vendedora', 'mensajero', 'venta_local', 'recolector'];

function visible(el: Element | null): el is Element {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return false;
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
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      .capa { pointer-events: none; }
      .bloq, .globo { pointer-events: auto; }
      .bloq { position: fixed; }
      /* El hueco que resalta el botón: todo lo demás queda oscuro */
      .foco { position: fixed; border-radius: 16px; box-shadow: 0 0 0 200vmax rgba(10, 14, 25, .66); pointer-events: none;
        transition: left .35s cubic-bezier(.2, .8, .2, 1), top .35s cubic-bezier(.2, .8, .2, 1), width .35s, height .35s; }
      .foco::after { content: ''; position: absolute; inset: -4px; border-radius: 20px; border: 2px solid rgba(255, 255, 255, .9); animation: anillo 1.6s ease-out infinite; }
      .foco.toca::after { border-color: #facc15; border-width: 3px; }
      /* "Toca aquí": un círculo que late encima del botón */
      .dedo { position: fixed; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; background: rgba(250, 204, 21, .85); pointer-events: none;
        box-shadow: 0 0 0 4px rgba(250, 204, 21, .35); animation: dedo 1.1s ease-in-out infinite; }
      @keyframes dedo { 0%, 100% { transform: scale(.75); opacity: .9; } 50% { transform: scale(1.15); opacity: .55; } }
      .toca-txt { font-size: 13.5px; font-weight: 700; color: #b45309; }
      .barra { height: 3px; margin-top: 10px; border-radius: 2px; background: #e2e8f0; overflow: hidden; }
      .barra .lleno { display: block; height: 3px; border-radius: 2px; background: #2563eb; transition: width .35s ease; }
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
      @media (prefers-reduced-motion: reduce) { .foco, .globo { transition: none; animation: none; } .foco::after, .dedo { animation: none; } }
    `,
  ],
  template: `
    @if (actual(); as p) {
      <div class="capa" role="dialog" aria-modal="true" [attr.aria-label]="'Recorrido: ' + p.titulo">
        <!-- Cuatro bloques alrededor del hueco: lo de afuera no se puede tocar -->
        <div class="bloq" [style.left.px]="0" [style.top.px]="0" [style.width.%]="100" [style.height.px]="caja().y"></div>
        <div class="bloq" [style.left.px]="0" [style.top.px]="caja().y + caja().h" [style.width.%]="100" [style.bottom.px]="0"></div>
        <div class="bloq" [style.left.px]="0" [style.top.px]="caja().y" [style.width.px]="caja().x" [style.height.px]="caja().h"></div>
        <div class="bloq" [style.left.px]="caja().x + caja().w" [style.top.px]="caja().y" [style.right.px]="0" [style.height.px]="caja().h"></div>
        @if (p.modo !== 'tocar') { <div class="bloq" [style.left.px]="caja().x" [style.top.px]="caja().y" [style.width.px]="caja().w" [style.height.px]="caja().h"></div> }
        <div class="foco" [class.toca]="p.modo === 'tocar'" [style.left.px]="caja().x" [style.top.px]="caja().y" [style.width.px]="caja().w" [style.height.px]="caja().h"></div>
        @if (p.modo === 'tocar') { <span class="dedo" [style.left.px]="caja().x + caja().w / 2" [style.top.px]="caja().y + caja().h / 2" aria-hidden="true"></span> }
        <div class="globo" [class.abajo]="globo().abajo" [class.arriba]="!globo().abajo" [style.left.px]="globo().x" [style.top.px]="globo().y" [style.--flecha.px]="globo().flecha">
          <small>{{ i() + 1 }} de {{ total() }}</small>
          <strong>{{ p.titulo }}</strong>
          <p>{{ p.texto }}</p>
          @if (p.enMenu) { <p class="menu">Está dentro de este menú.</p> }
          <div class="acc">
            <button type="button" class="saltar" (click)="terminar()">Saltar recorrido</button>
            @if (p.modo === 'tocar') {
              <span class="toca-txt">Toca el botón</span>
            } @else {
              <button type="button" class="sig" (click)="siguiente()">{{ p.modo === 'ir' ? 'Ir a ' + p.titulo : i() < total() - 1 ? 'Siguiente' : '¡Listo!' }}</button>
            }
          </div>
          <div class="barra" aria-hidden="true"><span class="lleno" [style.width.%]="((i() + 1) / total()) * 100"></span></div>
        </div>
      </div>
    }
  `,
})
export class GuiaComponent implements OnDestroy {
  private sb = inject(SupabaseService);
  private router = inject(Router);
  private lista: Paso[] = [];
  i = signal(-1);
  total = signal(0);
  /** El paso que se está mostrando, con su botón en pantalla */
  actual = signal<(Paso & { el: Element; modo: 'tocar' | 'ir' | 'siguiente'; enMenu: boolean }) | null>(null);
  private rect = signal<DOMRect | null>(null);
  private timer?: ReturnType<typeof setTimeout>;
  private soltar?: () => void;
  private turno = 0;

  caja = computed(() => {
    const r = this.rect();
    const m = 6;
    return r ? { x: r.left - m, y: r.top - m, w: r.width + m * 2, h: r.height + m * 2 } : { x: 0, y: 0, w: 0, h: 0 };
  });
  /** El globo va debajo si cabe, si no encima; si el elemento es muy alto, adentro abajo */
  globo = computed(() => {
    const c = this.caja();
    const w = Math.min(300, innerWidth - 24);
    const x = Math.max(12, Math.min(innerWidth - w - 12, c.x + c.w / 2 - w / 2));
    const alto = 200;
    let abajo = c.y + c.h + alto + 12 < innerHeight;
    let y = abajo ? c.y + c.h + 12 : c.y - 12 - alto;
    if (!abajo && y < 12) { y = Math.max(12, innerHeight - alto - 24); abajo = false; }
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
      this.timer = setTimeout(() => {
        try { localStorage.setItem(k, '1'); } catch { /* sin almacenamiento */ }
        this.lista = PASOS[rol] ?? [];
        this.total.set(this.lista.length);
        void this.ir(0);
      }, 1500);
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    this.soltar?.();
  }

  /** Busca el botón o la función del paso (espera a que la página cargue) y la resalta */
  private async ir(n: number): Promise<void> {
    const turno = ++this.turno;
    this.soltar?.();
    this.soltar = undefined;
    if (n >= this.lista.length) return this.terminar();
    const p = this.lista[n];
    this.i.set(n);
    let el: Element | null = null;
    let enMenu = false;
    const espera = p.opcional ? 300 : 5000;
    for (let t = 0; t < espera && !el; t += 150) {
      el = p.sel ? primero([p.sel]) : primero([`.pill-nav a[href="${p.ruta}"]`, `.rail a[href="${p.ruta}"]`, `.vd-top-wrap a[href="${p.ruta}"]`]);
      if (!el) await pausa(150);
      if (turno !== this.turno) return;
    }
    if (!el && p.ruta) {
      // No está a la vista: se señala el menú donde está y el botón del globo lleva a la página
      el = primero([`.rail button[aria-label="${p.grupo}"]`, '.pill-nav .tab-tu']);
      enMenu = !!el;
    }
    if (!el) return void this.ir(n + 1);
    if (!p.sel) el = el.closest('a, button') ?? el;
    el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    await pausa(320);
    if (turno !== this.turno) return;
    const modo: 'tocar' | 'ir' | 'siguiente' = p.ruta && enMenu ? 'ir' : p.tocar ? 'tocar' : 'siguiente';
    this.actual.set({ ...p, el, modo, enMenu });
    this.medir();
    if (modo === 'tocar') {
      // Al tocar el botón resaltado, la app hace lo suyo y el recorrido sigue en la página nueva
      const alTocar = () => setTimeout(() => void this.ir(n + 1), 50);
      el.addEventListener('click', alTocar, { once: true });
      this.soltar = () => el!.removeEventListener('click', alTocar);
    }
  }

  siguiente(): void {
    const p = this.actual();
    if (p?.modo === 'ir' && p.ruta) void this.router.navigateByUrl(p.ruta);
    void this.ir(this.i() + 1);
  }

  terminar(): void {
    this.turno++;
    this.soltar?.();
    this.actual.set(null);
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  medir(): void {
    const p = this.actual();
    if (p) this.rect.set(p.el.getBoundingClientRect());
  }
}
