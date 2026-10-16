import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { searchOutline, closeOutline, logoWhatsapp } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { Pedido, estadoLabel } from '../../shared/modelos';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { formatoFechaCO } from '../../shared/fecha-colombia';
import { enlaceWhatsapp, mensajeSeguimiento } from '../../shared/whatsapp';

interface Cliente {
  telefono: string; nombre: string; barrio: string | null; direccion: string | null;
  pedidos: number; entregados: number; total: number; ultimo: string; total_filas: number;
}

/** Clientes armados a partir de los pedidos (agrupados por teléfono) */
@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [FormsModule, IonIcon, PedidoDetalleComponent],
  styles: [
    `
      .tabla td { white-space: nowrap; }
      .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .lista li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); font-size: 13px; cursor: pointer; }
      .lista li:hover { color: var(--accent); }
      .lista small { display: block; color: var(--text-muted); font-size: 12px; }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Clientes <small class="num">{{ numero(total()) }}</small></h1>
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="Nombre, teléfono o barrio" [(ngModel)]="q" (ngModelChange)="buscarLuego()" />
        </label>
      </div>
      <div class="tabla-wrap">
        <table class="tabla">
          <thead><tr><th>Cliente</th><th>Teléfono</th><th>Barrio</th><th class="der">Pedidos</th><th class="der">Comprado</th><th>Último pedido</th></tr></thead>
          <tbody>
            @for (c of clientes(); track c.telefono) {
              <tr class="click" (click)="abrir(c)">
                <td>{{ c.nombre }}</td>
                <td class="num">{{ c.telefono }}</td>
                <td class="suave corta">{{ c.barrio || '—' }}</td>
                <td class="der num">{{ c.entregados }}<span class="suave"> / {{ c.pedidos }}</span></td>
                <td class="der num">{{ pesos(c.total) }}</td>
                <td class="suave">{{ fecha(c.ultimo) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="suave">{{ cargando() ? 'Cargando…' : 'No hay clientes con esa búsqueda.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (total() > 50) {
        <div class="paginar">
          <span class="num">{{ pagina() * 50 + 1 }}–{{ min((pagina() + 1) * 50, total()) }} de {{ numero(total()) }}</span>
          <span style="display: flex; gap: 8px">
            <button class="b" [disabled]="pagina() === 0" (click)="ir(pagina() - 1)">Anterior</button>
            <button class="b" [disabled]="(pagina() + 1) * 50 >= total()" (click)="ir(pagina() + 1)">Siguiente</button>
          </span>
        </div>
      }
      <div class="vista-body"><p class="ayuda">"Pedidos" muestra entregados / total. "Comprado" suma solo los entregados.</p></div>
    </div>

    @if (sel(); as c) {
      <button class="velo" aria-label="Cerrar" (click)="sel.set(null)"></button>
      <aside class="hoja" role="dialog" aria-labelledby="t-cli">
        <div class="hoja-head">
          <h2 id="t-cli">{{ c.nombre }}</h2>
          <button class="b b-icono" aria-label="Cerrar" (click)="sel.set(null)"><ion-icon name="close-outline"></ion-icon></button>
        </div>
        <div class="hoja-body">
          <dl class="datos">
            <dt>Teléfono</dt><dd><a [href]="'tel:' + c.telefono">{{ c.telefono }}</a></dd>
            <dt>Dirección</dt><dd>{{ c.direccion || '—' }}</dd>
            <dt>Barrio</dt><dd>{{ c.barrio || '—' }}</dd>
            <dt>Compras</dt><dd>{{ c.entregados }} entregadas · {{ pesos(c.total) }}</dd>
          </dl>
          <a class="b" [href]="whatsapp(c)" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>Escribir por WhatsApp</a>
          <section>
            <h3 class="seccion-titulo">Pedidos</h3>
            <ul class="lista">
              @for (p of pedidosCli(); track p.id) {
                <li (click)="abierto.set(p.id)">
                  <span>#{{ p.id }} · {{ fecha(p.created_at) }}<small>{{ estadoLabel(p.estado) }} · {{ p.vendedora?.nombre || '—' }}</small></span>
                  <span class="num">{{ pesos(p.total) }}</span>
                </li>
              } @empty {
                <li class="suave">Cargando…</li>
              }
            </ul>
          </section>
        </div>
      </aside>
    }
    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)"></app-pedido-detalle>
    }
  `,
})
export class ClientesPage implements OnInit {
  private sb = inject(SupabaseService);
  private ps = inject(PedidosService);
  private toast = inject(ToastService);

  clientes = signal<Cliente[]>([]);
  total = signal(0);
  pagina = signal(0);
  cargando = signal(true);
  sel = signal<Cliente | null>(null);
  pedidosCli = signal<Pedido[]>([]);
  abierto = signal<number | null>(null);
  q = '';
  private timer?: ReturnType<typeof setTimeout>;

  pesos = pesos;
  numero = numero;
  estadoLabel = estadoLabel;
  min = Math.min;

  constructor() {
    addIcons({ searchOutline, closeOutline, logoWhatsapp });
  }

  ngOnInit(): void {
    void this.ir(0);
  }

  buscarLuego(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.ir(0), 350);
  }

  async ir(n: number): Promise<void> {
    this.pagina.set(n);
    this.cargando.set(true);
    const { data, error } = await this.sb.client.rpc('clientes', { p_buscar: this.q || null, p_limite: 50, p_desde: n * 50 });
    this.cargando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    const filas = (data ?? []) as Cliente[];
    this.clientes.set(filas);
    this.total.set(filas[0]?.total_filas ?? 0);
  }

  async abrir(c: Cliente): Promise<void> {
    this.sel.set(c);
    this.pedidosCli.set([]);
    try {
      const r = await this.ps.listar({ texto: c.telefono, porPagina: 100, conItems: true });
      this.pedidosCli.set(r.filas);
    } catch (e) {
      this.toast.error(mensajeError(e));
    }
  }

  /** Mensaje de seguimiento con lo que compró en su último pedido entregado */
  whatsapp(c: Cliente): string {
    const pedidos = this.pedidosCli();
    const ultimo = pedidos.find((p) => p.estado === 'entregado') ?? pedidos.find((p) => p.estado !== 'cancelado');
    const productos = (ultimo?.pedido_items ?? []).map((i) => i.nombre);
    return enlaceWhatsapp(c.telefono, mensajeSeguimiento(c.nombre, productos));
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
