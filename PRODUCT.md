# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Todo el equipo de Jasta (JT Hobbies & Accesorios) usa la app a diario, cada rol en su escenario:

- **Alistamiento**, en la bodega, en computador o tablet: alista pedidos, imprime rótulos y despacha con mensajero durante toda la jornada.
- **Vendedoras**, casi siempre en el celular: crean pedidos mientras hablan con el cliente.
- **Mensajeros**, en la calle y en el celular, con prisa y a veces a pleno sol: ven su ruta, entregan y registran cómo pagó el cliente.
- **Admin y cuadres**, en el computador: revisan reportes, cuadres de mensajeros y la plata.

Una persona puede tener varios roles.

## Product Purpose

App interna de pedidos de Jasta: ventas a domicilio y en local, alistamiento, despacho a mensajeros, entregas con recaudo (efectivo, transferencia o mixto) y cuadres. Reemplaza el WordPress/WooCommerce anterior (jastatechnology.com), del que vienen pedidos, productos, usuarios e historial. Funciona bien cuando cada rol ve de inmediato lo que le toca hacer y nadie pierde un pedido entre estados.

## Operating Context

- Flujo del pedido: Por alistar (Pendientes) → Alistado (en orden 1°, 2°…) → En ruta (despachado con mensajero) → Entregado o Cancelado.
- Los rótulos de 100×100 mm se imprimen desde Pedidos, en el orden de alistamiento.
- Los mensajeros reciben el pedido por WhatsApp y lo cierran desde "Mis entregas"; los cuadres se cierran por mensajero.
- Home ALS es una app hermana del mismo dueño con el mismo flujo de pedidos.

## Capabilities and Constraints

- Ionic + Angular (standalone, signals) sobre Supabase; se publica en Vercel y CI compila con Node 22.
- Toda la interfaz en español de Colombia; plata en pesos (COP) y fechas en hora de Colombia.
- Seguridad por políticas RLS y funciones de la base; la llave del cliente es la publicable.
- Debe funcionar igual de bien en celular y en escritorio.

## Brand Commitments

- Nombre: Jasta / JT Hobbies & Accesorios. El logo oficial es el de jastatechnology.com (JT negro con borde dorado y corona).
- Se conserva el modo oscuro.
- Se conserva el diseño del rótulo impreso de 100×100 mm.
- Cada estado del pedido conserva un color reconocible.

## Evidence on Hand

- Logo: `https://jastatechnology.com/wp-content/uploads/2025/05/cropped-Diseno-sin-titulo-5.png` (512×512, fondo transparente).
- Datos reales en Supabase (pedidos, productos, usuarios); no hay capturas ni datos de prueba en el repositorio.

## Product Principles

1. Lo urgente se ve primero: cada pantalla abre en lo que el rol debe atender ahora.
2. El estado del pedido se lee de un vistazo; nunca puede quedar ambiguo.
3. Densidad sin ruido: más pedidos por pantalla, sin perder legibilidad en el celular.
4. Cero pasos de más para las tareas que se repiten todo el día (alistar, despachar, entregar).

## Accessibility & Inclusion

Uso en la calle con sol y con prisa: buen contraste y objetivos táctiles cómodos en celular.
