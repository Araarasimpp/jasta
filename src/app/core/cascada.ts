/**
 * Entrada en cascada al cambiar de página (como en los dashboards de vidrio):
 * los bloques de la página nueva aparecen uno tras otro, de borrosos y un poco abajo a nítidos.
 * Solo anima lo que se ve en pantalla, y lo que llega después (cuando cargan los datos) también
 * entra en cascada durante el primer segundo y medio.
 */
const yaAnimados = new WeakSet<Element>();
let observador: MutationObserver | null = null;
let fin: ReturnType<typeof setTimeout> | undefined;

const MAX = 16;
const PASO = 55;
const INICIO = 90;

function reducir(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** La página que muestra el router dentro del contenido */
function pagina(): HTMLElement | null {
  const outlet = document.querySelector('main.content > router-outlet');
  return (outlet?.nextElementSibling as HTMLElement | null) ?? null;
}

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
}

/** Hijos que cuentan como bloque (sin elementos invisibles ni hojas flotantes) */
function hijos(el: Element): Element[] {
  return [...el.children].filter((c) => {
    if (c.tagName === 'TEMPLATE' || c.tagName === 'SCRIPT' || c.tagName === 'STYLE') return false;
    const pos = getComputedStyle(c).position;
    return pos !== 'fixed' && visible(c);
  });
}

/** Bloques de la página: baja por envoltorios de un solo hijo y abre las rejillas de tarjetas */
function bloques(raiz: HTMLElement): Element[] {
  let caja: Element = raiz;
  for (let i = 0; i < 4; i++) {
    const h = hijos(caja);
    if (h.length !== 1) break;
    caja = h[0];
  }
  const salida: Element[] = [];
  // Rejillas y filas de tarjetas: cada tarjeta entra por su lado (hasta dos niveles: tablero → fila de KPIs)
  const abrir = (b: Element, nivel: number): void => {
    const cs = getComputedStyle(b);
    const d = cs.display;
    const h = hijos(b);
    const rejilla = d === 'grid' || d === 'inline-grid' || (d === 'flex' && cs.flexDirection.startsWith('row') && cs.flexWrap !== 'nowrap') || (d === 'flex' && nivel > 0 && cs.flexDirection.startsWith('row'));
    if (nivel < 2 && rejilla && h.length >= 2 && h.length <= 12 && b.getBoundingClientRect().height > 60) h.forEach((x) => abrir(x, nivel + 1));
    else salida.push(b);
  };
  for (const b of hijos(caja)) abrir(b, 0);
  return salida;
}

function animar(lista: Element[]): void {
  const nuevos = lista.filter((el) => !yaAnimados.has(el)).slice(0, MAX);
  nuevos.forEach((el, i) => {
    yaAnimados.add(el);
    (el as HTMLElement).animate(
      [
        { opacity: 0, filter: 'blur(12px)', transform: 'translateY(18px) scale(0.97)' },
        { opacity: 1, filter: 'blur(0)', transform: 'none' },
      ],
      { duration: 560, delay: INICIO + i * PASO, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'backwards' },
    );
  });
}

/** Lanza la cascada para la página que acaba de abrir */
export function entradaEnCascada(): void {
  if (reducir() || typeof document === 'undefined') return;
  const raiz = pagina();
  if (!raiz) return;
  animar(bloques(raiz));
  // Lo que aparece cuando llegan los datos también entra en cascada
  observador?.disconnect();
  clearTimeout(fin);
  let pendiente = false;
  observador = new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      const r = pagina();
      if (r) animar(bloques(r));
    });
  });
  observador.observe(raiz, { childList: true, subtree: true });
  fin = setTimeout(() => observador?.disconnect(), 1500);
}
