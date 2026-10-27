import { Easing, interpolate, spring } from 'remotion';

export const FPS = 30;

/** Resorte con peso (sin rebote por defecto) */
export function sp(frame: number, desde = 0, damping = 200, masa = 1): number {
  return spring({ frame: frame - desde, fps: FPS, config: { damping, mass: masa, stiffness: 110 } });
}

/** Resorte con un poco de rebote, para lo que "aterriza" */
export function rebote(frame: number, desde = 0): number {
  return spring({ frame: frame - desde, fps: FPS, config: { damping: 14, mass: 0.9, stiffness: 120 } });
}

export const salida = Easing.bezier(0.16, 1, 0.3, 1);
export const suave = Easing.bezier(0.45, 0, 0.2, 1);

/** interpolate con los extremos fijos y ease-out */
export function r(frame: number, a: number, b: number, de: number, a2: number, easing = salida): number {
  return interpolate(frame, [a, b], [de, a2], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });
}

/** Texto que se va escribiendo letra por letra */
export function escribir(texto: string, frame: number, desde: number, porLetra = 1.6): string {
  const n = Math.max(0, Math.floor((frame - desde) / porLetra));
  return texto.slice(0, n);
}
