import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { searchOutline, closeOutline, logoWhatsapp } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { mensajeError, numero, pesos } from '../../shared/formato';
import { formatoFechaCO } from '../../shared/fecha-colombia';
import { enlaceWhatsapp, mensajeSeguimiento } from '../../shared/whatsapp';
import { Riesgo } from '../../shared/modelos';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';

/** Una compra entregada del cliente (de la función compras_cliente) */
interface Compra { id: number; created_at: string; canal: string; total: number; vendedora: string | null; productos: string[] }

interface Cliente {
  telefono: string; nombre: string; barrio: string | null; direccion: string | null;
  pedidos: number; entregados: number; total: number; ultimo: string; total_filas: number;
}

/** Clientes armados a partir de los pedidos (agrupados por teléfono) */
@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [EsqueletoComponent, FormsModule, IonIcon, PedidoDetalleComponent],
  styles: [
    `
      .tabla td { white-space: nowrap; }
      .lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
      .lista li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-soft); font-size: 13px; cursor: pointer; }
      @media (hover: hover) { .lista li:not(.fija):hover { color: var(--accent); } }
      .lista li.fija { cursor: default; }
      .lista small { display: block; color: var(--text-muted); font-size: 12px; }
      .riesgo { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--oro-wash); color: var(--oro-texto); font-size: 13px; }
      .riesgo.alto { background: var(--danger-wash); color: var(--danger); }
      .marcar { display: flex; flex-direction: column; gap: 8px; }
      .marcar .fila { display: flex; gap: 8px; flex-wrap: wrap; }
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
        <table class="tabla tarjetas-cel">
          <thead><tr><th>Cliente</th><th>Teléfono</th><th>Barrio</th><th class="der">Compras</th><th class="der">Comprado</th><th>Última compra</th></tr></thead>
          <tbody>
            @for (c of clientes(); track c.telefono) {
              <tr class="click" (click)="abrir(c)">
                <td class="titulo">{{ c.nombre }}</td>
                <td class="num" data-etq="Teléfono">{{ c.telefono }}</td>
                <td class="suave corta" data-etq="Barrio">{{ c.barrio || '—' }}</td>
                <td class="der num" data-etq="Compras">{{ c.entregados }}</td>
                <td class="der num" data-etq="Comprado">{{ pesos(c.total) }}</td>
                <td class="suave" data-etq="Última compra">{{ fecha(c.ultimo) }}</td>
              </tr>
            } @empty {
              @if (cargando()) { <tr><td colspan="6" class="suave"><app-esqueleto forma="tabla" [filas]="8" [columnas]="5"></app-esqueleto></td></tr> } @else { <tr><td colspan="6" class="suave">{{ 'No hay clientes con esa búsqueda.' }}</td></tr> }
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
      <div class="vista-body"><p class="ayuda">Solo aparecen los clientes que ya recibieron al menos un pedido. "Compras" y "Comprado" cuentan solo los pedidos entregados.</p></div>
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
          @if (riesgo(); as r) {
            @if (r.nivel) {
              <div class="riesgo" [class.alto]="r.nivel === 'alto'">
                <strong>{{ r.marca ? '⚠️ Marcado como problemático' : '⚠️ Ha tenido problemas' }}</strong>
                @if (r.marca) { <span>"{{ r.marca.nota }}"{{ r.marca.autor ? ' — ' + r.marca.autor : '' }}</span> }
                <span>{{ r.rechazados }} cancelados después de salir · {{ r.devoluciones }} devoluciones · {{ r.novedades }} novedades</span>
              </div>
            }
            @if (esAdmin()) {
              @if (marcando()) {
                <div class="marcar">
                  <input class="inp" maxlength="300" [(ngModel)]="notaMarca" placeholder="Ej: No recibe y no contesta, pedir pago anticipado" aria-label="Por qué" />
                  <div class="fila">
                    <button class="b b-pri" (click)="marcar(c, notaMarca)" [disabled]="!notaMarca.trim()">Guardar marca</button>
                    <button class="b" (click)="marcando.set(false)">Cancelar</button>
                  </div>
                </div>
              } @else if (r.marca) {
                <button class="b" (click)="marcar(c, '')">Quitar la marca</button>
              } @else {
                <button class="b" (click)="notaMarca = ''; marcando.set(true)">Marcar como cliente problemático</button>
              }
            }
          }
          <a class="b" [href]="whatsapp(c)" target="_blank" rel="noopener"><ion-icon name="logo-whatsapp"></ion-icon>Escribir por WhatsApp</a>
          <section>
            <h3 class="seccion-titulo">Lo que ha comprado</h3>
            <ul class="lista">
              @for (p of pedidosCli(); track p.id) {
                <!-- El admin abre el pedido completo; el local ve el resumen de la compra -->
                <li [class.fija]="!esAdmin()" (click)="esAdmin() && abierto.set(p.id)">
                  <span>#{{ p.id }} · {{ fecha(p.created_at) }}<small>{{ p.canal === 'local' ? 'En el local' : 'Domicilio' }} · {{ p.vendedora || 'Sin vendedora' }}</small>
                    @if (p.productos.length) { <small>{{ p.productos.join(', ') }}</small> }</span>
                  <span class="num">{{ pesos(p.total) }}</span>
                </li>
              } @empty {
                @if (cargandoCli()) { <app-esqueleto forma="lista" [filas]="3"></app-esqueleto> } @else { <li class="suave fija">{{ 'Sin compras entregadas.' }}</li> }
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
  private toast = inject(ToastService);

  clientes = signal<Cliente[]>([]);
  total = signal(0);
  pagina = signal(0);
  cargando = signal(true);
  sel = signal<Cliente | null>(null);
  pedidosCli = signal<Compra[]>([]);
  cargandoCli = signal(false);
  esAdmin = computed(() => this.sb.tiene('admin'));
  abierto = signal<number | null>(null);
  riesgo = signal<Riesgo | null>(null);
  marcando = signal(false);
  notaMarca = '';
  q = '';
  private timer?: ReturnType<typeof setTimeout>;

  pesos = pesos;
  numero = numero;
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
    this.riesgo.set(null);
    this.marcando.set(false);
    void this.cargarRiesgo(c);
    this.cargandoCli.set(true);
    // Solo lo que de verdad recibió (sin cancelados ni pendientes), a domicilio y en el local
    const { data, error } = await this.sb.client.rpc('compras_cliente', { p_telefono: c.telefono });
    this.cargandoCli.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.pedidosCli.set((data ?? []) as Compra[]);
  }

  private async cargarRiesgo(c: Cliente): Promise<void> {
    const { data } = await this.sb.client.rpc('riesgo_cliente', { p_telefono: c.telefono });
    if (this.sel()?.telefono === c.telefono) this.riesgo.set((data ?? null) as Riesgo | null);
  }

  async marcar(c: Cliente, nota: string): Promise<void> {
    const { error } = await this.sb.client.rpc('marcar_cliente', { p_telefono: c.telefono, p_nota: nota.trim() });
    if (error) return this.toast.error(mensajeError(error));
    this.marcando.set(false);
    this.toast.ok(nota.trim() ? 'Listo: avisaremos cuando le hagan un pedido' : 'Marca quitada');
    await this.cargarRiesgo(c);
  }

  /** Mensaje de seguimiento con lo que compró en su último pedido entregado */
  whatsapp(c: Cliente): string {
    const pedidos = this.pedidosCli();
    const productos = pedidos[0]?.productos ?? [];
    return enlaceWhatsapp(c.telefono, mensajeSeguimiento(c.nombre, productos));
  }

  fecha(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
