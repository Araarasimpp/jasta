import {Z as Zr,p as pn}from'./chunk-CR7JhsFm.js';var $=/precio|total|venta|costo|ganancia|domicilio|efectivo|transferencia|valor|cobrado|base|compra|subtotal|productos \$/i,T=/^(precio|p\.)/i,v=/tel[eé]fono|celular|sku|c[oó]digo|c[eé]dula|nit|documento/i,w=/^(cantidad|unidades|pedidos|entregas|und\.?)$/i;function k(n,e){let s=e.slice(0,50).map(r=>n.valor(r)).filter(r=>r!=null&&r!=="");return v.test(n.titulo)?"texto":/^(fecha|día|dia)$/i.test(n.titulo)&&s.every(r=>typeof r=="string"&&/^\d{4}-\d{2}-\d{2}/.test(r))?"fecha":s.length>0&&s.every(r=>typeof r=="number"||typeof r=="string"&&/^-?\d+(\.\d+)?$/.test(r))?w.test(n.titulo)?"cantidad":$.test(n.titulo)?"pesos":"numero":"texto"}function p(n){let e="";for(n++;n>0;n=Math.floor((n-1)/26))e=String.fromCharCode(65+(n-1)%26)+e;return e}var h=n=>n.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");function C(n){let e=n.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);return e?Date.UTC(+e[1],+e[2]-1,+e[3])/864e5+25569+(+(e[4]??0)*60+ +(e[5]??0))/1440:null}var S=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;$&quot;\\ #,##0;\\-&quot;$&quot;\\ #,##0"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy\\ hh:mm"/><numFmt numFmtId="166" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top style="thin"><color rgb="FF0F172A"/></top><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="9">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="3" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;function N(n,e,s){let m=e.map(t=>k(t,s)),r=e.map((t,o)=>{let l=t.titulo.length;for(let a of s.slice(0,300)){let c=t.valor(a),g=m[o]==="fecha"?16:m[o]==="pesos"?String(Math.round(Number(c)||0)).length+5:String(c??"").length;g>l&&(l=g);}return Math.min(60,Math.max(8,l+2))}),u=(t,o,l)=>{if(o==null||o==="")return "";if(l==="fecha"&&typeof o=="string"){let a=C(o);if(a!==null)return `<c r="${t}" s="${o.length>10?4:5}"><v>${a}</v></c>`}if(l==="pesos"||l==="cantidad"||l==="numero"){let a=Number(o);if(Number.isFinite(a))return `<c r="${t}"${l==="pesos"?' s="2"':l==="cantidad"?' s="3"':""}><v>${a}</v></c>`}return `<c r="${t}" t="inlineStr"><is><t xml:space="preserve">${h(String(o))}</t></is></c>`},f=p(e.length-1),i=[];i.push(`<row r="1">${e.map((t,o)=>`<c r="${p(o)}1" t="inlineStr" s="1"><is><t>${h(t.titulo)}</t></is></c>`).join("")}</row>`),s.forEach((t,o)=>{let l=o+2;i.push(`<row r="${l}">${e.map((a,c)=>u(`${p(c)}${l}`,a.valor(t),m[c])).join("")}</row>`);});let x=t=>m[t]==="pesos"&&!T.test(e[t].titulo)||m[t]==="cantidad";if(s.length>0&&e.some((t,o)=>x(o))){let t=s.length+2;i.push(`<row r="${t}">${e.map((o,l)=>{let a=`${p(l)}${t}`;return x(l)?`<c r="${a}" s="${m[l]==="pesos"?7:8}"><f>SUBTOTAL(9,${p(l)}2:${p(l)}${t-1})</f></c>`:l===0?`<c r="${a}" t="inlineStr" s="6"><is><t>Total</t></is></c>`:`<c r="${a}" s="6"/>`}).join("")}</row>`);}let F=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${r.map((t,o)=>`<col min="${o+1}" max="${o+1}" width="${t}" customWidth="1"/>`).join("")}</cols>
<sheetData>${i.join("")}</sheetData>
${s.length?`<autoFilter ref="A1:${f}${s.length+1}"/>`:""}
</worksheet>`,y=h(n.replace(/[[\]:*?/\\]/g," ").slice(0,31)||"Hoja1"),b={"[Content_Types].xml":Zr(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),"_rels/.rels":Zr(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),"xl/workbook.xml":Zr(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${y}" sheetId="1" r:id="rId1"/></sheets>
${s.length?`<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${y.replace(/'/g,"''")}'!$A$1:$${f}$${s.length+1}</definedName></definedNames>`:""}
</workbook>`),"xl/_rels/workbook.xml.rels":Zr(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),"xl/styles.xml":Zr(S),"xl/worksheets/sheet1.xml":Zr(F)};return pn(b,{level:6})}function R(n,e,s,m){let r=n.replace(/_\d{4}-\d{2}-\d{2}.*$/,"").replace(/_/g," ").trim(),u=N(m??(r.charAt(0).toUpperCase()+r.slice(1)||"Reporte"),e,s),f=new Blob([u],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),i=document.createElement("a");i.href=URL.createObjectURL(f),i.download=(n.replace(/\.(csv|xlsx)$/i,"")||"reporte")+".xlsx",document.body.appendChild(i),i.click(),i.remove(),setTimeout(()=>URL.revokeObjectURL(i.href),4e3);}export{R};