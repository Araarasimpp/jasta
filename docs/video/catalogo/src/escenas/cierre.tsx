import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { r, rebote, sp } from '../animacion';
import { Fondo, Logo, Revelar } from '../componentes/base';
import { C, FUENTE, MONO, pesos } from '../tema';

const Tarjeta: React.FC<{ en: number; titulo: string; texto: string; children: React.ReactNode }> = ({ en, titulo, texto, children }) => {
  const f = useCurrentFrame();
  const p = rebote(f, en);
  return (
    <div style={{ width: 500, height: 420, borderRadius: 34, background: '#fff', border: `1px solid ${C.borde}`, padding: 40, boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column', fontFamily: FUENTE, color: C.texto, boxShadow: '0 50px 90px -50px rgba(15,23,42,.35)',
      transform: `translateY(${(1 - p) * 80}px) scale(${0.92 + p * 0.08})`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ height: 130, display: 'flex', alignItems: 'center' }}>{children}</div>
      <div style={{ fontSize: 37, fontWeight: 750, letterSpacing: '-0.025em', marginTop: 18, whiteSpace: 'nowrap' }}>{titulo}</div>
      <div style={{ fontSize: 25, fontWeight: 360, lineHeight: 1.4, color: C.suave, marginTop: 12 }}>{texto}</div>
    </div>
  );
};

/** 66–74 s · Lo que da confianza: precios fijos, agotados y comisión */
export const Confianza: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Fondo halo={{ x: 960, y: 620 }}>
      <AbsoluteFill style={{ alignItems: 'center', fontFamily: FUENTE, color: C.texto }}>
        <div style={{ marginTop: 120, fontSize: 80, fontWeight: 780, letterSpacing: '-0.04em' }}>
          <Revelar desde={4}>Sin sorpresas.</Revelar>
        </div>
        <div style={{ marginTop: 70, display: 'flex', gap: 40 }}>
          <Tarjeta en={10} titulo="Precios fijos" texto="Siempre el precio sugerido del producto. Nadie lo puede cambiar.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px', borderRadius: 18, background: C.azulWash, color: C.azul }}>
              <span style={{ fontSize: 34 }}>🔒</span><span style={{ fontFamily: MONO, fontSize: 44, fontWeight: 700 }}>{pesos(65000)}</span>
            </div>
          </Tarjeta>
          <Tarjeta en={97} titulo="Agotados marcados" texto="Lo que no hay se ve en el catálogo, pero no se puede pedir.">
            <span style={{ padding: '14px 26px', borderRadius: 14, background: C.rojo, color: '#fff', fontSize: 40, fontWeight: 750,
              transform: `rotate(${-3 + Math.sin(f / 10) * 1.5}deg)` }}>Agotado</span>
          </Tarjeta>
          <Tarjeta en={159} titulo="Tu comisión de siempre" texto="El pedido queda a tu nombre, como si lo hubieras subido tú.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 24px', borderRadius: 18, background: C.verdeWash, color: C.verdeTexto }}>
              <span style={{ fontSize: 30, fontWeight: 700 }}>+</span><span style={{ fontFamily: MONO, fontSize: 44, fontWeight: 700 }}>{pesos(15000)}</span>
            </div>
          </Tarjeta>
        </div>
      </AbsoluteFill>
    </Fondo>
  );
};

const Cifra: React.FC<{ en: number; valor: number; desdeValor?: number; etiqueta: string; color: string }> = ({ en, valor, desdeValor = 0, etiqueta, color }) => {
  const f = useCurrentFrame();
  const p = sp(f, en);
  const v = Math.round(r(f, en, en + 34, desdeValor, valor));
  return (
    <div style={{ width: 480, textAlign: 'center', fontFamily: FUENTE, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: 210, fontWeight: 700, letterSpacing: '-0.05em', lineHeight: 1, color, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ marginTop: 22, fontSize: 34, fontWeight: 400, color: C.suave, lineHeight: 1.3 }}>{etiqueta}</div>
    </div>
  );
};

/** 74–80 s · Impacto con datos reales de la app */
export const Impacto: React.FC = () => (
  <Fondo halo={{ x: 960, y: 520, color: 'rgba(212,160,23,.12)' }}>
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 40 }}>
      <Cifra en={8} valor={397} etiqueta="productos en tu catálogo" color={C.texto} />
      <Cifra en={74} valor={1} etiqueta="enlace para todo" color={C.azul} />
      <Cifra en={113} valor={0} desdeValor={24} etiqueta="pedidos escritos a mano" color={C.verde} />
    </AbsoluteFill>
  </Fondo>
);

const Paso: React.FC<{ en: number; n: number; titulo: string; detalle: string }> = ({ en, n, titulo, detalle }) => {
  const f = useCurrentFrame();
  const p = rebote(f, en);
  return (
    <div style={{ width: 430, borderRadius: 28, background: '#fff', border: `1px solid ${C.borde}`, padding: '30px 32px', fontFamily: FUENTE, color: C.texto,
      boxShadow: '0 40px 80px -50px rgba(15,23,42,.35)', transform: `translateY(${(1 - p) * 50}px)`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ width: 54, height: 54, borderRadius: '50%', background: C.azul, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26, fontWeight: 750 }}>{n}</div>
      <div style={{ marginTop: 20, fontSize: 33, fontWeight: 750, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{titulo}</div>
      <div style={{ marginTop: 8, fontSize: 23, fontWeight: 360, color: C.suave, lineHeight: 1.4 }}>{detalle}</div>
    </div>
  );
};

/** 80–90 s · Cierre: logo, frase y el paso a paso para sacar el enlace */
export const Cierre: React.FC = () => {
  const f = useCurrentFrame();
  const logo = rebote(f, 2);
  const arriba = sp(f, 92, 200, 1.2);
  const pulso = 1 + 0.035 * Math.max(0, Math.sin((f - 205) / 7)) * (f > 205 ? 1 : 0);
  const fin = r(f, 284, 300, 1, 0);
  return (
    <Fondo halo={{ x: 960, y: 420 - arriba * 160 }}>
      <AbsoluteFill style={{ alignItems: 'center', fontFamily: FUENTE, color: C.texto, opacity: fin }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300 - arriba * 220, display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `scale(${1 - arriba * 0.35})` }}>
          <div style={{ transform: `scale(${0.6 + logo * 0.4})`, opacity: Math.min(1, logo * 1.5) }}><Logo tam={150} /></div>
          <div style={{ marginTop: 40, fontSize: 108, fontWeight: 790, letterSpacing: '-0.045em', lineHeight: 1.02, textAlign: 'center' }}>
            <Revelar desde={35}>Vende mientras</Revelar><br />
            <Revelar desde={50} style={{ color: C.azul }}>tu cliente elige.</Revelar>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, textAlign: 'center', top: 470, fontSize: 30, fontWeight: 600, color: C.oroTexto, letterSpacing: '.12em', textTransform: 'uppercase', opacity: arriba }}>
          <Revelar desde={100}>Así sacas tu enlace</Revelar>
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 540, display: 'flex', justifyContent: 'center', alignItems: 'stretch', gap: 22 }}>
          <Paso en={120} n={1} titulo="Abre Más" detalle="Abajo a la derecha, en la app de Jasta." />
          <Flecha en={140} />
          <Paso en={148} n={2} titulo="Pedidos de la tienda" detalle="Ahí está tu enlace, con tu nombre." />
          <Flecha en={170} />
          <Paso en={178} n={3} titulo="Compartir enlace" detalle="A tus estados, Instagram y grupos." />
        </div>
        <div style={{ position: 'absolute', top: 920, left: '50%', marginLeft: -170, width: 340, textAlign: 'center', boxSizing: 'border-box', padding: '20px 0', borderRadius: 999, background: C.azul, color: '#fff', fontSize: 34, fontWeight: 700,
          opacity: sp(f, 192), transform: `scale(${(0.9 + sp(f, 192) * 0.1) * pulso})`, boxShadow: '0 24px 50px -20px rgba(37,99,235,.7)' }}>
          Compártelo hoy
        </div>
      </AbsoluteFill>
    </Fondo>
  );
};

const Flecha: React.FC<{ en: number }> = ({ en }) => {
  const f = useCurrentFrame();
  const p = sp(f, en);
  return <div style={{ alignSelf: 'center', fontFamily: FUENTE, fontSize: 44, color: C.bordeFuerte, opacity: p, transform: `translateX(${(1 - p) * -16}px)` }}>→</div>;
};
