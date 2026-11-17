import { Directive, ElementRef, Input, OnChanges, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Animaciones de la app y la tienda. Todas son cortas, sin librerías y se apagan si el
 * celular tiene activado "reducir movimiento".
 */
export function movimientoReducido(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const COLORES = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#ef4444', '#facc15'];

/** Confeti liviano en un canvas encima de todo (se quita solo) */
export function confeti(opciones: { x?: number; y?: number; cantidad?: number; duracion?: number } = {}): void {
  if (movimientoReducido() || typeof document === 'undefined') return;
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.width = w * dpr;
  c.height = h * dpr;
  Object.assign(c.style, { position: 'fixed', inset: '0', width: w + 'px', height: h + 'px', pointerEvents: 'none', zIndex: '3000' });
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const x0 = opciones.x ?? w / 2;
  const y0 = opciones.y ?? h * 0.35;
  const n = opciones.cantidad ?? 110;
  const piezas = Array.from({ length: n }, () => {
    const ang = Math.random() * Math.PI * 2;
    const vel = 4 + Math.random() * 8;
    return {
      x: x0, y: y0, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel - 6,
      r: 4 + Math.random() * 5, giro: Math.random() * Math.PI, vg: (Math.random() - 0.5) * 0.3,
      color: COLORES[Math.floor(Math.random() * COLORES.length)], forma: Math.random() < 0.5,
    };
  });
  const fin = performance.now() + (opciones.duracion ?? 2200);
  const paso = (t: number) => {
    ctx.clearRect(0, 0, w, h);
    const vida = Math.max(0, Math.min(1, (fin - t) / 600));
    for (const p of piezas) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += p.vg;
      ctx.save();
      ctx.globalAlpha = vida;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.giro);
      ctx.fillStyle = p.color;
      if (p.forma) ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2.4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (t < fin) requestAnimationFrame(paso);
    else c.remove();
  };
  requestAnimationFrame(paso);
}

/** Confeti una sola vez por clave (ej. "meta-mes-2026-11-7"): no se repite al volver a la página */
export function confetiUnaVez(clave: string, opciones?: Parameters<typeof confeti>[0]): void {
  try {
    const k = 'confeti:' + clave;
    if (localStorage.getItem(k)) return;
    localStorage.setItem(k, '1');
  } catch { /* sin almacenamiento: igual se celebra */ }
  confeti(opciones);
}

/** Una copia de la foto vuela desde donde está hasta el destino (ej. el carrito) */
export function volarA(origen: Element | null | undefined, destino: Element | null | undefined): void {
  if (!origen || !destino || movimientoReducido()) return;
  const a = origen.getBoundingClientRect();
  const b = destino.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const copia = origen.cloneNode(true) as HTMLElement;
  const lado = Math.min(a.width, a.height, 220);
  Object.assign(copia.style, {
    position: 'fixed', left: a.left + (a.width - lado) / 2 + 'px', top: a.top + (a.height - lado) / 2 + 'px', width: lado + 'px', height: lado + 'px',
    margin: '0', zIndex: '3000', pointerEvents: 'none', borderRadius: '14px', objectFit: 'cover', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,.25)',
  });
  document.body.appendChild(copia);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  const anim = copia.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1, borderRadius: '14px' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(.55)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(.08)`, opacity: 0.4, borderRadius: '50%' },
    ],
    { duration: 650, easing: 'cubic-bezier(.45,.05,.55,.95)' }
  );
  anim.onfinish = () => {
    copia.remove();
    saltar(destino);
  };
}

/** Saltico (para el carrito, un contador que cambia, etc.) */
export function saltar(el: Element | null | undefined, fuerza = 1.25): void {
  if (!el || movimientoReducido()) return;
  (el as HTMLElement).animate(
    [{ transform: 'scale(1)' }, { transform: `scale(${fuerza})` }, { transform: 'scale(.95)' }, { transform: 'scale(1)' }],
    { duration: 420, easing: 'ease-out' }
  );
}

/** Corazón que late con chispitas */
export function latirCorazon(el: Element | null | undefined): void {
  if (!el || movimientoReducido()) return;
  const h = el as HTMLElement;
  h.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 480, easing: 'ease-out' });
  const r = h.getBoundingClientRect();
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span');
    const ang = (i / 8) * Math.PI * 2;
    Object.assign(s.style, {
      position: 'fixed', left: r.left + r.width / 2 - 3 + 'px', top: r.top + r.height / 2 - 3 + 'px', width: '6px', height: '6px',
      borderRadius: '50%', background: i % 2 ? '#ec4899' : '#f59e0b', pointerEvents: 'none', zIndex: '3000',
    });
    document.body.appendChild(s);
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * 26}px, ${Math.sin(ang) * 26}px) scale(.2)`, opacity: 0 }],
      { duration: 520, easing: 'ease-out' }).onfinish = () => s.remove();
  }
}

/**
 * Número que sube rodando hasta su valor: <strong [cuenta]="total" cuentaFormato="pesos"></strong>
 * Cuando el valor cambia, rueda desde el anterior.
 */
@Directive({ selector: '[cuenta]', standalone: true })
export class CuentaDirective implements OnChanges, OnDestroy {
  @Input() cuenta: number | string | null | undefined = 0;
  @Input() cuentaFormato: 'pesos' | 'numero' | 'porcentaje' = 'numero';
  @Input() cuentaMs = 900;
  private el = inject(ElementRef<HTMLElement>);
  private actual = 0;
  private raf = 0;
  private primera = true;

  ngOnChanges(): void {
    const meta = Number(this.cuenta) || 0;
    cancelAnimationFrame(this.raf);
    const desde = this.primera ? 0 : this.actual;
    this.primera = false;
    if (movimientoReducido() || desde === meta) return this.pintar(meta);
    const t0 = performance.now();
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / this.cuentaMs);
      const e = 1 - Math.pow(1 - k, 3);
      this.pintar(desde + (meta - desde) * e);
      if (k < 1) this.raf = requestAnimationFrame(paso);
      else this.pintar(meta);
    };
    this.raf = requestAnimationFrame(paso);
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
  }

  private pintar(v: number): void {
    this.actual = v;
    const n = Math.round(v);
    const txt = n.toLocaleString('es-CO');
    this.el.nativeElement.textContent = this.cuentaFormato === 'pesos' ? (n < 0 ? '−$ ' + Math.abs(n).toLocaleString('es-CO') : '$ ' + txt)
      : this.cuentaFormato === 'porcentaje' ? txt + ' %' : txt;
  }
}

/** Aparece suave cuando entra en pantalla (una vez). [aparecerI] escalona varios seguidos. */
@Directive({ selector: '[aparecer]', standalone: true })
export class AparecerDirective implements OnInit, OnDestroy {
  @Input() aparecerI = 0;
  private el = inject(ElementRef<HTMLElement>);
  private io?: IntersectionObserver;

  ngOnInit(): void {
    if (movimientoReducido() || typeof IntersectionObserver === 'undefined') return;
    const el = this.el.nativeElement;
    el.style.opacity = '0';
    this.io = new IntersectionObserver((entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      this.io?.disconnect();
      const a = el.animate([{ opacity: 0, transform: 'translateY(14px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 380, delay: (this.aparecerI % 6) * 55, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      el.style.opacity = '';
      void a;
    }, { rootMargin: '0px 0px -30px 0px' });
    this.io.observe(el);
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }
}
