import React from 'react';
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { CRUCE, ESCENAS, TOTAL } from './guion';
import { Desgaste, Problema, Solucion } from './escenas/apertura';
import { Cliente, Compartir, Confirmar } from './escenas/funciones';
import { Cierre, Confianza, Impacto } from './escenas/cierre';
import { salida } from './animacion';
import { C } from './tema';

const COMPONENTES: Record<string, React.FC> = {
  problema: Problema, desgaste: Desgaste, solucion: Solucion, compartir: Compartir, cliente: Cliente,
  confirmar: Confirmar, confianza: Confianza, impacto: Impacto, cierre: Cierre,
};

/** Cada escena entra con un zoom suave y sale desvaneciéndose mientras entra la siguiente */
const Transicion: React.FC<{ dura: number; primera: boolean; ultima: boolean; children: React.ReactNode }> = ({ dura, primera, ultima, children }) => {
  const f = useCurrentFrame();
  const entra = primera ? 1 : interpolate(f, [0, CRUCE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: salida });
  const sale = ultima ? 0 : interpolate(f, [dura, dura + CRUCE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: salida });
  return (
    <AbsoluteFill style={{ opacity: entra * (1 - sale), transform: `scale(${(1.035 - entra * 0.035) * (1 - sale * 0.025)})`, filter: sale > 0 ? `blur(${sale * 6}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  );
};

export const Video: React.FC<{ conVoz: boolean }> = ({ conVoz }) => {
  const f = useCurrentFrame();
  // La música baja un poco mientras habla la voz y se apaga al final
  const volumen = (conVoz ? 0.22 : 0.4) * interpolate(f, [0, 20, TOTAL - 60, TOTAL], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: C.fondo }}>
      {ESCENAS.map((e, i) => {
        const Comp = COMPONENTES[e.id];
        const ultima = i === ESCENAS.length - 1;
        return (
          <Sequence key={e.id} from={e.desde} durationInFrames={e.dura + (ultima ? 0 : CRUCE)} name={e.id}>
            <Transicion dura={e.dura} primera={i === 0} ultima={ultima}><Comp /></Transicion>
          </Sequence>
        );
      })}
      <Audio src={staticFile('musica.mp3')} volume={volumen} />
      {conVoz && <Audio src={staticFile('voz.mp3')} />}
    </AbsoluteFill>
  );
};
