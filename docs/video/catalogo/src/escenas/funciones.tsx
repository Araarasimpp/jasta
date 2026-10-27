import React from 'react';
import { Img, staticFile, useCurrentFrame } from 'remotion';
import { escribir, r, rebote, sp } from '../animacion';
import { Fondo, Frases, Revelar, Rotulo, Telefono, Toque } from '../componentes/base';
import {
  BarraPedido, ChatWhatsApp, ENLACE, HojaCarrito, HojaCompartir, PantallaBloqueo, PantallaListo, PantallaPedidosTienda, PantallaTienda, TarjetaPedidoWeb, Toast,
} from '../componentes/app';
import { C, FUENTE } from '../tema';

const IZQ = 160;
// Medidas de la cuadrícula del catálogo (ver PantallaTienda): inicio, alto de fila y centro del botón
const FILA0 = 108;
const FILA = 294;
const BOTON = 257;
const TEL_X = 1180;
const TEL_Y = 97;

// ---------------------------------------------------------------- 01 · Compartir
const VistaEnlace: React.FC<{ fondo: string; titulo: string; claro?: boolean; children?: React.ReactNode }> = ({ fondo, titulo, claro, children }) => (
  <div style={{ width: 300, height: 520, borderRadius: 30, background: fondo, padding: 20, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    justifyContent: 'space-between', fontFamily: FUENTE, boxShadow: '0 50px 90px -40px rgba(15,23,42,.45)' }}>
    <div style={{ fontSize: 19, fontWeight: 700, color: claro ? C.texto : '#fff' }}>{titulo}</div>
    {children}
    <div style={{ borderRadius: 18, background: '#fff', overflow: 'hidden' }}>
      <div style={{ height: 120, background: '#fff', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4, padding: 6 }}>
        {[3, 1, 5].map((i) => <Img key={i} src={staticFile(`productos/p${i}.jpg`)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />)}
      </div>
      <div style={{ padding: '10px 12px 12px', borderTop: `1px solid ${C.borde}` }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.texto }}>Catálogo de Valentina</div>
        <div style={{ fontSize: 12, color: C.tenue, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ENLACE}</div>
      </div>
    </div>
  </div>
);

export const Compartir: React.FC = () => {
  const f = useCurrentFrame();
  const entra = sp(f, 0, 200, 1.1);
  const fase = sp(f, 215, 200, 1.2); // el teléfono se corre y aparecen los destinos
  const telX = TEL_X - fase * 880;
  const textoSale = r(f, 205, 225, 1, 0);
  const destinos = [
    { fondo: 'linear-gradient(160deg,#128C7E,#075E54)', titulo: 'Tu estado de WhatsApp', en: 240 },
    { fondo: 'linear-gradient(160deg,#F9CE34,#EE2A7B 55%,#6228D7)', titulo: 'Tu historia de Instagram', en: 262 },
    { fondo: '#EFE7DD', titulo: 'Grupo · Clientas Cali 💛', en: 284, claro: true },
  ];
  return (
    <Fondo halo={{ x: telX + 215, y: 540 }}>
      <div style={{ position: 'absolute', left: IZQ, top: 250, opacity: textoSale }}>
        <Rotulo numero="01 · Compartes" titulo={['Comparte', 'tu enlace']} desde={8} />
        <Frases style={{ marginTop: 30, width: 640 }} frases={[
          { desde: 30, texto: 'Entra a Pedidos de la tienda y toca Compartir.' },
          { desde: 120, texto: 'Mándalo a tus estados, a Instagram o a tus grupos.' },
        ]} />
      </div>
      <div style={{ position: 'absolute', left: telX, top: TEL_Y, transform: `translateY(${(1 - entra) * 120}px) scale(${1 - fase * 0.08})`, opacity: entra }}>
        <Telefono>
          <PantallaPedidosTienda toqueCompartir={100} />
          <Toque x={100} y={196} en={100} />
          {f >= 104 && <HojaCompartir desde={106} toqueWa={170} />}
          <Toque x={57} y={604} en={170} />
        </Telefono>
      </div>
      {/* Destinos: el mismo enlace en estados, historias y grupos */}
      <div style={{ position: 'absolute', left: 760, top: 110, fontFamily: FUENTE, color: C.texto, opacity: fase }}>
        <div style={{ fontSize: 76, fontWeight: 770, letterSpacing: '-0.035em', lineHeight: 1.04 }}>
          <Revelar desde={236}>Es tu enlace,</Revelar><br /><Revelar desde={248} style={{ color: C.azul }}>con tu nombre.</Revelar>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 760, top: 390, display: 'flex', gap: 34 }}>
        {destinos.map((d, i) => {
          const p = rebote(f, d.en);
          if (f < d.en) return null;
          return (
            <div key={i} style={{ transform: `translate(${(1 - p) * -260}px, ${(1 - p) * 60}px) rotate(${(1 - p) * -8 + (i - 1) * 1.5}deg) scale(${0.7 + p * 0.3})`,
              opacity: Math.min(1, p * 1.6) }}>
              <VistaEnlace fondo={d.fondo} titulo={d.titulo} claro={d.claro}>
                {d.claro && (
                  <div style={{ alignSelf: 'flex-end', background: '#DCF8C6', borderRadius: 12, padding: '8px 10px', fontSize: 14, color: C.texto }}>
                    Miren el catálogo y pidan aquí 👇</div>
                )}
              </VistaEnlace>
            </div>
          );
        })}
      </div>
    </Fondo>
  );
};

// ---------------------------------------------------------------- 02 · El cliente pide
export const Cliente: React.FC = () => {
  const f = useCurrentFrame();
  const entra = sp(f, 0, 200, 1.1);
  const scroll = f < 100 ? r(f, 28, 62, 0, 250) : r(f, 100, 140, 250, 900);
  const agregados = [...(f >= 78 ? [2] : []), ...(f >= 178 ? [7] : [])];
  const activo = f < 266 ? 0 : f < 292 ? 1 : f < 334 ? 2 : f < 362 ? 3 : -1;
  const anillo = r(f, 140, 150, 0, 1) * r(f, 205, 215, 1, 0);
  return (
    <Fondo halo={{ x: TEL_X + 215, y: 540 }}>
      <div style={{ position: 'absolute', left: IZQ, top: 250 }}>
        <Rotulo numero="02 · Tu cliente" titulo={['Tu cliente', 'pide solo']} desde={8} />
        <Frases style={{ marginTop: 30, width: 660 }} frases={[
          { desde: 26, texto: 'Abre tu catálogo, ve las fotos y los precios, y elige.' },
          { desde: 140, texto: 'Lo agotado ya aparece marcado.' },
          { desde: 236, texto: 'Escribe su dirección y el domicilio se calcula solo.' },
          { desde: 420, texto: 'Y hace el pedido, sin escribirte.' },
        ]} />
      </div>
      <div style={{ position: 'absolute', left: TEL_X, top: TEL_Y, transform: `translateY(${(1 - entra) * 120}px)`, opacity: entra }}>
        <Telefono>
          <PantallaTienda scroll={scroll} agregados={agregados} toques={[{ i: 2, en: 75 }, { i: 7, en: 175 }]} />
          {/* Resalta la etiqueta de agotado */}
          <div style={{ position: 'absolute', left: 20, top: FILA0 + 3 * FILA + 7 - scroll, width: 76, height: 28, borderRadius: 9, border: `3px solid ${C.rojo}`,
            opacity: anillo, transform: `scale(${1 + 0.1 * Math.sin(f / 4)})`, zIndex: 25 }} />
          <Toque x={105} y={FILA0 + FILA + BOTON - 250} en={75} />
          <Toque x={296} y={FILA0 + 3 * FILA + BOTON - 900} en={175} />
          {f >= 80 && <BarraPedido desde={80} unidades={f >= 178 ? 2 : 1} total={f >= 178 ? 100000 : 65000} toque={215} />}
          <Toque x={200} y={756} en={215} />
          {f >= 220 && (
            <HojaCarrito desde={222} activo={activo} toqueEnviar={410}
              nombre={escribir('Daniela Hoyos', f, 246, 1.3)}
              tel={escribir('300 111 2233', f, 270, 1.6)}
              dir={escribir('Cra 43A # 38 sur-20', f, 296, 1.4)}
              barrio={escribir('Aguacatal', f, 338, 2)}
              domicilio={f >= 362 ? 12000 : null} />
          )}
          <Toque x={300} y={760} en={410} />
          {f >= 416 && <PantallaListo desde={418} />}
        </Telefono>
      </div>
    </Fondo>
  );
};

// ---------------------------------------------------------------- 03 · La vendedora confirma
export const Confirmar: React.FC = () => {
  const f = useCurrentFrame();
  const entra = sp(f, 0, 200, 1.1);
  const app = r(f, 118, 140, 0, 1);
  return (
    <Fondo halo={{ x: TEL_X + 215, y: 540, color: 'rgba(22,163,74,.10)' }}>
      <div style={{ position: 'absolute', left: IZQ, top: 250 }}>
        <Rotulo numero="03 · Tú" titulo={['Tú solo', 'confirmas']} desde={8} />
        <Frases style={{ marginTop: 30, width: 660 }} frases={[
          { desde: 26, texto: 'Te llega el aviso al instante, aunque tengas la app cerrada.' },
          { desde: 140, texto: 'Ves todo el pedido y, si el cliente ha tenido problemas, la app te lo dice.' },
          { desde: 236, texto: 'Le escribes por WhatsApp con el mensaje ya listo.' },
          { desde: 370, texto: 'Confirmas, y pasa directo a alistamiento.' },
        ]} />
      </div>
      <div style={{ position: 'absolute', left: TEL_X, top: TEL_Y, transform: `translateY(${(1 - entra) * 120}px)`, opacity: entra }}>
        <Telefono oscuro={f < 128}>
          {f >= 110 && (
            <div style={{ position: 'absolute', inset: 0, opacity: app, transform: `scale(${0.94 + app * 0.06})` }}>
              <PantallaPedidosTienda scroll={r(f, 140, 175, 0, 230)}>
                <TarjetaPedidoWeb confirmado={f >= 392} toqueWa={240} toqueConfirmar={385} desdeRiesgo={160} />
              </PantallaPedidosTienda>
            </div>
          )}
          {f < 140 && (
            <div style={{ position: 'absolute', inset: 0, opacity: 1 - app, transform: `scale(${1 + app * 0.08})` }}>
              <PantallaBloqueo aviso={30} toque={108} />
            </div>
          )}
          <Toque x={200} y={254} en={108} />
          <Toque x={66} y={346} en={240} />
          {f >= 244 && f < 350 && <ChatWhatsApp desde={246} hasta={348} respuesta={300} />}
          <Toque x={312} y={346} en={385} />
          {f >= 392 && <Toast desde={394} texto="Listo: quedó como pedido #4812 por alistar" />}
        </Telefono>
      </div>
    </Fondo>
  );
};
