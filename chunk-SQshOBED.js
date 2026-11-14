import {br as w,cv as v}from'./main-KFVX77DL.js';var nt=v((rt,at)=>{var et=(function(){var x=function(h,m){var d=236,c=17,a=h,l=L[m],e=null,t=0,v=null,i=[],u={},_=function(n,o){t=a*4+17,e=(function(r){for(var f=new Array(r),s=0;s<r;s+=1){f[s]=new Array(r);for(var g=0;g<r;g+=1)f[s][g]=null;}return f})(t),A(0,0),A(t-7,0),A(0,t-7),O(),E(),j(n,o),a>=7&&N(n),v==null&&(v=dt(a,l,i)),S(v,o);},A=function(n,o){for(var r=-1;r<=7;r+=1)if(!(n+r<=-1||t<=n+r))for(var f=-1;f<=7;f+=1)o+f<=-1||t<=o+f||(0<=r&&r<=6&&(f==0||f==6)||0<=f&&f<=6&&(r==0||r==6)||2<=r&&r<=4&&2<=f&&f<=4?e[n+r][o+f]=true:e[n+r][o+f]=false);},C=function(){for(var n=0,o=0,r=0;r<8;r+=1){_(true,r);var f=P.getLostPoint(u);(r==0||n>f)&&(n=f,o=r);}return o},E=function(){for(var n=8;n<t-8;n+=1)e[n][6]==null&&(e[n][6]=n%2==0);for(var o=8;o<t-8;o+=1)e[6][o]==null&&(e[6][o]=o%2==0);},O=function(){for(var n=P.getPatternPosition(a),o=0;o<n.length;o+=1)for(var r=0;r<n.length;r+=1){var f=n[o],s=n[r];if(e[f][s]==null)for(var g=-2;g<=2;g+=1)for(var w=-2;w<=2;w+=1)g==-2||g==2||w==-2||w==2||g==0&&w==0?e[f+g][s+w]=true:e[f+g][s+w]=false;}},N=function(n){for(var o=P.getBCHTypeNumber(a),r=0;r<18;r+=1){var f=!n&&(o>>r&1)==1;e[Math.floor(r/3)][r%3+t-8-3]=f;}for(var r=0;r<18;r+=1){var f=!n&&(o>>r&1)==1;e[r%3+t-8-3][Math.floor(r/3)]=f;}},j=function(n,o){for(var r=l<<3|o,f=P.getBCHTypeInfo(r),s=0;s<15;s+=1){var g=!n&&(f>>s&1)==1;s<6?e[s][8]=g:s<8?e[s+1][8]=g:e[t-15+s][8]=g;}for(var s=0;s<15;s+=1){var g=!n&&(f>>s&1)==1;s<8?e[8][t-s-1]=g:s<9?e[8][15-s-1+1]=g:e[8][15-s-1]=g;}e[t-8][8]=!n;},S=function(n,o){for(var r=-1,f=t-1,s=7,g=0,w=P.getMaskFunction(o),b=t-1;b>0;b-=2)for(b==6&&(b-=1);;){for(var M=0;M<2;M+=1)if(e[f][b-M]==null){var R=false;g<n.length&&(R=(n[g]>>>s&1)==1);var y=w(f,b-M);y&&(R=!R),e[f][b-M]=R,s-=1,s==-1&&(g+=1,s=7);}if(f+=r,f<0||t<=f){f-=r,r=-r;break}}},F=function(n,o){for(var r=0,f=0,s=0,g=new Array(o.length),w=new Array(o.length),b=0;b<o.length;b+=1){var M=o[b].dataCount,R=o[b].totalCount-M;f=Math.max(f,M),s=Math.max(s,R),g[b]=new Array(M);for(var y=0;y<g[b].length;y+=1)g[b][y]=255&n.getBuffer()[y+r];r+=M;var I=P.getErrorCorrectPolynomial(R),$=T(g[b],I.getLength()-1),W=$.mod(I);w[b]=new Array(I.getLength()-1);for(var y=0;y<w[b].length;y+=1){var z=y+W.getLength()-w[b].length;w[b][y]=z>=0?W.getAt(z):0;}}for(var tt=0,y=0;y<o.length;y+=1)tt+=o[y].totalCount;for(var X=new Array(tt),Y=0,y=0;y<f;y+=1)for(var b=0;b<o.length;b+=1)y<g[b].length&&(X[Y]=g[b][y],Y+=1);for(var y=0;y<s;y+=1)for(var b=0;b<o.length;b+=1)y<w[b].length&&(X[Y]=w[b][y],Y+=1);return X},dt=function(n,o,r){for(var f=H.getRSBlocks(n,o),s=K(),g=0;g<r.length;g+=1){var w=r[g];s.put(w.getMode(),4),s.put(w.getLength(),P.getLengthInBits(w.getMode(),n)),w.write(s);}for(var b=0,g=0;g<f.length;g+=1)b+=f[g].dataCount;if(s.getLengthInBits()>b*8)throw "code length overflow. ("+s.getLengthInBits()+">"+b*8+")";for(s.getLengthInBits()+4<=b*8&&s.put(0,4);s.getLengthInBits()%8!=0;)s.putBit(false);for(;!(s.getLengthInBits()>=b*8||(s.put(d,8),s.getLengthInBits()>=b*8));)s.put(c,8);return F(s,f)};u.addData=function(n,o){o=o||"Byte";var r=null;switch(o){case "Numeric":r=V(n);break;case "Alphanumeric":r=U(n);break;case "Byte":r=G(n);break;case "Kanji":r=J(n);break;default:throw "mode:"+o}i.push(r),v=null;},u.isDark=function(n,o){if(n<0||t<=n||o<0||t<=o)throw n+","+o;return e[n][o]},u.getModuleCount=function(){return t},u.make=function(){if(a<1){for(var n=1;n<40;n++){for(var o=H.getRSBlocks(n,l),r=K(),f=0;f<i.length;f++){var s=i[f];r.put(s.getMode(),4),r.put(s.getLength(),P.getLengthInBits(s.getMode(),n)),s.write(r);}for(var g=0,f=0;f<o.length;f++)g+=o[f].dataCount;if(r.getLengthInBits()<=g*8)break}a=n;}_(false,C());},u.createTableTag=function(n,o){n=n||2,o=typeof o>"u"?n*4:o;var r="";r+='<table style="',r+=" border-width: 0px; border-style: none;",r+=" border-collapse: collapse;",r+=" padding: 0px; margin: "+o+"px;",r+='">',r+="<tbody>";for(var f=0;f<u.getModuleCount();f+=1){r+="<tr>";for(var s=0;s<u.getModuleCount();s+=1)r+='<td style="',r+=" border-width: 0px; border-style: none;",r+=" border-collapse: collapse;",r+=" padding: 0px; margin: 0px;",r+=" width: "+n+"px;",r+=" height: "+n+"px;",r+=" background-color: ",r+=u.isDark(f,s)?"#000000":"#ffffff",r+=";",r+='"/>';r+="</tr>";}return r+="</tbody>",r+="</table>",r},u.createSvgTag=function(n,o,r,f){var s={};typeof arguments[0]=="object"&&(s=arguments[0],n=s.cellSize,o=s.margin,r=s.alt,f=s.title),n=n||2,o=typeof o>"u"?n*4:o,r=typeof r=="string"?{text:r}:r||{},r.text=r.text||null,r.id=r.text?r.id||"qrcode-description":null,f=typeof f=="string"?{text:f}:f||{},f.text=f.text||null,f.id=f.text?f.id||"qrcode-title":null;var g=u.getModuleCount()*n+o*2,w,b,M,R,y="",I;for(I="l"+n+",0 0,"+n+" -"+n+",0 0,-"+n+"z ",y+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',y+=s.scalable?"":' width="'+g+'px" height="'+g+'px"',y+=' viewBox="0 0 '+g+" "+g+'" ',y+=' preserveAspectRatio="xMinYMin meet"',y+=f.text||r.text?' role="img" aria-labelledby="'+q([f.id,r.id].join(" ").trim())+'"':"",y+=">",y+=f.text?'<title id="'+q(f.id)+'">'+q(f.text)+"</title>":"",y+=r.text?'<description id="'+q(r.id)+'">'+q(r.text)+"</description>":"",y+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',y+='<path d="',M=0;M<u.getModuleCount();M+=1)for(R=M*n+o,w=0;w<u.getModuleCount();w+=1)u.isDark(M,w)&&(b=w*n+o,y+="M"+b+","+R+I);return y+='" stroke="transparent" fill="black"/>',y+="</svg>",y},u.createDataURL=function(n,o){n=n||2,o=typeof o>"u"?n*4:o;var r=u.getModuleCount()*n+o*2,f=o,s=r-o;return vt(r,r,function(g,w){if(f<=g&&g<s&&f<=w&&w<s){var b=Math.floor((g-f)/n),M=Math.floor((w-f)/n);return u.isDark(M,b)?0:1}else return 1})},u.createImgTag=function(n,o,r){n=n||2,o=typeof o>"u"?n*4:o;var f=u.getModuleCount()*n+o*2,s="";return s+="<img",s+=' src="',s+=u.createDataURL(n,o),s+='"',s+=' width="',s+=f,s+='"',s+=' height="',s+=f,s+='"',r&&(s+=' alt="',s+=q(r),s+='"'),s+="/>",s};var q=function(n){for(var o="",r=0;r<n.length;r+=1){var f=n.charAt(r);switch(f){case "<":o+="&lt;";break;case ">":o+="&gt;";break;case "&":o+="&amp;";break;case '"':o+="&quot;";break;default:o+=f;break}}return o},ct=function(n){var o=1;n=typeof n>"u"?o*2:n;var r=u.getModuleCount()*o+n*2,f=n,s=r-n,g,w,b,M,R,y={"\u2588\u2588":"\u2588","\u2588 ":"\u2580"," \u2588":"\u2584","  ":" "},I={"\u2588\u2588":"\u2580","\u2588 ":"\u2580"," \u2588":" ","  ":" "},$="";for(g=0;g<r;g+=2){for(b=Math.floor((g-f)/o),M=Math.floor((g+1-f)/o),w=0;w<r;w+=1)R="\u2588",f<=w&&w<s&&f<=g&&g<s&&u.isDark(b,Math.floor((w-f)/o))&&(R=" "),f<=w&&w<s&&f<=g+1&&g+1<s&&u.isDark(M,Math.floor((w-f)/o))?R+=" ":R+="\u2588",$+=n<1&&g+1>=s?I[R]:y[R];$+=`
`;}return r%2&&n>0?$.substring(0,$.length-r-1)+Array(r+1).join("\u2580"):$.substring(0,$.length-1)};return u.createASCII=function(n,o){if(n=n||1,n<2)return ct(o);n-=1,o=typeof o>"u"?n*2:o;var r=u.getModuleCount()*n+o*2,f=o,s=r-o,g,w,b,M,R=Array(n+1).join("\u2588\u2588"),y=Array(n+1).join("  "),I="",$="";for(g=0;g<r;g+=1){for(b=Math.floor((g-f)/n),$="",w=0;w<r;w+=1)M=1,f<=w&&w<s&&f<=g&&g<s&&u.isDark(b,Math.floor((w-f)/n))&&(M=0),$+=M?R:y;for(b=0;b<n;b+=1)I+=$+`
`;}return I.substring(0,I.length-1)},u.renderTo2dContext=function(n,o){o=o||2;for(var r=u.getModuleCount(),f=0;f<r;f++)for(var s=0;s<r;s++)n.fillStyle=u.isDark(f,s)?"black":"white",n.fillRect(f*o,s*o,o,o);},u};x.stringToBytesFuncs={default:function(h){for(var m=[],d=0;d<h.length;d+=1){var c=h.charCodeAt(d);m.push(c&255);}return m}},x.stringToBytes=x.stringToBytesFuncs.default,x.createStringToBytes=function(h,m){var d=(function(){for(var a=ut(h),l=function(){var E=a.read();if(E==-1)throw "eof";return E},e=0,t={};;){var v=a.read();if(v==-1)break;var i=l(),u=l(),_=l(),A=String.fromCharCode(v<<8|i),C=u<<8|_;t[A]=C,e+=1;}if(e!=m)throw e+" != "+m;return t})(),c=63;return function(a){for(var l=[],e=0;e<a.length;e+=1){var t=a.charCodeAt(e);if(t<128)l.push(t);else {var v=d[a.charAt(e)];typeof v=="number"?(v&255)==v?l.push(v):(l.push(v>>>8),l.push(v&255)):l.push(c);}}return l}};var p={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},L={L:1,M:0,Q:3,H:2},D={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},P=(function(){var h=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],m=1335,d=7973,c=21522,a={},l=function(e){for(var t=0;e!=0;)t+=1,e>>>=1;return t};return a.getBCHTypeInfo=function(e){for(var t=e<<10;l(t)-l(m)>=0;)t^=m<<l(t)-l(m);return (e<<10|t)^c},a.getBCHTypeNumber=function(e){for(var t=e<<12;l(t)-l(d)>=0;)t^=d<<l(t)-l(d);return e<<12|t},a.getPatternPosition=function(e){return h[e-1]},a.getMaskFunction=function(e){switch(e){case D.PATTERN000:return function(t,v){return (t+v)%2==0};case D.PATTERN001:return function(t,v){return t%2==0};case D.PATTERN010:return function(t,v){return v%3==0};case D.PATTERN011:return function(t,v){return (t+v)%3==0};case D.PATTERN100:return function(t,v){return (Math.floor(t/2)+Math.floor(v/3))%2==0};case D.PATTERN101:return function(t,v){return t*v%2+t*v%3==0};case D.PATTERN110:return function(t,v){return (t*v%2+t*v%3)%2==0};case D.PATTERN111:return function(t,v){return (t*v%3+(t+v)%2)%2==0};default:throw "bad maskPattern:"+e}},a.getErrorCorrectPolynomial=function(e){for(var t=T([1],0),v=0;v<e;v+=1)t=t.multiply(T([1,B.gexp(v)],0));return t},a.getLengthInBits=function(e,t){if(1<=t&&t<10)switch(e){case p.MODE_NUMBER:return 10;case p.MODE_ALPHA_NUM:return 9;case p.MODE_8BIT_BYTE:return 8;case p.MODE_KANJI:return 8;default:throw "mode:"+e}else if(t<27)switch(e){case p.MODE_NUMBER:return 12;case p.MODE_ALPHA_NUM:return 11;case p.MODE_8BIT_BYTE:return 16;case p.MODE_KANJI:return 10;default:throw "mode:"+e}else if(t<41)switch(e){case p.MODE_NUMBER:return 14;case p.MODE_ALPHA_NUM:return 13;case p.MODE_8BIT_BYTE:return 16;case p.MODE_KANJI:return 12;default:throw "mode:"+e}else throw "type:"+t},a.getLostPoint=function(e){for(var t=e.getModuleCount(),v=0,i=0;i<t;i+=1)for(var u=0;u<t;u+=1){for(var _=0,A=e.isDark(i,u),C=-1;C<=1;C+=1)if(!(i+C<0||t<=i+C))for(var E=-1;E<=1;E+=1)u+E<0||t<=u+E||C==0&&E==0||A==e.isDark(i+C,u+E)&&(_+=1);_>5&&(v+=3+_-5);}for(var i=0;i<t-1;i+=1)for(var u=0;u<t-1;u+=1){var O=0;e.isDark(i,u)&&(O+=1),e.isDark(i+1,u)&&(O+=1),e.isDark(i,u+1)&&(O+=1),e.isDark(i+1,u+1)&&(O+=1),(O==0||O==4)&&(v+=3);}for(var i=0;i<t;i+=1)for(var u=0;u<t-6;u+=1)e.isDark(i,u)&&!e.isDark(i,u+1)&&e.isDark(i,u+2)&&e.isDark(i,u+3)&&e.isDark(i,u+4)&&!e.isDark(i,u+5)&&e.isDark(i,u+6)&&(v+=40);for(var u=0;u<t;u+=1)for(var i=0;i<t-6;i+=1)e.isDark(i,u)&&!e.isDark(i+1,u)&&e.isDark(i+2,u)&&e.isDark(i+3,u)&&e.isDark(i+4,u)&&!e.isDark(i+5,u)&&e.isDark(i+6,u)&&(v+=40);for(var N=0,u=0;u<t;u+=1)for(var i=0;i<t;i+=1)e.isDark(i,u)&&(N+=1);var j=Math.abs(100*N/t/t-50)/5;return v+=j*10,v},a})(),B=(function(){for(var h=new Array(256),m=new Array(256),d=0;d<8;d+=1)h[d]=1<<d;for(var d=8;d<256;d+=1)h[d]=h[d-4]^h[d-5]^h[d-6]^h[d-8];for(var d=0;d<255;d+=1)m[h[d]]=d;var c={};return c.glog=function(a){if(a<1)throw "glog("+a+")";return m[a]},c.gexp=function(a){for(;a<0;)a+=255;for(;a>=256;)a-=255;return h[a]},c})();function T(h,m){if(typeof h.length>"u")throw h.length+"/"+m;var d=(function(){for(var a=0;a<h.length&&h[a]==0;)a+=1;for(var l=new Array(h.length-a+m),e=0;e<h.length-a;e+=1)l[e]=h[e+a];return l})(),c={};return c.getAt=function(a){return d[a]},c.getLength=function(){return d.length},c.multiply=function(a){for(var l=new Array(c.getLength()+a.getLength()-1),e=0;e<c.getLength();e+=1)for(var t=0;t<a.getLength();t+=1)l[e+t]^=B.gexp(B.glog(c.getAt(e))+B.glog(a.getAt(t)));return T(l,0)},c.mod=function(a){if(c.getLength()-a.getLength()<0)return c;for(var l=B.glog(c.getAt(0))-B.glog(a.getAt(0)),e=new Array(c.getLength()),t=0;t<c.getLength();t+=1)e[t]=c.getAt(t);for(var t=0;t<a.getLength();t+=1)e[t]^=B.gexp(B.glog(a.getAt(t))+l);return T(e,0).mod(a)},c}var H=(function(){var h=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],m=function(a,l){var e={};return e.totalCount=a,e.dataCount=l,e},d={},c=function(a,l){switch(l){case L.L:return h[(a-1)*4+0];case L.M:return h[(a-1)*4+1];case L.Q:return h[(a-1)*4+2];case L.H:return h[(a-1)*4+3];default:return}};return d.getRSBlocks=function(a,l){var e=c(a,l);if(typeof e>"u")throw "bad rs block @ typeNumber:"+a+"/errorCorrectionLevel:"+l;for(var t=e.length/3,v=[],i=0;i<t;i+=1)for(var u=e[i*3+0],_=e[i*3+1],A=e[i*3+2],C=0;C<u;C+=1)v.push(m(_,A));return v},d})(),K=function(){var h=[],m=0,d={};return d.getBuffer=function(){return h},d.getAt=function(c){var a=Math.floor(c/8);return (h[a]>>>7-c%8&1)==1},d.put=function(c,a){for(var l=0;l<a;l+=1)d.putBit((c>>>a-l-1&1)==1);},d.getLengthInBits=function(){return m},d.putBit=function(c){var a=Math.floor(m/8);h.length<=a&&h.push(0),c&&(h[a]|=128>>>m%8),m+=1;},d},V=function(h){var m=p.MODE_NUMBER,d=h,c={};c.getMode=function(){return m},c.getLength=function(e){return d.length},c.write=function(e){for(var t=d,v=0;v+2<t.length;)e.put(a(t.substring(v,v+3)),10),v+=3;v<t.length&&(t.length-v==1?e.put(a(t.substring(v,v+1)),4):t.length-v==2&&e.put(a(t.substring(v,v+2)),7));};var a=function(e){for(var t=0,v=0;v<e.length;v+=1)t=t*10+l(e.charAt(v));return t},l=function(e){if("0"<=e&&e<="9")return e.charCodeAt(0)-48;throw "illegal char :"+e};return c},U=function(h){var m=p.MODE_ALPHA_NUM,d=h,c={};c.getMode=function(){return m},c.getLength=function(l){return d.length},c.write=function(l){for(var e=d,t=0;t+1<e.length;)l.put(a(e.charAt(t))*45+a(e.charAt(t+1)),11),t+=2;t<e.length&&l.put(a(e.charAt(t)),6);};var a=function(l){if("0"<=l&&l<="9")return l.charCodeAt(0)-48;if("A"<=l&&l<="Z")return l.charCodeAt(0)-65+10;switch(l){case " ":return 36;case "$":return 37;case "%":return 38;case "*":return 39;case "+":return 40;case "-":return 41;case ".":return 42;case "/":return 43;case ":":return 44;default:throw "illegal char :"+l}};return c},G=function(h){var m=p.MODE_8BIT_BYTE,c=x.stringToBytes(h),a={};return a.getMode=function(){return m},a.getLength=function(l){return c.length},a.write=function(l){for(var e=0;e<c.length;e+=1)l.put(c[e],8);},a},J=function(h){var m=p.MODE_KANJI,c=x.stringToBytesFuncs.SJIS;if(!c)throw "sjis not supported.";(function(e,t){var v=c(e);if(v.length!=2||(v[0]<<8|v[1])!=t)throw "sjis not supported."})("\u53CB",38726);var a=c(h),l={};return l.getMode=function(){return m},l.getLength=function(e){return ~~(a.length/2)},l.write=function(e){for(var t=a,v=0;v+1<t.length;){var i=(255&t[v])<<8|255&t[v+1];if(33088<=i&&i<=40956)i-=33088;else if(57408<=i&&i<=60351)i-=49472;else throw "illegal char at "+(v+1)+"/"+i;i=(i>>>8&255)*192+(i&255),e.put(i,13),v+=2;}if(v<t.length)throw "illegal char at "+(v+1)},l},Z=function(){var h=[],m={};return m.writeByte=function(d){h.push(d&255);},m.writeShort=function(d){m.writeByte(d),m.writeByte(d>>>8);},m.writeBytes=function(d,c,a){c=c||0,a=a||d.length;for(var l=0;l<a;l+=1)m.writeByte(d[l+c]);},m.writeString=function(d){for(var c=0;c<d.length;c+=1)m.writeByte(d.charCodeAt(c));},m.toByteArray=function(){return h},m.toString=function(){var d="";d+="[";for(var c=0;c<h.length;c+=1)c>0&&(d+=","),d+=h[c];return d+="]",d},m},st=function(){var h=0,m=0,d=0,c="",a={},l=function(t){c+=String.fromCharCode(e(t&63));},e=function(t){if(!(t<0)){if(t<26)return 65+t;if(t<52)return 97+(t-26);if(t<62)return 48+(t-52);if(t==62)return 43;if(t==63)return 47}throw "n:"+t};return a.writeByte=function(t){for(h=h<<8|t&255,m+=8,d+=1;m>=6;)l(h>>>m-6),m-=6;},a.flush=function(){if(m>0&&(l(h<<6-m),h=0,m=0),d%3!=0)for(var t=3-d%3,v=0;v<t;v+=1)c+="=";},a.toString=function(){return c},a},ut=function(h){var m=h,d=0,c=0,a=0,l={};l.read=function(){for(;a<8;){if(d>=m.length){if(a==0)return  -1;throw "unexpected end of file./"+a}var t=m.charAt(d);if(d+=1,t=="=")return a=0,-1;if(t.match(/^\s$/))continue;c=c<<6|e(t.charCodeAt(0)),a+=6;}var v=c>>>a-8&255;return a-=8,v};var e=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(t==43)return 62;if(t==47)return 63;throw "c:"+t};return l},lt=function(h,m){var d=h,c=m,a=new Array(h*m),l={};l.setPixel=function(i,u,_){a[u*d+i]=_;},l.write=function(i){i.writeString("GIF87a"),i.writeShort(d),i.writeShort(c),i.writeByte(128),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(0),i.writeByte(255),i.writeByte(255),i.writeByte(255),i.writeString(","),i.writeShort(0),i.writeShort(0),i.writeShort(d),i.writeShort(c),i.writeByte(0);var u=2,_=t(u);i.writeByte(u);for(var A=0;_.length-A>255;)i.writeByte(255),i.writeBytes(_,A,255),A+=255;i.writeByte(_.length-A),i.writeBytes(_,A,_.length-A),i.writeByte(0),i.writeString(";");};var e=function(i){var u=i,_=0,A=0,C={};return C.write=function(E,O){if(E>>>O)throw "length over";for(;_+O>=8;)u.writeByte(255&(E<<_|A)),O-=8-_,E>>>=8-_,A=0,_=0;A=E<<_|A,_=_+O;},C.flush=function(){_>0&&u.writeByte(A);},C},t=function(i){for(var u=1<<i,_=(1<<i)+1,A=i+1,C=v(),E=0;E<u;E+=1)C.add(String.fromCharCode(E));C.add(String.fromCharCode(u)),C.add(String.fromCharCode(_));var O=Z(),N=e(O);N.write(u,A);var j=0,S=String.fromCharCode(a[j]);for(j+=1;j<a.length;){var F=String.fromCharCode(a[j]);j+=1,C.contains(S+F)?S=S+F:(N.write(C.indexOf(S),A),C.size()<4095&&(C.size()==1<<A&&(A+=1),C.add(S+F)),S=F);}return N.write(C.indexOf(S),A),N.write(_,A),N.flush(),O.toByteArray()},v=function(){var i={},u=0,_={};return _.add=function(A){if(_.contains(A))throw "dup key:"+A;i[A]=u,u+=1;},_.size=function(){return u},_.indexOf=function(A){return i[A]},_.contains=function(A){return typeof i[A]<"u"},_};return l},vt=function(h,m,d){for(var c=lt(h,m),a=0;a<m;a+=1)for(var l=0;l<h;l+=1)c.setPixel(l,a,d(l,a));var e=Z();c.write(e);for(var t=st(),v=e.toByteArray(),i=0;i<v.length;i+=1)t.writeByte(v[i]);return t.flush(),"data:image/gif;base64,"+t};return x})();(function(){et.stringToBytesFuncs["UTF-8"]=function(x){function p(L){for(var D=[],P=0;P<L.length;P++){var B=L.charCodeAt(P);B<128?D.push(B):B<2048?D.push(192|B>>6,128|B&63):B<55296||B>=57344?D.push(224|B>>12,128|B>>6&63,128|B&63):(P++,B=65536+((B&1023)<<10|L.charCodeAt(P)&1023),D.push(240|B>>18,128|B>>12&63,128|B>>6&63,128|B&63));}return D}return p(x)};})();(function(x){typeof define=="function"&&define.amd?define([],x):typeof rt=="object"&&(at.exports=x());})(function(){return et});});var ft=w(nt()),ot={nombre_negocio:"Jasta Technology",telefonos:null,redes:null,texto_garantia:"Todos nuestros productos cuentan con garant\xEDa. Guarda este r\xF3tulo: es el soporte para la garant\xEDa."};function mt(){return new URL("assets/icon/logo-rotulo.png",document.baseURI).href}async function wt(x){let{data:p,error:L}=await x.from("configuracion").select("nombre_negocio, telefonos, redes, texto_garantia, direccion").eq("id",true).single();return L||!p?ot:{nombre_negocio:p.nombre_negocio?.trim()||ot.nombre_negocio,telefonos:p.telefonos?.trim()||null,redes:p.redes?.trim()||null,texto_garantia:p.texto_garantia?.trim()||null,direccion:p.direccion?.trim()||null}}function k(x){return String(x??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function pt(x){return Number(x||0).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})}function Q(x){return (x??"").toLocaleUpperCase("es-CO")}function it(x){return (x??"").split(/\s*[-,/|]\s*(?=\d)|\n/).map(p=>p.trim()).filter(Boolean)}function xt(x){let p=(0, ft.default)(0,"Q");return p.addData(`JASTA-${x}`,"Alphanumeric"),p.make(),p.createSvgTag({cellSize:4,margin:8,scalable:true}).replace("<svg ",'<svg shape-rendering="crispEdges" ')}function yt(x,p){let L=it(p.telefonos).map(U=>`<div>${k(U)}</div>`).join(""),D=3,P=x.productos.length>D?[...x.productos.slice(0,D-1).map(U=>k(U)),`y ${x.productos.length-(D-1)} productos m\xE1s`]:x.productos.map(U=>k(U)),B=P.length?P.join("<br>"):"\u2014",T=(U,G,J="")=>`<tr${J?` class="${J}"`:""}><th>${U}</th><td><div class="v">${G||"\u2014"}</div></td></tr>`,[H,K,V]=new Date(x.created_at).toLocaleDateString("en-CA",{timeZone:"America/Bogota"}).split("-");return `
  <section class="rotulo">
    <header class="cabecera">
      <div class="marca"><img class="logo" src="${mt()}" alt="" /><span class="nombre">${k(p.nombre_negocio)}</span></div>

      <div class="qr">${xt(x.numero)}<span>#${k(x.numero)}</span></div>

      <div class="contacto">
        <div class="fecha">
          <span class="etiqueta">Fecha</span>
          <div class="fecha-cajas">
            <span>${V}</span><span>${K}</span><span class="anio">${H}</span>
          </div>
        </div>
        ${L?`<div class="telefonos">${L}</div>`:""}
        ${p.redes?`<div class="redes">${k(p.redes)}</div>`:""}
      </div>
    </header>

    ${x.nacional?`
    <div class="cobro">
      <span class="cobro-label">Env\xEDo nacional</span>
      <strong class="cobro-valor">PAGADO \xB7 NO COBRAR</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${T("Pedido","#"+k(x.numero),"pedido")}
      ${T("Para",k(x.cliente_nombre),"destacado")}
      ${T("C.C.",k(x.nacional.cedula),"fuerte")}
      ${T("Direcci\xF3n",k(Q(x.direccion)),"destacado")}
      ${T("Ciudad",k(Q([x.nacional.ciudad,x.nacional.departamento].filter(Boolean).join(" - "))),"destacado")}
      ${T("Celular",k(Q(x.cliente_telefono)),"fuerte")}
      ${T("Contenido",B,"productos")}
      ${T("Remite",k([p.nombre_negocio,p.direccion,it(p.telefonos)[0]].filter(Boolean).join(" \xB7 ")))}
    </table>
    </div>`:`
    <div class="cobro">
      <span class="cobro-label">Valor a cobrar</span>
      <strong class="cobro-valor">${pt(x.total)}</strong>
    </div>

    <div class="cuerpo">
    <table class="datos">
      ${T("Pedido","#"+k(x.numero),"pedido")}
      ${T("Nombre",k(x.cliente_nombre),"destacado")}
      ${T("Direcci\xF3n",k(Q(x.direccion)),"destacado")}
      ${T("Barrio",k(x.barrio))}
      ${T("Celular",k(Q(x.cliente_telefono)),"fuerte")}
      ${T("Producto",B,"productos")}
      ${T("Observaci\xF3n",k(Q(x.observaciones)),"fuerte")}
    </table>
    </div>`}

    ${p.texto_garantia?`<p class="garantia">${k(p.texto_garantia)}</p>`:""}
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
`;function _t(x,p="R\xF3tulos",L=""){return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${k(p)}</title>
    <style>${bt}${L}</style>
  </head>
  <body>${x.join("")}</body>
</html>`}var At=`
  @media screen {
    body { padding: 12px 0; }
    .rotulo { margin-bottom: 0; }
  }
  @media (max-width: 400px) { body { zoom: 0.9; } }
  @media (max-width: 360px) { body { zoom: 0.82; } }
  @media (max-width: 330px) { body { zoom: 0.74; } }
`;function Bt(x){document.querySelectorAll("iframe.marco-impresion").forEach(D=>D.remove());let p=document.createElement("iframe");p.className="marco-impresion",p.setAttribute("aria-hidden","true"),p.tabIndex=-1,p.style.cssText="position:fixed;left:-10000px;top:0;width:100mm;height:100mm;border:0;opacity:0;pointer-events:none;";let L=false;p.onload=async()=>{if(L)return;L=true;let D=p.contentDocument,P=Array.from(D?.images??[]).filter(T=>!T.complete);await Promise.race([Promise.all(P.map(T=>new Promise(H=>{T.onload=T.onerror=H;}))),new Promise(T=>setTimeout(T,2500))]);let B=p.contentWindow;B&&(B.focus(),B.print(),setTimeout(()=>p.remove(),12e4));},p.srcdoc=x,document.body.appendChild(p);}export{At as A,Bt as B,_t as _,nt as n,ot as o,wt as w,yt as y};