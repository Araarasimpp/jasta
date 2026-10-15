import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { searchOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { RangoComponent, RangoFechas } from '../../shared/rango/rango.component';
import { mensajeError } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';

interface Registro { id: number; created_at: string; autor: string | null; texto: string; tipo: string; pedido_id?: number }
type Vista = 'pedidos' | 'cambios';

/** Quién hizo qué: movimientos de pedidos y cambios en productos, usuarios, cuadres y configuración */
@Component({
  selector: 'app-actividad',
  standalone: true,
  imports: [FormsModule, IonIcon, RangoComponent, PedidoDetalleComponent],
  styles: [
    `
      .feed { list-style: none; margin: 0; padding: 0 20px 24px; }
      .feed li { display: grid; grid-template-columns: 110px 150px 1fr; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); font-size: 13px; align-items: baseline; }
      .feed time { color: var(--text-muted); font-size: 12px; }
      .feed .quien { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .feed .guia { margin-right: 6px; }
      .tag { display: inline-block; margin-right: 6px; padding: 0 6px; border-radius: 4px; background: var(--surface-2); color: var(--text-soft); font-size: 11px; }
      @media (max-width: 760px) { .feed { padding: 0 14px 24px; } .feed li { grid-template-columns: 1fr; gap: 2px; } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head"><h1>Actividad</h1></div>
      <div class="barra">
        <div class="chips">
          <button class="chip" [class.on]="vista() === 'pedidos'" (click)="cambiarVista('pedidos')">Pedidos</button>
          <button class="chip" [class.on]="vista() === 'cambios'" (click)="cambiarVista('cambios')">Productos, usuarios y cuadres</button>
        </div>
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="Persona o texto" [(ngModel)]="q" (ngModelChange)="buscarLuego()" />
        </label>
      </div>
      <div class="barra"><app-rango (cambio)="cambiarRango($event)"></app-rango></div>
      <ul class="feed">
        @for (r of registros(); track r.tipo + r.id) {
          <li>
            <time>{{ fecha(r.created_at) }}</time>
            <span class="quien">{{ r.autor || 'Sistema' }}</span>
            <span>
              @if (r.pedido_id) { <a class="guia" (click)="abierto.set(r.pedido_id!)">#{{ r.pedido_id }}</a> } @else { <span class="tag">{{ r.tipo }}</span> }
              {{ r.texto }}
            </span>
          </li>
        } @empty {
          <li><span></span><span></span><span class="suave">{{ cargando() ? 'Cargando…' : 'Sin actividad en este periodo.' }}</span></li>
        }
      </ul>
      @if (registros().length === limite) {
        <div class="paginar"><span class="suave">Se muestran los {{ limite }} más recientes. Acorta el periodo o busca para ver más.</span></div>
      }
    </div>
    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)"></app-pedido-detalle>
    }
  `,
})
export class ActividadPage {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);

  readonly limite = 300;
  vista = signal<Vista>('pedidos');
  registros = signal<Registro[]>([]);
  cargando = signal(true);
  abierto = signal<number | null>(null);
  q = '';
  private rango: RangoFechas | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ searchOutline });
  }

  cambiarVista(v: Vista): void {
    this.vista.set(v);
    void this.cargar();
  }

  cambiarRango(r: RangoFechas): void {
    this.rango = r;
    void this.cargar();
  }

  buscarLuego(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.cargar(), 350);
  }

  async cargar(): Promise<void> {
    const r = this.rango;
    if (!r) return;
    this.cargando.set(true);
    const desde = r.desde ? inicioDiaColombia(r.desde).toISOString() : null;
    const hasta = r.hasta ? finDiaColombia(r.hasta).toISOString() : null;
    const t = this.q.trim().replace(/[,()%]/g, ' ').trim();
    try {
      if (this.vista() === 'pedidos') {
        // Solo lo que hizo una persona (las notas automáticas del WordPress no tienen autor)
        let q = this.sb.client.from('pedido_notas').select('id, created_at, autor, nota, pedido_id').not('autor', 'is', null);
        if (desde) q = q.gte('created_at', desde);
        if (hasta) q = q.lte('created_at', hasta);
        if (t) q = q.or(`autor.ilike.%${t}%,nota.ilike.%${t}%`);
        const res = await q.order('created_at', { ascending: false }).limit(this.limite);
        if (res.error) throw res.error;
        this.registros.set(
          (res.data ?? []).map((n) => ({ id: n.id, created_at: n.created_at, autor: n.autor, texto: n.nota, tipo: 'pedido', pedido_id: n.pedido_id }))
        );
      } else {
        let q = this.sb.client.from('actividad').select('id, created_at, usuario_nombre, tabla, resumen');
        if (desde) q = q.gte('created_at', desde);
        if (hasta) q = q.lte('created_at', hasta);
        if (t) q = q.or(`usuario_nombre.ilike.%${t}%,resumen.ilike.%${t}%`);
        const res = await q.order('created_at', { ascending: false }).limit(this.limite);
        if (res.error) throw res.error;
        const nombres: Record<string, string> = { productos: 'Producto', usuarios: 'Usuario', cuadres: 'Cuadre', configuracion: 'Configuración', metas: 'Meta' };
        this.registros.set(
          (res.data ?? []).map((a) => ({ id: a.id, created_at: a.created_at, autor: a.usuario_nombre, texto: a.resumen ?? '', tipo: nombres[a.tabla] ?? a.tabla }))
        );
      }
    } catch (e) {
      this.toast.error(mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
