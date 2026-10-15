---
version: 1
slug: "src-app-shell-shell-component-ts"
primary_target: "src/app/shell/shell.component.ts"
related_targets: ["src/theme/tema.scss"]
---

# App completa de Jasta (shell + todas las pantallas)

Modo: Operate. Público: alistamiento, vendedoras, mensajeros, admin/cuadres; celular y escritorio por igual.
Tarea: ver y mover pedidos por estado, crear ventas, entregar y cuadrar. Restricciones: rótulo impreso intacto, modo oscuro, color por estado, logo de jastatechnology.com. Evitar: apagado, genérico.

## Direction contract

THESIS: La app se lee como un tiquete de caja: papel blanco, tinta casi negra, cifras tabulares y perforaciones punteadas. Rechaza el admin genérico de tarjetas con sombra y degradados.

OWN-WORLD: Papel #fff sobre gris recibo muy claro; tinta #16130e; reglas punteadas 1px como separadores; números de pedido y plata en mono tabular; rótulos 11px en mayúsculas espaciadas; oro JT (#b8860b familia) como único acento: pestaña activa, selección, foco, total. Estados como punto de color de tamaño fijo + texto. Radios pequeños (4–6px), sin sombras salvo menús flotantes.

STORY: Cada persona abre su pantalla y ve, como en un tiquete, la lista de lo que le toca con su número, su estado y su valor alineados; actúa con un toque y el total cuadra.

FIRST VIEWPORT: Pedidos: barra lateral blanca con logo JT y navegación en texto; encabezado con título y conteo mono; pestañas subrayadas en oro; tabla densa con filas separadas por perforación, # mono a la izquierda, total alineado a la derecha; acción primaria tinta negra arriba a la derecha.

FORM: Tiquete de caja (recibo térmico POS), candidato 5 de 7, seed c04a46dc. Raise de Crouwel: grilla estricta en celdas enteras. Raise de atlas: estado como punto de diámetro fijo. Raise de Ikeda: columnas tabulares densas. Interacción firma: totales con puntos guía y fila seleccionada con talón dorado a la izquierda.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
