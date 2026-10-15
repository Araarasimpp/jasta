---
name: Jasta
description: App de pedidos, despacho y cuadres de JT Hobbies & Accesorios, con forma de tiquete de caja.
colors:
  tinta: "#171511"
  tinta-hover: "#34312a"
  oro: "#c4920f"
  oro-texto: "#8a6400"
  oro-wash: "#fbf5e4"
  oro-soft: "#efdfb2"
  papel: "#ffffff"
  papel-2: "#f8f8f6"
  mostrador: "#f4f4f2"
  hover: "#f1f0ec"
  texto-2: "#36332c"
  texto-suave: "#5b574e"
  texto-tenue: "#6f6b62"
  raya: "#e3e1db"
  raya-fuerte: "#cbc8bf"
  estado-alistado: "#2f55d4"
  estado-ruta: "#c97a00"
  estado-ruta-texto: "#9a5b00"
  estado-entregado: "#17794f"
  estado-cancelado: "#9a968d"
  peligro: "#b42318"
typography:
  headline:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 650
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist Variable, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.06em"
  cifra:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "13.5px"
    fontWeight: 550
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
  total:
    fontFamily: "Geist Mono Variable, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 650
    letterSpacing: "-0.03em"
rounded:
  xs: "3px"
  sm: "5px"
  md: "6px"
  lg: "8px"
  xl: "12px"
spacing:
  fila: "46px"
  gutter-pc: "28px"
  gutter-cel: "16px"
  tarjeta: "16px 20px"
components:
  button-primary:
    backgroundColor: "{colors.tinta}"
    textColor: "{colors.papel}"
    rounded: "{rounded.sm}"
    height: "34px"
    padding: "0 13px"
  button-primary-hover:
    backgroundColor: "{colors.tinta-hover}"
  button-secondary:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.sm}"
    height: "34px"
  button-entregar:
    backgroundColor: "{colors.estado-entregado}"
    textColor: "{colors.papel}"
    rounded: "{rounded.md}"
    height: "46px"
  input:
    backgroundColor: "{colors.papel}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.sm}"
    height: "40px"
  card-tiquete:
    backgroundColor: "{colors.papel}"
    rounded: "{rounded.lg}"
    padding: "16px 20px"
  total-destacado:
    backgroundColor: "{colors.oro-wash}"
    textColor: "{colors.tinta}"
---

# Design System: Jasta

## Overview

**Creative North Star: "Tiquete de caja"**

Jasta se lee como el recibo térmico de un punto de venta: papel blanco, tinta casi negra, cifras que salen de la impresora en columnas tabulares y perforaciones punteadas que separan un renglón del otro. Es una herramienta de trabajo para alistar, despachar, entregar y cuadrar todo el día, así que la densidad manda y la decoración no tiene lugar. La identidad vive en los detalles que un recibo tiene y un admin genérico no: los puntos guía entre concepto y valor, el TOTAL subrayado con doble raya, el número de pedido en mono.

El oro de JT Hobbies & Accesorios (el borde de la JT del logo) es el único acento. No pinta superficies: marca lo activo (pestaña, sección del menú), lo seleccionado (talón de oro en la fila) y el foco. El color restante pertenece a los estados del pedido, y cada estado conserva el suyo.

Hay modo oscuro: el mismo tiquete en papel carbón, con tinta clara y un oro más luminoso.

**Key Characteristics:**
- Papel blanco sobre un mostrador gris muy claro; plano, sin sombras en reposo.
- Separadores punteados (perforación) en lugar de líneas sólidas entre renglones.
- Cifras, plata, números de pedido y fechas en Geist Mono tabular; todo lo demás en Geist.
- Un solo acento, el oro, en menos del 5 % de cualquier pantalla.
- Estado del pedido como punto de diámetro fijo más su nombre en su color.

## Colors

Neutros cálidos de papel y tinta, un oro de marca y una paleta de estados que solo aparece en los estados.

### Primary
- **Tinta de impresora** (tinta): texto principal, botón primario, raya bajo los encabezados de tabla y doble raya del TOTAL.
- **Oro JT** (oro): subrayado de la pestaña activa, ícono de la sección activa, talón de la fila seleccionada, foco, casillas, barras de gráfica y de metas.
- **Oro legible** (oro-texto): el oro cuando es texto sobre papel (enlaces, conteo de la pestaña activa, etiqueta del total destacado).
- **Lavado de oro** (oro-wash): fondo del total destacado, de la fila o tarjeta seleccionada y halo de foco en campos.

### Neutral
- **Papel** (papel): superficies de trabajo: tablas, paneles, tarjetas, hojas laterales.
- **Mostrador** (mostrador): fondo de la app detrás del papel.
- **Papel gastado** (papel-2): hover de filas, campo de búsqueda en reposo.
- **Texto suave / tenue** (texto-suave, texto-tenue): datos secundarios, etiquetas, ejes.
- **Raya / raya fuerte** (raya, raya-fuerte): bordes de contenedores y la perforación punteada.

### Estados del pedido
- **Por alistar**: anillo vacío en texto-tenue. **Alistado**: azul cobalto (estado-alistado). **En ruta**: ámbar (estado-ruta, texto estado-ruta-texto). **Entregado**: verde efectivo (estado-entregado). **Cancelado**: gris tachado (estado-cancelado).

### Named Rules
**The One Gold Rule.** El oro marca estado de interfaz (activo, seleccionado, foco), nunca decora. Si una superficie entera es dorada, está mal.

**The State Color Rule.** Azul, ámbar y verde existen solo para los estados del pedido. El único uso de color de estado fuera de una etiqueta de estado es el botón verde "Entregar", porque cierra la entrega y mueve plata.

## Typography

**Body Font:** Geist (variable, servida desde la app)
**Label/Mono Font:** Geist Mono (variable, servida desde la app)

**Character:** Una grotesca neutra para leer rápido y una mono de la misma familia para todo lo que es cifra, como lo imprime un tiquete.

### Hierarchy
- **Headline** (650, 22px; 20px en celular): título de cada vista, con el conteo en mono pequeño al lado.
- **Title** (650, 16px): títulos de panel y de hoja lateral.
- **Body** (400, 14px, 1.45): contenido de tablas y formularios.
- **Label** (600, 11px, 0.06em, MAYÚSCULAS): encabezados de tabla, títulos de sección, etiquetas de cifras.
- **Cifra** (Geist Mono 550, tabular): plata, cantidades, número de pedido, conteos.
- **Total** (Geist Mono 650, 24px; 20px en celular): el TOTAL del renglón final.

### Named Rules
**The Printer Rule.** Mono solo para lo que una caja registradora imprimiría como número: plata, cantidades, # de pedido, conteos y horas. Nunca para frases, nombres de productos ni etiquetas.

## Layout

Vistas de ancho completo en escritorio con márgenes laterales de 28px; las tablas llegan de borde a borde del papel. En celular el margen es 16px, las tablas se vuelven tarjetas y los filtros van en una sola fila que se desplaza de lado. El menú lateral mide 236px (64px contraído); bajo 860px desaparece y aparece la barra inferior de 60px. Las pantallas de tablero (Inicio, Mis entregas, Ranking) usan una columna centrada de hasta 820–1100px.

## Elevation & Depth

Plano por defecto: la profundidad la dan el papel blanco sobre el mostrador gris y las rayas, no las sombras. Solo lo que flota sobre el contenido lleva sombra.

### Shadow Vocabulary
- **Flotante** (`0 10px 30px rgba(23,21,17,.14), 0 2px 6px rgba(23,21,17,.08)`): hojas laterales, menú "Más", barra de acciones en lote y avisos.

### Named Rules
**The Flat Paper Rule.** Tarjetas, paneles y tablas no llevan sombra. Si algo necesita separarse, lleva una raya punteada.

## Shapes

Esquinas cortas de papel cortado: 5px en controles, 6px en botones grandes, 8px en paneles y tarjetas, 12px solo en hojas que suben desde abajo. Los separadores internos son punteados (1px dashed, raya-fuerte); los puntos guía son punteados finos (1px dotted). El TOTAL lleva doble raya de 3px en tinta.

## Components

### Buttons
- **Shape:** esquinas cortas (5px), 34px de alto (38px en celular).
- **Primary:** tinta llena con texto blanco; hover un tono más claro. En modo oscuro se invierte (papel claro, texto carbón).
- **Secondary:** papel con borde raya-fuerte; hover con borde tenue y fondo papel gastado.
- **Entregar / mover plata:** verde efectivo lleno, 46px de alto.
- **Peligro:** texto rojo sobre papel; hover con fondo de peligro lavado.

### Chips (pestañas de estado)
- **Style:** texto suave sin caja, conteo en mono tenue al lado.
- **State:** la activa en tinta 600 con subrayado de oro de 2px que crece desde el centro; su conteo pasa a oro legible.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** papel.
- **Shadow Strategy:** ninguna (ver The Flat Paper Rule).
- **Border:** 1px raya.
- **Internal Padding:** 16px 20px; las acciones de la tarjeta van debajo de una perforación punteada que llega de borde a borde.

### Inputs / Fields
- **Style:** papel, borde raya-fuerte, 5px, 40px de alto; flecha de select dibujada.
- **Focus:** borde oro con halo de 3px en lavado de oro; el cursor de texto es dorado.
- **Error:** caja con borde y fondo de peligro lavado.

### Navigation
- **Menú lateral:** papel con borde derecho; logo JT, "Jasta" y "Hobbies & Accesorios" en oro legible. Secciones en texto suave con ícono tenue; la activa en tinta sobre hover con el ícono en oro.
- **Barra inferior (celular):** íconos tenues; la activa con ícono de oro y una raya de oro arriba. "Nuevo" es un cuadro de tinta.

### Tabla de tiquete (signature)
Encabezados en label tenue en mayúsculas sobre una raya de tinta; renglones de 46px separados por perforación punteada; # de pedido y plata en mono, la plata alineada a la derecha. La fila seleccionada lleva lavado de oro y un talón de oro de 3px a la izquierda.

### Renglones con puntos guía (signature)
"Concepto ······ $ valor": la etiqueta en texto suave, puntos guía finos hasta el valor en mono y, al final, el TOTAL en mayúsculas con doble raya. Se usa en el resumen de Inicio, en los productos del detalle del pedido y en el desglose del cuadre del mensajero.

### Estado
Punto de 8px más el nombre del estado en su color. "Por alistar" es un anillo vacío; "Cancelado" va tachado.

## Do's and Don'ts

### Do:
- **Do** separar renglones con la perforación punteada (1px dashed raya-fuerte), no con líneas sólidas.
- **Do** poner toda cifra (plata, # de pedido, conteos, horas) en Geist Mono tabular.
- **Do** usar el oro solo para activo, seleccionado y foco.
- **Do** cerrar cada suma con el renglón TOTAL a doble raya.
- **Do** mantener la JT del logo sobre una placa clara en modo oscuro (la tinta del logo es negra).

### Don't:
- **Don't** usar tarjetas con sombra, degradados o vidrio. El papel es plano.
- **Don't** usar fichas de KPI con número gigante como estructura de tablero. Las cifras van como renglones de tiquete.
- **Don't** poner etiquetas pequeñas encima de los títulos (kickers). La fecha o el periodo van al lado del título.
- **Don't** usar azul, ámbar o verde fuera de los estados del pedido (salvo el botón Entregar).
- **Don't** tocar el rótulo impreso de 100×100 mm: tiene su propio diseño y no sigue este sistema.
