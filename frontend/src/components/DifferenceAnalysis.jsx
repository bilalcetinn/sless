import { useState, useRef, useEffect, useCallback } from 'react';

// ── Audio decode ──────────────────────────────────────────────────────────────
async function fetchMono(url) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const resp = await fetch(url);
  const buf  = await resp.arrayBuffer();
  const decoded = await ctx.decodeAudioData(buf);
  await ctx.close();
  const ch0 = decoded.getChannelData(0);
  if (decoded.numberOfChannels === 1) return ch0;
  const ch1 = decoded.getChannelData(1);
  const mono = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) * 0.5;
  return mono;
}

// ── Waveform çizim ───────────────────────────────────────────────────────────
function drawWave(canvas, samples, color, alpha) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const total = samples.length;
  for (let x = 0; x < W; x++) {
    const s0 = Math.floor((x / W) * total);
    const s1 = Math.floor(((x + 1) / W) * total);
    let min = 1, max = -1;
    for (let i = s0; i < s1; i++) {
      if (samples[i] < min) min = samples[i];
      if (samples[i] > max) max = samples[i];
    }
    const yT = ((1 - max) / 2) * H;
    const yB = ((1 - min) / 2) * H;
    ctx.fillRect(x, yT, 1, Math.max(1, yB - yT));
  }
  ctx.globalAlpha = 1;
}

function clearCanvas(canvas, bg) {
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (bg !== '#111111') {
    ctx.strokeStyle = '#E0E0E0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
}

// ── Spectrogram hesaplama (iteratif FFT) ──────────────────────────────────────
function fftMag(samples, start, fftSize, hann) {
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    re[i] = (start + i < samples.length ? samples[start + i] : 0) * hann[i];
  }
  // Bit-reversal
  let j = 0;
  for (let i = 1; i < fftSize; i++) {
    let bit = fftSize >> 1;
    while (j & bit) { j ^= bit; bit >>= 1; }
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Butterfly
  for (let len = 2; len <= fftSize; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wR = Math.cos(ang), wI = Math.sin(ang);
    for (let i = 0; i < fftSize; i += len) {
      let cR = 1, cI = 0;
      for (let k = 0; k < len >> 1; k++) {
        const uR = re[i+k], uI = im[i+k];
        const vR = re[i+k+(len>>1)]*cR - im[i+k+(len>>1)]*cI;
        const vI = re[i+k+(len>>1)]*cI + im[i+k+(len>>1)]*cR;
        re[i+k] = uR+vR; im[i+k] = uI+vI;
        re[i+k+(len>>1)] = uR-vR; im[i+k+(len>>1)] = uI-vI;
        const nR = cR*wR - cI*wI; cI = cR*wI + cI*wR; cR = nR;
      }
    }
  }
  const bins = fftSize >> 1;
  const mag = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    mag[i] = Math.sqrt(re[i]*re[i] + im[i]*im[i]) / fftSize;
  }
  return mag;
}

function computeSpectrogram(samples, fftSize = 512, hopSize = 128) {
  const hann = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++)
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));

  const frames = [];
  for (let s = 0; s + fftSize <= samples.length; s += hopSize)
    frames.push(fftMag(samples, s, fftSize, hann));
  return frames;
}

function drawSpectrogramOverlay(canvas, origFrames, cleanFrames) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, W, H);

  const T = Math.min(origFrames.length, cleanFrames.length);
  const bins = origFrames[0]?.length || 256;

  // Global max normalizasyon
  let maxV = 1e-10;
  for (let t = 0; t < T; t++) {
    for (let b = 0; b < bins; b++) {
      if (origFrames[t][b] > maxV) maxV = origFrames[t][b];
      if (cleanFrames[t][b] > maxV) maxV = cleanFrames[t][b];
    }
  }

  const imgW = T, imgH = bins;
  const temp = document.createElement('canvas');
  temp.width = imgW; temp.height = imgH;
  const tCtx = temp.getContext('2d');
  const imgData = tCtx.createImageData(imgW, imgH);
  const d = imgData.data;

  for (let t = 0; t < T; t++) {
    for (let b = 0; b < bins; b++) {
      const y = bins - 1 - b; // düşük frekans altta
      // Gamma sıkıştırma — spektrogram kontrastını artırır
      const o = Math.pow(Math.max(0, origFrames[t][b]  / maxV), 0.35);
      const c = Math.pow(Math.max(0, cleanFrames[t][b] / maxV), 0.35);
      const idx = (t + y * imgW) * 4;
      // Cyan  = orijinal ses (o=1, c=0 → R=20,  G=210, B=255)
      // Turuncu = temizlenmiş (o=0, c=1 → R=255, G=140, B=10)
      // Beyaz   = ikisi birlikte  (konuşma korundu)
      // Siyah   = sessizlik
      d[idx]   = Math.min(255, Math.round(o * 20  + c * 255)); // R
      d[idx+1] = Math.min(255, Math.round(o * 210 + c * 140)); // G
      d[idx+2] = Math.min(255, Math.round(o * 255 + c * 10));  // B
      d[idx+3] = 255;
    }
  }

  tCtx.putImageData(imgData, 0, 0);
  ctx.drawImage(temp, 0, 0, W, H);
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────
// mode: 'waveform' | 'spectrogram'
export default function DifferenceAnalysis({ originalUrl, cleanedUrl, mode = 'waveform' }) {
  const [isOpen,  setIsOpen]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const canvasRef = useRef(null);
  const cachedRef = useRef(null); // { orig, clean, origFrames?, cleanFrames? }

  const redraw = useCallback(() => {
    const d = cachedRef.current;
    if (!d || !canvasRef.current) return;

    if (mode === 'waveform') {
      clearCanvas(canvasRef.current, '#F8F8F8');
      drawWave(canvasRef.current, d.orig,  '#9CA3AF', 0.75);
      drawWave(canvasRef.current, d.clean, '#FA5D19', 0.80);
    } else {
      drawSpectrogramOverlay(canvasRef.current, d.origFrames, d.cleanFrames);
    }
  }, [mode]);

  const analyze = useCallback(async () => {
    if (!originalUrl || !cleanedUrl) return;
    if (cachedRef.current) { redraw(); return; }

    setLoading(true);
    setError(null);

    try {
      const [orig, clean] = await Promise.all([
        fetchMono(originalUrl),
        fetchMono(cleanedUrl),
      ]);
      const len = Math.min(orig.length, clean.length);

      if (mode === 'spectrogram') {
        const fftSize = 512, hopSize = 128;
        const origFrames  = computeSpectrogram(orig.slice(0, len),  fftSize, hopSize);
        const cleanFrames = computeSpectrogram(clean.slice(0, len), fftSize, hopSize);
        cachedRef.current = { orig: orig.slice(0, len), clean: clean.slice(0, len), origFrames, cleanFrames };
      } else {
        cachedRef.current = { orig: orig.slice(0, len), clean: clean.slice(0, len) };
      }
    } catch (e) {
      console.error('[DifferenceAnalysis]', e);
      setError('Ses dosyaları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [originalUrl, cleanedUrl, mode, redraw]);

  useEffect(() => { if (isOpen) analyze(); }, [isOpen, analyze]);
  useEffect(() => { if (!loading && !error && isOpen) redraw(); }, [loading, error, isOpen, redraw]);
  useEffect(() => { cachedRef.current = null; }, [originalUrl, cleanedUrl, mode]);

  if (!originalUrl || !cleanedUrl) return null;

  const isSpectro = mode === 'spectrogram';
  const canvasH   = isSpectro ? 160 : 100;

  return (
    <div
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #F0F0F0',
        borderRadius: '16px',
        overflow:     'hidden',
        boxShadow:    '0 2px 12px rgba(0,0,0,0.04)',
        marginTop:    '12px',
      }}
    >
      {/* Toggle */}
      <button
        onClick={() => setIsOpen(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 20px',
          border:         'none',
          background:     isOpen ? '#FFF5F0' : 'transparent',
          cursor:         'pointer',
          transition:     'background 0.2s',
          fontFamily:     "'Inter', sans-serif",
        }}
        onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#FFF9F7'; }}
        onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = isOpen ? '#FFF5F0' : 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width:          '32px',
              height:         '32px',
              borderRadius:   '8px',
              background:     isOpen ? '#FA5D19' : '#F0F0F0',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              flexShrink:     0,
              transition:     'background 0.2s',
            }}
          >
            {isSpectro ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#fff' : '#888'} strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeOpacity="0.6" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isOpen ? '#fff' : '#888'} strokeWidth="2">
                <path d="M2 12h3l3-9 5 18 5-18 3 9h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#262626' }}>
              {isSpectro ? 'Spektrogram Overlap' : 'Dalga Formu Overlap'}
            </p>
            <p style={{ margin: 0, fontSize: '11px', color: '#AAAAAA', marginTop: '1px' }}>
              {isSpectro
                ? 'Cyan: temizlenmiş'
                : 'Gri: orijinal  ·  Turuncu: temizlenmiş'}
            </p>
          </div>
        </div>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none"
          stroke="#AAAAAA" strokeWidth="2"
          style={{ transition: 'transform 0.25s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <div className="animate-fade-in" style={{ padding: '0 20px 20px' }}>
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '24px 0', color: '#888' }}>
              <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#FA5D19' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                {isSpectro ? 'FFT hesaplanıyor…' : 'Ses dosyaları analiz ediliyor…'}
              </span>
            </div>
          )}

          {error && (
            <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', color: '#D32F2F', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Legend — sadece waveform modunda göster */}
              {!isSpectro && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#9CA3AF', fontWeight: 600 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#9CA3AF', display: 'inline-block' }} />
                    Orijinal
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#FA5D19', fontWeight: 600 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: '#FA5D19', display: 'inline-block' }} />
                    Temizlenmiş
                  </span>
                </div>
              )}

              <canvas
                ref={canvasRef}
                width={900}
                height={canvasH}
                style={{
                  width:        '100%',
                  height:       canvasH + 'px',
                  borderRadius: '10px',
                  display:      'block',
                  background:   isSpectro ? '#111111' : '#F8F8F8',
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
