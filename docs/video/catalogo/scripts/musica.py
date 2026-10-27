"""Base musical del video (90 s, 96 BPM): pad suave, bajo, arpegio y pulso.

Se genera aquí para no depender de pistas con derechos. Uso:
    python3 scripts/musica.py public/musica.wav
    ffmpeg -y -i public/musica.wav -b:a 160k public/musica.mp3
"""
import sys

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
DUR = 90.0
BPM = 96
BEAT = 60 / BPM
BAR = BEAT * 4
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)


def hz(nota):
    return 440.0 * 2 ** ((nota - 69) / 12)


# Cmaj7 - Am7 - Fmaj7 - G6, dos compases cada uno
ACORDES = [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 55, 59]]


def acorde_en(seg):
    return ACORDES[int(seg // (BAR * 2)) % 4]


def lp(x, fc, orden=2):
    return sosfilt(butter(orden, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, orden=2):
    return sosfilt(butter(orden, fc, 'high', fs=SR, output='sos'), x)


def envolvente(n, a, r):
    e = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def saw(f, tt):
    return 2 * ((tt * f) % 1) - 1


# ---------- Pad: sierras desafinadas, filtradas; se abre a los 10 s
pad = np.zeros(N)
largo = BAR * 2
for k in range(int(DUR // largo) + 1):
    i0 = int(k * largo * SR)
    i1 = min(N, int((k + 1) * largo * SR + 0.6 * SR))
    if i0 >= N:
        break
    tt = t[i0:i1] - t[i0]
    voz = np.zeros(i1 - i0)
    for nota in acorde_en(k * largo):
        for det in (-0.07, 0.0, 0.06):
            voz += saw(hz(nota + 12) * (1 + det / 100), tt)
    pad[i0:i1] += voz * envolvente(i1 - i0, 0.8, 0.9) / 12
corte = np.interp(t, [0, 9, 10.5, 80, 90], [500, 900, 2200, 2200, 900])
pad_osc = lp(pad, 700) * np.clip(1 - (corte - 500) / 1700, 0, 1) + lp(pad, 2400) * np.clip((corte - 500) / 1700, 0, 1)

# ---------- Bajo: seno con la raíz de cada compás (entra con la solución)
bajo = np.zeros(N)
for k in range(int(DUR // BAR)):
    s = k * BAR
    if s < 10:
        continue
    i0, i1 = int(s * SR), min(N, int((s + BAR) * SR))
    tt = t[i0:i1] - t[i0]
    raiz = acorde_en(s)[0] - 12
    bajo[i0:i1] += np.sin(2 * np.pi * hz(raiz) * tt) * np.exp(-tt * 0.9) * 0.55

# ---------- Arpegio: notas cortas tipo pluck en corcheas (desde los 16 s)
arpe = np.zeros(N)
paso = BEAT / 2
for k in range(int(DUR // paso)):
    s = k * paso
    if s < 16 or s > 86:
        continue
    notas = acorde_en(s)
    nota = notas[[1, 2, 3, 2, 1, 3, 2, 3][k % 8]] + 12
    i0, i1 = int(s * SR), min(N, int((s + 0.5) * SR))
    tt = t[i0:i1] - t[i0]
    tri = 2 * np.abs(2 * ((tt * hz(nota)) % 1) - 1) - 1
    arpe[i0:i1] += tri * np.exp(-tt * 9) * 0.16
arpe = lp(arpe, 3500)

# ---------- Pulso: bombo suave en cada tiempo (10 s a 84 s) y shaker desde los 32 s
golpe = np.zeros(N)
for k in range(int(DUR // BEAT)):
    s = k * BEAT
    if s < 10 or s > 84:
        continue
    i0, i1 = int(s * SR), min(N, int((s + 0.35) * SR))
    tt = t[i0:i1] - t[i0]
    f = 48 + 70 * np.exp(-tt * 30)
    golpe[i0:i1] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * 0.5
shaker = np.zeros(N)
for k in range(int(DUR // (BEAT / 2))):
    s = k * BEAT / 2 + BEAT / 4
    if s < 32 or s > 80:
        continue
    i0, i1 = int(s * SR), min(N, int((s + 0.08) * SR))
    shaker[i0:i1] += rng.standard_normal(i1 - i0) * np.exp(-np.arange(i1 - i0) / SR * 60) * 0.05
shaker = hp(shaker, 6000)

# ---------- Subida antes de la solución (8 a 10 s)
subida = hp(rng.standard_normal(N), 2500) * np.clip((t - 7.5) / 2.5, 0, 1) * (t < 10) * 0.05

mezcla = pad_osc * 0.9 + bajo + arpe + golpe * 0.6 + shaker + subida

# Reverb simple: respuesta al impulso de ruido con caída exponencial
ir_n = int(2.2 * SR)
ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 3.2)
ir = lp(ir, 5000)
humedo = fftconvolve(mezcla, ir)[:N]
humedo /= np.max(np.abs(humedo)) + 1e-9
final = mezcla / (np.max(np.abs(mezcla)) + 1e-9) * 0.8 + humedo * 0.28

# Entrada y salida suaves
final *= np.clip(t / 1.5, 0, 1) * np.clip((DUR - t) / 3.0, 0, 1)
final = np.tanh(final * 1.2)
final = final / np.max(np.abs(final)) * 0.89

estereo = np.stack([final, np.roll(final, int(0.012 * SR))], axis=1)
datos = (estereo * 32767).astype('<i2')

with open(sys.argv[1], 'wb') as f:
    import wave

    w = wave.open(f, 'wb')
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(datos.tobytes())
    w.close()
print('ok', sys.argv[1])
