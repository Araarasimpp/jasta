import {b7 as w,bX as v}from'./main-7Y7B7EZZ.js';var nt=v((rt,at)=>{var et=(function(){var y=function(h,p){var d=236,g=17,a=h,l=E[p],e=null,t=0,v=null,i=[],u={},_=function(n,o){t=a*4+17,e=(function(r){for(var f=new Array(r),s=0;s<r;s+=1){f[s]=new Array(r);for(var c=0;c<r;c+=1)f[s][c]=null;}return f})(t),A(0,0),A(t-7,0),A(0,t-7),R(),D(),S(n,o),a>=7&&$(n),v==null&&(v=vt(a,l,i)),H(v,o);},A=function(n,o){for(var r=-1;r<=7;r+=1)if(!(n+r<=-1||t<=n+r))for(var f=-1;f<=7;f+=1)o+f<=-1||t<=o+f||(0<=r&&r<=6&&(f==0||f==6)||0<=f&&f<=6&&(r==0||r==6)||2<=r&&r<=4&&2<=f&&f<=4?e[n+r][o+f]=true:e[n+r][o+f]=false);},T=function(){for(var n=0,o=0,r=0;r<8;r+=1){_(true,r);var f=L.getLostPoint(u);(r==0||n>f)&&(n=f,o=r);}return o},D=function(){for(var n=8;n<t-8;n+=1)e[n][6]==null&&(e[n][6]=n%2==0);for(var o=8;o<t-8;o+=1)e[6][o]==null&&(e[6][o]=o%2==0);},R=function(){for(var n=L.getPatternPosition(a),o=0;o<n.length;o+=1)for(var r=0;r<n.length;r+=1){var f=n[o],s=n[r];if(e[f][s]==null)for(var c=-2;c<=2;c+=1)for(var b=-2;b<=2;b+=1)c==-2||c==2||b==-2||b==2||c==0&&b==0?e[f+c][s+b]=true:e[f+c][s+b]=false;}},$=function(n){for(var o=L.getBCHTypeNumber(a),r=0;r<18;r+=1){var f=!n&&(o>>r&1)==1;e[Math.floor(r/3)][r%3+t-8-3]=f;}for(var r=0;r<18;r+=1){var f=!n&&(o>>r&1)==1;e[r%3+t-8-3][Math.floor(r/3)]=f;}},S=function(n,o){for(var r=l<<3|o,f=L.getBCHTypeInfo(r),s=0;s<15;s+=1){var c=!n&&(f>>s&1)==1;s<6?e[s][8]=c:s<8?e[s+1][8]=c:e[t-15+s][8]=c;}for(var s=0;s<15;s+=1){var c=!n&&(f>>s&1)==1;s<8?e[8][t-s-1]=c:s<9?e[8][15-s-1+1]=c:e[8][15-s-1]=c;}e[t-8][8]=!n;},H=function(n,o){for(var r=-1,f=t-1,s=7,c=0,b=L.getMaskFunction(o),m=t-1;m>0;m-=2)for(m==6&&(m-=1);;){for(var M=0;M<2;M+=1)if(e[f][m-M]==null){var P=false;c<n.length&&(P=(n[c]>>>s&1)==1);var w=b(f,m-M);w&&(P=!P),e[f][m-M]=P,s-=1,s==-1&&(c+=1,s=7);}if(f+=r,f<0||t<=f){f-=r,r=-r;break}}},F=function(n,o){for(var r=0,f=0,s=0,c=new Array(o.length),b=new Array(o.length),m=0;m<o.length;m+=1){var M=o[m].dataCount,P=o[m].totalCount-M;f=Math.max(f,M),s=Math.max(s,P),c[m]=new Array(M);for(var w=0;w<c[m].length;w+=1)c[m][w]=255&n.getBuffer()[w+r];r+=M;var I=L.getErrorCorrectPolynomial(P),N=k(c[m],I.getLength()-1),W=N.mod(I);b[m]=new Array(I.getLength()-1);for(var w=0;w<b[m].length;w+=1){var z=w+W.getLength()-b[m].length;b[m][w]=z>=0?W.getAt(z):0;}}for(var tt=0,w=0;w<o.length;w+=1)tt+=o[w].totalCount;for(var V=new Array(tt),G=0,w=0;w<f;w+=1)for(var m=0;m<o.length;m+=1)w<c[m].length&&(V[G]=c[m][w],G+=1);for(var w=0;w<s;w+=1)for(var m=0;m<o.length;m+=1)w<b[m].length&&(V[G]=b[m][w],G+=1);return V},vt=function(n,o,r){for(var f=j.getRSBlocks(n,o),s=Q(),c=0;c<r.length;c+=1){var b=r[c];s.put(b.getMode(),4),s.put(b.getLength(),L.getLengthInBits(b.getMode(),n)),b.write(s);}for(var m=0,c=0;c<f.length;c+=1)m+=f[c].dataCount;if(s.getLengthInBits()>m*8)throw "code length overflow. ("+s.getLengthInBits()+">"+m*8+")";for(s.getLengthInBits()+4<=m*8&&s.put(0,4);s.getLengthInBits()%8!=0;)s.putBit(false);for(;!(s.getLengthInBits()>=m*8||(s.put(d,8),s.getLengthInBits()>=m*8));)s.put(g,8);return F(s,f)};u.addData=function(n,o){o=o||"Byte";var r=null;switch(o){case "Numeric":r=Y(n);break;case "Alphanumeric":r=U(n);break;case "Byte":r=K(n);break;case "Kanji":r=J(n);break;default:throw "mode:"+o}i.push(r),v=null;},u.isDark=function(n,o){if(n<0||t<=n||o<0||t<=o)throw n+","+o;return e[n][o]},u.getModuleCount=function(){return t},u.make=function(){if(a<1){for(var n=1;n<40;n++){for(var o=j.getRSBlocks(n,l),r=Q(),f=0;f<i.length;f++){var s=i[f];r.put(s.getMode(),4),r.put(s.getLength(),L.getLengthInBits(s.getMode(),n)),s.write(r);}for(var c=0,f=0;f<o.length;f++)c+=o[f].dataCount;if(r.getLengthInBits()<=c*8)break}a=n;}_(false,T());},u.createTableTag=function(n,o){n=n||2,o=typeof o>"u"?n*4:o;var r="";r+='<table style="',r+=" border-width: 0px; border-style: none;",r+=" border-collapse: collapse;",r+=" padding: 0px; margin: "+o+"px;",r+='">',r+="<tbody>";for(var f=0;f<u.getModuleCount();f+=1){r+="<tr>";for(var s=0;s<u.getModuleCount();s+=1)r+='<td style="',r+=" border-width: 0px; border-style: none;",r+=" border-collapse: collapse;",r+=" padding: 0px; margin: 0px;",r+=" width: "+n+"px;",r+=" height: "+n+"px;",r+=" background-color: ",r+=u.isDark(f,s)?"#000000":"#ffffff",r+=";",r+='"/>';r+="</tr>";}return r+="</tbody>",r+="</table>",r},u.createSvgTag=function(n,o,r,f){var s={};typeof arguments[0]=="object"&&(s=arguments[0],n=s.cellSize,o=s.margin,r=s.alt,f=s.title),n=n||2,o=typeof o>"u"?n*4:o,r=typeof r=="string"?{text:r}:r||{},r.text=r.text||null,r.id=r.text?r.id||"qrcode-description":null,f=typeof f=="string"?{text:f}:f||{},f.text=f.text||null,f.id=f.text?f.id||"qrcode-title":null;var c=u.getModuleCount()*n+o*2,b,m,M,P,w="",I;for(I="l"+n+",0 0,"+n+" -"+n+",0 0,-"+n+"z ",w+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',w+=s.scalable?"":' width="'+c+'px" height="'+c+'px"',w+=' viewBox="0 0 '+c+" "+c+'" ',w+=' preserveAspectRatio="xMinYMin meet"',w+=f.text||r.text?' role="img" aria-labelledby="'+q([f.id,r.id].join(" ").trim())+'"':"",w+=">",w+=f.text?'<title id="'+q(f.id)+'">'+q(f.text)+"</title>":"",w+=r.text?'<description id="'+q(r.id)+'">'+q(r.text)+"</description>":"",w+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',w+='<path d="',M=0;M<u.getModuleCount();M+=1)for(P=M*n+o,b=0;b<u.getModuleCount();b+=1)u.isDark(M,b)&&(m=b*n+o,w+="M"+m+","+P+I);return w+='" stroke="transparent" fill="black"/>',w+="</svg>",w},u.createDataURL=function(n,o){n=n||2,o=typeof o>"u"?n*4:o;var r=u.getModuleCount()*n+o*2,f=o,s=r-o;return lt(r,r,function(c,b){if(f<=c&&c<s&&f<=b&&b<s){var m=Math.floor((c-f)/n),M=Math.floor((b-f)/n);return u.isDark(M,m)?0:1}else return 1})},u.createImgTag=function(n,o,r){n=n||2,o=typeof o>"u"?n*4:o;var f=u.getModuleCount()*n+o*2,s="";return s+="<img",s+=' src="',s+=u.createDataURL(n,o),s+='"',s+=' width="',s+=f,s+='"',s+=' height="',s+=f,s+='"',r&&(s+=' alt="',s+=q(r),s+='"'),s+="/>",s};var q=function(n){for(var o="",r=0;r<n.length;r+=1){var f=n.charAt(r);switch(f){case "<":o+="&lt;";break;case ">":o+="&gt;";break;case "&":o+="&amp;";break;case '"':o+="&quot;";break;default:o+=f;break}}return o},dt=function(n){var o=1;n=typeof n>"u"?o*2:n;var r=u.getModuleCount()*o+n*2,f=n,s=r-n,c,b,m,M,P,w={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},I={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "},N="";for(c=0;c<r;c+=2){for(m=Math.floor((c-f)/o),M=Math.floor((c+1-f)/o),b=0;b<r;b+=1)P="\u2588",f<=b&&b<s&&f<=c&&c<s&&u.isDark(m,Math.floor((b-f)/o))&&(P=" "),f<=b&&b<s&&f<=c+1&&c+1<s&&u.isDark(M,Math.floor((b-f)/o))?P+=" ":P+="\u2588",N+=n<1&&c+1>=s?I[P]:w[P];N+=`
`;}return r%2&&n>0?N.substring(0,N.length-r-1)+Array(r+1).join("\u2580"):N.substring(0,N.length-1)};return u.createASCII=function(n,o){if(n=n||1,n<2)return dt(o);n-=1,o=typeof o>"u"?n*2:o;var r=u.getModuleCount()*n+o*2,f=o,s=r-o,c,b,m,M,P=Array(n+1).join("\u2588\u2588"),w=Array(n+1).join("  "),I="",N="";for(c=0;c<r;c+=1){for(m=Math.floor((c-f)/n),N="",b=0;b<r;b+=1)M=1,f<=b&&b<s&&f<=c&&c<s&&u.isDark(m,Math.floor((b-f)/n))&&(M=0),N+=M?P:w;for(m=0;m<n;m+=1)I+=N+`
`;}return I.substring(0,I.length-1)},u.renderTo2dContext=function(n,o){o=o||2;for(var r=u.getModuleCount(),f=0;f<r;f++)for(var s=0;s<r;s++)n.fillStyle=u.isDark(f,s)?"black":"white",n.fillRect(f*o,s*o,o,o);},u};y.stringToBytesFuncs={default:function(h){for(var p=[],d=0;d<h.length;d+=1){var g=h.charCodeAt(d);p.push(g&255);}return p}},y.stringToBytes=y.stringToBytesFuncs.default,y.createStringToBytes=function(h,p){var d=(function(){for(var a=st(h),l=function(){var D=a.read();if(D==-1)throw "eof";return D},e=0,t={};;){var v=a.read();if(v==-1)break;var i=l(),u=l(),_=l(),A=String.fromCharCode(v<<8|i),T=u<<8|_;t[A]=T,e+=1;}if(e!=p)throw e+" != "+p;return t})(),g=63;return function(a){for(var l=[],e=0;e<a.length;e+=1){var t=a.charCodeAt(e);if(t<128)l.push(t);else {var v=d[a.charAt(e)];typeof v=="number"?(v&255)==v?l.push(v):(l.push(v>>>8),l.push(v&255)):l.push(g);}}return l}};var x={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},E={L:1,M:0,Q:3,H:2},C={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},L=(function(){var h=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],p=1335,d=7973,g=21522,a={},l=function(e){for(var t=0;e!=0;)t+=1,e>>>=1;return t};return a.getBCHTypeInfo=function(e){for(var t=e<<10;l(t)-l(p)>=0;)t^=p<<l(t)-l(p);return (e<<10|t)^g},a.getBCHTypeNumber=function(e){for(var t=e<<12;l(t)-l(d)>=0;)t^=d<<l(t)-l(d);return e<<12|t},a.getPatternPosition=function(e){return h[e-1]},a.getMaskFunction=function(e){switch(e){case C.PATTERN000:return function(t,v){return (t+v)%2==0};case C.PATTERN001:return function(t,v){return t%2==0};case C.PATTERN010:return function(t,v){return v%3==0};case C.PATTERN011:return function(t,v){return (t+v)%3==0};case C.PATTERN100:return function(t,v){return (Math.floor(t/2)+Math.floor(v/3))%2==0};case C.PATTERN101:return function(t,v){return t*v%2+t*v%3==0};case C.PATTERN110:return function(t,v){return (t*v%2+t*v%3)%2==0};case C.PATTERN111:return function(t,v){return (t*v%3+(t+v)%2)%2==0};default:throw "bad maskPattern:"+e}},a.getErrorCorrectPolynomial=function(e){for(var t=k([1],0),v=0;v<e;v+=1)t=t.multiply(k([1,B.gexp(v)],0));return t},a.getLengthInBits=function(e,t){if(1<=t&&t<10)switch(e){case x.MODE_NUMBER:return 10;case x.MODE_ALPHA_NUM:return 9;case x.MODE_8BIT_BYTE:return 8;case x.MODE_KANJI:return 8;default:throw "mode:"+e}else if(t<27)switch(e){case x.MODE_NUMBER:return 12;case x.MODE_ALPHA_NUM:return 11;case x.MODE_8BIT_BYTE:return 16;case x.MODE_KANJI:return 10;default:throw "mode:"+e}else if(t<41)switch(e){case x.MODE_NUMBER:return 14;case x.MODE_ALPHA_NUM:return 13;case x.MODE_8BIT_BYTE:return 16;case x.MODE_KANJI:return 12;default:throw "mode:"+e}else throw "type:"+t},a.getLostPoint=function(e){for(var t=e.getModuleCount(),v=0,i=0;i<t;i+=1)for(var u=0;u<t;u+=1){for(var _=0,A=e.isDark(i,u),T=-1;T<=1;T+=1)if(!(i+T<0||t<=i+T))for(var D=-1;D<=1;D+=1)u+D<0||t<=u+D||T==0&&D==0||A==e.isDark(i+T,u+D)&&(_+=1);_>5&&(v+=3+_-5);}for(var i=0;i<t-1;i+=1)for(var u=0;u<t-1;u+=1){var R=0;e.isDark(i,u)&&(R+=1),e.isDark(i+1,u)&&(R+=1),e.isDark(i,u+1)&&(R+=1),e.isDark(i+1,u+1)&&(R+=1),(R==0||R==4)&&(v+=3);}for(var i=0;i<t;i+=1)for(var u=0;u<t-6;u+=1)e.isDark(i,u)&&!e.isDark(i,u+1)&&e.isDark(i,u+2)&&e.isDark(i,u+3)&&e.isDark(i,u+4)&&!e.isDark(i,u+5)&&e.isDark(i,u+6)&&(v+=40);for(var u=0;u<t;u+=1)for(var i=0;i<t-6;i+=1)e.isDark(i,u)&&!e.isDark(i+1,u)&&e.isDark(i+2,u)&&e.isDark(i+3,u)&&e.isDark(i+4,u)&&!e.isDark(i+5,u)&&e.isDark(i+6,u)&&(v+=40);for(var $=0,u=0;u<t;u+=1)for(var i=0;i<t;i+=1)e.isDark(i,u)&&($+=1);var S=Math.abs(100*$/t/t-50)/5;return v+=S*10,v},a})(),B=(function(){for(var h=new Array(256),p=new Array(256),d=0;d<8;d+=1)h[d]=1<<d;for(var d=8;d<256;d+=1)h[d]=h[d-4]^h[d-5]^h[d-6]^h[d-8];for(var d=0;d<255;d+=1)p[h[d]]=d;var g={};return g.glog=function(a){if(a<1)throw "glog("+a+")";return p[a]},g.gexp=function(a){for(;a<0;)a+=255;for(;a>=256;)a-=255;return h[a]},g})();function k(h,p){if(typeof h.length>"u")throw h.length+"/"+p;var d=(function(){for(var a=0;a<h.length&&h[a]==0;)a+=1;for(var l=new Array(h.length-a+p),e=0;e<h.length-a;e+=1)l[e]=h[e+a];return l})(),g={};return g.getAt=function(a){return d[a]},g.getLength=function(){return d.length},g.multiply=function(a){for(var l=new Array(g.getLength()+a.getLength()-1),e=0;e<g.getLength();e+=1)for(var t=0;t<a.getLength();t+=1)l[e+t]^=B.gexp(B.glog(g.getAt(e))+B.glog(a.getAt(t)));return k(l,0)},g.mod=function(a){if(g.getLength()-a.getLength()<0)return g;for(var l=B.glog(g.getAt(0))-B.glog(a.getAt(0)),e=new Array(g.getLength()),t=0;t<g.getLength();t+=1)e[t]=g.getAt(t);for(var t=0;t<a.getLength();t+=1)e[t]^=B.gexp(B.glog(a.getAt(t))+l);return k(e,0).mod(a)},g}var j=(function(){var h=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],p=function(a,l){var e={};return e.totalCount=a,e.dataCount=l,e},d={},g=function(a,l){switch(l){case E.L:return h[(a-1)*4+0];case E.M:return h[(a-1)*4+1];case E.Q:return h[(a-1)*4+2];case E.H:return h[(a-1)*4+3];default:return}};return d.getRSBlocks=function(a,l){var e=g(a,l);if(typeof e>"u")throw "bad rs block @ typeNumber:"+a+"/errorCorrectionLevel:"+l;for(var t=e.length/3,v=[],i=0;i<t;i+=1)for(var u=e[i*3+0],_=e[i*3+1],A=e[i*3+2],T=0;T<u;T+=1)v.push(p(_,A));return v},d})(),Q=function(){var h=[],p=0,d={};return d.getBuffer=function(){return h},d.getAt=function(g){var a=Math.floor(g/8);return (h[a]>>>7-g%8&1)==1},d.put=function(g,a){for(var l=0;l<a;l+=1)d.putBit((g>>>a-l-1&1)==1);},d.getLengthInBits=function(){return p},d.putBit=function(g){var a=Math.floor(p/8);h.length<=a&&h.push(0),g&&(h[a]|=128>>>p%8),p+=1;},d},Y=function(h){var p=x.MODE_NUMBER,d=h,g={};g.getMode=function(){return p},g.getLength=function(e){return d.length},g.write=function(e){for(var t=d,v=0;v+2<t.length;)e.put(a(t.substring(v,v+3)),10),v+=3;v<t.length&&(t.length-v==1?e.put(a(t.substring(v,v+1)),4):t.length-v==2&&e.put(a(t.substring(v,v+2)),7));};var a=function(e){for(var t=0,v=0;v<e.length;v+=1)t=t*10+l(e.charAt(v));return t},l=function(e){if("0"<=e&&e<="9")return e.charCodeAt(0)-48;throw "illegal char :"+e};return g},U=function(h){var p=x.MODE_ALPHA_NUM,d=h,g={};g.getMode=function(){return p},g.getLength=function(l){return d.length},g.write=function(l){for(var e=d,t=0;t+1<e.length;)l.put(a(e.charAt(t))*45+a(e.charAt(t+1)),11),t+=2;t<e.length&&l.put(a(e.charAt(t)),6);};var a=function(l){if("0"<=l&&l<="9")return l.charCodeAt(0)-48;if("A"<=l&&l<="Z")return l.charCodeAt(0)-65+10;switch(l){case " ":return 36;case "$":return 37;case "%":return 38;case "*":return 39;case "+":return 40;case "-":return 41;case ".":return 42;case "/":return 43;case ":":return 44;default:throw "illegal char :"+l}};return g},K=function(h){var p=x.MODE_8BIT_BYTE,g=y.stringToBytes(h),a={};return a.getMode=function(){return p},a.getLength=function(l){return g.length},a.write=function(l){for(var e=0;e<g.length;e+=1)l.put(g[e],8);},a},J=function(h){var p=x.MODE_KANJI,g=y.stringToBytesFuncs.SJIS;if(!g)throw "sjis not supported.";(function(e,t){var v=g(e);if(v.length!=2||(v[0]<<8|v[1])!=t)throw "sjis not supported."})("\u53CB",38726);var a=g(h),l={};return l.getMode=function(){return p},l.getLength=function(e){return ~~(a.length/2)},l.write=function(e){for(var t=a,v=0;v+1<t.length;){var i=(255&t[v])<<8|255&t[v+1];if(33088<=i&&i<=40956)i-=33088;else if(57408<=i&&i<=60351)i-=49472;else throw "illegal char at "+(v+1)+"/"+i;i=(i>>>8&255)*192+(i&255),e.put(i,13),v+=2;}if(v<t.length)throw "illegal char at "+(v+1)},l},Z=function(){var h=[],p={};return p.writeByte=function(d){h.push(d&255);},p.writeShort=function(d){p.writeByte(d),p.writeByte(d>>>8);},p.writeBytes=function(d,g,a){g=g||0,a=a||d.length;for(var l=0;l<a;l+=1)p.writeByte(d[l+g]);},p.writeString=function(d){for(var g=0;g<d.length;g+=1)p.writeByte(d.charCodeAt(g));},p.toByteArray=function(){return h},p.toString=function(){var d="";d+="[";for(var g=0;g<h.length;g+=1)g>0&&(d+=","),d+=h[g];return d+="]",d},p},ft=function(){var h=0,p=0,d=0,g="",a={},l=function(t){g+=String.fromCharCode(e(t&63));},e=function(t){if(!(t<0)){if(t<26)return 65+t;if(t<52)return 97+(t-26);if(t<62)return 48+(t-52);if(t==62)return 43;if(t==63)return 47}throw "n:"+t};return a.writeByte=function(t){for(h=h<<8|t&255,p+=8,d+=1;p>=6;)l(h>>>p-6),p-=6;},a.flush=function(){if(p>0&&(l(h<<6-p),h=0,p=0),d%3!=0)for(var t=3-d%3,v=0;v<t;v+=1)g+="=";},a.toString=function(){return g},a},st=function(h){var p=h,d=0,g=0,a=0,l={};l.read=function(){for(;a<8;){if(d>=p.length){if(a==0)return  -1;throw "unexpected end of file./"+a}var t=p.charAt(d);if(d+=1,t=="=")return a=0,-1;if(t.match(/^\s$/))continue;g=g<<6|e(t.charCodeAt(0)),a+=6;}var v=g>>>a-8&255;return a-=8,v};var e=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(t==43)return 62;if(t==47)return 63;throw "c:"+t};return l},ut=function(h,p){var d=h,g=p,a=new Array(h*p),l={};l.setPixel=function(i,u,_){a[u*d+i]=_;},l.write=function(i){i.writeString("GIF87a"),i.writeShort(d),i.writeShort(g),i.writeByte(128),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(255),i.writeByte(255),i.writeByte(255),i.writeString(","),i.writeShort(0),i.writeShort(0),i.writeShort(d),i.writeShort(g),i.writeByte(0);var u=2,_=t(u);i.writeByte(u);for(var A=0;_.length-A>255;)i.writeByte(255),i.writeBytes(_,A,255),A+=255;i.writeByte(_.length-A),i.writeBytes(_,A,_.length-A),i.writeByte(0),i.writeString(";");};var e=function(i){var u=i,_=0,A=0,T={};return T.write=function(D,R){if(D>>>R)throw "length over";for(;_+R>=8;)u.writeByte(255&(D<<_|A)),R-=8-_,D>>>=8-_,A=0,_=0;A=D<<_|A,_=_+R;},T.flush=function(){_>0&&u.writeByte(A);},T},t=function(i){for(var u=1<<i,_=(1<<i)+1,A=i+1,T=v(),D=0;D<u;D+=1)T.add(String.fromCharCode(D));T.add(String.fromCharCode(u)),T.add(String.fromCharCode(_));var R=Z(),$=e(R);$.write(u,A);var S=0,H=String.fromCharCode(a[S]);for(S+=1;S<a.length;){var F=String.fromCharCode(a[S]);S+=1,T.contains(H+F)?H=H+F:($.write(T.indexOf(H),A),T.size()<4095&&(T.size()==1<<A&&(A+=1),T.add(H+F)),H=F);}return $.write(T.indexOf(H),A),$.write(_,A),$.flush(),R.toByteArray()},v=function(){var i={},u=0,_={};return _.add=function(A){if(_.contains(A))throw "dup key:"+A;i[A]=u,u+=1;},_.size=function(){return u},_.indexOf=function(A){return i[A]},_.contains=function(A){return typeof i[A]<"u"},_};return l},lt=function(h,p,d){for(var g=ut(h,p),a=0;a<p;a+=1)for(var l=0;l<h;l+=1)g.setPixel(l,a,d(l,a));var e=Z();g.write(e);for(var t=ft(),v=e.toByteArray(),i=0;i<v.length;i+=1)t.writeByte(v[i]);return t.flush(),"data:image/gif;base64,"+t};return y})();(function(){et.stringToBytesFuncs["UTF-8"]=function(y){function x(E){for(var C=[],L=0;L<E.length;L++){var B=E.charCodeAt(L);B<128?C.push(B):B<2048?C.push(192|B>>6,128|B&63):B<55296||B>=57344?C.push(224|B>>12,128|B>>6&63,128|B&63):(L++,B=65536+((B&1023)<<10|E.charCodeAt(L)&1023),C.push(240|B>>18,128|B>>12&63,128|B>>6&63,128|B&63));}return C}return x(y)};})();(function(y){typeof define=="function"&&define.amd?define([],y):typeof rt=="object"&&(at.exports=y());})(function(){return et});});var it=w(nt()),ot={nombre_negocio:"Jasta Technology",telefonos:null,redes:null,texto_garantia:"Todos nuestros productos cuentan con garant\xEDa. Guarda este r\xF3tulo: es el soporte para la garant\xEDa."};function ht(){return new URL("assets/icon/logo-rotulo.png",document.baseURI).href}async function wt(y){let{data:x,error:E}=await y.from("configuracion").select("nombre_negocio, telefonos, redes, texto_garantia").eq("id",true).single();return E||!x?ot:{nombre_negocio:x.nombre_negocio?.trim()||ot.nombre_negocio,telefonos:x.telefonos?.trim()||null,redes:x.redes?.trim()||null,texto_garantia:x.texto_garantia?.trim()||null}}function O(y){return String(y??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function pt(y){return Number(y||0).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})}function X(y){return (y??"").toLocaleUpperCase("es-CO")}function mt(y){return (y??"").split(/\s*[-,/|]\s*(?=\d)|\n/).map(x=>x.trim()).filter(Boolean)}function xt(y){let x=(0, it.default)(0,"Q");return x.addData(`JASTA-${y}`,"Alphanumeric"),x.make(),x.createSvgTag({cellSize:4,margin:8,scalable:true}).replace("<svg ",'<svg shape-rendering="crispEdges" ')}function yt(y,x){let E=mt(x.telefonos).map(U=>`<div>${O(U)}</div>`).join(""),C=3,L=y.productos.length>C?[...y.productos.slice(0,C-1).map(U=>O(U)),`y ${y.productos.length-(C-1)} productos m\xE1s`]:y.productos.map(U=>O(U)),B=L.length?L.join("<br>"):"\u2014",k=(U,K,J="")=>`<tr${J?` class="${J}"`:""}><th>${U}</th><td><div class="v">${K||"\u2014"}</div></td></tr>`,[j,Q,Y]=new Date(y.created_at).toLocaleDateString("en-CA",{timeZone:"America/Bogota"}).split("-");return `
  <section class="rotulo">
    <header class="cabecera">
      <div class="marca"><img class="logo" src="${ht()}" alt="" /><span class="nombre">${O(x.nombre_negocio)}</span></div>

      <div class="qr">${xt(y.numero)}<span>#${O(y.numero)}</span></div>

      <div class="contacto">
        <div class="fecha">
          <span class="etiqueta">Fecha</span>
          <div class="fecha-cajas">
            <span>${Y}</span><span>${Q}</span><span class="anio">${j}</span>
          </div>
        </div>
        ${E?`<div class="telefonos">${E}</div>`:""}
        ${x.redes?`<div class="redes">${O(x.redes)}</div>`:""}
      </div>
    </header>

    <div class="cobro">
      <span class="cobro-label">Valor a cobrar</span>
      <strong class="cobro-valor">${pt(y.total)}</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${k("Pedido","#"+O(y.numero),"pedido")}
      ${k("Nombre",O(y.cliente_nombre),"destacado")}
      ${k("Direcci\xF3n",O(X(y.direccion)),"destacado")}
      ${k("Barrio",O(y.barrio))}
      ${k("Celular",O(X(y.cliente_telefono)),"fuerte")}
      ${k("Producto",B,"productos")}
      ${k("Observaci\xF3n",O(X(y.observaciones)),"fuerte")}
    </table>
    </div>

    ${x.texto_garantia?`<p class="garantia">${O(x.texto_garantia)}</p>`:""}
  </section>`}var bt=`
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
`;function _t(y,x="R\xF3tulos",E=""){return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${O(x)}</title>
    <style>${bt}${E}</style>
  </head>
  <body>${y.join("")}</body>
</html>`}var At=`
  @media screen {
    body { padding: 12px 0; }
    .rotulo { margin-bottom: 0; }
  }
  @media (max-width: 400px) { body { zoom: 0.9; } }
  @media (max-width: 360px) { body { zoom: 0.82; } }
  @media (max-width: 330px) { body { zoom: 0.74; } }
`;function Bt(y){document.querySelectorAll("iframe.marco-impresion").forEach(C=>C.remove());let x=document.createElement("iframe");x.className="marco-impresion",x.setAttribute("aria-hidden","true"),x.tabIndex=-1,x.style.cssText="position:fixed;left:-10000px;top:0;width:100mm;height:100mm;border:0;opacity:0;pointer-events:none;";let E=false;x.onload=async()=>{if(E)return;E=true;let C=x.contentDocument,L=Array.from(C?.images??[]).filter(k=>!k.complete);await Promise.race([Promise.all(L.map(k=>new Promise(j=>{k.onload=k.onerror=j;}))),new Promise(k=>setTimeout(k,2500))]);let B=x.contentWindow;B&&(B.focus(),B.print(),setTimeout(()=>x.remove(),12e4));},x.srcdoc=y,document.body.appendChild(x);}export{At as A,Bt as B,_t as _,nt as n,ot as o,wt as w,yt as y};