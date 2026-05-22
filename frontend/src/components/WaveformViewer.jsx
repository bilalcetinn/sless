import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import useStore from '../store/useStore';

// Zaman formatlayıcı
function formatTime(secs) {
  if (isNaN(secs) || !isFinite(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export default function WaveformViewer({ audioUrl, label }) {
  const store = useStore();
  
  // Backward compatibility: props gelirse tekli panel, gelmezse karşılaştırma modu
  const isLegacy = !!audioUrl;
  const originalUrl = isLegacy ? audioUrl : store.originalAudioUrl;
  const cleanedUrl = isLegacy ? null : store.cleanedAudioUrl;

  const hasCleaned = !!cleanedUrl;

  // State
  const [listenMode, setListenMode] = useState(isLegacy ? 'original' : 'original');
  const [isPlaying, setIsPlaying] = useState(false);

  // Orijinal
  const originalContainerRef = useRef(null);
  const originalWsRef = useRef(null);
  const [originalStatus, setOriginalStatus] = useState('idle');
  const [originalTime, setOriginalTime] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);

  // Temizlenmiş
  const cleanedContainerRef = useRef(null);
  const cleanedWsRef = useRef(null);
  const [cleanedStatus, setCleanedStatus] = useState('idle');
  const [cleanedTime, setCleanedTime] = useState(0);
  const [cleanedDuration, setCleanedDuration] = useState(0);

  // sync seek guard
  const isSyncingSeekRef = useRef(false);

  // Event handler'larda güncel durumu almak için ref'ler
  const modeRef = useRef(listenMode);
  modeRef.current = listenMode;
  
  const cleanedStatusRef = useRef(cleanedStatus);
  cleanedStatusRef.current = cleanedStatus;

  const originalStatusRef = useRef(originalStatus);
  originalStatusRef.current = originalStatus;

  // Cleaned ses geldiğinde veya silindiğinde modu ayarla
  useEffect(() => {
    if (!isLegacy && hasCleaned && store.processingStatus === 'done') {
      setListenMode('sync');
    } else if (!isLegacy && !hasCleaned && listenMode === 'sync') {
      setListenMode('original');
    }
  }, [hasCleaned, store.processingStatus, isLegacy, listenMode]);

  // WaveSurfer init - Orijinal Ses
  useEffect(() => {
    if (!originalContainerRef.current || !originalUrl) {
      setOriginalStatus('idle');
      return;
    }

    let cancelled = false;
    setOriginalStatus('loading');
    setOriginalTime(0);
    setOriginalDuration(0);

    // cleanup
    if (originalWsRef.current) {
      try { originalWsRef.current.destroy(); } catch (e) {}
    }
    originalContainerRef.current.innerHTML = '';

    const ws = WaveSurfer.create({
      container: originalContainerRef.current,
      waveColor: '#FA5D19',
      progressColor: '#262626',
      cursorColor: '#FA5D19',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      interact: true,
      hideScrollbar: true,
    });

    originalWsRef.current = ws;

    ws.on('ready', () => {
      if (cancelled) return;
      setOriginalStatus('ready');
      setOriginalDuration(ws.getDuration());
    });

    ws.on('timeupdate', (time) => {
      if (cancelled) return;
      setOriginalTime(time);
    });

    ws.on('seeking', () => {
      if (cancelled) return;
      setOriginalTime(ws.getCurrentTime());
      
      // sync seek guard
      if (!isLegacy && modeRef.current === 'sync' && cleanedWsRef.current && cleanedStatusRef.current === 'ready') {
        if (!isSyncingSeekRef.current) {
          isSyncingSeekRef.current = true;
          const prog = ws.getCurrentTime() / ws.getDuration();
          cleanedWsRef.current.seekTo(prog);
          setTimeout(() => { isSyncingSeekRef.current = false; }, 0);
        }
      }
    });

    ws.on('finish', () => {
      if (cancelled) return;
      if (modeRef.current === 'sync' || modeRef.current === 'original') {
        setIsPlaying(false);
      }
    });

    ws.on('error', (err) => {
      if (cancelled) return;
      console.error('Orijinal WS Hata:', err);
      setOriginalStatus('error');
    });

    try { ws.load(originalUrl); } catch(err) { if (!cancelled) setOriginalStatus('error'); }

    // cleanup
    return () => {
      cancelled = true;
      if (originalWsRef.current) {
        try { originalWsRef.current.destroy(); } catch (e) {}
        originalWsRef.current = null;
      }
    };
  }, [originalUrl, isLegacy]);

  // WaveSurfer init - Temizlenmiş Ses
  useEffect(() => {
    if (isLegacy || !cleanedContainerRef.current || !cleanedUrl) {
      setCleanedStatus('idle');
      return;
    }

    let cancelled = false;
    setCleanedStatus('loading');
    setCleanedTime(0);
    setCleanedDuration(0);

    // cleanup
    if (cleanedWsRef.current) {
      try { cleanedWsRef.current.destroy(); } catch (e) {}
    }
    cleanedContainerRef.current.innerHTML = '';

    const ws = WaveSurfer.create({
      container: cleanedContainerRef.current,
      waveColor: '#FA5D19',
      progressColor: '#262626',
      cursorColor: '#FA5D19',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 120,
      normalize: true,
      interact: true,
      hideScrollbar: true,
    });

    cleanedWsRef.current = ws;

    ws.on('ready', () => {
      if (cancelled) return;
      setCleanedStatus('ready');
      setCleanedDuration(ws.getDuration());
    });

    ws.on('timeupdate', (time) => {
      if (cancelled) return;
      setCleanedTime(time);
    });

    ws.on('seeking', () => {
      if (cancelled) return;
      setCleanedTime(ws.getCurrentTime());

      // sync seek guard
      if (!isLegacy && modeRef.current === 'sync' && originalWsRef.current && originalStatusRef.current === 'ready') {
        if (!isSyncingSeekRef.current) {
          isSyncingSeekRef.current = true;
          const prog = ws.getCurrentTime() / ws.getDuration();
          originalWsRef.current.seekTo(prog);
          setTimeout(() => { isSyncingSeekRef.current = false; }, 0);
        }
      }
    });

    ws.on('finish', () => {
      if (cancelled) return;
      if (modeRef.current === 'cleaned') {
        setIsPlaying(false);
      }
    });

    ws.on('error', (err) => {
      if (cancelled) return;
      console.error('Temizlenmiş WS Hata:', err);
      setCleanedStatus('error');
    });

    try { ws.load(cleanedUrl); } catch(err) { if (!cancelled) setCleanedStatus('error'); }

    // cleanup
    return () => {
      cancelled = true;
      if (cleanedWsRef.current) {
        try { cleanedWsRef.current.destroy(); } catch (e) {}
        cleanedWsRef.current = null;
      }
    };
  }, [cleanedUrl, isLegacy]);

  function syncCleanedToOriginalProgress() {
    if (
      !originalWsRef.current ||
      !cleanedWsRef.current ||
      originalStatusRef.current !== 'ready' ||
      cleanedStatusRef.current !== 'ready'
    ) {
      return;
    }

    const originalDuration = originalWsRef.current.getDuration();
    const originalCurrentTime = originalWsRef.current.getCurrentTime();

    if (!originalDuration || !isFinite(originalDuration)) return;

    const progress = clamp01(originalCurrentTime / originalDuration);
    
    isSyncingSeekRef.current = true;
    cleanedWsRef.current.seekTo(progress);
    setTimeout(() => { isSyncingSeekRef.current = false; }, 0);
  }

  // playback mode handling
  useEffect(() => {
    if (isPlaying) {
      if (listenMode === 'sync') {
        syncCleanedToOriginalProgress();
        if (originalWsRef.current && originalStatus === 'ready') originalWsRef.current.play();
        if (cleanedWsRef.current && cleanedStatus === 'ready') cleanedWsRef.current.play();
      } else if (listenMode === 'original') {
        if (cleanedWsRef.current && cleanedStatus === 'ready') cleanedWsRef.current.pause();
        if (originalWsRef.current && originalStatus === 'ready') originalWsRef.current.play();
      } else if (listenMode === 'cleaned') {
        if (originalWsRef.current && originalStatus === 'ready') originalWsRef.current.pause();
        if (cleanedWsRef.current && cleanedStatus === 'ready') cleanedWsRef.current.play();
      }
    } else {
      if (originalWsRef.current && originalStatus === 'ready') originalWsRef.current.pause();
      if (cleanedWsRef.current && cleanedStatus === 'ready') cleanedWsRef.current.pause();
    }
  }, [isPlaying, listenMode, originalStatus, cleanedStatus]);

  function handlePlayPause() {
    setIsPlaying(!isPlaying);
  }

  function handleStop() {
    setIsPlaying(false);
    if (originalWsRef.current && originalStatus === 'ready') originalWsRef.current.seekTo(0);
    if (cleanedWsRef.current && cleanedStatus === 'ready') cleanedWsRef.current.seekTo(0);
    setOriginalTime(0);
    setCleanedTime(0);
  }

  const displayTime = listenMode === 'cleaned' ? cleanedTime : originalTime;
  const displayDuration = listenMode === 'cleaned' ? cleanedDuration : originalDuration;

  // Boş state
  if (!originalUrl) {
    return (
      <div className="bg-white border border-app-gray rounded-xl p-8 flex flex-col items-center justify-center text-center space-y-3 min-h-[300px] shadow-sm">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-app-orange-bg to-app-orange-pale flex items-center justify-center border-2 border-app-orange/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="1.5">
            <path d="M2 12h4l3-9 5 18 5-18 3 9h2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <p className="text-app-dark font-semibold text-[15px]">Dalga Formu Bekleniyor</p>
          <p className="text-app-gray-text text-[13px] mt-1">Ses dosyası yükleyince orijinal ve temizlenmiş dalga formları burada görünür.</p>
        </div>
      </div>
    );
  }

  const getModeBtnClass = (mode) => {
    const isActive = listenMode === mode;
    const isDisabled = (mode === 'sync' || mode === 'cleaned') && !hasCleaned;
    return `px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
      isDisabled ? 'opacity-40 cursor-not-allowed text-app-gray-text' :
      isActive ? 'bg-app-dark text-white shadow-sm' : 'text-app-gray-text hover:text-app-dark'
    }`;
  };

  const playButtonLabel =
    listenMode === 'sync'
      ? 'A/B Dinle'
      : listenMode === 'cleaned'
        ? 'Temizlenmişi Dinle'
        : 'Orijinali Dinle';

  const playButtonAriaLabel = isPlaying
    ? 'Duraklat'
    : playButtonLabel;

  return (
    <div className="bg-white border border-app-gray rounded-xl p-4 space-y-4 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold text-app-gray-text uppercase tracking-widest">
            {isLegacy ? (label || "Dalga Formu") : "Dalga Formu Karşılaştırması"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-app-gray bg-white p-2 md:p-3 shadow-sm">
          <div className="flex items-center gap-2 border-r border-app-gray pr-3">
            <button
              type="button"
              onClick={handlePlayPause}
              aria-label={playButtonAriaLabel}
              className="flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-gradient-to-br from-[#FA5D19] to-[#FF7A40] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity shadow-[0_2px_8px_rgba(250,93,25,0.25)]"
            >
              {isPlaying ? (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <rect x="3" y="2" width="4" height="12" rx="1" />
                  <rect x="9" y="2" width="4" height="12" rx="1" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M4 2l10 6-10 6V2z" />
                </svg>
              )}
              {isPlaying ? 'Duraklat' : playButtonLabel}
            </button>
            <button
              type="button"
              onClick={handleStop}
              aria-label="Durdur ve başa dön"
              className="w-8 h-8 md:w-9 md:h-9 rounded-lg border-[1.5px] border-[#E5E5E5] flex items-center justify-center text-app-gray-text hover:border-app-dark hover:text-app-dark transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <rect x="3" y="3" width="10" height="10" rx="1" />
              </svg>
            </button>
          </div>

          {!isLegacy && (
            <div className="inline-flex rounded-lg bg-[#F5F5F5] p-1">
              <button 
                type="button" 
                onClick={() => setListenMode('original')}
                className={getModeBtnClass('original')}
              >
                Orijinal
              </button>
              <button 
                type="button" 
                onClick={() => hasCleaned && setListenMode('cleaned')}
                disabled={!hasCleaned}
                className={getModeBtnClass('cleaned')}
              >
                Temizlenmiş
              </button>
              <button 
                type="button" 
                onClick={() => hasCleaned && setListenMode('sync')}
                disabled={!hasCleaned}
                className={getModeBtnClass('sync')}
              >
                Karşılaştır
              </button>
            </div>
          )}

          <div className="pl-1 min-w-[70px] text-right">
            <span className="text-[12px] text-app-dark/60 font-medium tabular-nums font-mono">
              {formatTime(displayTime)} / {formatTime(displayDuration)}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-1 ${isLegacy ? '' : 'md:grid-cols-2'} gap-4`}>
        {/* Orijinal Panel */}
        <div className="relative rounded-xl border border-app-gray bg-white p-4 space-y-3 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-app-gray-text uppercase tracking-widest">
              {isLegacy ? (label || "Orijinal Ses") : "Orijinal Ses"}
            </span>
            {originalStatus === 'error' && (
              <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded">Yüklenemedi</span>
            )}
          </div>
          <div className="relative min-h-[120px] rounded-lg overflow-hidden bg-app-gray/10">
            {originalStatus === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                <svg className="w-6 h-6 animate-spin text-app-orange mb-2" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            )}
            <div ref={originalContainerRef} className="w-full h-full" />
          </div>
        </div>

        {/* Temizlenmiş Panel (sadece legacy değilse göster) */}
        {!isLegacy && (
          <div className={`relative rounded-xl border border-app-gray bg-white p-4 space-y-3 overflow-hidden shadow-sm transition-opacity ${!hasCleaned ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-app-gray-text uppercase tracking-widest">Temizlenmiş Ses</span>
              {cleanedStatus === 'error' && (
                <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded">Yüklenemedi</span>
              )}
            </div>
            
            {hasCleaned ? (
              <div className="relative min-h-[120px] rounded-lg overflow-hidden bg-app-gray/10">
                {cleanedStatus === 'loading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
                    <svg className="w-6 h-6 animate-spin text-app-orange mb-2" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
                <div ref={cleanedContainerRef} className="w-full h-full" />
              </div>
            ) : (
              <div className="relative min-h-[120px] rounded-lg overflow-hidden bg-[#F9F9F9] border border-dashed border-[#E5E5E5] flex flex-col items-center justify-center text-center p-4">
                <span className="text-[13px] font-semibold text-[#888]">Henüz temizlenmiş ses yok</span>
                <span className="text-[11px] text-[#BBBBBB] mt-1">İşlem tamamlanınca karşılaştırma aktif olur.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-app-gray-text text-center mt-2 px-4">
        Dalga formu sesin zaman içindeki şiddetini gösterir. Frekans detayları için <strong>Spektrogram</strong> sekmesini kullanın.
      </p>
    </div>
  );
}
