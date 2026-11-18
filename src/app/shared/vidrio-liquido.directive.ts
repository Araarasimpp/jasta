import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject } from '@angular/core';

/**
 * Barra de pestañas de vidrio líquido (como iOS 26): una burbuja de vidrio marca la
 * pestaña activa. Al tocar la barra la burbuja crece, se vuelve transparente con un
 * borde tornasol y sigue el dedo; las pestañas que quedan debajo se agrandan como
 * vistas a través de una lupa. Al soltar, abre la pestaña donde quedó la burbuja.
 *
 * Las pestañas son los hijos con la clase `pn-item`; la activa lleva la clase `active`
 * (si hay varias, gana la que tenga `data-lente-primero`).
 */
@Directive({ selector: '[appVidrioLiquido]', standalone: true })
export class VidrioLiquidoDirective implements AfterViewInit, OnDestroy {
  private nav = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private zona = inject(NgZone);
  private lente = document.createElement('span');
  private obs?: MutationObserver;
  private ro?: ResizeObserver;
  private quitar: (() => void)[] = [];

  /** Posición y ancho actuales de la burbuja (px, relativos a la barra) */
  private x = 0;
  private ancho = 0;
  private tocando = false;
  private arrastrando = false;
  private inicioX = 0;
  private dedo = 0;
  private cuadro = 0;
  private evitarClic = false;

  ngAfterViewInit(): void {
    this.lente.className = 'pn-lente';
    this.lente.setAttribute('aria-hidden', 'true');
    // Los estilos de la barra están encapsulados: la burbuja lleva la misma marca que la barra
    for (const at of Array.from(this.nav.attributes)) if (at.name.startsWith('_ngcontent-')) this.lente.setAttribute(at.name, '');
    this.nav.prepend(this.lente);
    this.zona.runOutsideAngular(() => {
      // La pestaña activa cambia cuando cambia la página: la burbuja se desliza hasta ella
      this.obs = new MutationObserver((cambios) => {
        // Los cambios de la propia burbuja o de la barra no cuentan (si no, se llamaría sin fin)
        if (this.tocando || !cambios.some((c) => c.target !== this.lente && c.target !== this.nav)) return;
        this.irAActiva(true);
      });
      this.obs.observe(this.nav, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      this.ro = new ResizeObserver(() => !this.tocando && this.irAActiva(false));
      this.ro.observe(this.nav);
      this.escuchar('pointerdown', (e) => this.bajar(e as PointerEvent));
      this.escuchar('pointermove', (e) => this.mover(e as PointerEvent));
      this.escuchar('pointerup', (e) => this.soltar(e as PointerEvent));
      this.escuchar('pointercancel', () => this.cancelar());
      // Las pestañas son enlaces: que el navegador no intente arrastrarlos (cancelaría el gesto)
      this.escuchar('dragstart', (e) => e.preventDefault());
      this.escuchar('contextmenu', (e) => e.preventDefault());
      // Si se arrastró, el clic nativo no cuenta: ya se abrió la pestaña de la burbuja
      this.escuchar('click', (e) => {
        if (this.evitarClic) {
          e.preventDefault();
          e.stopPropagation();
          this.evitarClic = false;
        }
      }, true);
      requestAnimationFrame(() => this.irAActiva(false));
    });
  }

  ngOnDestroy(): void {
    this.obs?.disconnect();
    this.ro?.disconnect();
    this.quitar.forEach((f) => f());
    cancelAnimationFrame(this.cuadro);
  }

  private escuchar(tipo: string, fn: (e: Event) => void, captura = false): void {
    this.nav.addEventListener(tipo, fn, captura);
    this.quitar.push(() => this.nav.removeEventListener(tipo, fn, captura));
  }

  private items(): HTMLElement[] {
    return Array.from(this.nav.querySelectorAll<HTMLElement>('.pn-item'));
  }

  private activa(): HTMLElement | null {
    const activas = this.items().filter((el) => el.classList.contains('active'));
    return activas.find((el) => el.hasAttribute('data-lente-primero')) ?? activas[0] ?? null;
  }

  /** Centro y ancho de una pestaña, relativos a la barra */
  private medida(el: HTMLElement): { centro: number; ancho: number } {
    const n = this.nav.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { centro: r.left - n.left + r.width / 2, ancho: r.width };
  }

  private irAActiva(animar: boolean): void {
    const el = this.activa();
    if (!el) {
      this.lente.classList.add('oculta');
      return;
    }
    const m = this.medida(el);
    const estabaOculta = this.lente.classList.contains('oculta');
    this.lente.classList.remove('oculta');
    this.ancho = m.ancho;
    this.x = m.centro - m.ancho / 2;
    this.lente.classList.toggle('sin-transicion', !animar || estabaOculta);
    this.pintar(1);
    if (!animar || estabaOculta) requestAnimationFrame(() => this.lente.classList.remove('sin-transicion'));
  }

  private pintar(escala: number): void {
    this.lente.style.width = `${this.ancho}px`;
    this.lente.style.transform = `translateX(${this.x}px) scale(${escala}, ${escala === 1 ? 1 : escala + 0.1})`;
  }

  private bajar(e: PointerEvent): void {
    if (e.button !== 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('.pn-item');
    if (!el || !this.nav.contains(el)) return;
    this.tocando = true;
    this.arrastrando = false;
    this.evitarClic = false;
    this.inicioX = e.clientX;
    this.dedo = e.clientX;
    // La burbuja salta a la pestaña tocada y se infla
    const m = this.medida(el);
    this.ancho = Math.max(m.ancho, this.ancho || m.ancho);
    this.x = m.centro - this.ancho / 2;
    this.lente.classList.remove('oculta');
    this.nav.classList.add('pn-tocando');
    this.lente.classList.add('viva');
    this.pintar(1.18);
    this.lupa();
  }

  private mover(e: PointerEvent): void {
    if (!this.tocando) return;
    this.dedo = e.clientX;
    if (!this.arrastrando && Math.abs(e.clientX - this.inicioX) > 8) {
      this.arrastrando = true;
      this.lente.classList.add('sin-transicion');
      try {
        this.nav.setPointerCapture(e.pointerId);
      } catch {
        /* sin captura */
      }
    }
    if (!this.arrastrando) return;
    const n = this.nav.getBoundingClientRect();
    const min = 4;
    const max = n.width - this.ancho - 4;
    this.x = Math.min(max, Math.max(min, e.clientX - n.left - this.ancho / 2));
    this.pintar(1.18);
    cancelAnimationFrame(this.cuadro);
    this.cuadro = requestAnimationFrame(() => this.lupa());
  }

  private soltar(e: PointerEvent): void {
    if (!this.tocando) return;
    const arrastro = this.arrastrando;
    this.terminar();
    if (!arrastro) return;
    // Abre la pestaña que quedó debajo del centro de la burbuja
    const centro = this.nav.getBoundingClientRect().left + this.x + this.ancho / 2;
    const el = this.items().find((it) => {
      const r = it.getBoundingClientRect();
      return centro >= r.left && centro <= r.right;
    });
    try {
      this.nav.releasePointerCapture(e.pointerId);
    } catch {
      /* ya liberado */
    }
    if (el && !el.classList.contains('active')) {
      // Primero se deja a la burbuja en su sitio; el cambio de página la acomoda
      this.evitarClic = false;
      this.zona.run(() => el.click());
    }
    // El clic nativo que llega después del arrastre no cuenta
    this.evitarClic = true;
    setTimeout(() => (this.evitarClic = false), 400);
    this.irAActiva(true);
  }

  private cancelar(): void {
    if (!this.tocando) return;
    this.terminar();
    this.irAActiva(true);
  }

  private terminar(): void {
    this.tocando = false;
    this.arrastrando = false;
    this.nav.classList.remove('pn-tocando');
    this.lente.classList.remove('viva', 'sin-transicion');
    for (const it of this.items()) it.style.removeProperty('--pn-lupa');
    // Un toque simple: la burbuja vuelve a su tamaño; el clic nativo abre la pestaña
    setTimeout(() => !this.tocando && this.irAActiva(true), 0);
  }

  /** Las pestañas bajo la burbuja se ven más grandes, como a través de una lupa */
  private lupa(): void {
    if (!this.tocando) return;
    const n = this.nav.getBoundingClientRect();
    const centro = n.left + this.x + this.ancho / 2;
    for (const it of this.items()) {
      const r = it.getBoundingClientRect();
      const d = Math.abs(r.left + r.width / 2 - centro);
      const f = Math.max(0, 1 - d / (this.ancho * 0.9));
      it.style.setProperty('--pn-lupa', (1 + 0.16 * f).toFixed(3));
    }
  }
}
