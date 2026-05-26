import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import useStore from '../store/useStore';

function formatTime(secs) {
  if (isNaN(secs) || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Tek bir dalga formu paneli — kendi play/pause/stop kontrolüyle
function WavePanel({ label, audioUrl, color = '#FA5D19', progressColor = '#262626' }) {
  const containerRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState('idle');   // idle | loading | ready | error
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) {
      setStatus('idle');
      setIsPlaying(false);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch (_) {}
    }
    containerRef.current.innerHTML = '';

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: color,
      progressColor,
      cursorColor: color,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 100,
      normalize: true,
      interact: true,
      hideScrollbar: true,
    });

    wsRef.current = ws;

    ws.on('ready', () => {
      if (cancelled) return;
      setStatus('ready');
      setDuration(ws.getDuration());
    });

    ws.on('timeupdate', (t) => {
      if (cancelled) return;
      setCurrentTime(t);
    });

    ws.on('finish', () => {
      if (cancelled) return;
      setIsPlaying(false);
    });

    ws.on('error', (err) => {
      if (cancelled) return;
      console.error('WaveSurfer hata:', err);
      setStatus('error');
    });

    try {
      ws.load(audioUrl);
    } catch (err) {
      console.error('Ses yüklenemedi:', err);
      if (!cancelled) setTimeout(() => setStatus('error'), 0);
    }

    return () => {
      cancelled = true;
      if (wsRef.current) {
        try { wsRef.current.destroy(); } catch (_) {}
        wsRef.current = null;
      }
    };
  }, [audioUrl]);

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

  function handleStop() {
    if (!wsRef.current || status !== 'ready') return;
    wsRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  }

  const ready = status === 'ready';

  return (
    <div className="relative rounded-xl border border-app-gray bg-white overflow-hidden shadow-sm">
      {/* Panel başlığı + kontroller */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-[11px] font-bold text-app-gray-text uppercase tracking-widest">
          {label}
        </span>

        <div className="flex items-center gap-2">
          {/* Zaman göstergesi */}
          <span className="text-[11px] text-app-dark/50 font-mono tabular-nums mr-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          {/* Stop */}
          <button
            type="button"
            onClick={handleStop}
            disabled={!ready}
            title="Başa dön"
            className="w-7 h-7 rounded-lg border-[1.5px] border-[#E5E5E5] flex items-center justify-center text-app-gray-text
                       hover:border-app-dark hover:text-app-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={!ready}
            aria-label={isPlaying ? 'Duraklat' : 'Oynat'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white
                       bg-gradient-to-br from-[#FA5D19] to-[#FF7A40]
                       hover:opacity-90 transition-opacity shadow-[0_2px_6px_rgba(250,93,25,0.25)]
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2l10 6-10 6V2z" />
              </svg>
            )}
            {isPlaying ? 'Duraklat' : 'Oynat'}
          </button>
        </div>
      </div>

      {/* Dalga formu */}
      <div className="relative mx-4 mb-4 min-h-[100px] rounded-lg overflow-hidden bg-[#FAFAFA]">
        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
            <svg className="w-5 h-5 animate-spin text-app-orange" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 z-10">
            <span className="text-[12px] font-semibold text-red-500">Ses yüklenemedi</span>
          </div>
        )}
        {!audioUrl && status === 'idle' && (
          <div className="absolute inset-0 flex items-center justify-center border border-dashed border-[#E5E5E5] rounded-lg">
            <span className="text-[12px] text-[#BBBBBB]">Henüz ses yok</span>
          </div>
        )}
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}

// Ana bileşen
export default function WaveformViewer({ audioUrl, label }) {
  const store = useStore();

  const isLegacy = !!audioUrl;
  const originalUrl = isLegacy ? audioUrl : store.originalAudioUrl;
  const cleanedUrl  = isLegacy ? null  : store.cleanedAudioUrl;

  // Boş durum
  if (!originalUrl) {
    return (
      <div className="bg-white border border-app-gray rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[260px] shadow-sm">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-app-orange-bg to-app-orange-pale flex items-center justify-center border-2 border-app-orange/10">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="1.5">
            <path d="M2 12h4l3-9 5 18 5-18 3 9h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-app-dark font-semibold text-[15px]">Dalga Formu Bekleniyor</p>
          <p className="text-app-gray-text text-[13px] mt-1">
            Ses dosyası yükleyince dalga formları burada görünür.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] font-bold text-app-gray-text uppercase tracking-widest px-1">
        {isLegacy ? (label || 'Dalga Formu') : 'Dalga Formu Karşılaştırması'}
      </p>

      {/* Orijinal panel */}
      <WavePanel
        label="Orijinal Ses"
        audioUrl={originalUrl}
        color="#FA5D19"
        progressColor="#262626"
      />

      {/* Temizlenmiş panel — sadece varsa */}
      {!isLegacy && (
        <WavePanel
          label="Temizlenmiş Ses"
          audioUrl={cleanedUrl}
          color="#22C55E"
          progressColor="#15803D"
        />
      )}

      <p className="text-[11px] text-app-gray-text text-center px-4">
        Her panel bağımsız oynatılabilir. Frekans detayları için{' '}
        <strong>Spektrogram</strong> sekmesini kullanın.
      </p>
    </div>
  );
}
