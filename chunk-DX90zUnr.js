import {v as vr}from'./chunk-CMS9tuIm.js';import {aY as w$1}from'./main-ZR4UL33X.js';var f=w$1(vr()),$={devolucion:"DEVOLUCI\xD3N",cambio:"CAMBIO",garantia:"GARANT\xCDA"},g={nombre_negocio:"Jasta Technology",telefonos:null,redes:null,texto_garantia:"Todos nuestros productos cuentan con garant\xEDa. Guarda este r\xF3tulo: es el soporte para la garant\xEDa."};function w(){return new URL("assets/icon/logo-rotulo.png",document.baseURI).href}async function j(e){let{data:o,error:r}=await e.from("configuracion").select("nombre_negocio, telefonos, redes, texto_garantia, direccion").eq("id",true).single();return r||!o?g:{nombre_negocio:o.nombre_negocio?.trim()||g.nombre_negocio,telefonos:o.telefonos?.trim()||null,redes:o.redes?.trim()||null,texto_garantia:o.texto_garantia?.trim()||null,direccion:o.direccion?.trim()||null}}function t(e){return String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function y(e){return Number(e||0).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})}function n(e){return (e??"").toLocaleUpperCase("es-CO")}function u(e){return (e??"").split(/\s*[-,/|]\s*(?=\d)|\n/).map(o=>o.trim()).filter(Boolean)}function _(e){let o=(0, f.default)(0,"Q");return o.addData(`JASTA-${e}`,"Alphanumeric"),o.make(),o.createSvgTag({cellSize:4,margin:8,scalable:true}).replace("<svg ",'<svg shape-rendering="crispEdges" ')}function O(e,o){let r=u(o.telefonos).map(i=>`<div>${t(i)}</div>`).join(""),s=3,c=e.productos.length>s?[...e.productos.slice(0,s-1).map(i=>t(i)),`y ${e.productos.length-(s-1)} productos m\xE1s`]:e.productos.map(i=>t(i)),l=c.length?c.join("<br>"):"\u2014",a=(i,m,p="")=>`<tr${p?` class="${p}"`:""}><th>${i}</th><td><div class="v">${m||"\u2014"}</div></td></tr>`,[d,b,h]=new Date(e.created_at).toLocaleDateString("en-CA",{timeZone:"America/Bogota"}).split("-");return `
  <section class="rotulo">
    <header class="cabecera">
      <div class="marca"><img class="logo" src="${w()}" alt="${t(o.nombre_negocio)}" /></div>

      <div class="qr">${_(e.numero)}<span>#${t(e.numero)}</span></div>

      <div class="contacto">
        <div class="fecha">
          <span class="etiqueta">Fecha</span>
          <div class="fecha-cajas">
            <span>${h}</span><span>${b}</span><span class="anio">${d}</span>
          </div>
        </div>
        ${r?`<div class="telefonos">${r}</div>`:""}
        ${o.redes?`<div class="redes">${t(o.redes)}</div>`:""}
      </div>
    </header>

    ${e.especial?`
    <div class="tipo-especial">${$[e.especial.tipo]}</div>
    <div class="cobro">
      <span class="cobro-label">${e.especial.tipo==="garantia"?"Valor":"Valor a cobrar"}</span>
      <strong class="cobro-valor">${t(e.especial.cobro)}</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${a("Pedido","#"+t(e.numero),"pedido")}
      ${a("Nombre",t(e.cliente_nombre),"destacado")}
      ${a("Direcci\xF3n",t(n(e.direccion)),"destacado")}
      ${a("Barrio",t(e.barrio))}
      ${a("Celular",t(n(e.cliente_telefono)),"fuerte")}
      ${e.especial.recoge.length?a("Recoger",e.especial.recoge.slice(0,3).map(i=>t(i)).join("<br>"),"productos"):""}
      ${e.especial.entrega.length?a("Entregar",e.especial.entrega.slice(0,3).map(i=>t(i)).join("<br>"),"productos"):""}
      ${a("Observaci\xF3n",t(n([e.especial.nota,e.observaciones].filter(Boolean).join(" \xB7 "))),"fuerte")}
    </table>
    </div>`:e.nacional?`
    <div class="cobro">
      <span class="cobro-label">Env\xEDo nacional</span>
      <strong class="cobro-valor">PAGADO \xB7 NO COBRAR</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${a("Pedido","#"+t(e.numero),"pedido")}
      ${a("Para",t(e.cliente_nombre),"destacado")}
      ${a("C.C.",t(e.nacional.cedula),"fuerte")}
      ${a("Direcci\xF3n",t(n(e.direccion)),"destacado")}
      ${a("Ciudad",t(n([e.nacional.ciudad,e.nacional.departamento].filter(Boolean).join(" - "))),"destacado")}
      ${a("Celular",t(n(e.cliente_telefono)),"fuerte")}
      ${a("Contenido",l,"productos")}
      ${a("Remite",t([o.nombre_negocio,o.direccion,u(o.telefonos)[0]].filter(Boolean).join(" \xB7 ")))}
    </table>
    </div>`:`
    <div class="cobro">
      <span class="cobro-label">Valor a cobrar</span>
      <strong class="cobro-valor">${y(e.total)}</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${a("Pedido","#"+t(e.numero),"pedido")}
      ${a("Nombre",t(e.cliente_nombre),"destacado")}
      ${a("Direcci\xF3n",t(n(e.direccion)),"destacado")}
      ${a("Barrio",t(e.barrio))}
      ${a("Celular",t(n(e.cliente_telefono)),"fuerte")}
      ${a("Producto",l,"productos")}
      ${a("Observaci\xF3n",t(n(e.observaciones)),"fuerte")}
    </table>
    </div>`}

    ${o.texto_garantia?`<p class="garantia">${t(o.texto_garantia)}</p>`:""}
  </section>`}var C=`
  @page { size: 100mm 100mm; }
  * { box-sizing: border-box; }
  /* Solo quita el espacio que el navegador pone por defecto dentro de la p\xE1gina */
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .rotulo {
    width: 100%;
    /* En impresi\xF3n, 100vh es el alto disponible de la p\xE1gina (ya sin m\xE1rgenes) */
    height: 100vh;
    padding: 2.5mm 3mm 2mm;
    border: 0.3mm solid #000;
    border-radius: 3mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .rotulo:last-child { page-break-after: auto; break-after: auto; }

  /* Cabecera: logo a la izquierda, fecha y contacto a la derecha */
  .cabecera {
    display: flex;
    align-items: center;
    gap: 3mm;
    padding-bottom: 1.5mm;
    border-bottom: 0.3mm solid #000;
  }
  /* QR del pedido, en el centro de la cabecera (lo lee el bot de Telegram) */
  .qr { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 0.6mm; margin: 0 auto; }
  .qr svg { display: block; width: 24mm; height: 24mm; margin: -2mm; }
  .qr span { font-size: 7pt; font-weight: bold; letter-spacing: 0.04em; }
  .marca { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 1mm; max-width: 44mm; }
  /* Sin el nombre debajo, el logo ocupa ese espacio: la cabecera queda casi del mismo alto */
  .logo { width: 28mm; height: 28mm; object-fit: contain; }
  .contacto {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.9mm;
    text-align: right;
    font-size: 8.5pt;
    line-height: 1.25;
  }
  .etiqueta {
    display: block;
    margin-bottom: 0.6mm;
    font-size: 6.5pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .fecha-cajas { display: flex; gap: 1mm; justify-content: flex-end; }
  .fecha-cajas span {
    min-width: 7mm;
    padding: 0.5mm 1mm;
    border: 0.25mm solid #000;
    border-radius: 0.6mm;
    font-size: 9pt;
    font-weight: bold;
    text-align: center;
  }
  .fecha-cajas .anio { min-width: 11mm; }
  .telefonos { font-size: 9pt; font-weight: bold; }
  .redes { font-size: 8.5pt; }

  /* Devoluci\xF3n, cambio o garant\xEDa: franja negra bien visible arriba del valor */
  .tipo-especial {
    margin-top: 1.4mm;
    padding: 0.8mm 0;
    background: #000;
    color: #fff;
    font-size: 15pt;
    font-weight: 900;
    letter-spacing: 1.5mm;
    text-align: center;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .cobro {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 2mm;
    margin: 1.6mm 0 1.2mm;
  }
  .cobro-label { font-size: 10pt; font-weight: bold; text-transform: uppercase; }
  .cobro-valor {
    padding: 0.8mm 3mm;
    border: 0.5mm solid #000;
    border-radius: 1.2mm;
    font-size: 14pt;
    white-space: nowrap;
  }

  /* Los datos ocupan el espacio libre; si algo no cabe se recorta aqu\xED y la
     garant\xEDa de abajo siempre se ve completa */
  .cuerpo { flex: 1 1 auto; min-height: 0; overflow: hidden; }
  .datos { width: 100%; border-collapse: collapse; font-size: 8.5pt; line-height: 1.14; }
  .datos th, .datos td { padding: 0.3mm 0; vertical-align: top; text-align: left; }
  .datos th { width: 21mm; font-weight: bold; }
  .datos td { overflow-wrap: anywhere; }
  .datos tr.destacado td { font-size: 10pt; font-weight: bold; }
  .datos tr.fuerte td { font-weight: bold; }
  /* Textos largos: m\xE1ximo 2 l\xEDneas (productos: 3) para no salirse de la etiqueta */
  .datos .v { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
  .datos tr.productos .v { -webkit-line-clamp: 3; }

  .garantia {
    flex: 0 0 auto;
    margin: 1mm 0 0;
    padding-top: 1.2mm;
    border-top: 0.25mm dashed #000;
    font-size: 6.5pt;
    line-height: 1.25;
    text-align: center;
  }

  /* Solo en pantalla (vista previa): fondo y borde de referencia del tama\xF1o
     real. Nada de esto se imprime. */
  @media screen {
    body { background: #f4f5f7; padding: 16px 0; }
    .rotulo { width: 100mm; height: 100mm; margin: 0 auto 16px; background: #fff; }
  }
`;function A(e,o="R\xF3tulos",r=""){return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${t(o)}</title>
    <style>${C}${r}</style>
  </head>
  <body>${e.join("")}</body>
</html>`}var z=`
  @media screen {
    body { padding: 12px 0; }
    .rotulo { margin-bottom: 0; }
  }
  @media (max-width: 400px) { body { zoom: 0.9; } }
  @media (max-width: 360px) { body { zoom: 0.82; } }
  @media (max-width: 330px) { body { zoom: 0.74; } }
`;function k(e){document.querySelectorAll("iframe.marco-impresion").forEach(s=>s.remove());let o=document.createElement("iframe");o.className="marco-impresion",o.setAttribute("aria-hidden","true"),o.tabIndex=-1,o.style.cssText="position:fixed;left:-10000px;top:0;width:100mm;height:100mm;border:0;opacity:0;pointer-events:none;";let r=false;o.onload=async()=>{if(r)return;r=true;let s=o.contentDocument,c=Array.from(s?.images??[]).filter(a=>!a.complete);await Promise.race([Promise.all(c.map(a=>new Promise(d=>{a.onload=a.onerror=d;}))),new Promise(a=>setTimeout(a,2500))]);let l=o.contentWindow;l&&(l.focus(),l.print(),setTimeout(()=>o.remove(),12e4));},o.srcdoc=e,document.body.appendChild(o);}export{A,O,g,j,k,z};