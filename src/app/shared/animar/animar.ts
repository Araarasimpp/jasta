import { Directive, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, inject } from '@angular/core';

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

/** Sacudida de "algo falta" (formulario incompleto) */
export function sacudir(el: Element | null | undefined): void {
  if (!el || movimientoReducido()) return;
  (el as HTMLElement).animate(
    [{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-5px)' },
      { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }],
    { duration: 420, easing: 'ease-in-out' }
  );
}

/** Capa encima de todo que se quita sola */
function capa(html: string, ms: number): HTMLElement {
  const c = document.createElement('div');
  c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, { position: 'fixed', inset: '0', zIndex: '3000', display: 'grid', placeItems: 'center', pointerEvents: 'none' });
  c.innerHTML = html;
  document.body.appendChild(c);
  setTimeout(() => c.remove(), ms);
  return c;
}

/** Check verde grande que aparece y se va (como el datáfono al pagar) */
export function exito(texto = ''): void {
  if (movimientoReducido() || typeof document === 'undefined') return;
  const c = capa(`
    <div style="display:grid;place-items:center;gap:10px">
      <svg viewBox="0 0 52 52" width="104" height="104" style="filter:drop-shadow(0 8px 24px rgba(0,0,0,.25))">
        <circle cx="26" cy="26" r="25" fill="#16a34a"/>
        <path d="M15 27l7 7 15-16" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40"/>
      </svg>
      ${texto ? `<span style="padding:6px 14px;border-radius:999px;background:rgba(15,23,42,.85);color:#fff;font:600 15px system-ui,sans-serif">${texto.replace(/</g, '&lt;')}</span>` : ''}
    </div>`, 1300);
  const caja = c.firstElementChild as HTMLElement;
  caja.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1.08)', opacity: 1, offset: 0.35 }, { transform: 'scale(1)', opacity: 1, offset: 0.5 },
    { transform: 'scale(1)', opacity: 1, offset: 0.8 }, { transform: 'scale(.9)', opacity: 0 }], { duration: 1250, easing: 'ease-out' });
  c.querySelector('path')?.animate([{ strokeDashoffset: 40 }, { strokeDashoffset: 0 }], { duration: 350, delay: 260, fill: 'forwards', easing: 'ease-out' });
}

/** Monedas que caen en la alcancía (cuadre confirmado) */
export function monedasAlcancia(): void {
  if (movimientoReducido() || typeof document === 'undefined') return;
  const moneda = (x: number) => `<svg class="mo" viewBox="0 0 24 24" width="26" height="26" style="position:absolute;left:${x}px;top:-40px">
      <circle cx="12" cy="12" r="11" fill="#f59e0b" stroke="#b45309" stroke-width="1.5"/><circle cx="12" cy="12" r="7" fill="none" stroke="#fde68a" stroke-width="1.5"/></svg>`;
  const c = capa(`
    <div style="position:relative;width:150px;height:150px">
      ${moneda(50)}${moneda(70)}${moneda(90)}
      <svg viewBox="0 0 64 64" width="150" height="150" style="position:absolute;inset:0;filter:drop-shadow(0 8px 20px rgba(0,0,0,.25))">
        <ellipse cx="32" cy="38" rx="24" ry="18" fill="#ec4899"/>
        <circle cx="50" cy="34" r="7" fill="#f472b6"/><circle cx="52" cy="33" r="1.4" fill="#831843"/><circle cx="49" cy="33" r="1.4" fill="#831843"/>
        <circle cx="38" cy="30" r="2" fill="#1f2937"/>
        <path d="M14 26l-4-8 9 4z" fill="#db2777"/>
        <rect x="18" y="52" width="6" height="8" rx="2" fill="#db2777"/><rect x="38" y="52" width="6" height="8" rx="2" fill="#db2777"/>
        <rect x="26" y="20" width="12" height="3" rx="1.5" fill="#831843"/>
      </svg>
    </div>`, 1700);
  const caja = c.firstElementChild as HTMLElement;
  caja.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 1, offset: 0.85 },
    { transform: 'scale(.9)', opacity: 0 }], { duration: 1650 });
  c.querySelectorAll<SVGElement>('.mo').forEach((m, i) =>
    m.animate([{ transform: 'translateY(0)', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'translateY(78px) scale(.6)', opacity: 0 }],
      { duration: 650, delay: 250 + i * 200, easing: 'cubic-bezier(.5,0,.8,.6)', fill: 'both' }));
  setTimeout(() => saltar(caja.querySelector('svg:last-child'), 1.08), 900);
}

/** La campanita se mueve cuando llega un aviso */
export function campanita(el: Element | null | undefined): void {
  if (!el || movimientoReducido()) return;
  (el as HTMLElement).style.transformOrigin = 'top center';
  (el as HTMLElement).animate(
    [{ transform: 'rotate(0)' }, { transform: 'rotate(18deg)' }, { transform: 'rotate(-15deg)' }, { transform: 'rotate(11deg)' },
      { transform: 'rotate(-7deg)' }, { transform: 'rotate(3deg)' }, { transform: 'rotate(0)' }],
    { duration: 900, easing: 'ease-in-out' }
  );
}

/**
 * Jalar hacia abajo para recargar (en el celular): <div jalarRecargar (recargar)="cargar()">.
 * Sale un círculo con la flecha que gira mientras se jala; al soltar pasado el punto, recarga.
 */
@Directive({ selector: '[jalarRecargar]', standalone: true })
export class JalarRecargarDirective implements OnInit, OnDestroy {
  @Output() recargar = new EventEmitter<void>();
  private el = inject(ElementRef<HTMLElement>);
  private y0 = 0;
  private dy = 0;
  private activo = false;
  private ind?: HTMLElement;
  private quitar: (() => void)[] = [];

  ngOnInit(): void {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return;
    const raiz = this.el.nativeElement;
    const on = (t: string, f: (e: TouchEvent) => void) => {
      raiz.addEventListener(t, f as EventListener, { passive: true });
      this.quitar.push(() => raiz.removeEventListener(t, f as EventListener));
    };
    on('touchstart', (e) => {
      this.activo = e.touches.length === 1 && this.arriba();
      this.y0 = e.touches[0].clientY;
      this.dy = 0;
    });
    on('touchmove', (e) => {
      if (!this.activo) return;
      this.dy = Math.max(0, e.touches[0].clientY - this.y0);
      if (this.dy < 8) return;
      this.mostrar(Math.min(1, this.dy / 90));
    });
    on('touchend', () => {
      if (!this.activo) return;
      this.activo = false;
      if (this.dy >= 90) {
        this.girar();
        this.recargar.emit();
      } else this.esconder();
    });
  }

  ngOnDestroy(): void {
    this.quitar.forEach((f) => f());
    this.ind?.remove();
  }

  /** ¿La página está arriba del todo? (solo ahí se jala para recargar) */
  private arriba(): boolean {
    let n: HTMLElement | null = this.el.nativeElement;
    while (n) {
      const s = getComputedStyle(n);
      if (/(auto|scroll)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) return n.scrollTop <= 0;
      n = n.parentElement;
    }
    return (document.scrollingElement?.scrollTop ?? 0) <= 0;
  }

  private indicador(): HTMLElement {
    if (this.ind) return this.ind;
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    Object.assign(d.style, {
      position: 'fixed', top: 'calc(10px + env(safe-area-inset-top))', left: '50%', width: '40px', height: '40px', marginLeft: '-20px', zIndex: '2000',
      borderRadius: '50%', background: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,.2)', display: 'grid', placeItems: 'center', pointerEvents: 'none',
      opacity: '0', transform: 'translateY(-50px)', transition: 'opacity .2s, transform .2s',
    });
    d.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#2563eb" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/></svg>';
    document.body.appendChild(d);
    this.ind = d;
    return d;
  }

  private mostrar(k: number): void {
    const d = this.indicador();
    d.style.transition = 'none';
    d.style.opacity = String(k);
    d.style.transform = `translateY(${k * 40 - 20}px) rotate(${k * 300}deg)`;
  }

  private girar(): void {
    const d = this.indicador();
    d.style.transition = 'opacity .2s, transform .2s';
    d.style.transform = 'translateY(20px)';
    d.firstElementChild?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 700, iterations: 1, easing: 'linear' });
    setTimeout(() => this.esconder(), 800);
  }

  private esconder(): void {
    if (!this.ind) return;
    this.ind.style.transition = 'opacity .2s, transform .2s';
    this.ind.style.opacity = '0';
    this.ind.style.transform = 'translateY(-50px)';
  }
}

/** Cambia el modo claro / oscuro con un círculo que se expande desde donde se tocó */
export function cambiarTemaConCirculo(ev: MouseEvent | Event | null | undefined, cambiar: () => void): void {
  const doc = document as Document & { startViewTransition?: (f: () => void) => { ready: Promise<void>; finished: Promise<void> } };
  if (!doc.startViewTransition || movimientoReducido()) return cambiar();
  const me = ev as MouseEvent | undefined;
  const x = me?.clientX || innerWidth - 40;
  const y = me?.clientY || 40;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.documentElement.classList.add('vt-tema');
  const t = doc.startViewTransition(() => cambiar());
  void t.ready.then(() => {
    document.documentElement.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' } as KeyframeAnimationOptions);
  });
  void t.finished.finally(() => document.documentElement.classList.remove('vt-tema'));
}

/**
 * En toda la app: cuando algo se copia, el botón que se tocó se pone verde con un check.
 * Recuerda el último botón tocado y lo marca cuando la copia sale bien.
 */
export function activarCopiadoVisual(): void {
  if (typeof document === 'undefined' || !navigator.clipboard?.writeText) return;
  let ultimo: { el: HTMLElement; t: number } | null = null;
  document.addEventListener('click', (e) => {
    const b = (e.target as Element | null)?.closest?.('button, a, [role="button"]') as HTMLElement | null;
    if (b) ultimo = { el: b, t: Date.now() };
  }, true);
  const original = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = async (texto: string) => {
    await original(texto);
    if (ultimo && Date.now() - ultimo.t < 2500 && ultimo.el.isConnected) {
      const el = ultimo.el;
      el.classList.add('copiado-ok');
      setTimeout(() => el.classList.remove('copiado-ok'), 1300);
    }
  };
}
