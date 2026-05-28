import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';

function generateColorMap() {
  const map = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r, g, b;
    if (t < 0.5) {
      const p = t * 2;
      r = 17 + (140 - 17) * p;
      g = 17 + (50  - 17) * p;
      b = 17 + (10  - 17) * p;
    } else {
      const p = (t - 0.5) * 2;
      r = 140 + (255 - 140) * p;
      g = 50  + (160 - 50)  * p;
      b = 10  + (50  - 10)  * p;
    }
    map.push([r / 255, g / 255, b / 255, 1.0]);
  }
  return map;
}

function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

function SpectrogramPanel({ audioUrl, label, colorMap, speechFocus, onWsReady, peerWsRef }) {
  const hiddenWaveRef       = useRef(null);
  const spectroContainerRef = useRef(null);
  const wsRef               = useRef(null);
  const abortRef            = useRef(null);

  const [tooltip,     setTooltip]     = useState(null);
  const [status,      setStatus]      = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [isPlaying,   setIsPlaying]   = useState(false);

  const destroyInstance = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch {}
      wsRef.current = null;
    }
    if (onWsReady) onWsReady(null);
  }, [onWsReady]);

  useEffect(() => {
    if (!audioUrl) {
      destroyInstance();
      setStatus('idle');
      setIsPlaying(false);
      return;
    }

    if (abortRef.current) abortRef.current.aborted = true;
    const abortToken = { aborted: false };
    abortRef.current = abortToken;

    destroyInstance();
    setIsPlaying(false);

    if (!hiddenWaveRef.current || !spectroContainerRef.current) return;

    queueMicrotask(() => { if (!abortToken.aborted) setStatus('loading'); });
    spectroContainerRef.current.innerHTML = '';

    const ws = WaveSurfer.create({
      container:     hiddenWaveRef.current,
      height:        1,
      waveColor:     'transparent',
      progressColor: 'transparent',
      cursorWidth:   2,
      cursorColor:   '#FA5D19',
      interact:      true,
      plugins: [
        SpectrogramPlugin.create({
          container:        spectroContainerRef.current,
          fftSamples:       2048,
          height:           200,
          windowFunc:       'hann',
          colorMap:         colorMap,
          labels:           true,
          labelsColor:      '#AAAAAA',
          labelsHzColor:    '#666666',
          labelsBackground: 'rgba(255,255,255,0.03)',
          scale:            'linear',
          gainDB:           2,
          rangeDB:          60,
          // frequencyMax'ı plugin'e bırak — buffer.sampleRate/2 olarak
          // otomatik algılar. 8kHz ses → 0–4kHz, 16kHz ses → 0–8kHz.
          ...(speechFocus ? { frequencyMin: 300, frequencyMax: 4000 } : {}),
        }),
      ],
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      if (abortToken.aborted) return;
      setStatus('ready');
      setDuration(ws.getDuration());
      if (onWsReady) onWsReady(ws);
    });

    ws.on('timeupdate', (time) => {
      if (abortToken.aborted) return;
      setCurrentTime(time);
    });

    ws.on('finish', () => {
      if (abortToken.aborted) return;
      setIsPlaying(false);
    });

    ws.on('seeking', (time) => {
      if (abortToken.aborted) return;
      if (peerWsRef?.current && peerWsRef.current !== ws) {
        const d = peerWsRef.current.getDuration();
        if (d > 0) peerWsRef.current.seekTo(time / d);
      }
    });

    ws.on('error', (err) => {
      if (abortToken.aborted) return;
      const msg = err?.message || String(err);
      if (msg.includes('aborted') || err?.name === 'AbortError') return;
      setStatus('error');
    });

    ws.load(audioUrl);

    return () => {
      abortToken.aborted = true;
      destroyInstance();
    };
  }, [audioUrl, speechFocus, destroyInstance, colorMap, label, onWsReady, peerWsRef]);

  function togglePlay() {
    if (!wsRef.current || status !== 'ready') return;
    if (isPlaying) {
      wsRef.current.pause();
      setIsPlaying(false);
    } else {
      wsRef.current.play();
      setIsPlaying(true);
    }
  }

  const handleMouseMove = useCallback((e) => {
    const container = spectroContainerRef.current;
    if (!container || !wsRef.current || status !== 'ready') { setTooltip(null); return; }
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const totalDuration = wsRef.current.getDuration();
    const time = (x / rect.width) * totalDuration;

    const buf = wsRef.current?.getDecodedData?.();
    const nyquist = buf ? buf.sampleRate / 2 : 8000;
    const maxFreq = speechFocus ? 4000 : nyquist;
    const minFreq = speechFocus ? 300 : 0;
    const freq = maxFreq - (y / rect.height) * (maxFreq - minFreq);

    setTooltip({
      x: Math.min(x, rect.width - 140),
      y: Math.max(y - 50, 0),
      time,
      freq: Math.max(0, freq),
    });
  }, [status, speechFocus]);

  const handleMouseLeave = useCallback(() => setTooltip(null), []);

  return (
    <div
      style={{
        background:   '#FFFFFF',
        border:       '1px solid #F0F0F0',
        borderRadius: '16px',
        padding:      '16px',
        boxShadow:    '0 2px 12px rgba(0,0,0,0.04)',
        overflow:     'hidden',
        position:     'relative',
      }}
    >
      {/* Başlık satırı */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAAAAA' }}>
          {label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zaman */}
          {status === 'ready' && duration > 0 && (
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '12px', fontWeight: 600, color: '#666', letterSpacing: '0.02em' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}

          {/* Oynat / Duraklat — "Hazır" yazısının yerine */}
          {status === 'ready' && (
            <button
              onClick={togglePlay}
              title={isPlaying ? 'Duraklat' : 'Dinle'}
              style={{
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
                gap:             '5px',
                padding:         '5px 12px',
                borderRadius:    '6px',
                border:          'none',
                cursor:          'pointer',
                fontSize:        '12px',
                fontWeight:      600,
                fontFamily:      "'Inter', sans-serif",
                transition:      'all 0.2s',
                background:      isPlaying
                  ? '#262626'
                  : 'linear-gradient(135deg, #FA5D19, #FF7A40)',
                color:           '#FFFFFF',
                boxShadow:       isPlaying
                  ? '0 2px 6px rgba(0,0,0,0.2)'
                  : '0 2px 6px rgba(250,93,25,0.3)',
              }}
            >
              {isPlaying ? (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              )}
              {isPlaying ? 'Duraklat' : 'Dinle'}
            </button>
          )}

          {status === 'error' && (
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>Hata</span>
          )}
        </div>
      </div>

      {/* Gizli WaveSurfer dalga formu */}
      <div
        ref={hiddenWaveRef}
        style={{ width: '100%', height: 1, opacity: 0, overflow: 'hidden', position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}
      />

      {/* Spektrogram */}
      <div
        ref={spectroContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width:        '100%',
          minHeight:    '200px',
          borderRadius: '10px',
          overflow:     'hidden',
          background:   '#111111',
          position:     'relative',
          cursor:       status === 'ready' ? 'crosshair' : 'default',
        }}
      />

      {/* Tooltip */}
      {tooltip && status === 'ready' && (
        <div
          style={{
            position:           'absolute',
            left:               tooltip.x + 16 + 'px',
            top:                tooltip.y + 40 + 'px',
            background:         'rgba(38,38,38,0.92)',
            backdropFilter:     'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius:       '8px',
            padding:            '8px 12px',
            pointerEvents:      'none',
            zIndex:             20,
            border:             '1px solid rgba(250,93,25,0.3)',
            boxShadow:          '0 4px 16px rgba(0,0,0,0.3)',
            minWidth:           '120px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
              {formatTime(tooltip.time)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF7A40" strokeWidth="2">
              <path d="M2 12h3l3-9 5 18 5-18 3 9h3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600, fontFamily: "'Space Grotesk', sans-serif" }}>
              {tooltip.freq >= 1000 ? (tooltip.freq / 1000).toFixed(2) + ' kHz' : Math.round(tooltip.freq) + ' Hz'}
            </span>
          </div>
        </div>
      )}

      {/* Yükleme overlay */}
      {status === 'loading' && (
        <div
          style={{
            position:       'absolute',
            inset:          0,
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '12px',
            background:     'rgba(17,17,17,0.85)',
            borderRadius:   '10px',
            zIndex:         5,
          }}
        >
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: '#FA5D19' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '12px', color: '#AAAAAA', fontWeight: 500 }}>FFT hesaplanıyor…</span>
        </div>
      )}
    </div>
  );
}

export default function SpectrogramView() {
  const { originalAudioUrl, cleanedAudioUrl } = useStore();

  const colorMap = useMemo(() => generateColorMap(), []);
  const [speechFocus, setSpeechFocus] = useState(false);

  const originalWsRef = useRef(null);
  const cleanedWsRef  = useRef(null);
  const handleOriginalReady = useCallback((ws) => { originalWsRef.current = ws; }, []);
  const handleCleanedReady  = useCallback((ws) => { cleanedWsRef.current  = ws; }, []);

  const hasAudio = originalAudioUrl || cleanedAudioUrl;

  if (!hasAudio) {
    return (
      <div
        style={{
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          minHeight:      '300px',
          background:     '#FFFFFF',
          border:         '1px solid #F0F0F0',
          borderRadius:   '20px',
          padding:        '40px',
          boxShadow:      '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            width:          '64px',
            height:         '64px',
            borderRadius:   '50%',
            background:     'linear-gradient(135deg, #FFF5F0, #FEE8DC)',
            border:         '2px solid rgba(250,93,25,0.15)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            marginBottom:   '16px',
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 12h18M12 3v18" strokeOpacity="0.5" />
            <path d="M3 8h18M3 16h18" strokeOpacity="0.25" />
          </svg>
        </div>
        <p style={{ fontWeight: 600, color: '#262626', fontSize: '15px', margin: 0 }}>Spektrogram Bekleniyor</p>
        <p style={{ fontSize: '13px', color: '#AAAAAA', marginTop: '6px', textAlign: 'center' }}>
          Ses dosyası yükleyip temizledikten sonra frekans analizi burada görünür
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Kontrol Çubuğu — sadece Speech Focus ── */}
      <div
        style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'flex-end',
          marginBottom:   '16px',
          background:     '#FFFFFF',
          border:         '1px solid #F0F0F0',
          borderRadius:   '12px',
          padding:        '10px 16px',
          boxShadow:      '0 1px 6px rgba(0,0,0,0.03)',
        }}
      >
        <button
          onClick={() => setSpeechFocus(!speechFocus)}
          style={{
            display:     'flex',
            alignItems:  'center',
            gap:         '6px',
            padding:     '7px 14px',
            borderRadius:'8px',
            border:      speechFocus ? '1.5px solid #FA5D19' : '1.5px solid #E5E5E5',
            background:  speechFocus ? '#FFF5F0' : 'transparent',
            color:       speechFocus ? '#FA5D19' : '#888',
            fontSize:    '12px',
            fontWeight:  600,
            cursor:      'pointer',
            transition:  'all 0.2s',
            fontFamily:  "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => { if (!speechFocus) { e.currentTarget.style.borderColor = '#FA5D19'; e.currentTarget.style.color = '#FA5D19'; } }}
          onMouseLeave={(e) => { if (!speechFocus) { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.color = '#888'; } }}
          title="Sadece konuşma frekans bandını göster (300 Hz – 4 kHz)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
            {speechFocus && <path d="M8 11h6M11 8v6" strokeLinecap="round" />}
          </svg>
          {speechFocus ? 'Konuşma Bandı (300Hz–4kHz)' : 'Speech Focus'}
        </button>
      </div>

      {/* ── Spektrogram panelleri ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {originalAudioUrl && (
          <SpectrogramPanel
            audioUrl={originalAudioUrl}
            label="Orijinal Ses"
            colorMap={colorMap}
            speechFocus={speechFocus}
            onWsReady={handleOriginalReady}
            peerWsRef={cleanedWsRef}
          />
        )}

        {cleanedAudioUrl ? (
          <SpectrogramPanel
            audioUrl={cleanedAudioUrl}
            label="Temizlenmiş Ses"
            colorMap={colorMap}
            speechFocus={speechFocus}
            onWsReady={handleCleanedReady}
            peerWsRef={originalWsRef}
          />
        ) : (
          <div
            style={{
              background:   '#FFFFFF',
              border:       '1px solid #F0F0F0',
              borderRadius: '16px',
              padding:      '16px',
              boxShadow:    '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAAAAA', display: 'block', marginBottom: '12px' }}>
              Temizlenmiş Ses
            </span>
            <div
              style={{
                minHeight:      '200px',
                borderRadius:   '10px',
                background:     '#F5F5F5',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '13px', color: '#BBBBBB', fontWeight: 500 }}>Henüz işlenmedi</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
