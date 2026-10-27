# Guion de voz · Video del catálogo público (1:30)

Texto para generar en ElevenLabs. Cada bloque tiene el tiempo en que aparece en el video;
el texto está medido para leerse con calma en ese espacio.

**Recomendación de voz:** español latinoamericano (Colombia o neutro), cálida y cercana,
ritmo conversacional. En ElevenLabs: modelo *Multilingual v2*, estabilidad ~50 %,
similitud ~75 %, estilo bajo (0–15 %). Genera **todo en un solo archivo** y deja una pausa
corta (puedes usar `<break time="0.6s" />`) entre bloques.

| Tiempo | Escena | Voz |
|---|---|---|
| 0:00 – 0:05 | El problema | ¿Todavía escribes cada pedido a mano? |
| 0:05 – 0:10 | El desgaste | Copiar el mensaje, calcular el domicilio, volver a escribir todo… otra vez. |
| 0:10 – 0:16 | La solución | Ahora tienes tu propio catálogo. Un enlace, con todos tus productos. |
| 0:16 – 0:32 | 01 · Compartes | Entra a Pedidos de la tienda y toca Compartir. Mándalo a tus estados, a Instagram o a tus grupos. Es tu enlace, con tu nombre. |
| 0:32 – 0:50 | 02 · Tu cliente | Tu cliente abre el catálogo, ve las fotos y los precios, y elige. Lo agotado ya aparece marcado. Escribe su dirección, el domicilio se calcula solo… y hace el pedido, sin escribirte. |
| 0:50 – 1:06 | 03 · Tú confirmas | A ti te llega el aviso al instante. Ves todo el pedido y, si el cliente ha tenido problemas, la app te lo dice. Le escribes, confirmas, y pasa directo a alistamiento. |
| 1:06 – 1:14 | Sin sorpresas | Los precios son los sugeridos y nadie los cambia. Lo agotado no se puede pedir. Y tu comisión es la de siempre. |
| 1:14 – 1:20 | Impacto | Casi cuatrocientos productos. Un solo enlace. Cero pedidos escritos a mano. |
| 1:20 – 1:30 | Cierre | Jasta. Vende mientras tu cliente elige. Busca tu enlace en Más, Pedidos de la tienda, y compártelo hoy. |

## Texto corrido (para pegar en ElevenLabs)

```
¿Todavía escribes cada pedido a mano? <break time="0.6s" />
Copiar el mensaje, calcular el domicilio, volver a escribir todo… otra vez. <break time="0.8s" />
Ahora tienes tu propio catálogo. Un enlace, con todos tus productos. <break time="0.8s" />
Entra a Pedidos de la tienda y toca Compartir. Mándalo a tus estados, a Instagram o a tus grupos. Es tu enlace, con tu nombre. <break time="0.8s" />
Tu cliente abre el catálogo, ve las fotos y los precios, y elige. Lo agotado ya aparece marcado. Escribe su dirección, el domicilio se calcula solo… y hace el pedido, sin escribirte. <break time="0.8s" />
A ti te llega el aviso al instante. Ves todo el pedido y, si el cliente ha tenido problemas, la app te lo dice. Le escribes, confirmas, y pasa directo a alistamiento. <break time="0.8s" />
Los precios son los sugeridos y nadie los cambia. Lo agotado no se puede pedir. Y tu comisión es la de siempre. <break time="0.6s" />
Casi cuatrocientos productos. Un solo enlace. Cero pedidos escritos a mano. <break time="0.8s" />
Jasta. Vende mientras tu cliente elige. Busca tu enlace en Más, Pedidos de la tienda, y compártelo hoy.
```

## Cuando tengas el audio

Mándalo como MP3. Si ElevenLabs te da las marcas de tiempo (*timestamps* o el JSON de
alineación), mándalas también: con eso cada animación cae justo en su palabra. El archivo
va en `public/voz.mp3` y los tiempos se ajustan en `src/guion.ts`.

## Cómo renderizar

```
npm install
REMOTION_CHROME=/ruta/a/chrome npx remotion render Catalogo ../jasta-catalogo.mp4 --props='{"conVoz":true}'
```
La música (`public/musica.mp3`) se genera con `python3 scripts/musica.py` (ver el archivo).
