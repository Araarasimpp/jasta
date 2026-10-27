import { Config } from '@remotion/cli/config';

// Chromium que ya trae el entorno (no se descarga otro)
Config.setBrowserExecutable(process.env.REMOTION_CHROME ?? null);
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
