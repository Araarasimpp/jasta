import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { add, searchOutline, refreshOutline } from 'ionicons/icons';
import { PedidosService } from '../../core/services/pedidos.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { EstadoPedido, Pedido, estadoLabel } from '../../shared/modelos';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { finDiaColombia, formatoFechaCO, formatoHoraCO, inicioDiaColombia } from '../../shared/fecha-colombia';

type Filtro = EstadoPedido | 'activos' | 'todos';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [FormsModule, RouterLink, IonIcon, PedidoDetalleComponent],
  styles: [
    `
      .fechas { display: flex; gap: 6px; align-items: center; font-size: 13px; color: var(--text-soft); }
      .fechas input { width: 140px; }
      .cliente { display: flex; flex-direction: column; }
      .cliente small { color: var(--text-muted); font-size: 12px; }
      .tarjeta { cursor: pointer; }
      .tarjeta .meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head">
        <h1>Pedidos <small class="num">{{ numero(total()) }}</small></h1>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
        @if (puedeVender()) {
          <a class="b b-pri" routerLink="/app/pedidos/nuevo"><ion-icon name="add"></ion-icon>Nuevo pedido</a>
        }
      </div>

      <div class="barra">
        <div class="chips" role="tablist">
          @for (f of filtros; track f.id) {
            <button class="chip" [class.on]="filtro() === f.id" (click)="cambiarFiltro(f.id)">
              {{ f.label }}
              @if (conteos()[f.id] !== undefined) {
                <span class="n num">{{ conteos()[f.id] }}</span>
              }
            </button>
          }
        </div>
      </div>
      <div class="barra">
        <label class="buscar">
          <ion-icon name="search-outline"></ion-icon>
          <input type="search" placeholder="N.º, cliente, teléfono o barrio" [(ngModel)]="texto" (ngModelChange)="buscarLuego()" />
        </label>
        <div class="fechas">
          <input class="inp inp-chico" type="date" [(ngModel)]="desde" (change)="irPagina(0)" aria-label="Desde" />
          <span>a</span>
          <input class="inp inp-chico" type="date" [(ngModel)]="hasta" (change)="irPagina(0)" aria-label="Hasta" />
          @if (desde || hasta) {
            <button class="b" (click)="desde = ''; hasta = ''; irPagina(0)">Quitar fechas</button>
          }
        </div>
      </div>

      @if (error()) {
        <div class="vista-body"><p class="error">{{ error() }}</p></div>
      }

      <div class="tabla-wrap solo-pc">
        <table class="tabla">
          <thead>
            <tr>
              <th>N.º</th><th>Fecha</th><th>Cliente</th><th>Barrio</th><th>Vendedora</th><th>Mensajero</th><th>Estado</th><th class="der">Total</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filas(); track p.id) {
              <tr class="click" (click)="abrir(p.id)">
                <td class="num suave">{{ p.id }}</td>
                <td class="suave">{{ fecha(p.created_at) }}</td>
                <td class="corta">{{ p.cliente_nombre }}</td>
                <td class="corta suave">{{ p.barrio || '—' }}</td>
                <td class="corta">{{ p.vendedora?.nombre || '—' }}</td>
                <td class="corta">{{ p.mensajero?.nombre || '—' }}</td>
                <td><span class="estado {{ p.estado }}">{{ estadoLabel(p.estado) }}</span></td>
                <td class="der num">{{ pesos(p.total) }}</td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="suave">{{ cargando() ? 'Cargando…' : 'No hay pedidos con estos filtros.' }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      <div class="vista-body solo-cel">
        <div class="tarjetas" style="width: 100%">
          @for (p of filas(); track p.id) {
            <div class="tarjeta" (click)="abrir(p.id)">
              <div class="tarjeta-top">
                <h3>{{ p.cliente_nombre }}</h3>
                <strong class="num">{{ pesos(p.total) }}</strong>
              </div>
              <p>{{ p.barrio || 'Sin barrio' }} · {{ p.vendedora?.nombre || '—' }}</p>
              <div class="meta"><span class="estado {{ p.estado }}">{{ estadoLabel(p.estado) }}</span><span>#{{ p.id }} · {{ fecha(p.created_at) }}</span></div>
            </div>
          } @empty {
            <div class="vacio">{{ cargando() ? 'Cargando…' : 'No hay pedidos con estos filtros.' }}</div>
          }
        </div>
      </div>

      @if (total() > porPagina) {
        <div class="paginar">
          <span class="num">{{ pagina() * porPagina + 1 }}–{{ min((pagina() + 1) * porPagina, total()) }} de {{ numero(total()) }}</span>
          <span style="display: flex; gap: 8px">
            <button class="b" [disabled]="pagina() === 0" (click)="irPagina(pagina() - 1)">Anterior</button>
            <button class="b" [disabled]="(pagina() + 1) * porPagina >= total()" (click)="irPagina(pagina() + 1)">Siguiente</button>
          </span>
        </div>
      }
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="cerrarDetalle()" (cambiado)="cargar()"></app-pedido-detalle>
    }
  `,
})
export class PedidosPage implements OnInit, OnDestroy {
  private ps = inject(PedidosService);
  private sb = inject(SupabaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  filtros: { id: Filtro; label: string }[] = [
    { id: 'activos', label: 'Activos' },
    { id: 'por_alistar', label: 'Por alistar' },
    { id: 'alistado', label: 'Alistados' },
    { id: 'despachado', label: 'Despachados' },
    { id: 'entregado', label: 'Entregados' },
    { id: 'cancelado', label: 'Cancelados' },
    { id: 'todos', label: 'Todos' },
  ];

  filtro = signal<Filtro>('activos');
  filas = signal<Pedido[]>([]);
  total = signal(0);
  pagina = signal(0);
  cargando = signal(true);
  error = signal('');
  conteos = signal<Record<string, number>>({});
  abierto = signal<number | null>(null);
  texto = '';
  desde = '';
  hasta = '';
  readonly porPagina = 50;

  puedeVender = computed(() => this.sb.tiene('admin', 'vendedora'));
  pesos = pesos;
  numero = numero;
  estadoLabel = estadoLabel;
  min = Math.min;

  private timer?: ReturnType<typeof setTimeout>;
  private dejarDeEscuchar?: () => void;

  constructor() {
    addIcons({ add, searchOutline, refreshOutline });
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.queryParamMap.get('id'));
    if (id) this.abierto.set(id);
    void this.cargar();
    this.dejarDeEscuchar = this.ps.escuchar(() => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.cargar(), 600);
    });
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar?.();
    clearTimeout(this.timer);
  }

  async cargar(): Promise<void> {
    this.cargando.set(true);
    try {
      const f = this.filtro();
      const [r, c] = await Promise.all([
        this.ps.listar({
          estado: f === 'todos' ? null : f,
          texto: this.texto,
          desde: this.desde ? inicioDiaColombia(this.desde).toISOString() : null,
          hasta: this.hasta ? finDiaColombia(this.hasta).toISOString() : null,
          pagina: this.pagina(),
          porPagina: this.porPagina,
        }),
        this.ps.conteoPorEstado(),
      ]);
      this.filas.set(r.filas);
      this.total.set(r.total);
      this.conteos.set({ ...c, activos: (c['por_alistar'] ?? 0) + (c['alistado'] ?? 0) + (c['despachado'] ?? 0) });
      this.error.set('');
    } catch (e) {
      this.error.set('No se pudieron cargar los pedidos: ' + mensajeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarFiltro(f: Filtro): void {
    this.filtro.set(f);
    this.irPagina(0);
  }

  irPagina(n: number): void {
    this.pagina.set(n);
    void this.cargar();
  }

  buscarLuego(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.irPagina(0), 350);
  }

  abrir(id: number): void {
    this.abierto.set(id);
    this.router.navigate([], { queryParams: { id }, replaceUrl: true });
  }

  cerrarDetalle(): void {
    this.abierto.set(null);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
