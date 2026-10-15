/** Enlace para abrir WhatsApp con el cliente (números colombianos de 10 dígitos llevan el 57) */
export function enlaceWhatsapp(telefono: string | null | undefined, mensaje = ''): string {
  const n = (telefono ?? '').replace(/\D/g, '');
  const num = n.length === 10 ? '57' + n : n;
  return `https://wa.me/${num}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
}
