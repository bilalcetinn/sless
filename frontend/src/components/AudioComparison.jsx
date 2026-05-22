import { useState, useRef, useCallback } from 'react';
import WaveformViewer from './WaveformViewer';
import useStore from '../store/useStore';
import { downloadAudio } from '../api/client';

export default function AudioComparison() {
  const { originalAudioUrl, cleanedAudioUrl, recordId, comparisonMode, setComparisonMode } = useStore();
  const [dividerPos, setDividerPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMouseDown = useCallback(() => setIsDragging(true), []);
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setDividerPos(Math.max(10, Math.min(90, (x / rect.width) * 100)));
  }, [isDragging]);

  const handleTouchMove = useCallback((e) => {
    if (!isDragging || !containerRef.current) return;
    const touch = e.touches[0];
    const rect = containerRef.current.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    setDividerPos(Math.max(10, Math.min(90, (x / rect.width) * 100)));
  }, [isDragging]);

  async function handleDownload() {
    if (!recordId) return;
    try {
      await downloadAudio(recordId);
    } catch (err) {
      alert('İndirme sırasında hata oluştu.');
    }
  }

  // Ses dosyası yoksa boş durum göster
  if (!originalAudioUrl && !cleanedAudioUrl) {
    return (
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: '20px',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #FFF5F0, #FEE8DC)',
            border: '2px solid rgba(250,93,25,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '20px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h3l3-9 5 18 5-18 3 9h3" />
          </svg>
        </div>
        <p style={{ fontWeight: 700, color: '#262626', fontSize: '18px', margin: 0 }}>Ses Bekleniyor</p>
        <p style={{ fontSize: '14px', color: '#AAAAAA', marginTop: '8px', maxWidth: '240px' }}>
          Sol panelden bir ses dosyası yükleyin ve "Sesi Temizle" butonuna basın
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '20px',
        padding: '24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Üst Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        {/* Toggle */}
        <div style={{ background: '#F5F5F5', borderRadius: '8px', padding: '4px', display: 'inline-flex' }}>
          <button
            onClick={() => setComparisonMode('original')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: comparisonMode === 'original' ? '#FFFFFF' : 'transparent',
              color: comparisonMode === 'original' ? '#262626' : '#888',
              boxShadow: comparisonMode === 'original' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Orijinal
          </button>
          <button
            onClick={() => setComparisonMode('cleaned')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: comparisonMode === 'cleaned' ? '#FFFFFF' : 'transparent',
              color: comparisonMode === 'cleaned' ? '#262626' : '#888',
              boxShadow: comparisonMode === 'cleaned' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Temizlenmiş
          </button>
        </div>

        {/* İndir Butonu */}
        {cleanedAudioUrl && recordId && (
          <button
            onClick={handleDownload}
            style={{
              background: '#FA5D19',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#FF7A40'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#FA5D19'; }}
            id="download-cleaned-btn"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            İndir
          </button>
        )}
      </div>

      {/* Waveform */}
      <WaveformViewer
        audioUrl={comparisonMode === 'original' ? originalAudioUrl : cleanedAudioUrl}
        label={comparisonMode === 'original' ? 'Orijinal Ses' : 'Temizlenmiş Ses'}
      />

      {/* Karşılaştırma Slider */}
      {originalAudioUrl && cleanedAudioUrl && (
        <div
          ref={containerRef}
          className="select-none"
          style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#F9F9F9',
            minHeight: '120px',
            height: '180px',
            marginTop: '20px',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
        >
          {/* Sol (Orijinal) */}
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${dividerPos}%`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '12px', left: '16px', zIndex: 10 }}>
              <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, background: 'rgba(38,38,38,0.8)', color: 'white', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>Orijinal</span>
            </div>
            <div style={{ height: '100%', background: 'linear-gradient(to bottom, #EFF6FF, #DBEAFE)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '60%' }}>
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} style={{ width: '3px', background: 'rgba(96,165,250,0.7)', borderRadius: '2px', height: `${20 + Math.random() * 60}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Sağ (Temizlenmiş) */}
          <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: `${100 - dividerPos}%`, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '12px', right: '16px', zIndex: 10 }}>
              <span style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 700, background: 'rgba(250,93,25,0.9)', color: 'white', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>Temizlenmiş</span>
            </div>
            <div style={{ height: '100%', background: 'linear-gradient(to bottom, #FFF7ED, #FFEDD5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'end', gap: '2px', height: '60%' }}>
                {Array.from({ length: 50 }).map((_, i) => (
                  <div key={i} style={{ width: '3px', background: 'rgba(250,93,25,0.6)', borderRadius: '2px', height: `${15 + Math.random() * 40}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${dividerPos}%`,
              transform: 'translateX(-50%)',
              zIndex: 20,
              cursor: 'col-resize',
            }}
            onMouseDown={handleMouseDown}
            onTouchStart={handleMouseDown}
          >
            <div style={{ width: '2px', height: '100%', background: '#FA5D19' }} />
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '28px',
                height: '28px',
                background: '#FA5D19',
                borderRadius: '50%',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(250,93,25,0.4)',
                cursor: 'col-resize',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M4 3L1 7l3 4M10 3l3 4-3 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
