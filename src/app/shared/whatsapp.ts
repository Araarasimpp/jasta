/** Enlace para abrir WhatsApp con el cliente (números colombianos de 10 dígitos llevan el 57) */
export function enlaceWhatsapp(telefono: string | null | undefined, mensaje = ''): string {
  const n = (telefono ?? '').replace(/\D/g, '');
  const num = n.length === 10 ? '57' + n : n;
  return `https://wa.me/${num}${mensaje ? '?text=' + encodeURIComponent(mensaje) : ''}`;
}

/** Canal de WhatsApp de Jasta (se invita a seguirlo en los mensajes a clientes) */
export const CANAL_WHATSAPP = 'https://whatsapp.com/channel/0029Vb72Rzw9MF8xwEjkqR0c';

/** "a", "a y b", "a, b y c" */
export function enLista(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? '';
  return cosas.slice(0, -1).join(', ') + ' y ' + cosas[cosas.length - 1];
}

/**
 * Lo que lleva el pedido, para el mensaje: "Cadena cubana y 2 Gorras trucker (Negro)".
 * Con más de 3 productos: "Cadena cubana, Gorra y 2 productos más".
 */
export function productosDelPedido(items: { nombre: string; cantidad: number; color?: string | null; talla?: string | null }[]): string {
  const partes = items.map((i) => {
    const v = [i.color, i.talla ? 'talla ' + i.talla : null].filter(Boolean).join(', ');
    return `${i.cantidad > 1 ? i.cantidad + ' ' : ''}${i.nombre.trim()}${v ? ` (${v})` : ''}`;
  });
  if (partes.length > 3) return `${partes.slice(0, 2).join(', ')} y ${partes.length - 2} productos más`;
  return enLista(partes);
}

/**
 * Mensaje de seguimiento para el cliente (Clientes → Escribir por WhatsApp):
 * pregunta cómo le fue con lo que compró e invita al canal de WhatsApp.
 */
export function mensajeSeguimiento(nombre: string, productos: string[]): string {
  const unicos = [...new Set(productos.map((p) => p.trim()).filter(Boolean))];
  const pedido = unicos.length ? enLista(unicos) : 'tu última compra';
  return (
    `Hola ${nombre.trim()} te hablamos de Jasta Technology, quisiera preguntarte ¿cómo te fue con tu pedido de ${pedido}?\n\n\n` +
    'Te invitamos a que nos sigas en nuestro canal de WhatsApp, tenemos muchos productos novedosos, hogar, herramientas, juguetería gadgets y mucho más\n\n' +
    `${CANAL_WHATSAPP}\n\n` +
    'Síguenos, mándanos captura y participa en nuestras rifas mensuales 🥳'
  );
}
