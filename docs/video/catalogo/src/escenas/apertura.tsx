import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { r, rebote, sp } from '../animacion';
import { Fondo, Logo, Revelar, Rotulo, Telefono } from '../componentes/base';
import { PantallaTienda } from '../componentes/app';
import { C, FUENTE } from '../tema';

const MENSAJES = [
  'Hola 👋 quiero el armario en tela negro',
  '¿Cuánto vale?',
  'Y también la carpa para moto',
  'Es para Aguacatal',
  '¿Cuánto me sale el domicilio?',
  'Cra 43A # 38 sur-20',
  'Me llamo Daniela Hoyos',
  'Mi cel es 300 111 2233',
  '¿Ya lo subiste? 🙏',
];

/** 0–5 s · El problema: un chat que no para de llenarse */
export const Problema: React.FC = () => {
  const f = useCurrentFrame();
  const visibles = MENSAJES.filter((_, i) => f >= 6 + i * 13).length;
  const subir = Math.max(0, visibles - 6) * 74;
  const subida = r(f, 0, 150, 0, 1);
  return (
    <Fondo halo={{ x: 1300, y: 540, color: 'rgba(37,211,102,.10)' }}>
      <AbsoluteFill style={{ padding: '0 160px', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Rotulo titulo={['¿Todavía escribes', 'cada pedido', 'a mano?']} desde={10} ancho={820} />
        <div style={{ width: 560, height: 760, borderRadius: 34, background: '#EFE7DD', overflow: 'hidden', position: 'relative', fontFamily: FUENTE,
          boxShadow: '0 70px 120px -50px rgba(15,23,42,.4)', transform: `translateY(${(1 - sp(f, 0)) * 60}px) scale(${1 + subida * 0.03})` }}>
          <div style={{ height: 96, background: '#075E54', color: '#fff', display: 'flex', alignItems: 'center', gap: 14, padding: '0 22px', position: 'relative', zIndex: 2 }}>
            <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#cfd8dc', display: 'grid', placeItems: 'center', color: '#455a64', fontWeight: 700, fontSize: 22 }}>D</div>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 650, fontSize: 21 }}>Daniela</div><div style={{ fontSize: 15, opacity: 0.8 }}>escribiendo…</div></div>
            <div style={{ minWidth: 34, height: 34, borderRadius: 17, background: C.whatsapp, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17,
              transform: `scale(${1 + 0.15 * Math.max(0, 1 - ((f - 6) % 13) / 6)})` }}>{visibles}</div>
          </div>
          <div style={{ position: 'absolute', top: 96, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, transform: `translateY(${-subir}px)` }}>
            {MENSAJES.map((m, i) => {
              const p = rebote(f, 6 + i * 13);
              if (f < 6 + i * 13) return null;
              return (
                <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '82%', background: '#fff', borderRadius: '16px 16px 16px 4px', padding: '13px 16px', fontSize: 21,
                  lineHeight: 1.35, color: C.texto, boxShadow: '0 1px 1px rgba(0,0,0,.08)', transform: `scale(${0.8 + p * 0.2}) translateY(${(1 - p) * 20}px)`, opacity: Math.min(1, p * 2),
                  transformOrigin: 'left bottom' }}>{m}</div>
              );
            })}
          </div>
          </div>
        </div>
      </AbsoluteFill>
    </Fondo>
  );
};

// Cada palabra entra cuando la voz la dice (ver VOZ en guion.ts)
const PALABRAS = [{ w: 'Copiar.', en: 3 }, { w: 'Calcular.', en: 40 }, { w: 'Volver a escribir.', en: 84 }];

/** 5–10 s · El desgaste: las tareas que se repiten con cada pedido */
export const Desgaste: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Fondo>
      {/* Un formulario borroso detrás, que se llena y se borra */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', filter: 'blur(5px)', opacity: 0.35 }}>
        <div style={{ width: 900, display: 'flex', flexDirection: 'column', gap: 26, fontFamily: FUENTE }}>
          {['Nombre del cliente', 'Teléfono', 'Dirección', 'Barrio', 'Productos'].map((l, i) => (
            <div key={l}>
              <div style={{ fontSize: 22, color: C.tenue, marginBottom: 8 }}>{l}</div>
              <div style={{ height: 64, borderRadius: 14, background: '#fff', border: `1px solid ${C.borde}`, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(((f * 1.6 + i * 37) % 120) / 120) * 100}%`, background: C.azulSoft }} />
              </div>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FUENTE, color: C.texto }}>
        {PALABRAS.map(({ w, en: a }, i) => {
          const b = PALABRAS[i + 1]?.en ?? 999;
          if (f < a - 2 || f > b + 10) return null;
          const entra = sp(f, a);
          const sale = r(f, b, b + 8, 0, 1);
          return (
            <div key={w} style={{ position: 'absolute', fontSize: 168, fontWeight: 780, letterSpacing: '-0.045em', overflow: 'hidden', padding: '0 0 0.1em' }}>
              <div style={{ transform: `translateY(${(1 - entra) * 100 - sale * 100}%)`, opacity: 1 - sale }}>{w}</div>
            </div>
          );
        })}
        <div style={{ position: 'absolute', top: 640, fontSize: 52, fontWeight: 360, color: C.tenue }}>
          <Revelar desde={133}>…otra vez.</Revelar>
        </div>
      </AbsoluteFill>
    </Fondo>
  );
};

/** 10–16 s · La solución: el logo y el catálogo en el celular */
export const Solucion: React.FC = () => {
  const f = useCurrentFrame();
  const logo = rebote(f, 2);
  const tel = sp(f, 60, 200, 1.2);
  const zoom = r(f, 150, 194, 1, 1.12);
  return (
    <Fondo halo={{ x: 960, y: 760, color: 'rgba(212,160,23,.16)' }}>
      <AbsoluteFill style={{ alignItems: 'center', fontFamily: FUENTE, color: C.texto, transform: `scale(${zoom})`, transformOrigin: '50% 80%' }}>
        <div style={{ marginTop: 70, display: 'flex', alignItems: 'center', gap: 28, transform: `scale(${0.7 + logo * 0.3})`, opacity: Math.min(1, logo * 1.4) }}>
          <Logo tam={92} />
          <div style={{ fontSize: 84, fontWeight: 780, letterSpacing: '-0.04em' }}>
            <Revelar desde={30}>Tu catálogo.</Revelar>{' '}
            <Revelar desde={72} style={{ color: C.azul }}>Tu enlace.</Revelar>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 250, transform: `translateY(${(1 - tel) * 700}px)` }}>
          <Telefono ancho={430}>
            <PantallaTienda scroll={r(f, 60, 180, 0, 300)} agregados={[]} />
          </Telefono>
        </div>
      </AbsoluteFill>
    </Fondo>
  );
};
