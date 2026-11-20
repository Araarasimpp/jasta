/**
 * Micrófono y cámara reutilizables.
 *
 * En iPhone, cada vez que la app pide el micrófono o la cámara de nuevo (getUserMedia),
 * Safari vuelve a preguntar el permiso. Para no preguntar en cada nota de voz o cada vez
 * que se abre la cámara de Despachar, el micrófono (o la cámara) que ya se autorizó se
 * deja abierto un rato después de usarlo, en pausa (sin grabar nada), y la siguiente vez
 * se reutiliza. Si no se vuelve a usar en ese rato, se cierra del todo.
 */
type Tipo = 'audio' | 'video';

const abiertos: Record<Tipo, MediaStream | null> = { audio: null, video: null };
const relojes: Record<Tipo, ReturnType<typeof setTimeout> | undefined> = { audio: undefined, video: undefined };
/** Cuánto se deja abierto después de usarlo (el micrófono más, porque se usa seguido en el chat) */
const ESPERA: Record<Tipo, number> = { audio: 10 * 60_000, video: 3 * 60_000 };

function vivo(f: MediaStream | null): f is MediaStream {
  return !!f && f.getTracks().length > 0 && f.getTracks().every((t) => t.readyState === 'live');
}

async function pedir(tipo: Tipo, restricciones: MediaStreamConstraints): Promise<MediaStream> {
  clearTimeout(relojes[tipo]);
  const actual = abiertos[tipo];
  if (vivo(actual)) {
    actual.getTracks().forEach((t) => (t.enabled = true));
    return actual;
  }
  const nuevo = await navigator.mediaDevices.getUserMedia(restricciones);
  abiertos[tipo] = nuevo;
  return nuevo;
}

/** Deja el micrófono o la cámara en pausa y lo cierra si no se vuelve a usar pronto */
function soltar(tipo: Tipo): void {
  const f = abiertos[tipo];
  if (!f) return;
  f.getTracks().forEach((t) => (t.enabled = false));
  clearTimeout(relojes[tipo]);
  relojes[tipo] = setTimeout(() => cerrar(tipo), ESPERA[tipo]);
}

function cerrar(tipo: Tipo): void {
  clearTimeout(relojes[tipo]);
  abiertos[tipo]?.getTracks().forEach((t) => t.stop());
  abiertos[tipo] = null;
}

export const pedirMicrofono = () => pedir('audio', { audio: { echoCancellation: true, noiseSuppression: true } });
export const soltarMicrofono = () => soltar('audio');

export const pedirCamara = () =>
  pedir('video', { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
export const soltarCamara = () => soltar('video');

// Al cerrar o recargar la app se apaga todo
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    cerrar('audio');
    cerrar('video');
  });
}
