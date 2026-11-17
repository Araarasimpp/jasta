/* Jasta: service worker de avisos (notificaciones push), igual al de Home ALS.
 * Lo mantiene vivo el navegador aunque la app esté cerrada: recibe el aviso
 * que envía Supabase (Edge Function enviar-push) y lo muestra como
 * notificación del sistema. No guarda caché ni intercepta peticiones.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Modo sin señal: la app se puede abrir sin internet. Siempre se pide primero a la red (así nunca
// queda una versión vieja) y solo si no hay señal se usa la última copia guardada.
const CACHE = 'jasta-sin-senal-v1';
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const pagina = req.mode === 'navigate';
  if (!pagina && !/\.(js|css|woff2?|png|svg|webp|jpg|json|ico)$/.test(url.pathname)) return;
  const clave = pagina ? '/index.html' : req;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(clave, copia)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(clave).then((r) => r || Response.error()))
  );
});

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch (e) {
    datos = { titulo: 'Jasta', cuerpo: event.data ? event.data.text() : '' };
  }

  const titulo = datos.titulo || 'Jasta';
  const opciones = {
    body: datos.cuerpo || '',
    icon: '/assets/icon/logo-192.png',
    badge: '/assets/icon/favicon.png',
    // Mismo "tag" que usa la app abierta: si ambos muestran el aviso, uno reemplaza al otro
    tag: datos.tag || undefined,
    renotify: !!datos.tag,
    data: { url: datos.url || '/' },
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

// Al tocar el aviso: si la app ya está abierta, la enfoca y navega; si no, la abre
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin) {
          return v.focus().then((enfocada) => (enfocada && 'navigate' in enfocada ? enfocada.navigate(destino) : null));
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});
