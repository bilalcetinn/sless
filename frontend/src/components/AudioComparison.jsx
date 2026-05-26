import WaveformViewer from './WaveformViewer';
import useStore from '../store/useStore';
import { downloadAudio } from '../api/client';

export default function AudioComparison() {
  const { originalAudioUrl, cleanedAudioUrl, recordId } = useStore();

  async function handleDownload() {
    if (!recordId) return;
    try {
      await downloadAudio(recordId);
    } catch (err) {
      console.error('İndirme sırasında hata oluştu:', err);
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
      {cleanedAudioUrl && recordId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          {/* İndir Butonu */}
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
            Temizlenmiş Sesi İndir
          </button>
        </div>
      )}

      {/* Waveform Viewer */}
      <WaveformViewer />
    </div>
  );
}
