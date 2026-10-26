import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../core/services/supabase.service';
import { pesos } from '../shared/formato';
import { formatoFechaCO, formatoHoraCO } from '../shared/fecha-colombia';

interface Seguimiento {
  id: number;
  estado: 'por_alistar' | 'alistado' | 'despachado' | 'entregado' | 'cancelado';
  creado_at: string;
  alistado_at: string | null;
  en_ruta_at: string | null;
  entregado_at: string | null;
  cliente: string;
  barrio: string | null;
  total: number;
  domicilio: number;
  mensajero: string | null;
  novedad: string | null;
  novedad_at: string | null;
  vendedora: string | null;
  vendedora_telefono: string | null;
  negocio: string | null;
  telefonos: string | null;
  items: { nombre: string; cantidad: number; color: string | null; talla: string | null }[];
}

/**
 * Página pública del pedido (sin iniciar sesión): el cliente abre el enlace que le
 * mandó la vendedora y ve en qué va su pedido. Se actualiza sola cada minuto.
 */
@Component({
  selector: 'app-seguimiento',
  standalone: true,
  styles: [
    `
      :host { display: block; min-height: 100vh; min-height: 100dvh; background: var(--bg); color: var(--text); }
      .caja { max-width: 520px; margin: 0 auto; padding: calc(20px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 14px; }
      .marca { display: flex; align-items: center; gap: 10px; }
      .marca img { width: 40px; height: 40px; border-radius: 10px; background: #fff; object-fit: contain; }
      .marca strong { font-size: 16px; }
      .marca small { display: block; font-size: 12px; color: var(--text-muted); }
      .tarjeta { padding: 18px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
      h1 { margin: 0; font-size: 22px; line-height: 1.25; }
      .sub { margin: 4px 0 0; font-size: 14px; color: var(--text-soft); }
      .estado { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; padding: 6px 12px; border-radius: 999px; font-size: 14px; font-weight: 700;
        background: var(--accent-wash); color: var(--accent); }
      .estado.entregado { background: var(--ok-wash); color: var(--efectivo-texto); }
      .estado.cancelado { background: var(--danger-wash); color: var(--danger); }
      .pasos { list-style: none; margin: 0; padding: 0; }
      .paso { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; padding-bottom: 18px; }
      .paso:last-child { padding-bottom: 0; }
      .paso::before { content: ''; position: absolute; left: 13px; top: 28px; bottom: 0; width: 2px; background: var(--border); }
      .paso:last-child::before { display: none; }
      .paso.hecho::before { background: var(--oro); }
      .punto { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; border: 2px solid var(--border-strong); background: var(--surface);
        font-size: 14px; color: var(--text-muted); z-index: 1; }
      .paso.hecho .punto { border-color: var(--oro); background: var(--oro); color: #1a1408; }
      .paso.actual .punto { border-color: var(--oro); color: var(--oro); box-shadow: 0 0 0 5px var(--oro-wash); }
      .paso strong { display: block; font-size: 15px; }
      .paso small { display: block; margin-top: 2px; font-size: 13px; color: var(--text-soft); }
      .paso:not(.hecho):not(.actual) strong { color: var(--text-muted); font-weight: 550; }
      .novedad { padding: 12px 14px; border-radius: var(--radius); background: var(--oro-wash); color: var(--oro-texto); font-size: 14px; line-height: 1.4; }
      .novedad strong { display: block; }
      .items { list-style: none; margin: 0; padding: 0; }
      .items li { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: var(--perfora); font-size: 14px; }
      .items li:last-child { border-bottom: 0; }
      .items small { color: var(--text-muted); }
      .total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 10px; font-size: 15px; font-weight: 650; }
      .total strong { font-family: var(--mono-font); font-size: 20px; }
      .total-nota { margin: 2px 0 0; font-size: 12.5px; color: var(--text-muted); }
      h2 { margin: 0 0 8px; font-size: 13px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; color: var(--text-muted); }
      .contacto { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .contacto a { display: flex; align-items: center; justify-content: center; height: 48px; border-radius: var(--radius); font-size: 15px; font-weight: 650; text-decoration: none; }
      .wa { background: #25d366; color: #fff; }
      .tel { border: 1px solid var(--border-strong); background: var(--surface); color: var(--text); }
      .solo { grid-column: 1 / -1; }
      .vacio { padding: 40px 18px; text-align: center; color: var(--text-soft); }
      .vacio strong { display: block; margin-bottom: 6px; font-size: 18px; color: var(--text); }
      .pie { text-align: center; font-size: 12px; color: var(--text-muted); }
    `,
  ],
  template: `
    <div class="caja">
      <div class="marca">
        <img src="assets/icon/logo.png" alt="" />
        <div><strong>{{ s()?.negocio || 'Jasta' }}</strong><small>Seguimiento de tu pedido</small></div>
      </div>

      @if (s(); as p) {
        <section class="tarjeta">
          <h1>Hola {{ p.cliente }}, este es tu pedido #{{ p.id }}</h1>
          <p class="sub">{{ p.barrio ? 'Entrega en ' + p.barrio : 'Pedido del ' + fecha(p.creado_at) }}</p>
          <span class="estado" [class.entregado]="p.estado === 'entregado'" [class.cancelado]="p.estado === 'cancelado'">{{ titulo() }}</span>
        </section>

        @if (p.novedad && p.estado !== 'cancelado') {
          <div class="novedad" role="status">
            <strong>Intentamos entregarte tu pedido</strong>
            {{ p.novedad }}{{ p.novedad_at ? ' · ' + fecha(p.novedad_at) : '' }}. Escríbele a {{ p.vendedora || 'la tienda' }} para acordar la entrega.
          </div>
        }

        @if (p.estado !== 'cancelado') {
          <section class="tarjeta">
            <ol class="pasos">
              @for (paso of pasos(); track paso.titulo) {
                <li class="paso" [class.hecho]="paso.hecho" [class.actual]="paso.actual">
                  <span class="punto" aria-hidden="true">{{ paso.hecho ? '✓' : '' }}</span>
                  <div><strong>{{ paso.titulo }}</strong>@if (paso.detalle) {<small>{{ paso.detalle }}</small>}</div>
                </li>
              }
            </ol>
          </section>
        }

        <section class="tarjeta">
          <h2>Lo que pediste</h2>
          <ul class="items">
            @for (i of p.items; track $index) {
              <li><span>{{ i.cantidad }} × {{ i.nombre }}@if (i.color || i.talla) {&nbsp;<small>· {{ variante(i) }}</small>}</span></li>
            }
          </ul>
          <div class="total"><span>Total a pagar</span><strong>{{ pesos(p.total) }}</strong></div>
          @if (p.domicilio) { <p class="total-nota">Incluye domicilio de {{ pesos(p.domicilio) }}</p> }
        </section>

        <section class="contacto">
          @if (p.vendedora_telefono) {
            <a class="wa" [class.solo]="!telefonoTienda()" [href]="whatsapp(p)" target="_blank" rel="noopener">WhatsApp a {{ p.vendedora || 'la tienda' }}</a>
          }
          @if (telefonoTienda(); as t) {
            <a class="tel" [class.solo]="!p.vendedora_telefono" [href]="'tel:' + t">Llamar a la tienda</a>
          }
        </section>
        <p class="pie">Esta página se actualiza sola · {{ actualizado() }}</p>
      } @else {
        <div class="tarjeta vacio">
          @if (cargando()) {
            Buscando tu pedido…
          } @else {
            <strong>No encontramos este pedido</strong>
            Revisa que el enlace esté completo o pídele uno nuevo a quien te vendió.
          }
        </div>
      }
    </div>
  `,
})
export class SeguimientoPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private route = inject(ActivatedRoute);

  s = signal<Seguimiento | null>(null);
  cargando = signal(true);
  actualizado = signal('');
  pesos = pesos;
  private reloj?: ReturnType<typeof setInterval>;

  titulo = computed(() => {
    const p = this.s();
    if (!p) return '';
    return {
      por_alistar: 'Recibimos tu pedido',
      alistado: 'Tu pedido está listo para salir',
      despachado: 'Tu pedido va en camino',
      entregado: 'Pedido entregado',
      cancelado: 'Pedido cancelado',
    }[p.estado];
  });

  pasos = computed(() => {
    const p = this.s();
    if (!p) return [];
    const orden = ['por_alistar', 'alistado', 'despachado', 'entregado'];
    const i = orden.indexOf(p.estado);
    return [
      { titulo: 'Recibimos tu pedido', detalle: this.fecha(p.creado_at), hecho: i >= 0, actual: false },
      { titulo: 'Lo alistamos', detalle: p.alistado_at && i >= 1 ? this.fecha(p.alistado_at) : '', hecho: i >= 1, actual: i === 0 },
      {
        titulo: 'Va en camino',
        detalle: i >= 2 ? [p.en_ruta_at ? this.fecha(p.en_ruta_at) : '', p.mensajero ? 'Te lo lleva ' + p.mensajero : ''].filter(Boolean).join(' · ') : '',
        hecho: i >= 2, actual: i === 1,
      },
      { titulo: 'Entregado', detalle: p.entregado_at ? this.fecha(p.entregado_at) : '', hecho: i >= 3, actual: i === 2 },
    ];
  });

  telefonoTienda = computed(() => {
    const t = (this.s()?.telefonos ?? '').split(/[-,/]/)[0]?.replace(/\D/g, '');
    return t && t.length >= 7 ? t : '';
  });

  ngOnInit(): void {
    void this.cargar();
    // Mientras la página esté abierta, se revisa cada minuto
    this.reloj = setInterval(() => {
      if (document.visibilityState === 'visible' && this.s()?.estado !== 'entregado') void this.cargar();
    }, 60000);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
  }

  private async cargar(): Promise<void> {
    const codigo = this.route.snapshot.paramMap.get('codigo') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(codigo)) {
      this.cargando.set(false);
      return;
    }
    const { data } = await this.sb.client.rpc('seguimiento', { p_codigo: codigo });
    this.cargando.set(false);
    if (data) {
      this.s.set(data as Seguimiento);
      this.actualizado.set('revisado a las ' + formatoHoraCO(new Date().toISOString()));
    }
  }

  variante(i: { color: string | null; talla: string | null }): string {
    return [i.color, i.talla].filter(Boolean).join(' · ');
  }

  whatsapp(p: Seguimiento): string {
    const tel = (p.vendedora_telefono ?? '').replace(/\D/g, '');
    const num = tel.length === 10 ? '57' + tel : tel;
    return `https://wa.me/${num}?text=${encodeURIComponent(`Hola ${p.vendedora ?? ''}, te escribo por mi pedido #${p.id}.`)}`;
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + formatoHoraCO(iso);
  }
}
