import { Component, ElementRef, EventEmitter, Input, OnDestroy, Output, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { arrowBackOutline, locate, locationSharp, searchOutline } from 'ionicons/icons';
import { CENTRO, MapasService } from './mapas.service';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface UbicacionElegida {
  lat: number;
  lng: number;
  /** Dirección que da el mapa en ese punto (null si el usuario no la quiere usar) */
  direccion: string | null;
}

/**
 * Debajo del campo de dirección: "Ubicar en el mapa". Abre un mapa a pantalla completa con
 * un pin fijo en el centro; se mueve el mapa hasta la puerta exacta y se confirma.
 * Si Google no encuentra la dirección escrita, igual se puede buscar el punto a mano.
 */
@Component({
  selector: 'app-ubicar-mapa',
  standalone: true,
  imports: [FormsModule, IonIcon],
  styles: [
    `
      :host { display: block; }
      .linea { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; font-size: 13px; }
      .abrir { all: unset; display: inline-flex; align-items: center; gap: 5px; padding: 6px 11px; border: 1px solid var(--border-strong); border-radius: 999px;
        background: var(--surface); color: var(--accent); font-weight: 600; cursor: pointer; }
      .abrir ion-icon { font-size: 16px; }
      .ok { display: inline-flex; align-items: center; gap: 4px; color: var(--efectivo-texto, #15803d); font-weight: 600; }
      .link { all: unset; color: var(--accent); font-weight: 600; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
      .link.gris { color: var(--text-muted); }

      .capa { position: fixed; inset: 0; z-index: 1000; display: flex; flex-direction: column; background: var(--bg); color: var(--text); font-family: inherit; }
      .cab { display: flex; align-items: center; gap: 8px; padding: calc(8px + env(safe-area-inset-top)) 10px 8px; border-bottom: 1px solid var(--border); background: var(--bg); }
      .cab form { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; padding: 0 4px 0 12px; border: 1px solid var(--border-strong); border-radius: 999px; background: var(--surface-2); }
      .cab input { flex: 1; min-width: 0; height: 40px; border: 0; background: none; color: var(--text); font: inherit; font-size: 16px; outline: none; }
      .redondo { all: unset; width: 38px; height: 38px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; color: var(--text-soft); font-size: 21px; cursor: pointer; }
      .zona { position: relative; flex: 1; min-height: 0; }
      .mapa { position: absolute; inset: 0; }
      /* El pin queda fijo en el centro: lo que se mueve es el mapa */
      .pin { position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; margin: -44px 0 0 -22px; pointer-events: none; color: #e11d48;
        filter: drop-shadow(0 3px 3px rgba(0, 0, 0, .35)); transition: transform .15s ease; }
      .pin.arriba { transform: translateY(-10px); }
      .pin ion-icon { width: 100%; height: 100%; }
      .sombra { position: absolute; left: 50%; top: 50%; width: 10px; height: 4px; margin: -2px 0 0 -5px; border-radius: 50%; background: rgba(0, 0, 0, .35); pointer-events: none; }
      .yo { position: absolute; right: 14px; bottom: 14px; width: 46px; height: 46px; display: grid; place-items: center; border: 0; border-radius: 50%;
        background: var(--surface); color: var(--accent); font-size: 22px; box-shadow: 0 2px 10px rgba(0, 0, 0, .25); cursor: pointer; }
      .aviso { position: absolute; left: 50%; top: 12px; transform: translateX(-50%); max-width: calc(100% - 24px); padding: 7px 12px; border-radius: 10px;
        background: rgba(15, 23, 42, .85); color: #fff; font-size: 13px; text-align: center; }
      .pie { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid var(--border); background: var(--bg); }
      .pie .dir { font-size: 15px; font-weight: 650; color: var(--text); min-height: 20px; }
      .pie .dir small { display: block; font-size: 12.5px; font-weight: 400; color: var(--text-muted); margin-top: 2px; }
      .pie label { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--text-soft); cursor: pointer; }
      .pie label input { all: revert; width: 18px; height: 18px; margin: 0; flex: none; accent-color: var(--accent); }
      .pie .b { height: 48px; width: 100%; font-size: 15.5px; }
      .error { margin: auto; padding: 24px; text-align: center; color: var(--text-soft); }
    `,
  ],
  template: `
    @if (mapas.disponible()) {
      <div class="linea">
        @if (lat != null && lng != null) {
          <span class="ok"><ion-icon name="location-sharp" aria-hidden="true"></ion-icon>Ubicación exacta guardada</span>
          <button type="button" class="link" (click)="abrir()">Cambiar</button>
          <button type="button" class="link gris" (click)="quitar.emit()">Quitar</button>
        } @else {
          <button type="button" class="abrir" (click)="abrir()"><ion-icon name="location-sharp" aria-hidden="true"></ion-icon>Ubicar en el mapa</button>
        }
      </div>
    }

    @if (abierto()) {
      <div class="capa" #capa role="dialog" aria-label="Ubicar la dirección en el mapa">
        <div class="cab">
          <button type="button" class="redondo" aria-label="Volver" (click)="cerrar()"><ion-icon name="arrow-back-outline"></ion-icon></button>
          <form (ngSubmit)="buscar()">
            <input name="q" type="search" [(ngModel)]="q" placeholder="Busca la dirección o un sitio cercano" aria-label="Buscar dirección" enterkeyhint="search" />
            <button type="submit" class="redondo" aria-label="Buscar"><ion-icon name="search-outline"></ion-icon></button>
          </form>
        </div>
        <div class="zona">
          <div class="mapa" #mapa></div>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          } @else {
            <span class="sombra" aria-hidden="true"></span>
            <span class="pin" [class.arriba]="moviendo()" aria-hidden="true"><ion-icon name="location-sharp"></ion-icon></span>
            <button type="button" class="yo" aria-label="Ir a mi ubicación" (click)="miUbicacion()"><ion-icon name="locate"></ion-icon></button>
            @if (aviso()) { <span class="aviso">{{ aviso() }}</span> }
          }
        </div>
        <div class="pie">
          <div class="dir">
            {{ moviendo() ? 'Mueve el mapa hasta la puerta…' : (encontrada() || 'Punto elegido en el mapa') }}
            <small>Mueve el mapa para poner el pin justo en la entrada.</small>
          </div>
          @if (encontrada() && !moviendo()) {
            <label><input type="checkbox" [(ngModel)]="usarDireccion" />Escribir esta dirección en el pedido</label>
          }
          <button type="button" class="b b-pri" [disabled]="!listo() || moviendo()" (click)="confirmar()">Usar esta ubicación</button>
        </div>
      </div>
    }
  `,
})
export class UbicarMapaComponent implements OnDestroy {
  /** Lo que está escrito en el formulario (para buscarlo al abrir) */
  @Input() direccion = '';
  @Input() barrio = '';
  @Input() ciudad = 'Cali';
  @Input() lat: number | null = null;
  @Input() lng: number | null = null;
  @Output() elegido = new EventEmitter<UbicacionElegida>();
  @Output() quitar = new EventEmitter<void>();
  @ViewChild('mapa') caja?: ElementRef<HTMLElement>;
  @ViewChild('capa') capa?: ElementRef<HTMLElement>;

  mapas = inject(MapasService);
  abierto = signal(false);
  listo = signal(false);
  moviendo = signal(false);
  error = signal('');
  aviso = signal('');
  /** Dirección que da Google en el centro del mapa */
  encontrada = signal('');
  usarDireccion = true;
  q = '';

  private g: any;
  private mapa: any;
  private geo: any;
  private turno = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private avisoTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ arrowBackOutline, locate, locationSharp, searchOutline });
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
    clearTimeout(this.avisoTimer);
    document.body.style.overflow = '';
    this.capa?.nativeElement.remove();
  }

  async abrir(): Promise<void> {
    this.abierto.set(true);
    this.listo.set(false);
    this.error.set('');
    this.encontrada.set('');
    this.usarDireccion = true;
    this.q = [this.direccion.trim(), this.barrio.trim()].filter(Boolean).join(', ');
    document.body.style.overflow = 'hidden';
    // La capa va directo en <body>: dentro de una tarjeta con efecto de vidrio no quedaría a pantalla completa
    await new Promise((r) => setTimeout(r));
    const capa = this.capa?.nativeElement;
    if (capa && capa.parentElement !== document.body) document.body.appendChild(capa);
    try {
      this.g = await this.mapas.cargar();
    } catch (e) {
      return this.error.set((e as Error).message);
    }
    await new Promise((r) => setTimeout(r));
    const el = this.caja?.nativeElement;
    if (!el || !this.abierto()) return;
    this.geo = new this.g.Geocoder();
    this.mapa = new this.g.Map(el, {
      center: CENTRO, zoom: 13, disableDefaultUI: true, zoomControl: true, clickableIcons: false, gestureHandling: 'greedy',
      mapTypeControl: true, mapTypeControlOptions: { mapTypeIds: ['roadmap', 'hybrid'] },
    });
    this.mapa.addListener('dragstart', () => this.moviendo.set(true));
    this.mapa.addListener('idle', () => this.alQuedarQuieto());
    if (this.lat != null && this.lng != null) {
      this.mapa.setCenter({ lat: this.lat, lng: this.lng });
      this.mapa.setZoom(18);
    } else if (this.q) {
      await this.buscar(true);
    }
    this.listo.set(true);
  }

  cerrar(): void {
    this.abierto.set(false);
    this.mapa = undefined;
    document.body.style.overflow = '';
  }

  /** Busca lo escrito (dirección o sitio) en la ciudad */
  async buscar(alAbrir = false): Promise<void> {
    const texto = this.q.trim();
    if (!texto || !this.geo || !this.mapa) return;
    try {
      const { results } = await this.geo.geocode({
        address: /colombia/i.test(texto) ? texto : `${texto}, ${this.ciudad}, Colombia`,
        componentRestrictions: { country: 'CO' },
      });
      const r = results?.[0];
      if (!r) throw new Error();
      const exacta = r.types?.some((t: string) => t === 'street_address' || t === 'premise' || t === 'subpremise' || t === 'establishment' || t === 'point_of_interest');
      if (r.geometry.viewport && !exacta) this.mapa.fitBounds(r.geometry.viewport);
      else {
        this.mapa.setCenter(r.geometry.location);
        this.mapa.setZoom(18);
      }
      if (!exacta) this.avisar(alAbrir ? 'No encontramos la dirección exacta: mueve el mapa hasta la puerta.' : 'Solo encontramos la zona: mueve el mapa hasta la puerta.');
    } catch {
      this.avisar('Google no encontró esa dirección. Busca un sitio cercano o mueve el mapa a mano.');
    }
  }

  miUbicacion(): void {
    if (!navigator.geolocation) return this.avisar('Este celular no comparte la ubicación.');
    navigator.geolocation.getCurrentPosition(
      (p) => {
        this.mapa?.setCenter({ lat: p.coords.latitude, lng: p.coords.longitude });
        this.mapa?.setZoom(18);
      },
      () => this.avisar('Dale permiso de ubicación para usar este botón.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  /** Cuando el mapa se queda quieto se pregunta qué dirección hay en el pin */
  private alQuedarQuieto(): void {
    this.moviendo.set(false);
    clearTimeout(this.timer);
    const turno = ++this.turno;
    this.timer = setTimeout(async () => {
      const c = this.mapa?.getCenter();
      if (!c || !this.geo) return;
      try {
        const { results } = await this.geo.geocode({ location: { lat: c.lat(), lng: c.lng() } });
        if (turno !== this.turno) return;
        this.encontrada.set(direccionCorta(results ?? []));
      } catch {
        if (turno === this.turno) this.encontrada.set('');
      }
    }, 450);
  }

  confirmar(): void {
    const c = this.mapa?.getCenter();
    if (!c) return;
    this.elegido.emit({
      lat: Math.round(c.lat() * 1e6) / 1e6,
      lng: Math.round(c.lng() * 1e6) / 1e6,
      direccion: this.usarDireccion && this.encontrada() ? this.encontrada() : null,
    });
    this.cerrar();
  }

  private avisar(t: string): void {
    this.aviso.set(t);
    clearTimeout(this.avisoTimer);
    this.avisoTimer = setTimeout(() => this.aviso.set(''), 5000);
  }
}

/** "Cl. 10 #43e-31" a partir de la respuesta de Google (sin ciudad ni país) */
function direccionCorta(results: any[]): string {
  const r = results.find((x) => x.types?.some((t: string) => t === 'street_address' || t === 'premise')) ?? results[0];
  if (!r) return '';
  const comp = (tipo: string) => r.address_components?.find((c: any) => c.types?.includes(tipo))?.short_name ?? '';
  const via = comp('route');
  const num = comp('street_number');
  if (via && num) return `${via} #${num.replace(/^#/, '')}`;
  return String(r.formatted_address ?? '').split(',')[0].trim();
}
