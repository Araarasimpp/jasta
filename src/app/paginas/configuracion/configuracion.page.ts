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
