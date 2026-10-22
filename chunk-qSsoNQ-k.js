function u(t,e=""){let n=(t??"").replace(/\D/g,"");return `https://wa.me/${n.length===10?"57"+n:n}${e?"?text="+encodeURIComponent(e):""}`}var s="https://whatsapp.com/channel/0029Vb72Rzw9MF8xwEjkqR0c";function a(t){return t.length<=1?t[0]??"":t.slice(0,-1).join(", ")+" y "+t[t.length-1]}function c(t){let e=t.map(n=>{let o=[n.color,n.talla?"talla "+n.talla:null].filter(Boolean).join(", ");return `${n.cantidad>1?n.cantidad+" ":""}${n.nombre.trim()}${o?` (${o})`:""}`});return e.length>3?`${e.slice(0,2).join(", ")} y ${e.length-2} productos m\xE1s`:a(e)}function l(t,e){let n=[...new Set(e.map(r=>r.trim()).filter(Boolean))],o=n.length?a(n):"tu \xFAltima compra";return `Hola ${t.trim()} te hablamos de Jasta Technology, quisiera preguntarte \xBFc\xF3mo te fue con tu pedido de ${o}?


Te invitamos a que nos sigas en nuestro canal de WhatsApp, tenemos muchos productos novedosos, hogar, herramientas, jugueter\xEDa gadgets y mucho m\xE1s

${s}

S\xEDguenos, m\xE1ndanos captura y participa en nuestras rifas mensuales \u{1F973}`}export{c,l,s,u};