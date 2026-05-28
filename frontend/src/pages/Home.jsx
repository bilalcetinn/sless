import useStore from '../store/useStore';
import { uploadAudio, processAudio, getStatus } from '../api/client';

import Navbar from '../components/Navbar';
import ModelSelector from '../components/ModelSelector';
import AudioUploader from '../components/AudioUploader';
import ProcessingStatus from '../components/ProcessingStatus';
import AudioComparison from '../components/AudioComparison';
import SpectrogramView from '../components/SpectrogramView';
import ThreeDSpectro from '../components/ThreeDSpectro';
import HistoryPanel from '../components/HistoryPanel';
import ModelComparison from '../components/ModelComparison';
import AuthModal from '../components/AuthModal';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function Home() {
  const {
    uploadedFile,
    selectedModelId,
    token,
    activeView,
    activeTab,
    processingStatus,
    user,
    setActiveView,
    setActiveTab,
    setProcessingStatus,
    setProcessingStep,
    setUploadProgress,
    setRecordId,
    setOriginalAudioUrl,
    setCleanedAudioUrl,
  } = useStore();

  async function handleClean() {
    if (!uploadedFile) {
      alert('Lütfen bir ses dosyası yükleyin.');
      return;
    }
    if (!selectedModelId) {
      alert('Lütfen bir model seçin.');
      return;
    }

    try {
      // Yükleme
      setProcessingStatus('uploading');
      setProcessingStep('Dosya yükleniyor...');
      setUploadProgress(0);

      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('model_id', selectedModelId);
      formData.append('noise_level', 100);
      formData.append('filter_sensitivity', 0);
      if (token) formData.append('token', token);

      const uploadResult = await uploadAudio(formData, (pct) => {
        setUploadProgress(pct);
      });

      const recordId = uploadResult.record_id;
      setRecordId(recordId);
      setOriginalAudioUrl(`http://localhost:8000/files/${uploadResult.original_file}`);

      // Ön işleme
      setProcessingStatus('processing');
      setProcessingStep('Ön işleme uygulanıyor...');
      await delay(1500);

      // Model
      setProcessingStep('Model çalışıyor...');
      await processAudio(recordId);

      // Polling
      setProcessingStep('Çıktı hazırlanıyor...');
      let done = false;
      let attempts = 0;
      while (!done && attempts < 30) {
        await delay(2000);
        attempts++;
        try {
          const statusResult = await getStatus(recordId);
          if (statusResult.status === 'done') {
            setCleanedAudioUrl(`http://localhost:8000/files/${statusResult.cleaned_file_path}`);
            setProcessingStatus('done');
            setActiveView('waveform');
            done = true;
          } else if (statusResult.status === 'error') {
            setProcessingStatus('error');
            alert('İşlem sırasında hata oluştu. Lütfen tekrar deneyin.');
            done = true;
          }
        } catch (pollErr) {
          console.error('Polling hatası:', pollErr);
        }
      }

      if (!done) {
        setProcessingStatus('error');
        alert('İşlem zaman aşımına uğradı.');
      }
    } catch (err) {
      console.error('İşlem hatası:', err);
      setProcessingStatus('error');
      const msg = err.response?.data?.detail || 'Bir hata oluştu. Lütfen tekrar deneyin.';
      alert(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  // Tab tanımları
  const tabs = [
    { key: 'main', label: 'Ses Temizle', icon: '🎙' },
    { key: 'compare', label: 'Model Karşılaştır', icon: '⚖' },
  ];
  if (user) {
    tabs.push({ key: 'history', label: 'Geçmişim', icon: '📋' });
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F9F9F9' }}>
      <Navbar />
      <AuthModal />

      {/* Hero Bölümü */}
      <section style={{ textAlign: 'center', padding: '56px 0 40px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>
          {/* Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: '#FEE8DC',
              color: '#FA5D19',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '20px',
              border: '1px solid rgba(250,93,25,0.2)',
            }}
          >
            <span style={{ width: '6px', height: '6px', background: '#FA5D19', borderRadius: '50%', display: 'inline-block' }} />
            AI DESTEKLİ SES TEMİZLEME
          </div>

          {/* Ana Başlık */}
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'clamp(36px, 4vw, 58px)',
              fontWeight: 800,
              lineHeight: 1.1,
              color: '#262626',
              marginBottom: '16px',
              marginTop: 0,
            }}
          >
            Türkçe Sesini <span style={{ color: '#FA5D19' }}>Temizle</span>
          </h1>

          {/* Alt Başlık */}
          <p
            style={{
              fontSize: '17px',
              color: '#888888',
              maxWidth: '500px',
              margin: '0 auto',
              lineHeight: 1.7,
            }}
          >
            Yapay zeka destekli gürültü giderme teknolojisi ile konuşma kalitesini artırın
          </p>
        </div>
      </section>

      {/* Sekme Seçici */}
      <div style={{ maxWidth: '1280px', margin: '32px auto 24px', padding: '0 24px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ background: '#EFEFEF', borderRadius: '12px', padding: '4px', display: 'inline-flex', gap: '2px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 24px',
                borderRadius: '9px',
                border: 'none',
                fontWeight: activeTab === tab.key ? 600 : 500,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.key ? '#262626' : '#888',
                boxShadow: activeTab === tab.key ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: "'Inter', sans-serif",
              }}
              id={`tab-${tab.key}`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ana İçerik */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px 80px' }}>

        {/* Ses Temizle Sekmesi */}
        {activeTab === 'main' && (
          <div
            className="animate-fade-in"
            style={{
              display: 'grid',
              gridTemplateColumns: '480px 1fr',
              gap: '24px',
              alignItems: 'start',
            }}
          >
            {/* ══ Sol Kolon — Kontroller ══ */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Model Seçimi Kartı */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F0F0F0',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <ModelSelector />
              </div>

              {/* Ses Dosyası Kartı */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #F0F0F0',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}
              >
                <AudioUploader />
              </div>

              {/* Sesi Temizle Butonu */}
              <button
                onClick={handleClean}
                disabled={processingStatus === 'uploading' || processingStatus === 'processing'}
                style={{
                  width: '100%',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  background: 'linear-gradient(135deg, #FA5D19 0%, #FF7A40 100%)',
                  borderRadius: '14px',
                  padding: '16px',
                  fontSize: '16px',
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  boxShadow: '0 4px 20px rgba(250,93,25,0.35)',
                  border: 'none',
                  cursor: (processingStatus === 'uploading' || processingStatus === 'processing') ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  opacity: (processingStatus === 'uploading' || processingStatus === 'processing') ? 0.5 : 1,
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                id="clean-audio-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 11a7 7 0 01-14 0M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
                  <rect x="9" y="1" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
                </svg>
                Sesi Temizle
              </button>

              {/* İşlem Durumu */}
              <ProcessingStatus />
            </div>

            {/* ══ Sağ Kolon — Görselleştirme ══ */}
            <div>
              {/* Görünüm Sekmeleri */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'inline-flex', background: '#F5F5F5', borderRadius: '10px', padding: '4px' }}>
                  {[
                    { key: 'waveform', label: 'Dalga Formu', icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 12h2l3-9 4 18 4-12 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )},
                    { key: 'spectrogram', label: 'Spektrogram', icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <path d="M3 12h18M12 3v18" />
                      </svg>
                    )},
                    { key: '3d', label: '3D Görünüm', icon: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )},
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveView(tab.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: activeView === tab.key ? '#262626' : 'transparent',
                        color: activeView === tab.key ? '#FFFFFF' : '#888888',
                        fontFamily: "'Inter', sans-serif",
                      }}
                      id={`view-${tab.key}`}
                    >
                      {tab.icon}
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Aktif Görünüm */}
              <div style={{ minHeight: '400px' }}>
                {activeView === 'waveform' && <AudioComparison />}
                {activeView === 'spectrogram' && <SpectrogramView />}
                {activeView === '3d' && <ThreeDSpectro />}
              </div>
            </div>
          </div>
        )}

        {/* Model Karşılaştır Sekmesi */}
        {activeTab === 'compare' && <ModelComparison />}

        {/* Geçmişim Sekmesi */}
        {activeTab === 'history' && user && <HistoryPanel />}
      </div>

      {/* Footer */}
      <footer style={{ background: '#262626', padding: '20px 32px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: '1280px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h3l3-9 5 18 5-18 3 9h3" />
            </svg>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 800 }}>
              <span style={{ color: '#FA5D19' }}>S</span>
              <span style={{ color: '#FFFFFF' }}>LESS</span>
            </span>
          </div>
          <p style={{ color: '#888888', fontSize: '13px', margin: 0 }}>
            Türkçe ses gürültü giderme uygulaması
          </p>
        </div>
      </footer>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 1024px) {
          [style*="grid-template-columns: 480px 1fr"] {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 768px) {
          [style*="grid-template-columns: 480px 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
