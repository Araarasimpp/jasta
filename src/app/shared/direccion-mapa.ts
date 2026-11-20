/**
 * Solo la dirección (vía y placa) para buscarla en Waze o Google Maps.
 *
 * Muchas direcciones llegan con más cosas: el nombre del conjunto, la torre, el apto
 * o el barrio ("Cra 80 # 12-40 conjunto Los Pinos torre 2, Robledo"). Waze y Maps se
 * confunden con eso (y no conocen todos los barrios), así que para el mapa se toma
 * solo "Carrera 80 # 12-40" y la ciudad.
 */
const CIUDAD = 'Cali, Colombia';

const VIAS: [RegExp, string][] = [
  [/^av(enida)?\.?\s*(calle|cl)\.?$/i, 'Avenida Calle'],
  [/^av(enida)?\.?\s*(carrera|cra|kr|kra)\.?$/i, 'Avenida Carrera'],
  [/^(calle|cll?)\.?$/i, 'Calle'],
  [/^(carrera|cra|kra|kr|cr|k)\.?$/i, 'Carrera'],
  [/^(avenida|av)\.?$/i, 'Avenida'],
  [/^(diagonal|diag|dg)\.?$/i, 'Diagonal'],
  [/^(transversal|trans|tv|tr)\.?$/i, 'Transversal'],
  [/^(circular|circ|cq)\.?$/i, 'Circular'],
  [/^autopista$/i, 'Autopista'],
];

const VIA = String.raw`(av(?:enida)?\.?\s*(?:calle|cl|carrera|cra|kra|kr)\.?|calle|cll?\.?|carrera|cra\.?|kra\.?|kr\.?|cr\.?|k\.?|avenida|av\.?|diagonal|diag\.?|dg\.?|transversal|trans\.?|tv\.?|tr\.?|circular|circ\.?|autopista)`;
const NUM = String.raw`(\d+[a-z]?(?:\s*bis(?:\s*[a-z](?![a-z]))?)?)`;
const NUM1 = String.raw`(\d+[a-z]?(?:\s*bis(?:\s*[a-z](?![a-z]))?)?(?:\s*(?:sur|este|norte|oeste)\b)?)`;
const SEP = String.raw`\s*(?:#|n[°º.o]?(?![a-z])|no\.?(?![a-z])|nro\.?|num(?:ero)?\.?)?\s*`;
const PATRON = new RegExp(String.raw`(?:^|[^a-z])${VIA}\s*${NUM1}${SEP}${NUM}\s*[-–]?\s*(\d{1,3})(?!\d)(\s*(?:sur|este|norte|oeste)\b)?`, 'i');

/** "cra 80 n 12 40 conjunto X torre 2" -> "Carrera 80 # 12-40"; null si no se reconoce la dirección */
export function soloDireccion(texto: string | null | undefined): string | null {
  const m = (texto ?? '').match(PATRON);
  if (!m) return null;
  const via = VIAS.find(([r]) => r.test(m[1].replace(/\s+/g, ' ').trim()))?.[1] ?? m[1];
  const limpia = (s: string) => s.replace(/\s+/g, ' ').trim().toUpperCase().replace(/BIS/, 'Bis').replace(/ (SUR|ESTE|NORTE|OESTE)$/, (x) => ' ' + x.trim()[0] + x.trim().slice(1).toLowerCase());
  return `${via} ${limpia(m[2])} # ${limpia(m[3])}-${m[4]}${m[5] ? ' ' + m[5].trim().toLowerCase().replace(/^./, (c) => c.toUpperCase()) : ''}`;
}

/** Lo que se le manda a Waze o a Maps: solo la dirección y la ciudad (si no se reconoce, todo con el barrio) */
export function lugarParaMapa(p: { direccion: string | null; barrio: string | null }): string {
  const sola = soloDireccion(p.direccion);
  return sola ? `${sola}, ${CIUDAD}` : [p.direccion, p.barrio, CIUDAD].filter((x) => x && String(x).trim()).join(', ');
}
