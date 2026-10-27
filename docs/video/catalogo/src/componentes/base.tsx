import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { r, rebote, sp } from '../animacion';
import { C, FUENTE, MONO } from '../tema';

/** Texto que entra por una máscara: sube desde abajo y aparece */
export const Revelar: React.FC<{ desde?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ desde = 0, children, style }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde);
  return (
    <span style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: '0.12em', marginBottom: '-0.12em', ...style }}>
      <span style={{ display: 'inline-block', transform: `translateY(${(1 - p) * 110}%)`, opacity: Math.min(1, p * 1.5) }}>{children}</span>
    </span>
  );
};

/** Aparece con desvanecido y un desplazamiento corto */
export const Aparecer: React.FC<{ desde?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ desde = 0, y = 24, children, style }) => {
  const f = useCurrentFrame();
  const p = sp(f, desde);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * y}px)`, ...style }}>{children}</div>;
};

/** Bloque de texto del lado izquierdo de las escenas de funciones */
export const Rotulo: React.FC<{ numero?: string; titulo: string[]; sub?: string; desde?: number; ancho?: number; style?: React.CSSProperties }> = ({
  numero, titulo, sub, desde = 0, ancho = 680, style,
}) => (
  <div style={{ width: ancho, fontFamily: FUENTE, color: C.texto, ...style }}>
    {numero && (
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '0.14em', color: C.oroTexto, marginBottom: 22, textTransform: 'uppercase' }}>
        <Revelar desde={desde}>{numero}</Revelar>
      </div>
    )}
    <div style={{ fontSize: 88, fontWeight: 760, lineHeight: 1.02, letterSpacing: '-0.035em' }}>
      {titulo.map((l, i) => (
        <div key={i}>
          <Revelar desde={desde + 4 + i * 5}>{l}</Revelar>
        </div>
      ))}
    </div>
    {sub && (
      <Aparecer desde={desde + 14 + titulo.length * 5} style={{ marginTop: 30, fontSize: 34, fontWeight: 360, lineHeight: 1.35, color: C.suave }}>
        {sub}
      </Aparecer>
    )}
  </div>
);

/** Subtítulo que cambia según el momento de la escena (con cruce suave) */
export const Frases: React.FC<{ frases: { desde: number; texto: string }[]; style?: React.CSSProperties }> = ({ frases, style }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: 'relative', height: 100, fontFamily: FUENTE, ...style }}>
      {frases.map((fr, i) => {
        const fin = frases[i + 1]?.desde ?? 99999;
        const entra = sp(f, fr.desde);
        const sale = r(f, fin - 6, fin + 6, 1, 0);
        if (f < fr.desde - 2 || f > fin + 8) return null;
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, opacity: entra * sale, transform: `translateY(${(1 - entra) * 18 - (1 - sale) * 14}px)`,
            fontSize: 34, fontWeight: 360, lineHeight: 1.35, color: C.suave }}>
            {fr.texto}
          </div>
        );
      })}
    </div>
  );
};

/** iPhone con marco, isla, barra de estado, sombra suave y un reflejo sutil */
export const Telefono: React.FC<{ children: React.ReactNode; oscuro?: boolean; style?: React.CSSProperties; ancho?: number }> = ({
  children, oscuro, style, ancho = 430,
}) => {
  const alto = Math.round(ancho * 2.06);
  return (
    <div style={{ position: 'relative', width: ancho, height: alto, ...style }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: ancho * 0.165, background: '#0B0B10',
        boxShadow: '0 80px 140px -50px rgba(15,23,42,.45), 0 40px 70px -40px rgba(15,23,42,.35), inset 0 0 0 2px #2A2A33' }} />
      <div style={{ position: 'absolute', inset: ancho * 0.032, borderRadius: ancho * 0.135, overflow: 'hidden', background: oscuro ? '#0B1120' : C.fondo }}>
        <BarraEstado oscuro={oscuro} />
        <div style={{ position: 'absolute', top: 54, left: 0, right: 0, bottom: 0 }}>{children}</div>
        {/* Isla */}
        <div style={{ position: 'absolute', top: 12, left: '50%', width: 118, height: 34, marginLeft: -59, borderRadius: 20, background: '#000', zIndex: 50 }} />
        {/* Reflejo */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 60,
          background: 'linear-gradient(118deg, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 34%, rgba(255,255,255,0) 70%, rgba(255,255,255,.05) 100%)' }} />
      </div>
    </div>
  );
};

const BarraEstado: React.FC<{ oscuro?: boolean }> = ({ oscuro }) => {
  const col = oscuro ? '#fff' : C.texto;
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 54, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 34px 0 40px', fontFamily: FUENTE, fontSize: 17, fontWeight: 650, color: col }}>
      <span>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {[6, 9, 12, 15].map((h) => <span key={h} style={{ width: 3.5, height: h, borderRadius: 1, background: col }} />)}
        </span>
        <span style={{ width: 26, height: 12, borderRadius: 4, border: `1.5px solid ${col}`, padding: 1.5, display: 'flex' }}>
          <span style={{ flex: 1, borderRadius: 2, background: col }} />
        </span>
      </span>
    </div>
  );
};

/** Toque de un dedo: círculo que se presiona y se desvanece */
export const Toque: React.FC<{ x: number; y: number; en: number }> = ({ x, y, en }) => {
  const f = useCurrentFrame();
  if (f < en - 8 || f > en + 22) return null;
  const llega = r(f, en - 8, en, 0, 1);
  const onda = r(f, en, en + 20, 0, 1);
  return (
    <div style={{ position: 'absolute', left: x, top: y, zIndex: 70, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', width: 54, height: 54, left: -27, top: -27, borderRadius: '50%', background: 'rgba(15,23,42,.22)',
        transform: `scale(${0.6 + llega * 0.4 - onda * 0.2})`, opacity: llega * (1 - onda) }} />
      <div style={{ position: 'absolute', width: 54, height: 54, left: -27, top: -27, borderRadius: '50%', border: '2px solid rgba(37,99,235,.55)',
        transform: `scale(${1 + onda * 1.4})`, opacity: f >= en ? 1 - onda : 0 }} />
    </div>
  );
};

/** Un botón que se "hunde" un instante al tocarlo */
export function presion(f: number, en: number): number {
  return 1 - 0.06 * Math.max(0, 1 - Math.abs(f - en) / 5);
}

export const Logo: React.FC<{ tam: number; style?: React.CSSProperties }> = ({ tam, style }) => (
  <Img src={staticFile('logo.png')} style={{ width: tam, height: tam, borderRadius: tam * 0.24, background: '#fff', objectFit: 'contain',
    boxShadow: '0 20px 50px -20px rgba(15,23,42,.35)', ...style }} />
);

/** Fondo claro con un halo muy suave detrás del protagonista */
export const Fondo: React.FC<{ halo?: { x: number; y: number; color?: string }; children?: React.ReactNode }> = ({ halo, children }) => (
  <AbsoluteFill style={{ background: C.fondo }}>
    {halo && (
      <div style={{ position: 'absolute', left: halo.x - 600, top: halo.y - 600, width: 1200, height: 1200, borderRadius: '50%',
        background: `radial-gradient(circle, ${halo.color ?? 'rgba(37,99,235,.10)'} 0%, rgba(243,244,246,0) 62%)` }} />
    )}
    {children}
  </AbsoluteFill>
);

/** Número que cuenta hasta su valor */
export const Contador: React.FC<{ hasta: number; desde: number; dura?: number; style?: React.CSSProperties }> = ({ hasta, desde, dura = 40, style }) => {
  const f = useCurrentFrame();
  const v = Math.round(r(f, desde, desde + dura, 0, hasta));
  return <span style={{ fontFamily: MONO, fontVariantNumeric: 'tabular-nums', ...style }}>{v}</span>;
};

export { rebote };
