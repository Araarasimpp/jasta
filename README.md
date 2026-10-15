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

## Publicación

- **GitHub Pages:** cada push a `main` compila y publica en https://araarasimpp.github.io/jasta/
- **Vercel:** importar el repo; comando `npm run build`, carpeta `www`.
