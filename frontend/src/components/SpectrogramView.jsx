import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import useStore from '../store/useStore';
import WaveSurfer from 'wavesurfer.js';
import SpectrogramPlugin from 'wavesurfer.js/dist/plugins/spectrogram.esm.js';

// ─────────────────────────────────────────────────────────────────────────────
// Özel renk haritası: Koyu antrasit (#111111) → Turuncu (#FA5D19)
// colorMap: 256 eleman, her biri [r, g, b, alpha] (0..1 arası float)
// ─────────────────────────────────────────────────────────────────────────────
function generateColorMap() {
  const map = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let r, g, b;
    if (t < 0.5) {
      const p = t * 2;
      r = 17 + (140 - 17) * p;
      g = 17 + (50 - 17) * p;
      b = 17 + (10 - 17) * p;
    } else {
      const p = (t - 0.5) * 2;
      r = 140 + (255 - 140) * p;
      g = 50 + (160 - 50) * p;
      b = 10 + (50 - 10) * p;
    }
    map.push([r / 255, g / 255, b / 255, 1.0]);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Zaman formatlayıcı: 65.3 → "1:05.3"
// ─────────────────────────────────────────────────────────────────────────────
function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '0:00.0';
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1);
  return `${m}:${s.padStart(4, '0')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SpectrogramPanel — Tek bir ses kaynağı için WaveSurfer + Spectrogram
//
// Props:
//   audioUrl       – ses dosyası URL'si
//   label          – "Orijinal Ses" / "Temizlenmiş Ses"
//   colorMap       – 256 elemanlı renk haritası
//   speechFocus    – true ise frekans aralığı 300–4000 Hz olur
//   onWsReady      – WaveSurfer instance hazır olduğunda üst bileşene bildir
//   peerWsRef      – senkronize edilecek diğer panelin WaveSurfer ref'i
//   isPlaying      – dışarıdan kontrol edilen playback durumu
// ─────────────────────────────────────────────────────────────────────────────
function SpectrogramPanel({ audioUrl, label, colorMap, speechFocus, onWsReady, peerWsRef, isPlaying }) {
  const hiddenWaveRef = useRef(null);
  const spectroContainerRef = useRef(null);
  const wsRef = useRef(null);
  const abortRef = useRef(null);
  // Tooltip state
  const [tooltip, setTooltip] = useState(null); // { x, y, time, freq } veya null
  const [status, setStatus] = useState('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const destroyInstance = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.destroy();
      } catch {
        // sessizce yut
      }
      wsRef.current = null;
    }

    if (onWsReady) onWsReady(null);
  }, [onWsReady]);

  // ── WaveSurfer'ı oluştur / yeniden oluştur ──
  useEffect(() => {
    if (!audioUrl) {
      destroyInstance();
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setStatus('idle');
      });
      return () => {
        cancelled = true;
      };
    }

    if (abortRef.current) abortRef.current.aborted = true;
    const abortToken = { aborted: false };
    abortRef.current = abortToken;

    destroyInstance();

    if (!hiddenWaveRef.current || !spectroContainerRef.current) return;

    queueMicrotask(() => {
      if (!abortToken.aborted) setStatus('loading');
    });
    spectroContainerRef.current.innerHTML = '';

    const ws = WaveSurfer.create({
      container: hiddenWaveRef.current,
      height: 1,
      waveColor: 'transparent',
      progressColor: 'transparent',
      // Playback cursor aktif — kullanıcı tıklayıp seek edebilir
      cursorWidth: 2,
      cursorColor: '#FA5D19',
      interact: true,
      plugins: [
        SpectrogramPlugin.create({
          container: spectroContainerRef.current,
          fftSamples: 2048,
          height: 200,
          windowFunc: 'hann',
          colorMap: colorMap,
          labels: true,
          labelsColor: '#AAAAAA',
          labelsHzColor: '#666666',
          labelsBackground: 'rgba(255,255,255,0.03)',
          scale: 'linear',
          gainDB: 2,
          rangeDB: 80,
          // Speech Focus: sadece konuşma bandı (300Hz–4kHz)
          ...(speechFocus ? { frequencyMin: 300, frequencyMax: 4000 } : {}),
        }),
      ],
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      if (abortToken.aborted) return;
      setStatus('ready');
      setDuration(ws.getDuration());
      // Üst bileşene bu ws instance'ı bildir (senkronizasyon için)
      if (onWsReady) onWsReady(ws);
    });

    // Zaman güncellemesi — cursor pozisyonunu takip et
    ws.on('timeupdate', (time) => {
      if (abortToken.aborted) return;
      setCurrentTime(time);
    });

    // Seek olayı — peer paneli de aynı pozisyona taşı (senkronize dinleme)
    ws.on('seeking', (time) => {
      if (abortToken.aborted) return;
      if (peerWsRef?.current && peerWsRef.current !== ws) {
        const peerDuration = peerWsRef.current.getDuration();
        if (peerDuration > 0) {
          peerWsRef.current.seekTo(time / peerDuration);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[SpectrogramPanel] ${label} hata:`, err);
      if (abortToken.aborted) return;
      setStatus('error');
    });

    ws.load(audioUrl);

    return () => {
      abortToken.aborted = true;
      destroyInstance();
    };
  }, [audioUrl, speechFocus, destroyInstance, colorMap, label, onWsReady, peerWsRef]); // speechFocus değişince yeniden oluştur

  // ── Dışarıdan Play/Pause kontrolü ──
  useEffect(() => {
    if (!wsRef.current || status !== 'ready') return;
    if (isPlaying) {
      wsRef.current.play();
    } else {
      wsRef.current.pause();
    }
  }, [isPlaying, status]);

  // ── Tooltip: mouse hover'da frekans (Hz) ve zaman (s) göster ──
  const handleMouseMove = useCallback((e) => {
    const container = spectroContainerRef.current;
    if (!container || !wsRef.current || status !== 'ready') {
      setTooltip(null);
      return;
    }
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Zaman: x pozisyonunun toplam genişliğe oranı × süre
    const totalDuration = wsRef.current.getDuration();
    const time = (x / rect.width) * totalDuration;

    // Frekans: y pozisyonu (üst = yüksek frekans, alt = düşük frekans)
    // Mel ölçeği kullanıldığı için lineer yaklaşım
    const maxFreq = speechFocus ? 4000 : 22050;
    const minFreq = speechFocus ? 300 : 0;
    const freqRange = maxFreq - minFreq;
    const freq = maxFreq - (y / rect.height) * freqRange;

    setTooltip({
      x: Math.min(x, rect.width - 140),
      y: Math.max(y - 50, 0),
      time,
      freq: Math.max(0, freq),
    });
  }, [status, speechFocus]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Başlık + zaman göstergesi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#AAAAAA',
          }}
        >
          {label}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Oynatma zamanı */}
          {status === 'ready' && duration > 0 && (
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '12px',
                fontWeight: 600,
                color: '#666',
                letterSpacing: '0.02em',
              }}
            >
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          )}

          {/* Durum göstergesi */}
          {status === 'ready' && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#22C55E', fontWeight: 600 }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              Hazır
            </span>
          )}
          {status === 'error' && (
            <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 600 }}>Hata</span>
          )}
        </div>
      </div>

      {/* Gizli WaveSurfer dalga formu konteyneri */}
      <div ref={hiddenWaveRef} style={{ height: 1, opacity: 0, overflow: 'hidden', position: 'absolute', pointerEvents: 'none' }} />

      {/* Spektrogram çıktısı + tooltip katmanı */}
      <div
        ref={spectroContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          width: '100%',
          minHeight: '200px',
          borderRadius: '10px',
          overflow: 'hidden',
          background: '#111111',
          position: 'relative',
          cursor: status === 'ready' ? 'crosshair' : 'default',
        }}
      />

      {/* Tooltip overlay — frekans ve zaman gösterici */}
      {tooltip && status === 'ready' && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 16 + 'px',
            top: tooltip.y + 40 + 'px',
            background: 'rgba(38, 38, 38, 0.92)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: '8px',
            padding: '8px 12px',
            pointerEvents: 'none',
            zIndex: 20,
            border: '1px solid rgba(250, 93, 25, 0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            minWidth: '120px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
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
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(17,17,17,0.85)',
            borderRadius: '10px',
            zIndex: 5,
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

// ─────────────────────────────────────────────────────────────────────────────
// Ana bileşen: Kontrol çubuğu + İki paneli yan yana render eder
// ─────────────────────────────────────────────────────────────────────────────
export default function SpectrogramView() {
  const { originalAudioUrl, cleanedAudioUrl } = useStore();

  const colorMap = useMemo(() => generateColorMap(), []);

  // Playback kontrolü
  const [isPlaying, setIsPlaying] = useState(false);
  // Speech Focus toggle
  const [speechFocus, setSpeechFocus] = useState(false);

  // İki panelin WaveSurfer instance'larını senkronize etmek için ref'ler
  const originalWsRef = useRef(null);
  const cleanedWsRef = useRef(null);

  // Panel hazır olduğunda ref'e kaydet
  const handleOriginalReady = useCallback((ws) => { originalWsRef.current = ws; }, []);
  const handleCleanedReady = useCallback((ws) => { cleanedWsRef.current = ws; }, []);

  // Senkronize Play/Pause toggle
  function togglePlay() {
    setIsPlaying((prev) => !prev);
  }

  // Senkronize Stop
  function handleStop() {
    setIsPlaying(false);
    if (originalWsRef.current) {
      originalWsRef.current.pause();
      originalWsRef.current.seekTo(0);
    }
    if (cleanedWsRef.current) {
      cleanedWsRef.current.pause();
      cleanedWsRef.current.seekTo(0);
    }
  }

  const hasAudio = originalAudioUrl || cleanedAudioUrl;

  // Ses dosyası yoksa boş durum göster
  if (!hasAudio) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: '20px',
          padding: '40px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFF5F0, #FEE8DC)',
            border: '2px solid rgba(250,93,25,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
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
      {/* ── Kontrol Çubuğu ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '16px',
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: '12px',
          padding: '10px 16px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.03)',
        }}
      >
        {/* Sol: Playback butonları */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'all 0.2s',
              background: isPlaying ? '#262626' : 'linear-gradient(135deg, #FA5D19, #FF7A40)',
              color: '#FFFFFF',
              boxShadow: isPlaying ? '0 2px 8px rgba(0,0,0,0.15)' : '0 2px 8px rgba(250,93,25,0.25)',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {isPlaying ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
            )}
            {isPlaying ? 'Duraklat' : 'A/B Dinle'}
          </button>

          {/* Stop */}
          <button
            onClick={handleStop}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: '1.5px solid #E5E5E5',
              background: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: '#888',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.color = '#262626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.color = '#888'; }}
            title="Başa dön"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>

          {/* Senkronize bilgi */}
          {originalAudioUrl && cleanedAudioUrl && (
            <span style={{ fontSize: '11px', color: '#AAAAAA', fontWeight: 500, marginLeft: '4px' }}>
              ↔ Senkronize
            </span>
          )}
        </div>

        {/* Sağ: Speech Focus toggle */}
        <button
          onClick={() => setSpeechFocus(!speechFocus)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: speechFocus ? '1.5px solid #FA5D19' : '1.5px solid #E5E5E5',
            background: speechFocus ? '#FFF5F0' : 'transparent',
            color: speechFocus ? '#FA5D19' : '#888',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'Inter', sans-serif",
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

      {/* ── Spektrogram Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Orijinal Ses Spektrogramı */}
        {originalAudioUrl && (
          <SpectrogramPanel
            audioUrl={originalAudioUrl}
            label="Orijinal Ses"
            colorMap={colorMap}
            speechFocus={speechFocus}
            onWsReady={handleOriginalReady}
            peerWsRef={cleanedWsRef}
            isPlaying={isPlaying}
          />
        )}

        {/* Temizlenmiş Ses Spektrogramı */}
        {cleanedAudioUrl ? (
          <SpectrogramPanel
            audioUrl={cleanedAudioUrl}
            label="Temizlenmiş Ses"
            colorMap={colorMap}
            speechFocus={speechFocus}
            onWsReady={handleCleanedReady}
            peerWsRef={originalWsRef}
            isPlaying={isPlaying}
          />
        ) : (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #F0F0F0',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#AAAAAA',
                display: 'block',
                marginBottom: '12px',
              }}
            >
              Temizlenmiş Ses
            </span>
            <div
              style={{
                minHeight: '200px',
                borderRadius: '10px',
                background: '#F5F5F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '13px', color: '#BBBBBB', fontWeight: 500 }}>
                Henüz işlenmedi
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
