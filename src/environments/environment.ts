// La llave publicable es pública por diseño: la seguridad la dan las políticas RLS.
export const environment = {
  production: false,
  supabaseUrl: 'https://ktksdoedeazkvohewqzx.supabase.co',
  supabaseKey: 'sb_publishable_oejAL5ZoXxdyFCRLCLyj8A_tNlI49IX',
  // Fotos que vinieron del WordPress (productos y comprobantes), copiadas a Supabase Storage con la misma ruta
  uploadsUrl: 'https://ktksdoedeazkvohewqzx.supabase.co/storage/v1/object/public/wp/',
};
