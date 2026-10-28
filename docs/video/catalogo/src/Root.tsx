import React from 'react';
import { Composition } from 'remotion';
import { Video } from './Video';
import { TOTAL } from './guion';
import './tema';

export const Root: React.FC = () => (
  <Composition id="Catalogo" component={Video} durationInFrames={TOTAL} fps={30} width={1920} height={1080} defaultProps={{ conVoz: true }} />
);
