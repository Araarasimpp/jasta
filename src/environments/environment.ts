// La llave publicable es pública por diseño: la seguridad la dan las políticas RLS.
export const environment = {
  production: false,
  supabaseUrl: 'https://ktksdoedeazkvohewqzx.supabase.co',
  supabaseKey: 'sb_publishable_oejAL5ZoXxdyFCRLCLyj8A_tNlI49IX',
  // Fotos que vinieron del WordPress (productos y comprobantes), copiadas a Supabase Storage con la misma ruta
  // Llave pública (site key) de Cloudflare Turnstile. Vacía = sin verificación anti-robots.
  turnstileSiteKey: '0x4AAAAAAFZVvIoDg68UGInx',
  uploadsUrl: 'https://ktksdoedeazkvohewqzx.supabase.co/storage/v1/object/public/wp/',
  // Pedidos de Variedades JYB (Kaesuri) en Mis entregas: función que valida la sesión de Jasta
  jybPuenteUrl: 'https://mswqdzpsynvdanxdfidf.supabase.co/functions/v1/jasta-puente',
  // Avisos en vivo de Variedades JYB (llave pública de ese proyecto)
  jybUrl: 'https://mswqdzpsynvdanxdfidf.supabase.co',
  jybKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zd3FkenBzeW52ZGFueGRmaWRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2ODcyNTQsImV4cCI6MjEwNTI2MzI1NH0.HsrN07w2w74s2iol3csU__6Tzrbi6Z1IXYDU-fcQevI',
};
