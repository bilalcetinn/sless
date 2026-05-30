import WaveformViewer from './WaveformViewer';
import DifferenceAnalysis from './DifferenceAnalysis';
import useStore from '../store/useStore';

export default function AudioComparison() {
  const { originalAudioUrl, cleanedAudioUrl } = useStore();


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
      {/* Waveform Viewer */}
      <WaveformViewer />

      {/* Fark Analizi */}
      <DifferenceAnalysis
        originalUrl={originalAudioUrl}
        cleanedUrl={cleanedAudioUrl}
      />
    </div>
  );
}
