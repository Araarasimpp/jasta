import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { SupabaseService } from '../../core/services/supabase.service';
import { ToastService } from '../../shared/toast/toast.service';
import { RotulosService } from '../../shared/rotulo/rotulos.service';
import {
  DatosNegocio,
  NEGOCIO_POR_DEFECTO,
  PedidoRotulo,
  ROTULO_CSS_VISTA_PREVIA,
  cargarDatosNegocio,
  documentoRotulos,
  imprimirHtml,
  rotuloHtml,
} from '../../shared/rotulo/rotulo';
import { mensajeError } from '../../shared/formato';
import { TelegramPanelComponent } from '../../shared/telegram/telegram-panel.component';

const EJEMPLO: PedidoRotulo = {
  numero: 23270,
  cliente_nombre: 'María Fernanda López',
  cliente_telefono: '3001234567',
  direccion: 'Cra 40B #48-36, 3 piso',
  barrio: 'El Vallado',
  observaciones: 'Llamar antes de llegar',
  total: 74000,
  created_at: new Date().toISOString(),
  productos: ['Armario en tela X3 negro', 'Zapatero 9 niveles x2'],
};

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [FormsModule, TelegramPanelComponent],
  styles: [
    `
      .wa-campos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 14px; margin-top: 10px; }
      .wa-check { display: flex; gap: 8px; align-items: center; margin: 6px 0 12px; font-size: 14px; }
      .wa-acciones { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
      .wa-acciones .inp { width: 190px; }
      .an-roles { display: flex; flex-wrap: wrap; gap: 0 16px; }
      .an-roles .wa-check { margin: 4px 0; }
      .wa-envios { width: 100%; margin-top: 14px; border-collapse: collapse; font-size: 13px; }
      .wa-envios th { text-align: left; font-size: 11.5px; color: var(--text-muted); font-weight: 650; padding: 6px 4px; border-bottom: 1px solid var(--border); }
      .wa-envios td { padding: 7px 4px; border-bottom: 1px solid var(--border-soft); }
      .wa-envios td.mal { color: var(--danger); }
      @media (max-width: 640px) { .wa-campos { grid-template-columns: 1fr; } }
      .cierre { margin: 12px 0 0; padding: 12px 14px; border-radius: var(--radius); background: var(--surface-2); font-family: inherit; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap; }
      .grid { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 24px; align-items: start; }
      .form { display: flex; flex-direction: column; gap: 14px; max-width: 520px; }
      .previa { border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; background: var(--bg); }
      .previa iframe { display: block; width: 100%; height: 420px; border: 0; }
      .previa p { margin: 0; padding: 10px 14px; font-size: 12px; color: var(--text-soft); background: var(--surface); border-top: 1px solid var(--border); }
      h2 { margin: 0; font-size: 14px; font-weight: 600; }
      .acciones { display: flex; gap: 8px; flex-wrap: wrap; }
      .tg { max-width: 760px; margin-top: 32px; padding-top: 22px; border-top: var(--perfora); }
      .tg > p { margin: 4px 0 6px; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    `,
  ],
  template: `
    <div class="vista">
      <div class="vista-head"><h1>Configuración</h1></div>
      <div class="vista-body">
        <div class="grid">
          <section class="form">
            <h2>Datos del rótulo</h2>
            <p class="ayuda">Lo que sale en la etiqueta de 100 × 100 mm que se pega en cada paquete.</p>
            <div class="campo"><label for="cn">Nombre del negocio</label><input id="cn" [(ngModel)]="datos.nombre_negocio" (ngModelChange)="actualizar()" /></div>
            <div class="campo">
              <label for="ct">Teléfonos</label>
              <input id="ct" [(ngModel)]="datos.telefonos" (ngModelChange)="actualizar()" placeholder="316 0411587 - 320 7774134" />
              <p class="ayuda">Sepáralos con guion; cada uno sale en su propia línea.</p>
            </div>
            <div class="campo"><label for="cr">Redes</label><input id="cr" [(ngModel)]="datos.redes" (ngModelChange)="actualizar()" placeholder="@jastatechnology" /></div>
            <div class="campo"><label for="cg">Texto de garantía</label><textarea id="cg" [(ngModel)]="datos.texto_garantia" (ngModelChange)="actualizar()"></textarea></div>
            <div class="acciones">
              <button class="b b-pri" [disabled]="guardando()" (click)="guardar()">{{ guardando() ? 'Guardando…' : 'Guardar' }}</button>
              <button class="b" (click)="prueba()">Imprimir rótulo de prueba</button>
            </div>
          </section>
          <section>
            <div class="previa">
              <iframe title="Vista previa del rótulo" [srcdoc]="previa()"></iframe>
              <p>Vista previa a tamaño real (100 × 100 mm). Al imprimir, elige la impresora de etiquetas y tamaño 100 × 100 mm.</p>
            </div>
          </section>
        </div>

        <section class="tg">
          <h2>Despacho por Telegram</h2>
          <p class="ayuda">Quien despacha manda la foto del rótulo al grupo de cada mensajero y el pedido se le asigna solo, en el orden de las fotos.</p>
          <app-telegram-panel modo="admin"></app-telegram-panel>
        </section>

        <section class="tg">
          <h2>Seguimiento automático por WhatsApp</h2>
          <p class="ayuda">Cuando un pedido sale en ruta por primera vez, al cliente le llega por WhatsApp (API oficial de Meta) el enlace para ver en qué va su pedido.
            Una sola vez por pedido y solo a celulares colombianos. Meta cobra cada mensaje (categoría Utilidad).</p>
          @if (wa(); as w) {
            <div class="wa-campos">
              <div class="campo"><label for="wa-id">Phone number ID</label><input id="wa-id" [(ngModel)]="waForm.phone_number_id" placeholder="Ej: 123456789012345" /></div>
              <div class="campo"><label for="wa-tk">Token de acceso permanente</label>
                <input id="wa-tk" type="password" autocomplete="off" [(ngModel)]="waForm.token" [placeholder]="w.token_guardado ? 'Guardado · escribe uno nuevo para cambiarlo' : 'Pega el token de Meta'" /></div>
              <div class="campo"><label for="wa-pl">Nombre de la plantilla</label><input id="wa-pl" [(ngModel)]="waForm.plantilla" /></div>
              <div class="campo"><label for="wa-id2">Idioma de la plantilla</label><input id="wa-id2" [(ngModel)]="waForm.idioma" placeholder="es" /></div>
              <div class="campo"><label for="wa-url">Dirección de la app</label><input id="wa-url" [(ngModel)]="waForm.app_url" placeholder="https://…" /></div>
            </div>
            <label class="wa-check"><input type="checkbox" [(ngModel)]="waForm.activo" /> Mandar el enlace automáticamente cuando el pedido sale en ruta</label>
            <div class="wa-acciones">
              <button class="b b-pri" (click)="guardarWa()" [disabled]="waOcupado()">{{ waOcupado() ? 'Guardando…' : 'Guardar' }}</button>
              <input class="inp inp-chico" [(ngModel)]="waPrueba" inputmode="tel" placeholder="Celular para probar" aria-label="Celular para la prueba" />
              <button class="b" (click)="probarWa()" [disabled]="waOcupado() || !w.token_guardado">Enviar prueba</button>
            </div>
            @if (waEnvios().length) {
              <table class="wa-envios">
                <thead><tr><th>Cuándo</th><th>Pedido</th><th>Celular</th><th>Resultado</th></tr></thead>
                <tbody>
                  @for (e of waEnvios(); track $index) {
                    <tr>
                      <td>{{ cuando(e.fecha) }}</td><td>{{ e.pedido_id ? '#' + e.pedido_id : 'Prueba' }}</td><td>{{ e.telefono }}</td>
                      <td [class.mal]="!!e.error">{{ e.error ? e.error : e.codigo ? (e.codigo < 300 ? 'Enviado' : 'Error ' + e.codigo) : 'Enviando…' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          } @else {
            <p class="ayuda">{{ waError() || 'Cargando…' }}</p>
          }
        </section>

        <section class="tg">
          <h2>Avisar una actualización</h2>
          <p class="ayuda">Cuando la app tenga algo nuevo, cuéntaselo al equipo: les llega como notificación (campana y push en el celular).
            Además, a quien tenga la app abierta le sale el botón para cargar la versión nueva.</p>
          <div class="campo"><label for="an-ti">Título</label><input id="an-ti" maxlength="80" [(ngModel)]="anuncio.titulo" placeholder="Ej: Nuevo en Jasta" /></div>
          <div class="campo"><label for="an-cu">Qué cambió</label>
            <textarea id="an-cu" rows="3" maxlength="400" [(ngModel)]="anuncio.cuerpo" placeholder="Ej: Ya pueden elegir el indicativo del país al crear un pedido"></textarea></div>
          <div class="an-roles" role="group" aria-label="A quién">
            @for (r of rolesAnuncio; track r.id) {
              <label class="wa-check"><input type="checkbox" [checked]="anuncio.roles.includes(r.id)" (change)="alternarRol(r.id)" /> {{ r.label }}</label>
            }
          </div>
          <p class="ayuda" style="margin: 0">{{ anuncio.roles.length ? 'Solo a los roles marcados.' : 'Sin marcar ninguno, le llega a todo el equipo.' }}</p>
          <div class="wa-acciones"><button class="b b-pri" (click)="anunciar()" [disabled]="anunciando()">{{ anunciando() ? 'Enviando…' : 'Enviar aviso' }}</button></div>
        </section>

        <section class="tg">
          <h2>Cierre del día por Telegram</h2>
          <p class="ayuda">Todos los días a las 9:00 p. m. le llega al chat privado de cada admin (con su cuenta vinculada al bot) el resumen:
            entregas, ganancia, gastos, utilidad, novedades, lo que falta por despachar, cuadres y comisiones por pagar.</p>
          <button class="b" (click)="enviarCierre()" [disabled]="enviandoCierre()">{{ enviandoCierre() ? 'Enviando…' : 'Enviar el de hoy ahora' }}</button>
          @if (cierre(); as c) {
            <pre class="cierre">{{ c }}</pre>
          }
        </section>
      </div>
    </div>
  `,
})
export class ConfiguracionPage implements OnInit {
  private sb = inject(SupabaseService);
  private toast = inject(ToastService);
  private rotulos = inject(RotulosService);
  private san = inject(DomSanitizer);

  datos: DatosNegocio = { ...NEGOCIO_POR_DEFECTO };
  private version = signal(0);
  guardando = signal(false);
  enviandoCierre = signal(false);

  // ---------- WhatsApp (seguimiento automático)
  wa = signal<{ phone_number_id: string | null; token_guardado: boolean; plantilla: string; idioma: string; app_url: string | null; activo: boolean } | null>(null);
  waForm = { phone_number_id: '', token: '', plantilla: 'seguimiento_pedido', idioma: 'es', app_url: '', activo: false };
  waEnvios = signal<{ fecha: string; pedido_id: number | null; tipo: string; telefono: string; codigo: number | null; error: string | null }[]>([]);
  waOcupado = signal(false);
  waError = signal('');
  waPrueba = '';

  private async cargarWa(): Promise<void> {
    const [c, e] = await Promise.all([this.sb.client.rpc('whatsapp_config_leer'), this.sb.client.rpc('whatsapp_envios_recientes')]);
    if (c.error) return this.waError.set('No se pudo leer la configuración de WhatsApp: ' + c.error.message);
    const w = c.data as NonNullable<ReturnType<typeof this.wa>>;
    this.wa.set(w);
    this.waForm = { phone_number_id: w.phone_number_id ?? '', token: '', plantilla: w.plantilla, idioma: w.idioma, app_url: w.app_url ?? location.origin, activo: w.activo };
    this.waEnvios.set((e.data ?? []) as ReturnType<typeof this.waEnvios>);
  }

  async guardarWa(): Promise<void> {
    this.waOcupado.set(true);
    const f = this.waForm;
    const { error } = await this.sb.client.rpc('whatsapp_config_guardar', {
      p_phone_number_id: f.phone_number_id, p_token: f.token || null, p_plantilla: f.plantilla, p_idioma: f.idioma, p_app_url: f.app_url, p_activo: f.activo,
    });
    this.waOcupado.set(false);
    if (error) return this.toast.error(error.message);
    this.toast.ok(f.activo ? 'Guardado: el enlace se manda solo cuando el pedido sale en ruta' : 'Guardado (apagado)');
    await this.cargarWa();
  }

  async probarWa(): Promise<void> {
    this.waOcupado.set(true);
    const { error } = await this.sb.client.rpc('whatsapp_probar', { p_telefono: this.waPrueba });
    this.waOcupado.set(false);
    if (error) return this.toast.error(error.message);
    this.toast.ok('Prueba enviada: en unos segundos aparece el resultado abajo');
    setTimeout(() => void this.cargarWa(), 4000);
  }

  cuando(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
  // ---------- Avisos de actualización
  rolesAnuncio = [
    { id: 'admin', label: 'Admins' }, { id: 'vendedora', label: 'Vendedoras' }, { id: 'mensajero', label: 'Mensajeros' },
    { id: 'alistador', label: 'Alistadores' }, { id: 'cuadres', label: 'Cuadres' }, { id: 'recolector', label: 'Recolectores' },
    { id: 'venta_local', label: 'Venta local' },
  ];
  anuncio = { titulo: 'Nuevo en Jasta', cuerpo: '', roles: [] as string[] };
  anunciando = signal(false);

  alternarRol(r: string): void {
    const l = this.anuncio.roles;
    this.anuncio.roles = l.includes(r) ? l.filter((x) => x !== r) : [...l, r];
  }

  async anunciar(): Promise<void> {
    const a = this.anuncio;
    if (!a.titulo.trim() || !a.cuerpo.trim()) return this.toast.error('Escribe el título y qué cambió');
    if (!confirm(`¿Enviar este aviso a ${a.roles.length ? 'los roles marcados' : 'todo el equipo'}?`)) return;
    this.anunciando.set(true);
    const { data, error } = await this.sb.client.rpc('anunciar_actualizacion', { p_titulo: a.titulo.trim(), p_cuerpo: a.cuerpo.trim(), p_roles: a.roles });
    this.anunciando.set(false);
    if (error) return this.toast.error(error.message);
    this.toast.ok(`Aviso enviado a ${data} ${data === 1 ? 'persona' : 'personas'}`);
    this.anuncio = { ...a, cuerpo: '' };
  }

  cierre = signal('');

  async enviarCierre(): Promise<void> {
    this.enviandoCierre.set(true);
    const { data, error } = await this.sb.client.rpc('enviar_cierre_dia_ahora');
    this.enviandoCierre.set(false);
    if (error) return this.toast.error(error.message);
    const r = data as { enviados: number; texto: string };
    this.cierre.set(r.texto);
    if (r.enviados) this.toast.ok(r.enviados === 1 ? 'Enviado a 1 admin por Telegram' : `Enviado a ${r.enviados} admins por Telegram`);
    else this.toast.error('Ningún admin tiene Telegram vinculado (Mi perfil → Telegram) o el bot no está conectado.');
  }

  previa = computed<SafeHtml>(() => {
    this.version();
    return this.san.bypassSecurityTrustHtml(documentoRotulos([rotuloHtml(EJEMPLO, this.datos)], 'Vista previa', ROTULO_CSS_VISTA_PREVIA));
  });

  async ngOnInit(): Promise<void> {
    void this.cargarWa();
    this.datos = await cargarDatosNegocio(this.sb.client);
    this.actualizar();
  }

  actualizar(): void {
    this.version.update((v) => v + 1);
  }

  async guardar(): Promise<void> {
    this.guardando.set(true);
    const { error } = await this.sb.client
      .from('configuracion')
      .update({
        nombre_negocio: this.datos.nombre_negocio?.trim() || NEGOCIO_POR_DEFECTO.nombre_negocio,
        telefonos: this.datos.telefonos?.trim() || null,
        redes: this.datos.redes?.trim() || null,
        texto_garantia: this.datos.texto_garantia?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', true);
    this.guardando.set(false);
    if (error) return this.toast.error(mensajeError(error));
    this.rotulos.refrescar();
    this.toast.ok('Configuración guardada');
  }

  prueba(): void {
    imprimirHtml(documentoRotulos([rotuloHtml(EJEMPLO, this.datos)], 'Rótulo de prueba'));
  }
}
