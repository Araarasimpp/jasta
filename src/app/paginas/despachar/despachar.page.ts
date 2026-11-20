import { Component, ElementRef, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { alertCircle, cameraOutline, closeCircleOutline, checkmarkCircle, informationCircle, pauseOutline, qrCodeOutline, refreshOutline, sendOutline } from 'ionicons/icons';
import { SupabaseService } from '../../core/services/supabase.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { JybService, ResultadoDespacho } from '../../core/services/jyb.service';
import { Usuario } from '../../shared/modelos';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { microsAsignado } from '../../shared/fecha-colombia';
import { mensajeError } from '../../shared/formato';
import { pedirCamara, soltarCamara } from '../../shared/medios';
import { haceCuanto } from '../../core/services/presencia.service';

type Negocio = 'jasta' | 'jyb';
interface Lectura { negocio: Negocio; numero: number }
interface Resultado { clave: number; negocio: Negocio; numero: number; tipo: 'ok' | 'info' | 'error'; texto: string; hora: string; quitado?: boolean }
interface Devolucion { novedad: number; pedido: number; cliente: string; barrio: string | null; mensajero: string; motivo: string; detalle: string | null; estado: string; cuando: string }
interface Parada { clave: string; negocio: Negocio; numero: number; cliente: string; barrio: string | null; cuando: number }

const CLAVE_MENSAJERO = 'jasta-despachar-mensajero';

/** Lee el número del QR del rótulo: "JASTA-23345" (o un enlace ...?id=23345) y "KAESURI-215" de Variedades JYB */
export function leerRotulo(texto: string): Lectura | null {
  const k = texto.match(/KAESURI[\s:#-]*(\d{1,9})/i);
  if (k) return { negocio: 'jyb', numero: Number(k[1]) };
  const j = texto.match(/JASTA[\s:#-]*(\d{1,9})/i) ?? texto.match(/[?&]id=(\d{1,9})/);
  return j ? { negocio: 'jasta', numero: Number(j[1]) } : null;
}

/**
 * Despachar con QR (reemplaza a los bots de Telegram): quien despacha elige el mensajero,
 * abre la cámara y va escaneando los rótulos de Jasta y de Variedades JYB. Cada uno se le
 * asigna al mensajero en el orden en que se escanea, y su ruta (de los dos negocios) queda
 * en ese mismo orden, como cuando se mandaban las fotos al grupo de Telegram.
 */
@Component({
  selector: 'app-despachar',
  standalone: true,
  imports: [FormsModule, IonIcon, AvatarComponent],
  styleUrls: ['../../shared/ui.scss'],
  styles: [
    `
      .page { max-width: 640px; gap: 16px; }
      .modo { align-self: stretch; display: grid !important; grid-template-columns: 1fr 1fr; }
      .modo button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px !important; }
      .cuenta { min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: var(--danger); color: #fff; font-size: 11.5px; font-weight: 700; line-height: 20px; }
      .ruta.devs li { grid-template-columns: auto minmax(0, 1fr) auto; }
      .b-recibir { height: 34px; padding: 0 12px; font-size: 13px; }
      .mens { display: flex; gap: 8px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: none; }
      .mens button { flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 5px; width: 78px; padding: 8px 4px; cursor: pointer;
        border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text-soft); font: inherit; font-size: 12.5px; font-weight: 600; }
      .mens button span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .mens button.on { border-color: var(--accent); color: var(--text); box-shadow: 0 0 0 3px var(--accent-wash); }
      .tit { margin: 0 0 8px; font-size: 13px; font-weight: 650; color: var(--text-soft); }

      .camara { position: relative; aspect-ratio: 1; max-height: 62vh; width: 100%; border-radius: 22px; overflow: hidden; background: #0b0d12; display: grid; place-items: center; }
      .camara video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .marco { position: absolute; inset: 16%; border-radius: 22px; pointer-events: none;
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35); border: 3px solid rgba(255, 255, 255, 0.85); transition: border-color 160ms ease, transform 160ms ease; }
      .marco.ok { border-color: #23a55a; transform: scale(1.03); }
      .marco.error { border-color: #ef4444; }
      .camara .apagada { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; text-align: center; color: #e5e7eb; font-size: 14px; }
      .camara .apagada ion-icon { font-size: 44px; opacity: 0.8; }
      .estado-cam { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
      .pildora { padding: 7px 12px; border-radius: 999px; background: rgba(0, 0, 0, 0.55); color: #fff; font-size: 13px; font-weight: 600;
        -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
      .pildora.btn { border: 0; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13px; font-weight: 600; }

      .ultimo { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border-radius: 18px; font-size: 15px; line-height: 1.4; white-space: pre-line; animation: entra 220ms ease-out; }
      .ultimo ion-icon { font-size: 24px; flex-shrink: 0; }
      .ultimo.ok { background: color-mix(in srgb, #23a55a 16%, var(--surface)); color: var(--text); }
      .ultimo.ok ion-icon { color: #23a55a; }
      .ultimo.info { background: var(--surface-2); color: var(--text); }
      .ultimo.info ion-icon { color: var(--text-soft); }
      .ultimo.error { background: color-mix(in srgb, var(--danger) 14%, var(--surface)); color: var(--text); }
      .ultimo.error ion-icon { color: var(--danger); }
      @keyframes entra { from { opacity: 0; transform: translateY(6px) scale(0.98); } }

      .manual { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .manual input { flex: 1; min-width: 0; width: 100px; }
      .seg { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--surface-2); }
      .seg button { border: 0; background: none; padding: 7px 12px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; color: var(--text-soft); cursor: pointer; }
      .seg button.on { background: var(--surface); color: var(--text); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12); }

      .ruta { list-style: none; margin: 0; padding: 0; border-radius: 18px; background: var(--surface); border: 1px solid var(--border); overflow: hidden; }
      .ruta li { display: grid; grid-template-columns: 28px auto minmax(0, 1fr) auto; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; font-size: 14.5px; }
      .quitar { width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 50%; background: none; color: var(--text-muted); font-size: 20px; cursor: pointer; }
      .quitar:active { background: var(--hover); color: var(--danger); }
      .quitar:disabled { opacity: 0.4; }
      .ultimo .deshacer { margin-left: auto; align-self: center; flex-shrink: 0; border: 0; background: none; color: var(--accent); font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; padding: 4px 2px; }
      .ruta li + li { border-top: 1px solid var(--border); }
      .ruta .n { font-weight: 750; color: var(--text-soft); text-align: right; }
      .ruta .tag { font-size: 11px; font-weight: 700; padding: 3px 7px; border-radius: 999px; background: var(--surface-2); color: var(--text-soft); }
      .ruta .tag.jyb { background: color-mix(in srgb, #8b5cf6 18%, var(--surface)); color: #7c3aed; }
      .ruta .cli { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ruta .cli small { color: var(--text-muted); }
      .ruta li.nuevo { animation: entra 300ms ease-out; background: color-mix(in srgb, #23a55a 8%, transparent); }
      .vacio { margin: 0; padding: 16px; text-align: center; color: var(--text-soft); font-size: 14px; }
      .aviso-jyb { margin: 0; font-size: 12.5px; color: var(--text-muted); }
      .cab { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    `,
  ],
  template: `
    <div class="page">
      <div class="modo seg" role="tablist" aria-label="Qué vas a hacer">
        <button type="button" role="tab" [class.on]="modo() === 'despachar'" [attr.aria-selected]="modo() === 'despachar'" (click)="cambiarModo('despachar')">Despachar</button>
        <button type="button" role="tab" [class.on]="modo() === 'recibir'" [attr.aria-selected]="modo() === 'recibir'" (click)="cambiarModo('recibir')">
          Recibir devoluciones@if (devoluciones().length) { <span class="cuenta">{{ devoluciones().length }}</span> }</button>
      </div>

      @if (modo() === 'despachar') {
      <section>
        <p class="tit">¿A quién le despachas?</p>
        <div class="mens" role="radiogroup" aria-label="Mensajero">
          @for (m of mensajeros(); track m.id) {
            <button type="button" role="radio" [class.on]="mensajero()?.id === m.id" [attr.aria-checked]="mensajero()?.id === m.id" (click)="elegir(m)">
              <app-avatar [nombre]="m.nombre" [foto]="m.avatar_url" [usuario]="m.id" [tam]="40"></app-avatar>
              <span>{{ m.nombre.split(' ')[0] }}</span>
            </button>
          } @empty {
            <p class="vacio">No hay mensajeros activos.</p>
          }
        </div>
      </section>
      }

      <div class="camara">
        <video #video playsinline muted [hidden]="!camaraOn()"></video>
        @if (camaraOn()) {
          <div class="marco" [class.ok]="destello() === 'ok'" [class.error]="destello() === 'error'"></div>
        } @else {
          <div class="apagada">
            <ion-icon name="qr-code-outline"></ion-icon>
            @if (errorCamara(); as e) { <span>{{ e }}</span> } @else if (modo() === 'recibir') { <span>Escanea el rótulo de cada pedido que el mensajero trae de vuelta a la bodega.</span> } @else { <span>Escanea el QR de cada rótulo, de Jasta o de Variedades JYB.<br />Se asignan en el orden en que los escaneas.</span> }
            <button type="button" class="b b-pri" [disabled]="modo() === 'despachar' && !mensajero()" (click)="abrirCamara()"><ion-icon name="camera-outline"></ion-icon>{{ modo() === 'recibir' || mensajero() ? 'Abrir cámara' : 'Primero elige el mensajero' }}</button>
          </div>
        }
        @if (camaraOn()) {
          <div class="estado-cam">
            <span class="pildora">{{ enCola() ? (modo() === 'recibir' ? 'Recibiendo…' : 'Asignando…') : 'Apunta al QR del rótulo' }}</span>
            <button type="button" class="pildora btn" (click)="cerrarCamara()"><ion-icon name="pause-outline"></ion-icon>Pausar</button>
          </div>
        }
      </div>

      @if (ultimo(); as u) {
        <div class="ultimo" [class]="'ultimo ' + u.tipo" role="status" aria-live="polite">
          <ion-icon [name]="u.tipo === 'ok' ? 'checkmark-circle' : u.tipo === 'info' ? 'information-circle' : 'alert-circle'"></ion-icon>
          <span>{{ u.texto }}</span>
          @if (u.tipo === 'ok' && u.numero && !u.quitado && modo() === 'despachar') {
            <button type="button" class="deshacer" (click)="deshacer(u)">Deshacer</button>
          }
        </div>
      }

      @if (modo() === 'recibir') {
        <form class="manual" (ngSubmit)="recibirManual()">
          <input class="inp" name="numr" inputmode="numeric" placeholder="N.º del pedido si no lee" [(ngModel)]="numeroManual" aria-label="Número del pedido devuelto" />
          <button type="submit" class="b" [disabled]="!numeroManual.trim()"><ion-icon name="checkmark-circle"></ion-icon>Recibir</button>
        </form>
        <section>
          <div class="cab">
            <p class="tit">Por recibir en bodega ({{ devoluciones().length }})</p>
            <button type="button" class="b b-icono" aria-label="Actualizar" (click)="cargarDevoluciones()"><ion-icon name="refresh-outline"></ion-icon></button>
          </div>
          @if (devoluciones().length) {
            <ul class="ruta devs">
              @for (d of devoluciones(); track d.novedad) {
                <li>
                  <span class="tag">#{{ d.pedido }}</span>
                  <span class="cli">{{ d.cliente }}<small> · {{ d.mensajero }} · {{ d.motivo }} · {{ haceCuanto(d.cuando) }}</small></span>
                  <button type="button" class="b b-recibir" [disabled]="enCola() > 0" (click)="encolarRecibir(d.pedido)">Recibido</button>
                </li>
              }
            </ul>
          } @else {
            <p class="vacio">No hay pedidos devueltos pendientes por recibir.</p>
          }
          <p class="aviso-jyb">Aquí salen los pedidos de Jasta que un mensajero devolvió con "No se pudo". Al recibirlos quedan en Alistados, listos para despacharlos otra vez.</p>
        </section>
      } @else {
      <form class="manual" (ngSubmit)="asignarManual()">
        <div class="seg" role="radiogroup" aria-label="Negocio">
          <button type="button" role="radio" [class.on]="negocioManual() === 'jasta'" [attr.aria-checked]="negocioManual() === 'jasta'" (click)="negocioManual.set('jasta')">Jasta</button>
          <button type="button" role="radio" [class.on]="negocioManual() === 'jyb'" [attr.aria-checked]="negocioManual() === 'jyb'" (click)="negocioManual.set('jyb')">JYB</button>
        </div>
        <input class="inp" name="num" inputmode="numeric" placeholder="N.º si no lee" [(ngModel)]="numeroManual" aria-label="Número del pedido" />
        <button type="submit" class="b" [disabled]="!mensajero() || !numeroManual.trim()"><ion-icon name="send-outline"></ion-icon>Asignar</button>
      </form>

      @if (mensajero(); as m) {
        <section>
          <div class="cab">
            <p class="tit">Ruta de {{ m.nombre }} ({{ ruta().length }})</p>
            <button type="button" class="b b-icono" aria-label="Actualizar ruta" (click)="cargarRuta()"><ion-icon name="refresh-outline"></ion-icon></button>
          </div>
          @if (ruta().length) {
            <ol class="ruta">
              @for (p of ruta(); track p.clave; let i = $index) {
                <li [class.nuevo]="p.clave === nuevo()">
                  <span class="n">{{ i + 1 }}.</span>
                  <span class="tag" [class.jyb]="p.negocio === 'jyb'">{{ p.negocio === 'jyb' ? 'JYB' : 'Jasta' }} #{{ p.numero }}</span>
                  <span class="cli">{{ p.cliente }}@if (p.barrio) { <small> · {{ p.barrio }}</small> }</span>
                  <button type="button" class="quitar" [disabled]="quitando() === p.clave" (click)="quitar(p)"
                    [attr.aria-label]="'Quitar ' + (p.negocio === 'jyb' ? 'JYB' : 'Jasta') + ' #' + p.numero + ' de la ruta'" title="Quitar de la ruta">
                    <ion-icon name="close-circle-outline"></ion-icon></button>
                </li>
              }
            </ol>
          } @else {
            <p class="vacio">{{ cargandoRuta() ? 'Cargando ruta…' : 'No lleva pedidos en ruta.' }}</p>
          }
          @if (avisoJyb(); as a) { <p class="aviso-jyb">{{ a }}</p> }
        </section>
      }
      }
    </div>
  `,
})
export class DespacharPage implements OnInit, OnDestroy {
  private sb = inject(SupabaseService);
  private ps = inject(PedidosService);
  private jyb = inject(JybService);
  private video = viewChild<ElementRef<HTMLVideoElement>>('video');

  mensajeros = signal<Usuario[]>([]);
  mensajero = signal<Usuario | null>(null);
  camaraOn = signal(false);
  errorCamara = signal('');
  destello = signal<'ok' | 'error' | null>(null);
  ultimo = signal<Resultado | null>(null);
  enCola = signal(0);
  negocioManual = signal<Negocio>('jasta');
  numeroManual = '';

  private rutaJasta = signal<Parada[]>([]);
  private rutaJyb = signal<Parada[]>([]);
  cargandoRuta = signal(false);
  avisoJyb = signal('');
  nuevo = signal('');
  quitando = signal('');
  /** Ruta combinada de los dos negocios, en el orden en que se asignaron */
  ruta = computed(() => [...this.rutaJasta(), ...this.rutaJyb()].sort((a, b) => a.cuando - b.cuando));

  private stream: MediaStream | null = null;
  private lector: ((v: HTMLVideoElement) => Promise<string | null>) | null = null;
  private corriendo = false;
  private ultimoTexto = '';
  private ultimoCuando = 0;
  /** Los escaneos se asignan uno tras otro: así la hora de asignación sigue el orden del escaneo */
  private cola: Promise<void> = Promise.resolve();
  private audio?: AudioContext;
  private contador = 0;

  constructor() {
    addIcons({ alertCircle, cameraOutline, closeCircleOutline, checkmarkCircle, informationCircle, pauseOutline, qrCodeOutline, refreshOutline, sendOutline });
  }

  async ngOnInit(): Promise<void> {
    void this.cargarDevoluciones();
    try {
      const lista = await this.ps.mensajeros();
      this.mensajeros.set(lista);
      const guardado = Number(localStorage.getItem(CLAVE_MENSAJERO));
      const m = lista.find((x) => x.id === guardado);
      if (m) this.elegir(m);
    } catch (e) {
      this.ultimo.set(this.resultado('jasta', 0, 'error', mensajeError(e)));
    }
  }

  ngOnDestroy(): void {
    this.cerrarCamara();
    void this.audio?.close();
  }

  elegir(m: Usuario): void {
    if (this.mensajero()?.id === m.id) return;
    this.mensajero.set(m);
    this.ultimo.set(null);
    try { localStorage.setItem(CLAVE_MENSAJERO, String(m.id)); } catch { /* sin almacenamiento */ }
    void this.cargarRuta();
  }

  async cargarRuta(): Promise<void> {
    const m = this.mensajero();
    if (!m) return;
    this.cargandoRuta.set(true);
    const jasta = this.sb.client
      .from('pedidos')
      .select('id, cliente_nombre, barrio, asignado_at')
      .eq('estado', 'despachado')
      .eq('mensajero_id', m.id)
      .then(({ data }) => {
        if (this.mensajero()?.id !== m.id) return;
        this.rutaJasta.set(
          ((data ?? []) as { id: number; cliente_nombre: string; barrio: string | null; asignado_at: string | null }[]).map((p) => ({
            clave: 'j' + p.id, negocio: 'jasta', numero: p.id, cliente: p.cliente_nombre, barrio: p.barrio, cuando: microsAsignado(p.asignado_at),
          }))
        );
      });
    const jyb = this.jyb
      .rutaDe(m.id)
      .then((r) => {
        if (this.mensajero()?.id !== m.id) return;
        this.avisoJyb.set(r.vinculado ? '' : 'Este mensajero no tiene cuenta de domiciliario en Variedades JYB con el mismo correo: sus rótulos de JYB no se le pueden asignar.');
        this.rutaJyb.set(
          r.en_ruta.map((p) => ({
            clave: 'k' + p.id, negocio: 'jyb', numero: p.numero, cliente: p.cliente_nombre, barrio: p.barrio, cuando: microsAsignado(p.asignado_at ?? p.created_at),
          }))
        );
      })
      .catch(() => {
        this.rutaJyb.set([]);
        this.avisoJyb.set('No se pudo traer la ruta de Variedades JYB.');
      });
    await Promise.all([jasta, jyb]);
    this.cargandoRuta.set(false);
  }

  // ------------------------------------------------------------------ Cámara

  async abrirCamara(): Promise<void> {
    this.errorCamara.set('');
    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set('Este navegador no deja usar la cámara. Escribe el número del pedido abajo.');
      return;
    }
    try {
      // Reutiliza la cámara ya autorizada (en iPhone no vuelve a pedir permiso cada vez)
      this.stream = await pedirCamara();
    } catch {
      this.errorCamara.set('No se pudo abrir la cámara. Dale permiso a la app para usar la cámara y vuelve a intentar.');
      return;
    }
    this.camaraOn.set(true);
    // Se crea el sonido con el toque (en iPhone no suena si se crea después)
    try { this.audio ??= new AudioContext(); void this.audio.resume(); } catch { /* sin sonido */ }
    await new Promise((r) => setTimeout(r));
    const v = this.video()?.nativeElement;
    if (!v) return;
    v.srcObject = this.stream;
    await v.play().catch(() => undefined);
    this.lector ??= await crearLector();
    this.corriendo = true;
    void this.bucle(v);
  }

  cerrarCamara(): void {
    this.corriendo = false;
    if (this.stream) soltarCamara();
    this.stream = null;
    const v = this.video()?.nativeElement;
    if (v) v.srcObject = null;
    this.camaraOn.set(false);
  }

  private async bucle(v: HTMLVideoElement): Promise<void> {
    while (this.corriendo) {
      if (v.readyState >= 2 && this.lector) {
        const texto = await this.lector(v).catch(() => null);
        if (texto) this.leido(texto);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  /** Un QR leído: el mismo rótulo frente a la cámara no se vuelve a contar en 4 segundos */
  private leido(texto: string): void {
    const ahora = Date.now();
    if (texto === this.ultimoTexto && ahora - this.ultimoCuando < 4000) {
      this.ultimoCuando = ahora;
      return;
    }
    this.ultimoTexto = texto;
    this.ultimoCuando = ahora;
    const l = leerRotulo(texto);
    if (!l) {
      this.mostrar(this.resultado('jasta', 0, 'error', 'Este QR no es de un rótulo de Jasta ni de Variedades JYB.'));
      return;
    }
    if (this.modo() === 'recibir') {
      if (l.negocio === 'jyb') this.mostrar(this.resultado('jyb', l.numero, 'info', 'El JYB #' + l.numero + ' es de Variedades JYB: las devoluciones de JYB se reciben en su app.'));
      else this.encolarRecibir(l.numero);
      return;
    }
    this.encolar(l);
  }

  // ------------------------------------------------------------------ Recibir devoluciones

  modo = signal<'despachar' | 'recibir'>('despachar');
  devoluciones = signal<Devolucion[]>([]);
  /** "hace 20 min", "ayer", "el 12 de nov." */
  haceCuanto(iso: string): string {
    return haceCuanto(iso).replace(/^visto /, '');
  }

  cambiarModo(m: 'despachar' | 'recibir'): void {
    if (this.modo() === m) return;
    this.modo.set(m);
    this.ultimo.set(null);
    this.numeroManual = '';
    if (m === 'recibir') void this.cargarDevoluciones();
  }

  async cargarDevoluciones(): Promise<void> {
    const { data, error } = await this.sb.client.rpc('devoluciones_por_recibir');
    if (!error) this.devoluciones.set((data as Devolucion[]) ?? []);
  }

  recibirManual(): void {
    const n = Number(this.numeroManual.replace(/\D/g, ''));
    if (!n) return;
    this.numeroManual = '';
    this.encolarRecibir(n);
  }

  encolarRecibir(numero: number): void {
    this.enCola.update((x) => x + 1);
    this.cola = this.cola.then(async () => {
      try {
        const { data, error } = await this.sb.client.rpc('recibir_devolucion', { p_pedido: numero });
        if (error) throw error;
        const r = data as ResultadoDespacho;
        this.mostrar(this.resultado('jasta', numero, r.ok ? 'ok' : r.repetido ? 'info' : 'error', r.texto));
        if (r.ok) await this.cargarDevoluciones();
      } catch (e) {
        this.mostrar(this.resultado('jasta', numero, 'error', mensajeError(e)));
      } finally {
        this.enCola.update((x) => x - 1);
      }
    });
  }

  asignarManual(): void {
    const n = Number(this.numeroManual.replace(/\D/g, ''));
    if (!n) return;
    this.numeroManual = '';
    this.encolar({ negocio: this.negocioManual(), numero: n });
  }

  private encolar(l: Lectura): void {
    const m = this.mensajero();
    if (!m) return;
    this.enCola.update((x) => x + 1);
    this.cola = this.cola.then(async () => {
      try {
        const r: ResultadoDespacho =
          l.negocio === 'jyb'
            ? await this.jyb.asignar(m.id, l.numero)
            : ((await this.sb.client.rpc('despachar_por_qr', { p_mensajero: m.id, p_pedido: l.numero }).then(({ data, error }) => {
                if (error) throw error;
                return data;
              })) as ResultadoDespacho);
        this.mostrar(this.resultado(l.negocio, l.numero, r.ok ? 'ok' : r.repetido ? 'info' : 'error', r.texto));
        if (r.ok) {
          this.nuevo.set((l.negocio === 'jyb' ? 'k' : 'j') + l.numero);
          await this.cargarRuta();
          // En JYB la clave de la ruta es el id (uuid): se marca por número
          if (l.negocio === 'jyb') this.nuevo.set(this.rutaJyb().find((p) => p.numero === l.numero)?.clave ?? '');
        }
      } catch (e) {
        this.mostrar(this.resultado(l.negocio, l.numero, 'error', mensajeError(e)));
      } finally {
        this.enCola.update((x) => x - 1);
      }
    });
  }

  /** Se escaneó por error: sale de la ruta (Jasta vuelve a Alistados, JYB a pendientes) */
  async quitar(p: Parada): Promise<void> {
    const m = this.mensajero();
    if (!m || this.quitando()) return;
    const nombre = (p.negocio === 'jyb' ? 'JYB' : 'Jasta') + ' #' + p.numero;
    if (!confirm(`¿Quitar ${nombre} (${p.cliente}) de la ruta de ${m.nombre}?`)) return;
    this.quitando.set(p.clave);
    await this.sacar(m, p.negocio, p.numero);
    this.quitando.set('');
  }

  /** "Deshacer" en el aviso del último escaneo */
  async deshacer(u: Resultado): Promise<void> {
    const m = this.mensajero();
    if (!m) return;
    u.quitado = true;
    this.ultimo.set({ ...u });
    await this.sacar(m, u.negocio, u.numero);
  }

  private async sacar(m: Usuario, negocio: Negocio, numero: number): Promise<void> {
    // Va en la misma fila que los escaneos, para no cruzarse con uno que se esté asignando
    this.cola = this.cola.then(async () => {
      try {
        const r: ResultadoDespacho =
          negocio === 'jyb'
            ? await this.jyb.quitar(m.id, numero)
            : ((await this.sb.client.rpc('quitar_de_ruta', { p_mensajero: m.id, p_pedido: numero }).then(({ data, error }) => {
                if (error) throw error;
                return data;
              })) as ResultadoDespacho);
        this.ultimo.set({ ...this.resultado(negocio, numero, r.ok ? 'info' : 'error', r.texto), quitado: true });
        await this.cargarRuta();
      } catch (e) {
        this.ultimo.set(this.resultado(negocio, numero, 'error', mensajeError(e)));
      }
    });
    await this.cola;
  }

  private resultado(negocio: Negocio, numero: number, tipo: Resultado['tipo'], texto: string): Resultado {
    return { clave: ++this.contador, negocio, numero, tipo, texto, hora: new Date().toISOString() };
  }

  /** Muestra el resultado con color en el marco, vibración y un pitido (agudo si salió bien) */
  private mostrar(r: Resultado): void {
    this.ultimo.set(r);
    this.destello.set(r.tipo === 'error' ? 'error' : 'ok');
    setTimeout(() => this.destello.set(null), 700);
    try { navigator.vibrate?.(r.tipo === 'error' ? [60, 60, 60] : 70); } catch { /* sin vibración */ }
    this.pitido(r.tipo === 'error' ? 220 : r.tipo === 'info' ? 520 : 880);
  }

  private pitido(frecuencia: number): void {
    const a = this.audio;
    if (!a) return;
    try {
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = frecuencia;
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, a.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.16);
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.18);
    } catch { /* sin sonido */ }
  }
}

/**
 * Lector de QR del video: el del celular (BarcodeDetector, Android y Chrome) si existe;
 * si no (iPhone), jsQR sobre el cuadro de la cámara, probando también el centro ampliado.
 */
async function crearLector(): Promise<(v: HTMLVideoElement) => Promise<string | null>> {
  const BD = (globalThis as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): { detect(s: CanvasImageSource): Promise<{ rawValue: string }[]> }; getSupportedFormats?(): Promise<string[]> } }).BarcodeDetector;
  if (BD) {
    try {
      const formatos = (await BD.getSupportedFormats?.()) ?? [];
      if (formatos.includes('qr_code')) {
        const d = new BD({ formats: ['qr_code'] });
        return async (v) => (await d.detect(v))[0]?.rawValue ?? null;
      }
    } catch { /* se usa jsQR */ }
  }
  const jsQR = (await import('jsqr')).default;
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  let vuelta = 0;
  return async (v) => {
    const w = v.videoWidth, h = v.videoHeight;
    if (!w || !h) return null;
    // Un cuadro entero (reducido) y, una vuelta sí y otra no, el centro sin reducir (QR pequeños o lejos)
    const centro = vuelta++ % 2 === 1;
    const lado = Math.min(w, h);
    const sx = centro ? (w - lado * 0.6) / 2 : 0, sy = centro ? (h - lado * 0.6) / 2 : 0;
    const sw = centro ? lado * 0.6 : w, sh = centro ? lado * 0.6 : h;
    const escala = Math.min(1, 720 / Math.max(sw, sh));
    lienzo.width = Math.round(sw * escala);
    lienzo.height = Math.round(sh * escala);
    ctx.drawImage(v, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
    const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
  };
}
