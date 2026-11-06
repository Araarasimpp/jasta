import { Injectable, computed, signal } from '@angular/core';

/** Fondos que vienen con la app (fotos de Unsplash, de uso libre) */
export const FONDOS = [
  { id: 'sala', nombre: 'Sala' },
  { id: 'sillon', nombre: 'Sillón' },
  { id: 'nubes', nombre: 'Sobre las nubes' },
  { id: 'estrellas', nombre: 'Noche estrellada' },
  { id: 'lago', nombre: 'Lago' },
  { id: 'bote', nombre: 'Bote' },
  { id: 'playa', nombre: 'Playa' },
  { id: 'ciudad', nombre: 'Ciudad' },
  { id: 'colinas', nombre: 'Colinas' },
  { id: 'abstracto', nombre: 'Abstracto' },
] as const;

export interface Ajustes {
  /** id de un fondo de la app, o 'propio' (la imagen que subió la persona) */
  fondo: string;
  /** 0 a 0.8: qué tanto se oscurece la foto para que se lea */
  oscurecer: number;
  /** 0 a 24 px: desenfoque de la foto */
  desenfoque: number;
  /** 0.15 a 0.8: qué tan sólido es el vidrio de las tarjetas */
  vidrio: number;
}

const CLAVE = 'jasta-fondo';
const CLAVE_PROPIO = 'jasta-fondo-propio';
const POR_DEFECTO: Ajustes = { fondo: 'sala', oscurecer: 0.35, desenfoque: 0, vidrio: 0.4 };

/**
 * Fondo de la app (diseño Vidrio): una foto detrás de todo, con las tarjetas de vidrio encima.
 * Se guarda en este dispositivo. La imagen propia se reduce y se guarda como JPEG.
 */
@Injectable({ providedIn: 'root' })
export class FondoService {
  readonly ajustes = signal<Ajustes>(this.leer());
  readonly propio = signal<string | null>(this.leerPropio());
  readonly url = computed(() => {
    const a = this.ajustes();
    if (a.fondo === 'propio' && this.propio()) return this.propio()!;
    return `assets/fondos/${FONDOS.some((f) => f.id === a.fondo) ? a.fondo : POR_DEFECTO.fondo}.webp`;
  });

  constructor() {
    this.aplicar();
  }

  cambiar(p: Partial<Ajustes>): void {
    this.ajustes.update((a) => ({ ...a, ...p }));
    this.guardar();
    this.aplicar();
  }

  restablecer(): void {
    this.ajustes.set({ ...POR_DEFECTO });
    this.guardar();
    this.aplicar();
  }

  /** Reduce la imagen (máx. 1920 px) y la deja como fondo */
  async subir(archivo: File): Promise<void> {
    if (!archivo.type.startsWith('image/')) throw new Error('Elige una imagen');
    const bmp = await createImageBitmap(archivo);
    const escala = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    let calidad = 0.82;
    let data = c.toDataURL('image/jpeg', calidad);
    // Que quepa en el almacenamiento del navegador (~1,5 MB como máximo)
    while (data.length > 1_500_000 && calidad > 0.4) {
      calidad -= 0.12;
      data = c.toDataURL('image/jpeg', calidad);
    }
    try {
      localStorage.setItem(CLAVE_PROPIO, data);
    } catch {
      throw new Error('La imagen es muy pesada para guardarla en este celular. Prueba con otra.');
    }
    this.propio.set(data);
    this.cambiar({ fondo: 'propio' });
  }

  quitarPropio(): void {
    try { localStorage.removeItem(CLAVE_PROPIO); } catch { /* nada */ }
    this.propio.set(null);
    if (this.ajustes().fondo === 'propio') this.cambiar({ fondo: POR_DEFECTO.fondo });
  }

  private aplicar(): void {
    const a = this.ajustes();
    const s = document.body.style;
    document.body.classList.add('vidrio');
    s.setProperty('--fondo-img', `url("${this.url()}")`);
    s.setProperty('--fondo-oscuro', String(a.oscurecer));
    s.setProperty('--fondo-blur', `${a.desenfoque}px`);
    s.setProperty('--vd-alpha', String(a.vidrio));
  }

  private guardar(): void {
    try { localStorage.setItem(CLAVE, JSON.stringify(this.ajustes())); } catch { /* sin almacenamiento */ }
  }

  private leer(): Ajustes {
    try {
      return { ...POR_DEFECTO, ...(JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Ajustes>) };
    } catch {
      return { ...POR_DEFECTO };
    }
  }

  private leerPropio(): string | null {
    try { return localStorage.getItem(CLAVE_PROPIO); } catch { return null; }
  }
}

/** La foto de fondo guardada en este dispositivo (para pantallas sin sesión, como el login) */
export function fotoFondoGuardada(): string {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE) ?? '{}') as Partial<Ajustes>;
    if (a.fondo === 'propio') return localStorage.getItem(CLAVE_PROPIO) ?? `assets/fondos/${POR_DEFECTO.fondo}.webp`;
    return `assets/fondos/${FONDOS.some((f) => f.id === a.fondo) ? a.fondo : POR_DEFECTO.fondo}.webp`;
  } catch {
    return `assets/fondos/${POR_DEFECTO.fondo}.webp`;
  }
}
