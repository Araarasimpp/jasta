import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { closeOutline, refreshOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { VisorService } from '../../shared/visor/visor.service';
import { PedidoDetalleComponent } from '../../shared/pedido-detalle/pedido-detalle.component';
import { EsqueletoComponent } from '../../shared/esqueleto/esqueleto.component';
import { urlsComprobantes } from '../../shared/comprobantes';
import { aBase64, pedirIa } from '../../shared/ia';
import { prepararFoto } from '../../shared/fotos';
import { mensajeError, pesos } from '../../shared/formato';
import { formatoFechaCO, formatoHoraCO } from '../../shared/fecha-colombia';
import { TransferenciasAlertaService } from '../../shared/transferencias-alerta/transferencias-alerta.service';

interface Transferencia {
  id: number; estado: 'por_revisar' | 'llego' | 'no_llego'; canal: 'domicilio' | 'local'; cliente: string | null; telefono: string | null;
  total: number; transferencia: number; propina: number; esperado: number; tipo: string | null; entregado_at: string;
  evidencias: string[]; mensajero: string | null; vendedora: string | null;
  revisada_at: string | null; revisada_por: string | null; nota: string | null;
}
type Filtro = 'por_revisar' | 'no_llego' | 'revisadas';
/** Lo que la IA leyó en la foto del comprobante */
interface Lectura {
  es_comprobante?: boolean; valor?: number | null; banco?: string | null; fecha?: string | null; hora?: string | null;
  referencia?: string | null; destinatario?: string | null; alertas?: string[]; repetidos?: number[];
}

/**
 * Transferencias por revisar: cada pago presencial con transferencia (domicilio o local) queda aquí
 * hasta que el admin mira en el banco y confirma que sí llegó.
 */
@Component({
  selector: 'app-transferencias',
  standalone: true,
  imports: [FormsModule, IonIcon, PedidoDetalleComponent, EsqueletoComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .ia-lee { padding: 10px 12px; border-radius: var(--radius); border: 1px solid var(--border); font-size: 13px; }
      .ia-lee.bien { border-color: color-mix(in srgb, var(--efectivo) 45%, transparent); background: color-mix(in srgb, var(--efectivo) 8%, var(--surface)); }
      .ia-lee.ojo { border-color: color-mix(in srgb, #f59e0b 50%, transparent); background: color-mix(in srgb, #f59e0b 9%, var(--surface)); }
      .ia-lee.mal { border-color: var(--danger); background: color-mix(in srgb, var(--danger) 8%, var(--surface)); }
      .ia-cab { display: flex; align-items: center; gap: 6px; }
      .ia-lee.bien .ia-cab { color: var(--efectivo-texto); }
      .ia-lee.ojo .ia-cab { color: var(--st-pendiente-text); }
      .ia-lee.mal .ia-cab { color: var(--danger); }
      .ia-lee p { margin: 4px 0 0; color: var(--text-soft); }
      .ia-lee p.aviso { color: var(--text); font-weight: 550; }
      .ia-cargando { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 13px; color: var(--accent); }
      .ia-cargando ion-icon { animation: girar-ia 1.4s linear infinite; }
      @keyframes girar-ia { to { transform: rotate(360deg); } }
      .page { max-width: 820px; }
      .resumen { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; padding: 16px 18px; border-radius: var(--radius-lg); background: var(--danger-wash); }
      .resumen.ok { background: var(--ok-wash); }
      .resumen span { font-size: 13px; font-weight: 650; letter-spacing: .05em; text-transform: uppercase; color: var(--danger); }
      .resumen.ok span { color: var(--efectivo-texto); }
      .resumen strong { display: block; font-family: var(--mono-font); font-size: 26px; }
      .resumen small { font-size: 13px; color: var(--text-soft); }
      .chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .chips button { height: 34px; padding: 0 14px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface); color: var(--text-soft); font: inherit; font-size: 13.5px; cursor: pointer; }
      .chips button.on { border-color: var(--accent); background: var(--accent-wash); color: var(--accent); font-weight: 650; }
      .lista { display: flex; flex-direction: column; gap: 10px; }
      .tr { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); }
      .tr.por_revisar { border-color: var(--danger); box-shadow: inset 4px 0 0 var(--danger); }
      .tr.vieja { animation: parpadeo 1.6s ease-in-out infinite; }
      @keyframes parpadeo { 50% { box-shadow: inset 4px 0 0 var(--danger), 0 0 0 3px var(--danger-wash); } }
      .cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .cab h3 { margin: 0; font-size: 15px; }
      .cab small { display: block; margin-top: 2px; font-size: 12.5px; color: var(--text-muted); }
      .valor { text-align: right; }
      .valor strong { display: block; font-family: var(--mono-font); font-size: 22px; }
      .valor small { font-size: 12px; color: var(--text-muted); }
      .tag { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; background: var(--surface-2); color: var(--text-soft); }
      .tag.local { background: var(--oro-wash); color: var(--oro-texto); }
      .espera { font-size: 12.5px; font-weight: 650; color: var(--danger); }
      .fotos { display: flex; gap: 8px; flex-wrap: wrap; }
      .foto { width: 64px; height: 64px; padding: 0; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface-2); cursor: zoom-in; }
      .foto img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .sin-foto { font-size: 12.5px; color: var(--oro-texto); }
      .acciones { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
      .acciones .b { height: 44px; font-size: 14.5px; }
      .resultado { margin: 0; padding: 8px 10px; border-radius: var(--radius-sm); font-size: 13px; background: var(--ok-wash); color: var(--efectivo-texto); }
      .resultado.mal { background: var(--danger-wash); color: var(--danger); }
      .link { border: 0; background: none; padding: 0; color: var(--accent); font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; }
      .vacio-txt { margin: 0; padding: 24px 0; text-align: center; font-size: 14px; color: var(--text-soft); }
    `,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div><p class="fecha">Pagos presenciales por transferencia</p><h1>Transferencias</h1></div>
        <button class="b b-icono" aria-label="Actualizar" (click)="cargar()"><ion-icon name="refresh-outline"></ion-icon></button>
      </div>

      <div class="resumen" [class.ok]="!alerta.n()">
        @if (alerta.n()) {
          <div><span>Por revisar en el banco</span><strong>{{ pesos(alerta.valor()) }}</strong>
            <small>{{ alerta.n() }} {{ alerta.n() === 1 ? 'transferencia' : 'transferencias' }} · la más vieja hace {{ hace(alerta.desde()) }}</small></div>
        } @else {
          <div><span>Todo revisado</span><small>No hay transferencias pendientes. Cuando registren un pago por transferencia te llega un aviso.</small></div>
        }
      </div>
      <p class="ayuda" style="margin: 0">Abre la app de tu banco, busca cada transferencia por el valor y la hora, y confirma aquí si llegó. Mientras quede alguna sin revisar te llega un aviso cada 30 minutos.</p>

      <div class="chips" role="group" aria-label="Qué transferencias ver">
        <button type="button" [class.on]="filtro() === 'por_revisar'" (click)="cambiar('por_revisar')">Por revisar{{ alerta.n() ? ' (' + alerta.n() + ')' : '' }}</button>
        <button type="button" [class.on]="filtro() === 'no_llego'" (click)="cambiar('no_llego')">No llegaron</button>
        <button type="button" [class.on]="filtro() === 'revisadas'" (click)="cambiar('revisadas')">Revisadas (15 días)</button>
      </div>

      <div class="lista">
        @for (t of lista(); track t.id) {
          <article class="tr" [class]="'tr ' + t.estado" [class.vieja]="t.estado === 'por_revisar' && horas(t.entregado_at) >= 2">
            <div class="cab">
              <div>
                <h3>{{ t.cliente || 'Cliente' }}</h3>
                <small><span class="tag" [class.local]="t.canal === 'local'">{{ t.canal === 'local' ? 'Venta del local' : 'Domicilio' }}</span>
                  #{{ t.id }} · {{ cuando(t.entregado_at) }}</small>
                <small>{{ t.canal === 'local' ? (t.vendedora ? 'Vendió ' + t.vendedora : 'Venta del local') : 'Entregó ' + (t.mensajero || '—') }}</small>
                @if (t.estado === 'por_revisar') { <span class="espera">Esperando hace {{ hace(t.entregado_at) }}</span> }
              </div>
              <div class="valor">
                <strong>{{ pesos(t.esperado) }}</strong>
                @if (t.tipo === 'mixto') { <small>Mixto: pedido {{ pesos(t.total) }}</small> }
                @if (+t.propina) { <small>Incluye {{ pesos(t.propina) }} de propina</small> }
              </div>
            </div>
            @if (t.evidencias.length) {
              <div class="fotos">
                @for (f of t.evidencias; track f; let i = $index) {
                  <button type="button" class="foto" (click)="verFotos(t, i)" [attr.aria-label]="'Ver comprobante ' + (i + 1)">
                    @if (fotos()[f]; as u) { <img [src]="u" alt="" loading="lazy" /> }
                  </button>
                }
              </div>
            } @else { <span class="sin-foto">Sin foto del comprobante</span> }
            @for (f of t.evidencias.slice(0, 1); track f) {
              @if (lecturas()[f]; as l) {
                @let v = veredicto(t, l);
                <div class="ia-lee" [class.bien]="v.nivel === 'bien'" [class.mal]="v.nivel === 'mal'" [class.ojo]="v.nivel === 'ojo'">
                  <div class="ia-cab"><ion-icon [name]="v.nivel === 'bien' ? 'checkmark-circle' : 'warning'" aria-hidden="true"></ion-icon><strong>{{ v.titulo }}</strong></div>
                  <p>Leído con IA: {{ l.valor ? pesos(l.valor) : 'sin valor' }}{{ l.banco ? ' · ' + l.banco : '' }}{{ l.fecha ? ' · ' + l.fecha : '' }}{{ l.hora ? ' ' + l.hora : '' }}{{ l.referencia ? ' · Ref. ' + l.referencia : '' }}</p>
                  @for (a of v.avisos; track a) { <p class="aviso">{{ a }}</p> }
                </div>
              } @else if (leyendo().has(f)) {
                <p class="ia-cargando"><ion-icon name="sparkles" aria-hidden="true"></ion-icon>Revisando el comprobante con IA…</p>
              } @else {
                <div><button class="link" (click)="leer(t, f)"><ion-icon name="sparkles" aria-hidden="true"></ion-icon> Revisar con IA</button></div>
              }
            }

            @if (t.estado === 'por_revisar') {
              <div class="acciones">
                <button class="b" [disabled]="ocupado() === t.id" (click)="noLlego(t)">✗ No llegó</button>
                <button class="b b-ok" [disabled]="ocupado() === t.id" (click)="llego(t)">✓ Sí llegó</button>
              </div>
            } @else if (t.estado === 'llego') {
              <p class="resultado">✓ Confirmada por {{ t.revisada_por }} · {{ cuando(t.revisada_at!) }}</p>
            } @else {
              <p class="resultado mal">✗ No llegó ({{ t.revisada_por }} · {{ cuando(t.revisada_at!) }}): {{ t.nota }}</p>
              <div><button class="link" (click)="llego(t)">Ya llegó: marcar como recibida</button></div>
            }
            <div><button class="link" (click)="abierto.set(t.id)">Ver pedido</button></div>
          </article>
        } @empty {
          @if (cargando()) { <app-esqueleto forma="lista" [filas]="3"></app-esqueleto> }
          @else { <p class="vacio-txt">{{ filtro() === 'por_revisar' ? '¡Listo! No hay transferencias por revisar.' : filtro() === 'no_llego' ? 'Ninguna transferencia marcada como no recibida.' : 'No hay transferencias revisadas en los últimos 15 días.' }}</p> }
        }
      </div>
    </div>

    @if (abierto(); as id) {
      <app-pedido-detalle [pedidoId]="id" (cerrar)="abierto.set(null)"></app-pedido-detalle>
    }
  `,
})
export class TransferenciasPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private visor = inject(VisorService);
  alerta = inject(TransferenciasAlertaService);

  lista = signal<Transferencia[]>([]);
  filtro = signal<Filtro>('por_revisar');
  cargando = signal(true);
  ocupado = signal<number | null>(null);
  abierto = signal<number | null>(null);
  fotos = signal<Record<string, string>>({});
  pesos = pesos;
  /** Para que "hace X min" se actualice solo */
  private ahora = signal(Date.now());
  private reloj?: ReturnType<typeof setInterval>;
  pendientes = computed(() => this.lista().filter((t) => t.estado === 'por_revisar').length);

  constructor() {
    addIcons({ closeOutline, refreshOutline });
  }

  ngOnInit(): void {
    void this.cargar();
    this.reloj = setInterval(() => {
      this.ahora.set(Date.now());
      if (this.filtro() === 'por_revisar') void this.cargar(true);
    }, 60_000);
  }

  ngOnDestroy(): void {
    clearInterval(this.reloj);
  }

  cambiar(f: Filtro): void {
    this.filtro.set(f);
    this.lista.set([]);
    this.cargando.set(true);
    void this.cargar();
  }

  async cargar(silencioso = false): Promise<void> {
    const { data, error } = await this.sb.client.rpc('transferencias_lista', { p_estado: this.filtro() });
    this.cargando.set(false);
    void this.alerta.refrescar();
    if (error) {
      if (!silencioso) this.toast.error(mensajeError(error));
      return;
    }
    const lista = (data ?? []) as Transferencia[];
    this.lista.set(lista);
    // Lo que la IA ya había leído; los por revisar que falten se leen solos, uno a uno
    const todas = lista.flatMap((t) => t.evidencias.slice(0, 1));
    if (todas.length) {
      const { data: leidas } = await this.sb.client.rpc('comprobantes_leidos_de', { p_rutas: todas });
      if (leidas) this.lecturas.update((m) => ({ ...m, ...(leidas as Record<string, Lectura>) }));
      void this.leerPendientes(lista.filter((t) => t.estado === 'por_revisar' && t.evidencias.length && !this.lecturas()[t.evidencias[0]]));
    }
    const faltan = lista.flatMap((t) => t.evidencias).filter((f) => !this.fotos()[f]);
    if (faltan.length) {
      const urls = await urlsComprobantes(this.sb.client, faltan);
      this.fotos.update((m) => ({ ...m, ...Object.fromEntries(faltan.map((f, i) => [f, urls[i]])) }));
    }
  }

  // ---------- Revisión con IA ----------
  lecturas = signal<Record<string, Lectura>>({});
  leyendo = signal(new Set<string>());
  private cola = false;

  private async leerPendientes(lista: Transferencia[]): Promise<void> {
    if (this.cola) return;
    this.cola = true;
    try {
      for (const t of lista) await this.leer(t, t.evidencias[0], true);
    } finally {
      this.cola = false;
    }
  }

  /** La IA lee el comprobante (valor, banco, fecha, referencia) y se compara con el pedido */
  async leer(t: Transferencia, ruta: string, silencioso = false): Promise<void> {
    if (this.leyendo().has(ruta)) return;
    this.leyendo.update((s) => new Set(s).add(ruta));
    try {
      const [url] = await urlsComprobantes(this.sb.client, [ruta]);
      if (!url) throw new Error('No se pudo abrir la foto');
      const foto = await prepararFoto(await (await fetch(url)).blob(), 1600, 0.85);
      const datos = await pedirIa<Lectura>(this.sb.client, { accion: 'comprobante', imagen: await aBase64(foto), mime: 'image/jpeg' }, 40000);
      const { data } = await this.sb.client.rpc('registrar_comprobante', { p_ruta: ruta, p_pedido: t.id, p_datos: datos });
      this.lecturas.update((m) => ({ ...m, [ruta]: { ...datos, repetidos: (data as { repetidos?: number[] } | null)?.repetidos ?? [] } }));
    } catch (e) {
      if (!silencioso) this.toast.error(mensajeError(e));
    } finally {
      this.leyendo.update((s) => { const n = new Set(s); n.delete(ruta); return n; });
    }
  }

  /** Qué tan bien coincide lo leído con el pedido */
  veredicto(t: Transferencia, l: Lectura): { nivel: 'bien' | 'ojo' | 'mal'; titulo: string; avisos: string[] } {
    const avisos: string[] = [];
    let nivel: 'bien' | 'ojo' | 'mal' = 'bien';
    if (l.es_comprobante === false) return { nivel: 'mal', titulo: 'La foto no parece un comprobante de pago', avisos: l.alertas ?? [] };
    const v = Number(l.valor) || 0;
    const esperado = Number(t.esperado) || 0;
    if (!v) { nivel = 'ojo'; avisos.push('No se alcanza a leer el valor: revísalo a mano.'); }
    else if (Math.abs(v - esperado) > 1) { nivel = 'mal'; avisos.push(`El comprobante dice ${pesos(v)} y el pedido espera ${pesos(esperado)}.`); }
    if (l.fecha && t.entregado_at) {
      const dias = (new Date(t.entregado_at).getTime() - new Date(l.fecha + 'T12:00:00-05:00').getTime()) / 86400000;
      if (dias > 2) { nivel = nivel === 'mal' ? 'mal' : 'ojo'; avisos.push(`La fecha del comprobante (${l.fecha}) es de antes del pedido.`); }
    }
    if (l.repetidos?.length) { nivel = 'mal'; avisos.push('Esta misma referencia ya se usó en el pedido ' + l.repetidos.map((x) => '#' + x).join(', ') + '.'); }
    for (const a of l.alertas ?? []) { avisos.push(a); if (nivel === 'bien') nivel = 'ojo'; }
    const titulo = nivel === 'bien' ? 'Coincide con el pedido' : nivel === 'ojo' ? 'Revísalo con cuidado' : 'Ojo: algo no cuadra';
    return { nivel, titulo, avisos };
  }

  async llego(t: Transferencia): Promise<void> {
    await this.revisar(t, true, null);
  }

  async noLlego(t: Transferencia): Promise<void> {
    const nota = prompt(`¿Qué pasó con la transferencia de ${pesos(t.esperado)}? (Ej: no aparece en el banco, llegó menos)`)?.trim();
    if (!nota) return;
    await this.revisar(t, false, nota);
  }

  private async revisar(t: Transferencia, llego: boolean, nota: string | null): Promise<void> {
    this.ocupado.set(t.id);
    const { error } = await this.sb.client.rpc('revisar_transferencia', { p_pedido: t.id, p_llego: llego, p_nota: nota });
    this.ocupado.set(null);
    if (error) return this.toast.error(mensajeError(error));
    this.toast.ok(llego ? `Listo: ${pesos(t.esperado)} confirmada` : 'Marcada como no recibida. Le avisamos a quien la registró.');
    await this.cargar();
  }

  verFotos(t: Transferencia, i: number): void {
    void urlsComprobantes(this.sb.client, t.evidencias).then((urls) =>
      this.visor.abrir(urls.map((url, k) => ({ url, titulo: `${t.cliente ?? 'Cliente'} · ${pesos(t.esperado)}${urls.length > 1 ? ' · ' + (k + 1) : ''}` })), i)
    );
  }

  horas(iso: string): number {
    return (this.ahora() - new Date(iso).getTime()) / 3_600_000;
  }

  hace(iso: string | null): string {
    if (!iso) return '—';
    const min = Math.max(0, Math.floor((this.ahora() - new Date(iso).getTime()) / 60_000));
    if (min < 60) return min <= 1 ? '1 minuto' : `${min} minutos`;
    const h = Math.floor(min / 60);
    if (h < 24) return h === 1 ? '1 hora' : `${h} horas`;
    const d = Math.floor(h / 24);
    return d === 1 ? '1 día' : `${d} días`;
  }

  cuando(iso: string): string {
    return formatoFechaCO(iso, { day: 'numeric', month: 'short' }) + ' ' + formatoHoraCO(iso);
  }
}
