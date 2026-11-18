import { addIcons } from 'ionicons';
import {
  alarmOutline, alertCircle, checkmarkCircle, arrowUpCircleOutline, bagHandle, bagHandleOutline, briefcase, bonfire, bulb, car, card, cash, colorPalette, construct,
  cube, downloadOutline, extensionPuzzle, fileTrayFull, flag, flame, heart, heartOutline, home, hourglassOutline, medal, medkit, moon, paw, pencil,
  phonePortrait, repeat, restaurant, searchCircle, shareOutline, shirt, sparkles, star, sunny, ticket, trashOutline, warning, water,
} from 'ionicons/icons';

/**
 * Íconos que reemplazan a los emojis en toda la app (la app no usa emojis).
 * Se registran una sola vez al arrancar; cada pantalla solo necesita IonIcon.
 */
export function registrarIconos(): void {
  addIcons({
    alarmOutline, alertCircle, checkmarkCircle, arrowUpCircleOutline, bagHandle, bagHandleOutline, briefcase, bonfire, bulb, car, card, cash, colorPalette, construct,
    cube, downloadOutline, extensionPuzzle, fileTrayFull, flag, flame, heart, heartOutline, home, hourglassOutline, medal, medkit, moon, paw, pencil,
    phonePortrait, repeat, restaurant, searchCircle, shareOutline, shirt, sparkles, star, sunny, ticket, trashOutline, warning, water,
  });
}

/** Ícono de cada categoría de la tienda (por palabras, así aguanta nombres parecidos) */
export function iconoCategoria(nombreNormalizado: string): string {
  const mapa: [RegExp, string][] = [
    [/jug|beb|nin/, 'extension-puzzle'], [/organiz/, 'file-tray-full'], [/cocin/, 'restaurant'], [/herram/, 'construct'], [/bellez|cuidad/, 'color-palette'],
    [/tecno|celul|electr/, 'phone-portrait'], [/limpi/, 'water'], [/hogar|casa/, 'home'], [/carro|moto/, 'car'], [/ilumin|solar|luz|lampar/, 'bulb'],
    [/deport|camp/, 'bonfire'], [/bols|malet/, 'briefcase'], [/mascot/, 'paw'], [/ropa|moda/, 'shirt'], [/salud/, 'medkit'], [/oficin|escol/, 'pencil'],
  ];
  return mapa.find(([r]) => r.test(nombreNormalizado))?.[1] ?? 'bag-handle';
}
