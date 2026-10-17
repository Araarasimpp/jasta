import {f}from'./chunk-BfiSb0XR.js';import {c as c$1}from'./chunk-B829oREN.js';import {c}from'./chunk-C1Gww3Q2.js';import {af as j,d as y,w as w8,bj as w,bk as v}from'./main-HOSBZTXU.js';var ut=v((ft,st)=>{var it=(function(){var w=function(h,m){var d=236,c=17,a=h,l=L[m],r=null,t=0,v=null,i=[],u={},A=function(n,o){t=a*4+17,r=(function(e){for(var f=new Array(e),s=0;s<e;s+=1){f[s]=new Array(e);for(var g=0;g<e;g+=1)f[s][g]=null;}return f})(t),B(0,0),B(t-7,0),B(0,t-7),R(),E(),S(n,o),a>=7&&U(n),v==null&&(v=wt(a,l,i)),H(v,o);},B=function(n,o){for(var e=-1;e<=7;e+=1)if(!(n+e<=-1||t<=n+e))for(var f=-1;f<=7;f+=1)o+f<=-1||t<=o+f||(0<=e&&e<=6&&(f==0||f==6)||0<=f&&f<=6&&(e==0||e==6)||2<=e&&e<=4&&2<=f&&f<=4?r[n+e][o+f]=true:r[n+e][o+f]=false);},C=function(){for(var n=0,o=0,e=0;e<8;e+=1){A(true,e);var f=T.getLostPoint(u);(e==0||n>f)&&(n=f,o=e);}return o},E=function(){for(var n=8;n<t-8;n+=1)r[n][6]==null&&(r[n][6]=n%2==0);for(var o=8;o<t-8;o+=1)r[6][o]==null&&(r[6][o]=o%2==0);},R=function(){for(var n=T.getPatternPosition(a),o=0;o<n.length;o+=1)for(var e=0;e<n.length;e+=1){var f=n[o],s=n[e];if(r[f][s]==null)for(var g=-2;g<=2;g+=1)for(var x=-2;x<=2;x+=1)g==-2||g==2||x==-2||x==2||g==0&&x==0?r[f+g][s+x]=true:r[f+g][s+x]=false;}},U=function(n){for(var o=T.getBCHTypeNumber(a),e=0;e<18;e+=1){var f=!n&&(o>>e&1)==1;r[Math.floor(e/3)][e%3+t-8-3]=f;}for(var e=0;e<18;e+=1){var f=!n&&(o>>e&1)==1;r[e%3+t-8-3][Math.floor(e/3)]=f;}},S=function(n,o){for(var e=l<<3|o,f=T.getBCHTypeInfo(e),s=0;s<15;s+=1){var g=!n&&(f>>s&1)==1;s<6?r[s][8]=g:s<8?r[s+1][8]=g:r[t-15+s][8]=g;}for(var s=0;s<15;s+=1){var g=!n&&(f>>s&1)==1;s<8?r[8][t-s-1]=g:s<9?r[8][15-s-1+1]=g:r[8][15-s-1]=g;}r[t-8][8]=!n;},H=function(n,o){for(var e=-1,f=t-1,s=7,g=0,x=T.getMaskFunction(o),b=t-1;b>0;b-=2)for(b==6&&(b-=1);;){for(var k=0;k<2;k+=1)if(r[f][b-k]==null){var P=false;g<n.length&&(P=(n[g]>>>s&1)==1);var y=x(f,b-k);y&&(P=!P),r[f][b-k]=P,s-=1,s==-1&&(g+=1,s=7);}if(f+=e,f<0||t<=f){f-=e,e=-e;break}}},F=function(n,o){for(var e=0,f=0,s=0,g=new Array(o.length),x=new Array(o.length),b=0;b<o.length;b+=1){var k=o[b].dataCount,P=o[b].totalCount-k;f=Math.max(f,k),s=Math.max(s,P),g[b]=new Array(k);for(var y=0;y<g[b].length;y+=1)g[b][y]=255&n.getBuffer()[y+e];e+=k;var O=T.getErrorCorrectPolynomial(P),N=D(g[b],O.getLength()-1),W=N.mod(O);x[b]=new Array(O.getLength()-1);for(var y=0;y<x[b].length;y+=1){var z=y+W.getLength()-x[b].length;x[b][y]=z>=0?W.getAt(z):0;}}for(var tt=0,y=0;y<o.length;y+=1)tt+=o[y].totalCount;for(var V=new Array(tt),G=0,y=0;y<f;y+=1)for(var b=0;b<o.length;b+=1)y<g[b].length&&(V[G]=g[b][y],G+=1);for(var y=0;y<s;y+=1)for(var b=0;b<o.length;b+=1)y<x[b].length&&(V[G]=x[b][y],G+=1);return V},wt=function(n,o,e){for(var f=$.getRSBlocks(n,o),s=K(),g=0;g<e.length;g+=1){var x=e[g];s.put(x.getMode(),4),s.put(x.getLength(),T.getLengthInBits(x.getMode(),n)),x.write(s);}for(var b=0,g=0;g<f.length;g+=1)b+=f[g].dataCount;if(s.getLengthInBits()>b*8)throw "code length overflow. ("+s.getLengthInBits()+">"+b*8+")";for(s.getLengthInBits()+4<=b*8&&s.put(0,4);s.getLengthInBits()%8!=0;)s.putBit(false);for(;!(s.getLengthInBits()>=b*8||(s.put(d,8),s.getLengthInBits()>=b*8));)s.put(c,8);return F(s,f)};u.addData=function(n,o){o=o||"Byte";var e=null;switch(o){case "Numeric":e=Y(n);break;case "Alphanumeric":e=j(n);break;case "Byte":e=Q(n);break;case "Kanji":e=J(n);break;default:throw "mode:"+o}i.push(e),v=null;},u.isDark=function(n,o){if(n<0||t<=n||o<0||t<=o)throw n+","+o;return r[n][o]},u.getModuleCount=function(){return t},u.make=function(){if(a<1){for(var n=1;n<40;n++){for(var o=$.getRSBlocks(n,l),e=K(),f=0;f<i.length;f++){var s=i[f];e.put(s.getMode(),4),e.put(s.getLength(),T.getLengthInBits(s.getMode(),n)),s.write(e);}for(var g=0,f=0;f<o.length;f++)g+=o[f].dataCount;if(e.getLengthInBits()<=g*8)break}a=n;}A(false,C());},u.createTableTag=function(n,o){n=n||2,o=typeof o>"u"?n*4:o;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+o+"px;",e+='">',e+="<tbody>";for(var f=0;f<u.getModuleCount();f+=1){e+="<tr>";for(var s=0;s<u.getModuleCount();s+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+n+"px;",e+=" height: "+n+"px;",e+=" background-color: ",e+=u.isDark(f,s)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>";}return e+="</tbody>",e+="</table>",e},u.createSvgTag=function(n,o,e,f){var s={};typeof arguments[0]=="object"&&(s=arguments[0],n=s.cellSize,o=s.margin,e=s.alt,f=s.title),n=n||2,o=typeof o>"u"?n*4:o,e=typeof e=="string"?{text:e}:e||{},e.text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,f=typeof f=="string"?{text:f}:f||{},f.text=f.text||null,f.id=f.text?f.id||"qrcode-title":null;var g=u.getModuleCount()*n+o*2,x,b,k,P,y="",O;for(O="l"+n+",0 0,"+n+" -"+n+",0 0,-"+n+"z ",y+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',y+=s.scalable?"":' width="'+g+'px" height="'+g+'px"',y+=' viewBox="0 0 '+g+" "+g+'" ',y+=' preserveAspectRatio="xMinYMin meet"',y+=f.text||e.text?' role="img" aria-labelledby="'+q([f.id,e.id].join(" ").trim())+'"':"",y+=">",y+=f.text?'<title id="'+q(f.id)+'">'+q(f.text)+"</title>":"",y+=e.text?'<description id="'+q(e.id)+'">'+q(e.text)+"</description>":"",y+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',y+='<path d="',k=0;k<u.getModuleCount();k+=1)for(P=k*n+o,x=0;x<u.getModuleCount();x+=1)u.isDark(k,x)&&(b=x*n+o,y+="M"+b+","+P+O);return y+='" stroke="transparent" fill="black"/>',y+="</svg>",y},u.createDataURL=function(n,o){n=n||2,o=typeof o>"u"?n*4:o;var e=u.getModuleCount()*n+o*2,f=o,s=e-o;return xt(e,e,function(g,x){if(f<=g&&g<s&&f<=x&&x<s){var b=Math.floor((g-f)/n),k=Math.floor((x-f)/n);return u.isDark(k,b)?0:1}else return 1})},u.createImgTag=function(n,o,e){n=n||2,o=typeof o>"u"?n*4:o;var f=u.getModuleCount()*n+o*2,s="";return s+="<img",s+=' src="',s+=u.createDataURL(n,o),s+='"',s+=' width="',s+=f,s+='"',s+=' height="',s+=f,s+='"',e&&(s+=' alt="',s+=q(e),s+='"'),s+="/>",s};var q=function(n){for(var o="",e=0;e<n.length;e+=1){var f=n.charAt(e);switch(f){case "<":o+="&lt;";break;case ">":o+="&gt;";break;case "&":o+="&amp;";break;case '"':o+="&quot;";break;default:o+=f;break}}return o},yt=function(n){var o=1;n=typeof n>"u"?o*2:n;var e=u.getModuleCount()*o+n*2,f=n,s=e-n,g,x,b,k,P,y={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},O={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "},N="";for(g=0;g<e;g+=2){for(b=Math.floor((g-f)/o),k=Math.floor((g+1-f)/o),x=0;x<e;x+=1)P="\u2588",f<=x&&x<s&&f<=g&&g<s&&u.isDark(b,Math.floor((x-f)/o))&&(P=" "),f<=x&&x<s&&f<=g+1&&g+1<s&&u.isDark(k,Math.floor((x-f)/o))?P+=" ":P+="\u2588",N+=n<1&&g+1>=s?O[P]:y[P];N+=`
`;}return e%2&&n>0?N.substring(0,N.length-e-1)+Array(e+1).join("\u2580"):N.substring(0,N.length-1)};return u.createASCII=function(n,o){if(n=n||1,n<2)return yt(o);n-=1,o=typeof o>"u"?n*2:o;var e=u.getModuleCount()*n+o*2,f=o,s=e-o,g,x,b,k,P=Array(n+1).join("\u2588\u2588"),y=Array(n+1).join("  "),O="",N="";for(g=0;g<e;g+=1){for(b=Math.floor((g-f)/n),N="",x=0;x<e;x+=1)k=1,f<=x&&x<s&&f<=g&&g<s&&u.isDark(b,Math.floor((x-f)/n))&&(k=0),N+=k?P:y;for(b=0;b<n;b+=1)O+=N+`
`;}return O.substring(0,O.length-1)},u.renderTo2dContext=function(n,o){o=o||2;for(var e=u.getModuleCount(),f=0;f<e;f++)for(var s=0;s<e;s++)n.fillStyle=u.isDark(f,s)?"black":"white",n.fillRect(f*o,s*o,o,o);},u};w.stringToBytesFuncs={default:function(h){for(var m=[],d=0;d<h.length;d+=1){var c=h.charCodeAt(d);m.push(c&255);}return m}},w.stringToBytes=w.stringToBytesFuncs.default,w.createStringToBytes=function(h,m){var d=(function(){for(var a=pt(h),l=function(){var E=a.read();if(E==-1)throw "eof";return E},r=0,t={};;){var v=a.read();if(v==-1)break;var i=l(),u=l(),A=l(),B=String.fromCharCode(v<<8|i),C=u<<8|A;t[B]=C,r+=1;}if(r!=m)throw r+" != "+m;return t})(),c=63;return function(a){for(var l=[],r=0;r<a.length;r+=1){var t=a.charCodeAt(r);if(t<128)l.push(t);else {var v=d[a.charAt(r)];typeof v=="number"?(v&255)==v?l.push(v):(l.push(v>>>8),l.push(v&255)):l.push(c);}}return l}};var p={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},L={L:1,M:0,Q:3,H:2},_={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},T=(function(){var h=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],m=1335,d=7973,c=21522,a={},l=function(r){for(var t=0;r!=0;)t+=1,r>>>=1;return t};return a.getBCHTypeInfo=function(r){for(var t=r<<10;l(t)-l(m)>=0;)t^=m<<l(t)-l(m);return (r<<10|t)^c},a.getBCHTypeNumber=function(r){for(var t=r<<12;l(t)-l(d)>=0;)t^=d<<l(t)-l(d);return r<<12|t},a.getPatternPosition=function(r){return h[r-1]},a.getMaskFunction=function(r){switch(r){case _.PATTERN000:return function(t,v){return (t+v)%2==0};case _.PATTERN001:return function(t,v){return t%2==0};case _.PATTERN010:return function(t,v){return v%3==0};case _.PATTERN011:return function(t,v){return (t+v)%3==0};case _.PATTERN100:return function(t,v){return (Math.floor(t/2)+Math.floor(v/3))%2==0};case _.PATTERN101:return function(t,v){return t*v%2+t*v%3==0};case _.PATTERN110:return function(t,v){return (t*v%2+t*v%3)%2==0};case _.PATTERN111:return function(t,v){return (t*v%3+(t+v)%2)%2==0};default:throw "bad maskPattern:"+r}},a.getErrorCorrectPolynomial=function(r){for(var t=D([1],0),v=0;v<r;v+=1)t=t.multiply(D([1,M.gexp(v)],0));return t},a.getLengthInBits=function(r,t){if(1<=t&&t<10)switch(r){case p.MODE_NUMBER:return 10;case p.MODE_ALPHA_NUM:return 9;case p.MODE_8BIT_BYTE:return 8;case p.MODE_KANJI:return 8;default:throw "mode:"+r}else if(t<27)switch(r){case p.MODE_NUMBER:return 12;case p.MODE_ALPHA_NUM:return 11;case p.MODE_8BIT_BYTE:return 16;case p.MODE_KANJI:return 10;default:throw "mode:"+r}else if(t<41)switch(r){case p.MODE_NUMBER:return 14;case p.MODE_ALPHA_NUM:return 13;case p.MODE_8BIT_BYTE:return 16;case p.MODE_KANJI:return 12;default:throw "mode:"+r}else throw "type:"+t},a.getLostPoint=function(r){for(var t=r.getModuleCount(),v=0,i=0;i<t;i+=1)for(var u=0;u<t;u+=1){for(var A=0,B=r.isDark(i,u),C=-1;C<=1;C+=1)if(!(i+C<0||t<=i+C))for(var E=-1;E<=1;E+=1)u+E<0||t<=u+E||C==0&&E==0||B==r.isDark(i+C,u+E)&&(A+=1);A>5&&(v+=3+A-5);}for(var i=0;i<t-1;i+=1)for(var u=0;u<t-1;u+=1){var R=0;r.isDark(i,u)&&(R+=1),r.isDark(i+1,u)&&(R+=1),r.isDark(i,u+1)&&(R+=1),r.isDark(i+1,u+1)&&(R+=1),(R==0||R==4)&&(v+=3);}for(var i=0;i<t;i+=1)for(var u=0;u<t-6;u+=1)r.isDark(i,u)&&!r.isDark(i,u+1)&&r.isDark(i,u+2)&&r.isDark(i,u+3)&&r.isDark(i,u+4)&&!r.isDark(i,u+5)&&r.isDark(i,u+6)&&(v+=40);for(var u=0;u<t;u+=1)for(var i=0;i<t-6;i+=1)r.isDark(i,u)&&!r.isDark(i+1,u)&&r.isDark(i+2,u)&&r.isDark(i+3,u)&&r.isDark(i+4,u)&&!r.isDark(i+5,u)&&r.isDark(i+6,u)&&(v+=40);for(var U=0,u=0;u<t;u+=1)for(var i=0;i<t;i+=1)r.isDark(i,u)&&(U+=1);var S=Math.abs(100*U/t/t-50)/5;return v+=S*10,v},a})(),M=(function(){for(var h=new Array(256),m=new Array(256),d=0;d<8;d+=1)h[d]=1<<d;for(var d=8;d<256;d+=1)h[d]=h[d-4]^h[d-5]^h[d-6]^h[d-8];for(var d=0;d<255;d+=1)m[h[d]]=d;var c={};return c.glog=function(a){if(a<1)throw "glog("+a+")";return m[a]},c.gexp=function(a){for(;a<0;)a+=255;for(;a>=256;)a-=255;return h[a]},c})();function D(h,m){if(typeof h.length>"u")throw h.length+"/"+m;var d=(function(){for(var a=0;a<h.length&&h[a]==0;)a+=1;for(var l=new Array(h.length-a+m),r=0;r<h.length-a;r+=1)l[r]=h[r+a];return l})(),c={};return c.getAt=function(a){return d[a]},c.getLength=function(){return d.length},c.multiply=function(a){for(var l=new Array(c.getLength()+a.getLength()-1),r=0;r<c.getLength();r+=1)for(var t=0;t<a.getLength();t+=1)l[r+t]^=M.gexp(M.glog(c.getAt(r))+M.glog(a.getAt(t)));return D(l,0)},c.mod=function(a){if(c.getLength()-a.getLength()<0)return c;for(var l=M.glog(c.getAt(0))-M.glog(a.getAt(0)),r=new Array(c.getLength()),t=0;t<c.getLength();t+=1)r[t]=c.getAt(t);for(var t=0;t<a.getLength();t+=1)r[t]^=M.gexp(M.glog(a.getAt(t))+l);return D(r,0).mod(a)},c}var $=(function(){var h=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],m=function(a,l){var r={};return r.totalCount=a,r.dataCount=l,r},d={},c=function(a,l){switch(l){case L.L:return h[(a-1)*4+0];case L.M:return h[(a-1)*4+1];case L.Q:return h[(a-1)*4+2];case L.H:return h[(a-1)*4+3];default:return}};return d.getRSBlocks=function(a,l){var r=c(a,l);if(typeof r>"u")throw "bad rs block @ typeNumber:"+a+"/errorCorrectionLevel:"+l;for(var t=r.length/3,v=[],i=0;i<t;i+=1)for(var u=r[i*3+0],A=r[i*3+1],B=r[i*3+2],C=0;C<u;C+=1)v.push(m(A,B));return v},d})(),K=function(){var h=[],m=0,d={};return d.getBuffer=function(){return h},d.getAt=function(c){var a=Math.floor(c/8);return (h[a]>>>7-c%8&1)==1},d.put=function(c,a){for(var l=0;l<a;l+=1)d.putBit((c>>>a-l-1&1)==1);},d.getLengthInBits=function(){return m},d.putBit=function(c){var a=Math.floor(m/8);h.length<=a&&h.push(0),c&&(h[a]|=128>>>m%8),m+=1;},d},Y=function(h){var m=p.MODE_NUMBER,d=h,c={};c.getMode=function(){return m},c.getLength=function(r){return d.length},c.write=function(r){for(var t=d,v=0;v+2<t.length;)r.put(a(t.substring(v,v+3)),10),v+=3;v<t.length&&(t.length-v==1?r.put(a(t.substring(v,v+1)),4):t.length-v==2&&r.put(a(t.substring(v,v+2)),7));};var a=function(r){for(var t=0,v=0;v<r.length;v+=1)t=t*10+l(r.charAt(v));return t},l=function(r){if("0"<=r&&r<="9")return r.charCodeAt(0)-48;throw "illegal char :"+r};return c},j=function(h){var m=p.MODE_ALPHA_NUM,d=h,c={};c.getMode=function(){return m},c.getLength=function(l){return d.length},c.write=function(l){for(var r=d,t=0;t+1<r.length;)l.put(a(r.charAt(t))*45+a(r.charAt(t+1)),11),t+=2;t<r.length&&l.put(a(r.charAt(t)),6);};var a=function(l){if("0"<=l&&l<="9")return l.charCodeAt(0)-48;if("A"<=l&&l<="Z")return l.charCodeAt(0)-65+10;switch(l){case " ":return 36;case "$":return 37;case "%":return 38;case "*":return 39;case "+":return 40;case "-":return 41;case ".":return 42;case "/":return 43;case ":":return 44;default:throw "illegal char :"+l}};return c},Q=function(h){var m=p.MODE_8BIT_BYTE,c=w.stringToBytes(h),a={};return a.getMode=function(){return m},a.getLength=function(l){return c.length},a.write=function(l){for(var r=0;r<c.length;r+=1)l.put(c[r],8);},a},J=function(h){var m=p.MODE_KANJI,c=w.stringToBytesFuncs.SJIS;if(!c)throw "sjis not supported.";(function(r,t){var v=c(r);if(v.length!=2||(v[0]<<8|v[1])!=t)throw "sjis not supported."})("\u53CB",38726);var a=c(h),l={};return l.getMode=function(){return m},l.getLength=function(r){return ~~(a.length/2)},l.write=function(r){for(var t=a,v=0;v+1<t.length;){var i=(255&t[v])<<8|255&t[v+1];if(33088<=i&&i<=40956)i-=33088;else if(57408<=i&&i<=60351)i-=49472;else throw "illegal char at "+(v+1)+"/"+i;i=(i>>>8&255)*192+(i&255),r.put(i,13),v+=2;}if(v<t.length)throw "illegal char at "+(v+1)},l},Z=function(){var h=[],m={};return m.writeByte=function(d){h.push(d&255);},m.writeShort=function(d){m.writeByte(d),m.writeByte(d>>>8);},m.writeBytes=function(d,c,a){c=c||0,a=a||d.length;for(var l=0;l<a;l+=1)m.writeByte(d[l+c]);},m.writeString=function(d){for(var c=0;c<d.length;c+=1)m.writeByte(d.charCodeAt(c));},m.toByteArray=function(){return h},m.toString=function(){var d="";d+="[";for(var c=0;c<h.length;c+=1)c>0&&(d+=","),d+=h[c];return d+="]",d},m},mt=function(){var h=0,m=0,d=0,c="",a={},l=function(t){c+=String.fromCharCode(r(t&63));},r=function(t){if(!(t<0)){if(t<26)return 65+t;if(t<52)return 97+(t-26);if(t<62)return 48+(t-52);if(t==62)return 43;if(t==63)return 47}throw "n:"+t};return a.writeByte=function(t){for(h=h<<8|t&255,m+=8,d+=1;m>=6;)l(h>>>m-6),m-=6;},a.flush=function(){if(m>0&&(l(h<<6-m),h=0,m=0),d%3!=0)for(var t=3-d%3,v=0;v<t;v+=1)c+="=";},a.toString=function(){return c},a},pt=function(h){var m=h,d=0,c=0,a=0,l={};l.read=function(){for(;a<8;){if(d>=m.length){if(a==0)return  -1;throw "unexpected end of file./"+a}var t=m.charAt(d);if(d+=1,t=="=")return a=0,-1;if(t.match(/^\s$/))continue;c=c<<6|r(t.charCodeAt(0)),a+=6;}var v=c>>>a-8&255;return a-=8,v};var r=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(t==43)return 62;if(t==47)return 63;throw "c:"+t};return l},bt=function(h,m){var d=h,c=m,a=new Array(h*m),l={};l.setPixel=function(i,u,A){a[u*d+i]=A;},l.write=function(i){i.writeString("GIF87a"),i.writeShort(d),i.writeShort(c),i.writeByte(128),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(255),i.writeByte(255),i.writeByte(255),i.writeString(","),i.writeShort(0),i.writeShort(0),i.writeShort(d),i.writeShort(c),i.writeByte(0);var u=2,A=t(u);i.writeByte(u);for(var B=0;A.length-B>255;)i.writeByte(255),i.writeBytes(A,B,255),B+=255;i.writeByte(A.length-B),i.writeBytes(A,B,A.length-B),i.writeByte(0),i.writeString(";");};var r=function(i){var u=i,A=0,B=0,C={};return C.write=function(E,R){if(E>>>R)throw "length over";for(;A+R>=8;)u.writeByte(255&(E<<A|B)),R-=8-A,E>>>=8-A,B=0,A=0;B=E<<A|B,A=A+R;},C.flush=function(){A>0&&u.writeByte(B);},C},t=function(i){for(var u=1<<i,A=(1<<i)+1,B=i+1,C=v(),E=0;E<u;E+=1)C.add(String.fromCharCode(E));C.add(String.fromCharCode(u)),C.add(String.fromCharCode(A));var R=Z(),U=r(R);U.write(u,B);var S=0,H=String.fromCharCode(a[S]);for(S+=1;S<a.length;){var F=String.fromCharCode(a[S]);S+=1,C.contains(H+F)?H=H+F:(U.write(C.indexOf(H),B),C.size()<4095&&(C.size()==1<<B&&(B+=1),C.add(H+F)),H=F);}return U.write(C.indexOf(H),B),U.write(A,B),U.flush(),R.toByteArray()},v=function(){var i={},u=0,A={};return A.add=function(B){if(A.contains(B))throw "dup key:"+B;i[B]=u,u+=1;},A.size=function(){return u},A.indexOf=function(B){return i[B]},A.contains=function(B){return typeof i[B]<"u"},A};return l},xt=function(h,m,d){for(var c=bt(h,m),a=0;a<m;a+=1)for(var l=0;l<h;l+=1)c.setPixel(l,a,d(l,a));var r=Z();c.write(r);for(var t=mt(),v=r.toByteArray(),i=0;i<v.length;i+=1)t.writeByte(v[i]);return t.flush(),"data:image/gif;base64,"+t};return w})();(function(){it.stringToBytesFuncs["UTF-8"]=function(w){function p(L){for(var _=[],T=0;T<L.length;T++){var M=L.charCodeAt(T);M<128?_.push(M):M<2048?_.push(192|M>>6,128|M&63):M<55296||M>=57344?_.push(224|M>>12,128|M>>6&63,128|M&63):(T++,M=65536+((M&1023)<<10|L.charCodeAt(T)&1023),_.push(240|M>>18,128|M>>12&63,128|M>>6&63,128|M&63));}return _}return p(w)};})();(function(w){typeof define=="function"&&define.amd?define([],w):typeof ft=="object"&&(st.exports=w());})(function(){return it});});var vt=w(ut()),lt={nombre_negocio:"Jasta Technology",telefonos:null,redes:null,texto_garantia:"Todos nuestros productos cuentan con garant\xEDa. Guarda este r\xF3tulo: es el soporte para la garant\xEDa."};function Bt(){return new URL("assets/icon/logo-rotulo.png",document.baseURI).href}async function dt(w){let{data:p,error:L}=await w.from("configuracion").select("nombre_negocio, telefonos, redes, texto_garantia").eq("id",true).single();return L||!p?lt:{nombre_negocio:p.nombre_negocio?.trim()||lt.nombre_negocio,telefonos:p.telefonos?.trim()||null,redes:p.redes?.trim()||null,texto_garantia:p.texto_garantia?.trim()||null}}function I(w){return String(w??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function Tt(w){return Number(w||0).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})}function Mt(w){return (w??"").split(/\s*[-,/|]\s*(?=\d)|\n/).map(p=>p.trim()).filter(Boolean)}function Ct(w){let p=(0, vt.default)(0,"M");return p.addData(`JASTA-${w}`),p.make(),p.createSvgTag({cellSize:4,margin:0,scalable:true})}function ct(w,p){let L=Mt(p.telefonos).map(j=>`<div>${I(j)}</div>`).join(""),_=3,T=w.productos.length>_?[...w.productos.slice(0,_-1).map(j=>I(j)),`y ${w.productos.length-(_-1)} productos m\xE1s`]:w.productos.map(j=>I(j)),M=T.length?T.join("<br>"):"\u2014",D=(j,Q,J="")=>`<tr${J?` class="${J}"`:""}><th>${j}</th><td><div class="v">${Q||"\u2014"}</div></td></tr>`,[$,K,Y]=new Date(w.created_at).toLocaleDateString("en-CA",{timeZone:"America/Bogota"}).split("-");return `
  <section class="rotulo">
    <header class="cabecera">
      <div class="marca"><img class="logo" src="${Bt()}" alt="" /><span class="nombre">${I(p.nombre_negocio)}</span></div>

      <div class="qr">${Ct(w.numero)}<span>#${I(w.numero)}</span></div>

      <div class="contacto">
        <div class="fecha">
          <span class="etiqueta">Fecha</span>
          <div class="fecha-cajas">
            <span>${Y}</span><span>${K}</span><span class="anio">${$}</span>
          </div>
        </div>
        ${L?`<div class="telefonos">${L}</div>`:""}
        ${p.redes?`<div class="redes">${I(p.redes)}</div>`:""}
      </div>
    </header>

    <div class="cobro">
      <span class="cobro-label">Valor a cobrar</span>
      <strong class="cobro-valor">${Tt(w.total)}</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${D("Pedido","#"+I(w.numero),"pedido")}
      ${D("Nombre",I(w.cliente_nombre),"destacado")}
      ${D("Direcci\xF3n",I(w.direccion),"destacado")}
      ${D("Barrio",I(w.barrio))}
      ${D("Celular",I(w.cliente_telefono))}
      ${D("Producto",M,"productos")}
      ${D("Observaci\xF3n",I(w.observaciones))}
    </table>
    </div>

    ${p.texto_garantia?`<p class="garantia">${I(p.texto_garantia)}</p>`:""}
  </section>`}var kt=`
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
  .qr svg { display: block; width: 19mm; height: 19mm; }
  .qr span { font-size: 7pt; font-weight: bold; letter-spacing: 0.04em; }
  .marca { flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 1mm; max-width: 44mm; }
  .logo { width: 22mm; height: 22mm; object-fit: contain; }
  .nombre { font-size: 11pt; font-weight: bold; line-height: 1.1; }
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
`;function gt(w,p="R\xF3tulos",L=""){return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${I(p)}</title>
    <style>${kt}${L}</style>
  </head>
  <body>${w.join("")}</body>
</html>`}var Dt=`
  @media screen {
    body { padding: 12px 0; }
    .rotulo { margin-bottom: 0; }
  }
  @media (max-width: 400px) { body { zoom: 0.9; } }
  @media (max-width: 360px) { body { zoom: 0.82; } }
  @media (max-width: 330px) { body { zoom: 0.74; } }
`;function ht(w){document.querySelectorAll("iframe.marco-impresion").forEach(_=>_.remove());let p=document.createElement("iframe");p.className="marco-impresion",p.setAttribute("aria-hidden","true"),p.tabIndex=-1,p.style.cssText="position:fixed;left:-10000px;top:0;width:100mm;height:100mm;border:0;opacity:0;pointer-events:none;";let L=false;p.onload=async()=>{if(L)return;L=true;let _=p.contentDocument,T=Array.from(_?.images??[]).filter(D=>!D.complete);await Promise.race([Promise.all(T.map(D=>new Promise($=>{D.onload=D.onerror=$;}))),new Promise(D=>setTimeout(D,2500))]);let M=p.contentWindow;M&&(M.focus(),M.print(),setTimeout(()=>p.remove(),12e4));},p.srcdoc=w,document.body.appendChild(p);}var jt=(()=>{let p=class p{constructor(){this.sb=y(w8),this.toast=y(c),this.negocio=null;}static aRotulo(_){return {numero:_.id,cliente_nombre:_.cliente_nombre,cliente_telefono:_.cliente_telefono,direccion:_.direccion??"",barrio:_.barrio,observaciones:_.observaciones,total:Number(_.total),created_at:_.created_at,productos:(_.pedido_items??[]).map(T=>`${f(T)}${T.cantidad>1?" x"+T.cantidad:""}`)}}refrescar(){this.negocio=null;}async imprimir(_){if(Array.isArray(_)&&!_.length)return  false;try{let T=Array.isArray(_)?_:await _();if(!T.length)return this.toast.ok("No hay r\xF3tulos por imprimir"),!1;this.negocio??=await dt(this.sb.client);let M=gt(T.map($=>ct(p.aRotulo($),this.negocio)),T.length===1?`R\xF3tulo #${T[0].id}`:`${T.length} r\xF3tulos`);ht(M);let{error:D}=await this.sb.client.rpc("marcar_rotulos",{p_ids:T.map($=>$.id)});if(D)throw D;return !0}catch(T){return this.toast.error(c$1(T)),false}}};p.\u0275fac=function(T){return new(T||p)},p.\u0275prov=j({token:p,factory:p.\u0275fac,providedIn:"root"});let w=p;return w})();export{Dt as D,ct as c,dt as d,gt as g,ht as h,jt as j,lt as l};