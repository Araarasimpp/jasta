# Jasta

App de pedidos de Jasta: ventas, alistamiento, despacho a mensajeros, entregas con recaudo y cuadres.
Hecha con Ionic + Angular sobre Supabase, con el estilo de Home ALS.

## Roles

| Rol | Qué hace |
|---|---|
| Admin | Ve y cambia todo: reportes, pedidos, productos, usuarios |
| Vendedora | Crea pedidos y ve los suyos |
| Alistamiento | Alista pedidos y los despacha con un mensajero |
| Mensajero | Ve sus pedidos en ruta, los entrega y registra cómo pagó el cliente |
| Cuadres | Cierra los cuadres de los mensajeros y ve reportes |

Una persona puede tener varios roles. Quien se registra con el mismo correo que tenía en el WordPress
de Jasta queda automáticamente con sus roles.

## Con Variedades JYB (Kaesuri)

Quien reparte para los dos negocios (con el mismo correo en las dos apps) ve los pedidos de ambos en una
sola ruta, en cualquiera de las dos apps, y entrega cada uno en el sistema que corresponde. Los cuadres
siguen separados por negocio.

- Pedidos de Variedades JYB en Mis entregas: función `jasta-puente` del proyecto de Kaesuri (`JybService`).
- Pedidos de Jasta en la app de Kaesuri: función `kaesuri-puente` y funciones `kaesuri_*` de esta base
  (`supabase/sql/entregas_desde_kaesuri.sql`).

## Datos

Los pedidos, productos, usuarios, cuadres e historial vienen del WordPress/WooCommerce anterior
(jastatechnology.com). Las fotos de productos y comprobantes siguen apuntando a ese sitio hasta
que se suban a Supabase Storage.

## Desarrollo

```bash
npm install
npm start          # http://localhost:4200
npm run build      # genera www/
```

La configuración de Supabase está en `src/environments/`. La llave es la publicable: la seguridad
la dan las políticas RLS y las funciones de la base (`crear_pedido`, `cambiar_estado`,
`entregar_pedido`, `cerrar_cuadre`, `resumen`…).

## Probar en tu computador

Necesitas Node 22 o más reciente.

```bash
git clone https://github.com/Araarasimpp/jasta.git
cd jasta
npm install
npm start
```

Abre http://localhost:4200. Para que los correos de registro y de "olvidé mi contraseña" vuelvan a
tu computador, en Supabase → Authentication → URL Configuration pon `http://localhost:4200` como
Site URL (y agrégalo en Redirect URLs).

## Publicación

- **Vercel:** importar el repo; comando `npm run build`, carpeta `www`.
- Cada push a `main` corre la revisión "Compilar" en GitHub Actions.

## Avisos automáticos de novedades

Cada cambio que el equipo deba conocer se anota en `src/assets/novedades.json` (la más nueva
primero: `id` único, `fecha`, `titulo`, `cuerpo` y `roles`; sin roles le llega a todos). Al
publicarse la versión, la base (`privado.revisar_novedades`, cada minuto) lee ese archivo de
app.jastatechnology.com y manda la notificación una sola vez por novedad. Ver
`supabase/sql/novedades_automaticas.sql`.
