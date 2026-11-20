import qrcode from 'qrcode-generator';

/**
 * Imagen de un producto lista para los estados de WhatsApp (vertical, 1080 × 1920):
 * la foto grande, el nombre, el precio y un código QR con el enlace del producto
 * en la tienda de la vendedora (el pedido que llegue por ahí le queda a ella).
 */
export interface DatosEstado {
  nombre: string;
  precio: number;
  foto: string | null;
  enlace: string;
  vendedora?: { nombre: string; telefono?: string | null } | null;
  agotado?: boolean;
}

const W = 1080;
const H = 1920;

function pesos(n: number): string {
  return '$ ' + Math.round(Number(n) || 0).toLocaleString('es-CO');
}

async function cargar(url: string): Promise<HTMLImageElement | null> {
  try {
    // Se baja como blob: así el lienzo no queda "manchado" y se puede exportar
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const u = URL.createObjectURL(await r.blob());
    const img = new Image();
    img.decoding = 'async';
    img.src = u;
    await img.decode();
    setTimeout(() => URL.revokeObjectURL(u), 2000);
    return img;
  } catch {
    return null;
  }
}

function redondeado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Parte el texto en renglones que quepan en el ancho (máximo `max` renglones, con … al final) */
function renglones(ctx: CanvasRenderingContext2D, texto: string, ancho: number, max: number): string[] {
  const palabras = texto.trim().split(/\s+/);
  const out: string[] = [];
  let linea = '';
  for (const p of palabras) {
    const prueba = linea ? linea + ' ' + p : p;
    if (ctx.measureText(prueba).width <= ancho) linea = prueba;
    else {
      if (linea) out.push(linea);
      linea = p;
    }
  }
  if (linea) out.push(linea);
  if (out.length > max) {
    const cortadas = out.slice(0, max);
    let ult = cortadas[max - 1];
    while (ult && ctx.measureText(ult + '…').width > ancho) ult = ult.slice(0, -1);
    cortadas[max - 1] = ult.trimEnd() + '…';
    return cortadas;
  }
  return out;
}

function dibujarQr(ctx: CanvasRenderingContext2D, texto: string, x: number, y: number, lado: number): void {
  const q = qrcode(0, 'M');
  q.addData(texto);
  q.make();
  const n = q.getModuleCount();
  const celda = lado / n;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, lado, lado);
  ctx.fillStyle = '#111111';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (q.isDark(r, c)) ctx.fillRect(x + c * celda, y + r * celda, Math.ceil(celda), Math.ceil(celda));
    }
  }
}

export async function generarImagenEstado(d: DatosEstado): Promise<File> {
  const lienzo = document.createElement('canvas');
  lienzo.width = W;
  lienzo.height = H;
  const ctx = lienzo.getContext('2d')!;
  const fuente = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  // Fondo: degradado oscuro con un brillo dorado arriba
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#16131f');
  g.addColorStop(1, '#0b0a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const brillo = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 900);
  brillo.addColorStop(0, 'rgba(212, 175, 55, 0.35)');
  brillo.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.fillStyle = brillo;
  ctx.fillRect(0, 0, W, H);

  // Logo y nombre de la tienda
  const logo = await cargar('assets/icon/logo.png');
  if (logo) {
    // El logo es oscuro: va sobre un cuadro blanco para que se vea en el fondo negro
    ctx.save();
    ctx.fillStyle = '#ffffff';
    redondeado(ctx, W / 2 - 70, 70, 140, 140, 34);
    ctx.fill();
    ctx.clip();
    ctx.drawImage(logo, W / 2 - 60, 80, 120, 120);
    ctx.restore();
  }

  // Tarjeta blanca con la foto
  const tx = 70, ty = 250, tw = W - 140, th = 900;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#ffffff';
  redondeado(ctx, tx, ty, tw, th, 48);
  ctx.fill();
  ctx.restore();
  const foto = d.foto ? await cargar(d.foto) : null;
  if (foto) {
    const pad = 40;
    const aw = tw - pad * 2, ah = th - pad * 2;
    const k = Math.min(aw / foto.naturalWidth, ah / foto.naturalHeight);
    const fw = foto.naturalWidth * k, fh = foto.naturalHeight * k;
    ctx.save();
    redondeado(ctx, tx, ty, tw, th, 48);
    ctx.clip();
    ctx.drawImage(foto, tx + (tw - fw) / 2, ty + (th - fh) / 2, fw, fh);
    ctx.restore();
  } else {
    ctx.fillStyle = '#c9a227';
    ctx.font = `800 300px ${fuente}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.nombre.charAt(0).toUpperCase(), W / 2, ty + th / 2);
  }
  if (d.agotado) {
    ctx.fillStyle = 'rgba(17, 17, 17, 0.8)';
    redondeado(ctx, tx + 30, ty + 30, 300, 80, 40);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `700 40px ${fuente}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Por encargo', tx + 180, ty + 70);
  }

  // Nombre y precio
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 64px ${fuente}`;
  const lineas = renglones(ctx, d.nombre, W - 140, 2);
  let y = ty + th + 110;
  for (const l of lineas) {
    ctx.fillText(l, W / 2, y);
    y += 76;
  }
  ctx.fillStyle = '#f2c94c';
  ctx.font = `800 104px ${fuente}`;
  ctx.fillText(pesos(d.precio), W / 2, y + 40);

  // QR con el enlace del producto y la invitación
  const lado = 250;
  const qy = H - lado - 120;
  const qx = 90;
  ctx.save();
  ctx.fillStyle = '#ffffff';
  redondeado(ctx, qx - 18, qy - 18, lado + 36, lado + 36, 28);
  ctx.fill();
  ctx.restore();
  dibujarQr(ctx, d.enlace, qx, qy, lado);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 54px ${fuente}`;
  const tx2 = qx + lado + 60;
  ctx.fillText('Pídelo aquí', tx2, qy + 70);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `500 38px ${fuente}`;
  ctx.fillText('Escanea el código o', tx2, qy + 135);
  ctx.fillText('escríbeme por WhatsApp', tx2, qy + 185);
  if (d.vendedora?.nombre) {
    ctx.fillStyle = '#f2c94c';
    ctx.font = `700 40px ${fuente}`;
    const contacto = d.vendedora.nombre.split(/\s+/)[0] + (d.vendedora.telefono ? ' · ' + d.vendedora.telefono : '');
    ctx.fillText(renglones(ctx, contacto, W - tx2 - 60, 1)[0] ?? '', tx2, qy + 245);
  }

  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.92));
  if (!blob) throw new Error('No se pudo crear la imagen');
  const nombre = d.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'producto';
  return new File([blob], `estado-${nombre}.jpg`, { type: 'image/jpeg' });
}
