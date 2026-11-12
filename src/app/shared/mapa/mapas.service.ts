import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from '../../core/services/supabase.service';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { google?: any; __jastaMaps?: () => void }
}

/** Centro de Cali (donde se reparte) para cuando no se encuentra la dirección */
export const CENTRO = { lat: 3.4516, lng: -76.532 };

/**
 * Carga Google Maps una sola vez. La llave (de navegador, restringida por dominio en
 * Google Cloud) está guardada en la base; si no hay llave, no se ofrece el mapa.
 */
@Injectable({ providedIn: 'root' })
export class MapasService {
  private sb = inject(SupabaseService);
  /** null = todavía no se sabe; true/false = hay o no hay llave */
  readonly disponible = signal<boolean | null>(null);
  private clave?: Promise<string | null>;
  private carga?: Promise<any>;

  constructor() {
    void this.llave().then((k) => this.disponible.set(!!k));
  }

  private llave(): Promise<string | null> {
    this.clave ??= Promise.resolve(this.sb.client.rpc('maps_clave')).then(({ data }) => (typeof data === 'string' && data.trim() ? data.trim() : null), () => null);
    return this.clave;
  }

  /** Devuelve el objeto google.maps listo (mapa y geocodificador) */
  async cargar(): Promise<any> {
    if (window.google?.maps?.Map) return window.google.maps;
    this.carga ??= (async () => {
      const k = await this.llave();
      if (!k) throw new Error('El mapa todavía no está configurado.');
      await new Promise<void>((ok, mal) => {
        window.__jastaMaps = () => ok();
        const s = document.createElement('script');
        s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(k)}&v=weekly&language=es&region=CO&loading=async&callback=__jastaMaps`;
        s.async = true;
        s.onerror = () => mal(new Error('No se pudo cargar el mapa. Revisa tu internet.'));
        document.head.appendChild(s);
      });
      const g = window.google.maps;
      await Promise.all([g.importLibrary('maps'), g.importLibrary('geocoding')]);
      return g;
    })();
    try {
      return await this.carga;
    } catch (e) {
      this.carga = undefined;
      throw e;
    }
  }
}

/** Enlace para abrir la entrega en Google Maps (el punto exacto si lo hay; si no, la dirección escrita) */
export function enlaceMapa(p: { direccion?: string | null; barrio?: string | null; lat?: number | null; lng?: number | null }, ciudad = 'Cali'): string {
  if (p.lat != null && p.lng != null) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.direccion ?? ''}, ${p.barrio ?? ''}, ${ciudad}`);
}
