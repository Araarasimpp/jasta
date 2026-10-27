// Pantallas de Jasta redibujadas tal como se ven en la app (catálogo público y "Pedidos de la tienda")
import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { r, sp } from '../animacion';
import { C, FUENTE, MONO, pesos } from '../tema';
import { presion } from './base';

export const PRODUCTOS = [
  { n: 'HIDROLAVADORA DOBLE BATERÍA 48V', p: 65000 },
  { n: 'IMPERMEABLE CON BOTAS', p: 50000 },
  { n: 'ARMARIO EN TELA X3', p: 65000 },
  { n: 'ZAPATERO 6 NIVELES ACETATO', p: 50000 },
  { n: 'CARPA PARA MOTO', p: 25000 },
  { n: 'GABINETE ORGANIZADOR MULTIUSOS', p: 110000 },
  { n: 'PATÍN APRENDIZAJE NIÑA', p: 115000, agotado: true },
  { n: 'CINTURÓN CÓLICOS', p: 35000 },
  { n: 'ZAPATERO EN TELA 9N', p: 50000 },
  { n: 'CAJA REGISTRADORA DE DINERO', p: 150000 },
  { n: 'PAÑALERA CAMBIADOR', p: 75000 },
  { n: 'ARMARIO ESQUELETO X4', p: 100000 },
].map((x, i) => ({ ...x, img: staticFile(`productos/p${i + 1}.jpg`) }));

export const ENLACE = 'app.jastatechnology.com/tienda/valentina-12';

const caja: React.CSSProperties = { fontFamily: FUENTE, color: C.texto };

// ---------------------------------------------------------------- Catálogo público
export const PantallaTienda: React.FC<{ scroll: number; agregados: number[]; toques?: { i: number; en: number }[] }> = ({ scroll, agregados, toques = [] }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...caja, position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ transform: `translateY(${-scroll}px)`, padding: '6px 14px 120px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Img src={staticFile('logo.png')} style={{ width: 40, height: 40, borderRadius: 11, background: '#fff', objectFit: 'contain' }} />
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.15 }}>Jasta Technology</div>
            <div style={{ fontSize: 11.5, color: C.suave }}>Catálogo de Valentina · Pide aquí y te lo llevamos</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, height: 40, borderRadius: 999, border: `1px solid ${C.bordeFuerte}`, background: '#fff', display: 'flex', alignItems: 'center',
            padding: '0 14px', fontSize: 14, color: C.tenue }}>Buscar producto</div>
          <div style={{ height: 40, padding: '0 14px', borderRadius: 999, border: `1px solid ${C.bordeFuerte}`, background: '#fff', display: 'flex', alignItems: 'center',
            fontSize: 13, color: C.suave }}>Disponibles</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PRODUCTOS.map((p, i) => {
            const t = toques.find((x) => x.i === i);
            const esc = t ? presion(f, t.en) : 1;
            const hecho = agregados.includes(i);
            return (
              <div key={i} style={{ border: `1px solid ${C.borde}`, borderRadius: 16, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'relative', height: 172, background: '#fff' }}>
                  <Img src={p.img} style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box', opacity: p.agotado ? 0.45 : 1,
                    filter: p.agotado ? 'grayscale(.6)' : undefined }} />
                  {p.agotado && <span style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 6, background: C.rojo, color: '#fff', fontSize: 11, fontWeight: 700 }}>Agotado</span>}
                </div>
                <div style={{ padding: '8px 10px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: '15.5px', height: 31, overflow: 'hidden' }}>{p.n}</div>
                  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, lineHeight: '19px', height: 19 }}>{pesos(p.p)}</div>
                  <div style={{ height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 650, transform: `scale(${esc})`,
                    background: p.agotado ? C.superficie2 : hecho ? C.verde : C.azul, color: p.agotado ? C.tenue : '#fff' }}>
                    {p.agotado ? 'Agotado' : hecho ? '✓ Agregado' : 'Agregar'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/** Barra "Ver mi pedido" que sube desde abajo */
export const BarraPedido: React.FC<{ desde: number; unidades: number; total: number; toque?: number }> = ({ desde, unidades, total, toque }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde);
  return (
    <div style={{ ...caja, position: 'absolute', left: 14, right: 14, bottom: 22, height: 52, borderRadius: 999, background: C.texto, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 18px', fontSize: 14.5, fontWeight: 650, zIndex: 30,
      transform: `translateY(${(1 - p) * 110}px) scale(${toque ? presion(f, toque) : 1})`, boxShadow: '0 16px 30px -12px rgba(15,23,42,.5)' }}>
      <span>Ver mi pedido · {unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
      <span style={{ fontFamily: MONO }}>{pesos(total)}</span>
    </div>
  );
};

const Campo: React.FC<{ etq: string; valor: string; activo?: boolean; prefijo?: boolean }> = ({ etq, valor, activo, prefijo }) => {
  const f = useCurrentFrame();
  const cursor = activo && Math.floor(f / 8) % 2 === 0;
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>{etq}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {prefijo && <div style={{ width: 84, height: 36, borderRadius: 8, border: `1px solid ${C.bordeFuerte}`, background: '#fff', display: 'flex', alignItems: 'center',
          padding: '0 8px', fontSize: 12.5 }}>🇨🇴 +57</div>}
        <div style={{ flex: 1, height: 36, borderRadius: 8, border: `1px solid ${activo ? C.azul : C.bordeFuerte}`, background: '#fff', display: 'flex', alignItems: 'center',
          padding: '0 10px', fontSize: 13.5, boxShadow: activo ? `0 0 0 3px ${C.azulSoft}` : undefined }}>
          {valor}
          {cursor && <span style={{ width: 1.5, height: 17, background: C.azul, marginLeft: 1 }} />}
        </div>
      </div>
    </div>
  );
};

/** Hoja "Tu pedido" con los productos y los datos de entrega */
export const HojaCarrito: React.FC<{
  desde: number; nombre: string; tel: string; dir: string; barrio: string; activo: number; domicilio: number | null; toqueEnviar?: number;
}> = ({ desde, nombre, tel, dir, barrio, activo, domicilio, toqueEnviar }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde);
  const sub = 100000;
  const dom = domicilio ?? 0;
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.35)', opacity: p, zIndex: 35 }} />
      <div style={{ ...caja, position: 'absolute', left: 0, right: 0, bottom: 0, height: 720, borderRadius: '24px 24px 0 0', background: '#fff', zIndex: 36,
        transform: `translateY(${(1 - p) * 740}px)`, padding: '10px 16px 0', boxSizing: 'border-box' }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: C.bordeFuerte, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 6 }}>Tu pedido</div>
        {[2, 7].map((i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', gap: 10, alignItems: 'center', padding: '7px 0', borderBottom: `1px dashed ${C.borde}` }}>
            <Img src={PRODUCTOS[i].img} style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8, background: '#fff' }} />
            <div><div style={{ fontSize: 12.5, fontWeight: 600 }}>{PRODUCTOS[i].n}</div><div style={{ fontSize: 11.5, color: C.tenue }}>{pesos(PRODUCTOS[i].p)} c/u</div></div>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>1</div>
          </div>
        ))}
        <div style={{ height: 10 }} />
        <Campo etq="Tu nombre" valor={nombre} activo={activo === 0} />
        <Campo etq="Celular" valor={tel} activo={activo === 1} prefijo />
        <Campo etq="Dirección" valor={dir} activo={activo === 2} />
        <Campo etq="Barrio" valor={barrio} activo={activo === 3} />
        <div style={{ marginTop: 6, padding: '9px 12px', borderRadius: 10, background: C.superficie2, fontSize: 13.5, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Productos</span><span style={{ fontFamily: MONO }}>{pesos(sub)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: domicilio !== null ? C.verdeTexto : C.texto, fontWeight: domicilio !== null ? 650 : 400 }}>
            <span>Domicilio</span><span style={{ fontFamily: MONO }}>{domicilio === null ? 'Te lo confirmamos' : pesos(dom)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}><span>Total</span><span style={{ fontFamily: MONO }}>{pesos(sub + dom)}</span></div>
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, bottom: 22, display: 'flex', gap: 8}}>
          <div style={{ flex: 1, height: 44, borderRadius: 10, border: `1px solid ${C.bordeFuerte}`, display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 600 }}>Seguir comprando</div>
          <div style={{ flex: 1, height: 44, borderRadius: 10, background: C.azul, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 700,
            transform: `scale(${toqueEnviar ? presion(f, toqueEnviar) : 1})` }}>Hacer pedido</div>
        </div>
      </div>
    </>
  );
};

export const PantallaListo: React.FC<{ desde: number }> = ({ desde }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde);
  const check = sp(f, desde + 6, 12);
  return (
    <div style={{ ...caja, position: 'absolute', inset: 0, background: C.fondo, opacity: p, zIndex: 40, padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <Img src={staticFile('logo.png')} style={{ width: 40, height: 40, borderRadius: 11, background: '#fff', objectFit: 'contain' }} />
        <div style={{ fontSize: 17, fontWeight: 700 }}>Jasta Technology</div>
      </div>
      <div style={{ borderRadius: 20, background: '#fff', border: `1px solid ${C.borde}`, padding: '28px 20px', textAlign: 'center', transform: `translateY(${(1 - p) * 30}px)` }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.verdeWash, color: C.verdeTexto, margin: '0 auto 14px', display: 'grid', placeItems: 'center',
          fontSize: 34, fontWeight: 700, transform: `scale(${check})` }}>✓</div>
        <div style={{ fontSize: 23, fontWeight: 750, marginBottom: 10 }}>¡Recibimos tu pedido!</div>
        <div style={{ fontSize: 14.5, lineHeight: 1.5, color: C.suave, marginBottom: 12 }}>Valentina te va a llamar o escribir al 3001112233 para confirmarlo. Después de confirmado, te lo enviamos.</div>
        <div style={{ fontSize: 15, color: C.suave, marginBottom: 16 }}><b style={{ color: C.texto }}>Total: {pesos(112000)}</b>, domicilio incluido</div>
        <div style={{ height: 46, borderRadius: 12, background: C.whatsapp, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15 }}>Escribir por WhatsApp</div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- App de la vendedora
const BarraInferior: React.FC = () => (
  <div style={{ ...caja, position: 'absolute', left: 0, right: 0, bottom: 0, height: 74, background: '#fff', borderTop: `1px solid ${C.borde}`, display: 'flex',
    justifyContent: 'space-around', alignItems: 'center', fontSize: 10.5, color: C.tenue, zIndex: 20, paddingBottom: 10 }}>
    {['Mi panel', 'Catálogo', '', 'Avisos', 'Más'].map((t, i) => i === 2
      ? <div key={i} style={{ width: 46, height: 46, borderRadius: 12, background: C.azul, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 300 }}>+</div>
      : <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}><div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${C.tenue}` }} />{t}</div>)}
  </div>
);

export const PantallaPedidosTienda: React.FC<{ toqueCompartir?: number; children?: React.ReactNode; scroll?: number }> = ({ toqueCompartir, children, scroll = 0 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ ...caja, position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div style={{ padding: '8px 16px', transform: `translateY(${-scroll}px)` }}>
        <div style={{ fontSize: 12, color: C.tenue }}>Lo que piden los clientes en el catálogo</div>
        <div style={{ fontSize: 27, fontWeight: 760, letterSpacing: '-0.02em', margin: '2px 0 14px' }}>Pedidos de la tienda</div>
        <div style={{ borderRadius: 18, background: '#fff', border: `1px solid ${C.borde}`, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', color: C.tenue }}>TU ENLACE DE LA TIENDA</div>
          <div style={{ padding: '9px 10px', borderRadius: 8, background: C.superficie2, fontFamily: MONO, fontSize: 11.5, wordBreak: 'break-all' }}>https://{ENLACE}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ padding: '9px 14px', borderRadius: 9, background: C.azul, color: '#fff', fontSize: 13.5, fontWeight: 650,
              transform: `scale(${toqueCompartir ? presion(f, toqueCompartir) : 1})` }}>Compartir enlace</div>
            <div style={{ padding: '9px 14px', borderRadius: 9, border: `1px solid ${C.bordeFuerte}`, fontSize: 13.5, fontWeight: 600 }}>Copiar</div>
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: C.suave }}>Compártelo en tus estados, Instagram o grupos. Lo que pidan por ahí te llega aquí a tu nombre, con tu comisión normal.</div>
        </div>
        {children}
      </div>
      <BarraInferior />
    </div>
  );
};

const IconoApp: React.FC<{ tipo: 'wa' | 'ig' | 'fb' | 'sms'; tam?: number }> = ({ tipo, tam = 58 }) => {
  const fondos = { wa: C.whatsapp, ig: 'linear-gradient(45deg,#F9CE34,#EE2A7B 50%,#6228D7)', fb: '#1877F2', sms: '#34C759' };
  return (
    <div style={{ width: tam, height: tam, borderRadius: tam * 0.26, background: fondos[tipo], display: 'grid', placeItems: 'center', color: '#fff' }}>
      {tipo === 'ig' ? (
        <div style={{ width: tam * 0.5, height: tam * 0.5, borderRadius: tam * 0.15, border: '3px solid #fff', display: 'grid', placeItems: 'center' }}>
          <div style={{ width: tam * 0.2, height: tam * 0.2, borderRadius: '50%', border: '3px solid #fff' }} />
        </div>
      ) : tipo === 'fb' ? (
        <span style={{ fontFamily: FUENTE, fontWeight: 800, fontSize: tam * 0.55 }}>f</span>
      ) : (
        <div style={{ width: tam * 0.52, height: tam * 0.44, borderRadius: '50%', background: '#fff', position: 'relative' }}>
          <div style={{ position: 'absolute', left: tam * 0.02, bottom: -tam * 0.06, width: 0, height: 0, borderLeft: `${tam * 0.06}px solid transparent`,
            borderRight: `${tam * 0.1}px solid transparent`, borderTop: `${tam * 0.14}px solid #fff`, transform: 'rotate(25deg)' }} />
        </div>
      )}
    </div>
  );
};

export const HojaCompartir: React.FC<{ desde: number; toqueWa?: number }> = ({ desde, toqueWa }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde);
  const apps: { t: 'wa' | 'ig' | 'fb' | 'sms'; n: string }[] = [
    { t: 'wa', n: 'WhatsApp' }, { t: 'ig', n: 'Instagram' }, { t: 'fb', n: 'Facebook' }, { t: 'sms', n: 'Mensajes' },
  ];
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.3)', opacity: p, zIndex: 35 }} />
      <div style={{ ...caja, position: 'absolute', left: 8, right: 8, bottom: 8, height: 330, borderRadius: 26, background: '#F2F2F7', zIndex: 36, padding: 16,
        transform: `translateY(${(1 - p) * 360}px)`, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, borderBottom: `1px solid ${C.borde}` }}>
          <Img src={staticFile('logo.png')} style={{ width: 46, height: 46, borderRadius: 11, background: '#fff', objectFit: 'contain' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 650 }}>Catálogo</div>
            <div style={{ fontSize: 11.5, color: C.tenue, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280 }}>{ENLACE}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '18px 4px 0' }}>
          {apps.map((a, i) => (
            <div key={a.t} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontSize: 11.5,
              transform: `scale(${i === 0 && toqueWa ? presion(f, toqueWa) : 1}) translateY(${(1 - sp(f, desde + 4 + i * 3)) * 30}px)` }}>
              <IconoApp tipo={a.t} />{a.n}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 22, borderRadius: 12, background: '#fff', fontSize: 14 }}>
          {['Copiar', 'Agregar a favoritos'].map((t, i) => (
            <div key={t} style={{ padding: '12px 14px', borderTop: i ? `1px solid ${C.borde}` : undefined }}>{t}</div>
          ))}
        </div>
      </div>
    </>
  );
};

/** Pantalla bloqueada con un aviso que cae desde arriba */
export const PantallaBloqueo: React.FC<{ aviso: number; toque?: number }> = ({ aviso, toque }) => {
  const f = useCurrentFrame();
  const p = sp(f, aviso, 16);
  return (
    <div style={{ ...caja, position: 'absolute', inset: '-54px 0 0 0', background: 'radial-gradient(120% 80% at 30% 0%, #3B4A8C 0%, #1B2350 45%, #0B1120 100%)', color: '#fff' }}>
      <div style={{ textAlign: 'center', marginTop: 96 }}>
        <div style={{ fontSize: 19, fontWeight: 500, opacity: 0.85 }}>martes, 27 de octubre</div>
        <div style={{ fontSize: 104, fontWeight: 300, letterSpacing: '-0.03em', lineHeight: 1 }}>9:41</div>
      </div>
      <div style={{ position: 'absolute', left: 12, right: 12, top: 270, borderRadius: 22, background: 'rgba(245,245,247,.92)', color: C.texto, padding: '12px 14px',
        display: 'flex', gap: 12, transform: `translateY(${(1 - p) * -60}px) scale(${(0.92 + p * 0.08) * (toque ? presion(f, toque) : 1)})`, opacity: p,
        boxShadow: '0 20px 40px -20px rgba(0,0,0,.6)' }}>
        <Img src={staticFile('logo.png')} style={{ width: 42, height: 42, borderRadius: 10, background: '#fff', objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.tenue }}><b style={{ color: C.texto, letterSpacing: '.02em' }}>JASTA</b><span>ahora</span></div>
          <div style={{ fontSize: 14.5, fontWeight: 650, marginTop: 2 }}>Pedido de la tienda: Daniela · {pesos(112000)}</div>
          <div style={{ fontSize: 13.5, color: C.suave }}>Llama al cliente y confírmalo · Aguacatal</div>
        </div>
      </div>
    </div>
  );
};

/** Tarjeta de un pedido de la tienda por confirmar */
export const TarjetaPedidoWeb: React.FC<{ confirmado: boolean; toqueWa?: number; toqueConfirmar?: number; desdeRiesgo?: number }> = ({
  confirmado, toqueWa, toqueConfirmar, desdeRiesgo = 0,
}) => {
  const f = useCurrentFrame();
  const riesgo = sp(f, desdeRiesgo);
  const fila = (a: string, b: string) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}><span>{a}</span><span style={{ fontFamily: MONO }}>{b}</span></div>
  );
  return (
    <div style={{ ...caja, marginTop: 14, borderRadius: 18, background: '#fff', border: `1px solid ${C.borde}`, padding: 15, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><div style={{ fontSize: 16, fontWeight: 700 }}>Daniela Hoyos</div><div style={{ fontSize: 11.5, color: C.tenue }}>Hace 1 min · catálogo de Valentina</div></div>
        <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 700, background: confirmado ? C.verdeWash : C.oroWash,
          color: confirmado ? C.verdeTexto : C.oroTexto }}>{confirmado ? 'Confirmado' : 'Por confirmar'}</span>
      </div>
      <div style={{ padding: '8px 10px', borderRadius: 10, background: C.oroWash, color: C.oroTexto, fontSize: 12, lineHeight: 1.4, opacity: riesgo,
        transform: `translateY(${(1 - riesgo) * 8}px)` }}>
        <b>⚠️ Este cliente ha tenido problemas</b><br />1 cancelado después de salir · 1 de 2 entregados
      </div>
      <div style={{ fontSize: 12.5 }}><span style={{ color: C.azul, textDecoration: 'underline' }}>3001112233</span> · Cra 43A # 38 sur-20 · <b>Aguacatal</b></div>
      <div style={{ borderTop: `1px dashed ${C.borde}`, paddingTop: 6 }}>
        {fila('1 × ARMARIO EN TELA X3', pesos(65000))}
        {fila('1 × CINTURÓN CÓLICOS', pesos(35000))}
        {fila('Domicilio', pesos(12000))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 750, fontSize: 14.5, borderTop: `1px dashed ${C.borde}`, paddingTop: 6 }}>
        <span>Total</span><span style={{ fontFamily: MONO }}>{pesos(112000)}</span></div>
      {confirmado ? (
        <div style={{ fontSize: 12, color: C.tenue }}>Confirmado por Valentina · <span style={{ color: C.azul }}>Pedido #4812</span></div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {['WhatsApp', 'Llamar', 'Cancelar'].map((t, i) => (
            <div key={t} style={{ padding: '8px 11px', borderRadius: 9, border: `1px solid ${C.bordeFuerte}`, fontSize: 12.5, fontWeight: 600,
              transform: `scale(${i === 0 && toqueWa ? presion(f, toqueWa) : 1})` }}>{t}</div>
          ))}
          <div style={{ padding: '8px 12px', borderRadius: 9, background: C.azul, color: '#fff', fontSize: 12.5, fontWeight: 700,
            transform: `scale(${toqueConfirmar ? presion(f, toqueConfirmar) : 1})` }}>Confirmar</div>
        </div>
      )}
    </div>
  );
};

/** Conversación de WhatsApp con el mensaje que la app deja escrito */
export const ChatWhatsApp: React.FC<{ desde: number; hasta: number; respuesta: number }> = ({ desde, hasta, respuesta }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde) * r(f, hasta - 8, hasta, 1, 0);
  const m1 = sp(f, desde + 10);
  const m2 = sp(f, respuesta, 14);
  return (
    <div style={{ ...caja, position: 'absolute', inset: '-54px 0 0 0', background: '#EFE7DD', zIndex: 45, opacity: p, transform: `translateX(${(1 - p) * 60}px)` }}>
      <div style={{ height: 112, background: '#075E54', color: '#fff', display: 'flex', alignItems: 'flex-end', padding: '0 16px 14px', gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#cfd8dc', display: 'grid', placeItems: 'center', color: '#455a64', fontWeight: 700 }}>D</div>
        <div><div style={{ fontWeight: 650, fontSize: 16 }}>Daniela Hoyos</div><div style={{ fontSize: 12, opacity: 0.8 }}>en línea</div></div>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ alignSelf: 'flex-end', maxWidth: '82%', background: '#DCF8C6', borderRadius: '12px 12px 2px 12px', padding: '9px 11px', fontSize: 13.5, lineHeight: 1.4,
          opacity: m1, transform: `translateY(${(1 - m1) * 14}px)` }}>
          Hola Daniela, recibimos tu pedido del catálogo: 1 ARMARIO EN TELA X3, 1 CINTURÓN CÓLICOS. Total {pesos(112000)} con domicilio, para entregar en Cra 43A # 38 sur-20 (Aguacatal). ¿Te lo confirmo?
        </div>
        <div style={{ alignSelf: 'flex-start', background: '#fff', borderRadius: '12px 12px 12px 2px', padding: '9px 11px', fontSize: 13.5, opacity: m2, transform: `scale(${0.9 + m2 * 0.1})`,
          transformOrigin: 'left bottom' }}>¡Sí, confirmado! Gracias 🙌</div>
      </div>
    </div>
  );
};

export const Toast: React.FC<{ desde: number; texto: string }> = ({ desde, texto }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde, 18);
  return (
    <div style={{ ...caja, position: 'absolute', left: 14, right: 14, top: 8, zIndex: 48, padding: '12px 14px', borderRadius: 14, background: C.verde, color: '#fff',
      fontSize: 13.5, fontWeight: 650, transform: `translateY(${(1 - p) * -90}px)`, opacity: p, boxShadow: '0 16px 30px -14px rgba(22,163,74,.7)' }}>✓ {texto}</div>
  );
};
