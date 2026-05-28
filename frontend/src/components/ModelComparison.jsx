import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { fetchModels, processWithModel, uploadAudio } from '../api/client';
import WaveformViewer from './WaveformViewer';
import AudioUploader from './AudioUploader';
import ProcessingStatus from './ProcessingStatus';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function ModelComparison() {
  const {
    recordId,
    models,
    setModels,
    uploadedFile,
    token,
    setRecordId,
    setOriginalAudioUrl,
    setProcessingStatus,
    setProcessingStep,
    setUploadProgress,
    processingStatus,
  } = useStore();

  const [leftModelId, setLeftModelId] = useState(null);
  const [leftOpen, setLeftOpen] = useState(false);
  const [leftResult, setLeftResult] = useState(null);
  const [leftLoading, setLeftLoading] = useState(false);
  const [leftError, setLeftError] = useState(false);

  const [rightModelId, setRightModelId] = useState(null);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightResult, setRightResult] = useState(null);
  const [rightLoading, setRightLoading] = useState(false);
  const [rightError, setRightError] = useState(false);

  const leftDropdownRef = useRef(null);
  const rightDropdownRef = useRef(null);

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await fetchModels();
        setModels(data);
        if (data.length > 0) {
          setLeftModelId((cur) => cur || data[0]?.id || null);
          setRightModelId((cur) => cur || data[1]?.id || data[0]?.id || null);
        }
      } catch (err) {
        console.error('Modeller yüklenemedi:', err);
      }
    }
    loadModels();
  }, [setModels]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (leftDropdownRef.current && !leftDropdownRef.current.contains(e.target)) {
        setLeftOpen(false);
      }
      if (rightDropdownRef.current && !rightDropdownRef.current.contains(e.target)) {
        setRightOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleCompare() {
    if (!uploadedFile) {
      alert('Lütfen karşılaştırmak için bir ses dosyası seçin/yükleyin.');
      return;
    }
    if (!leftModelId || !rightModelId) {
      alert('Lütfen karşılaştırmak için iki model seçin.');
      return;
    }

    setLeftResult(null);
    setRightResult(null);
    setLeftError(false);
    setRightError(false);

    try {
      let currentRecordId = recordId;

      // 1. Eğer recordId yoksa (yeni ses dosyası yüklendiyse), önce yükleme işlemini başlat
      if (!currentRecordId) {
        setProcessingStatus('uploading');
        setProcessingStep('Dosya yükleniyor...');
        setUploadProgress(0);

        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('model_id', leftModelId);
        formData.append('noise_level', 100);
        formData.append('filter_sensitivity', 0);
        if (token) formData.append('token', token);

        const uploadResult = await uploadAudio(formData, (pct) => {
          setUploadProgress(pct);
        });

        currentRecordId = uploadResult.record_id;
        setRecordId(currentRecordId);
        setOriginalAudioUrl(`http://localhost:8000/files/${uploadResult.original_file}`);
      }

      // 2. Ön işleme adımı
      setProcessingStatus('processing');
      setProcessingStep('Ön işleme uygulanıyor...');
      await delay(1500);

      // 3. Model çalışıyor adımı
      setProcessingStep('Model çalışıyor...');

      const processLeft = async () => {
        try {
          setLeftLoading(true);
          const result = await processWithModel(currentRecordId, leftModelId, 100, 0);
          return {
            modelName: result.model_name,
            cleanedAudioUrl: `http://localhost:8000/files/${result.cleaned_file_path}`,
          };
        } catch (err) {
          console.error('Model işlenirken hata:', err);
          setLeftError(true);
          return null;
        } finally {
          setLeftLoading(false);
        }
      };

      const processRight = async () => {
        try {
          setRightLoading(true);
          const result = await processWithModel(currentRecordId, rightModelId, 100, 0);
          return {
            modelName: result.model_name,
            cleanedAudioUrl: `http://localhost:8000/files/${result.cleaned_file_path}`,
          };
        } catch (err) {
          console.error('Model işlenirken hata:', err);
          setRightError(true);
          return null;
        } finally {
          setRightLoading(false);
        }
      };

      const [resLeft, resRight] = await Promise.all([processLeft(), processRight()]);

      if (resLeft) setLeftResult(resLeft);
      if (resRight) setRightResult(resRight);

      // 4. Çıktı hazırlanıyor adımı
      setProcessingStep('Çıktı hazırlanıyor...');
      await delay(1000);
      setProcessingStatus('done');

    } catch (err) {
      console.error('Karşılaştırma hatası:', err);
      setProcessingStatus('error');
      alert('Karşılaştırma sırasında bir hata oluştu.');
    }
  }

  const leftSelectedModel = models.find((m) => m.id === leftModelId);
  const rightSelectedModel = models.find((m) => m.id === rightModelId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      {/* Title */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#262626', fontFamily: "'Space Grotesk', sans-serif", margin: 0 }}>Model Karşılaştırma</h2>
        <p style={{ fontSize: '14px', color: '#888888', margin: 0 }}>
          Seçtiğiniz iki farklı yapay zeka modelinin sonuçlarını doğrudan kıyaslayın
        </p>
      </div>

      {/* Audio Uploader Section */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
      }}>
        <AudioUploader />
      </div>

      {/* Control Card */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        maxWidth: '960px',
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Dropdowns side-by-side */}
        <div className="model-compare-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* First Selector */}
          <div style={{ position: 'relative' }} ref={leftDropdownRef}>
            <button
              onClick={() => setLeftOpen(!leftOpen)}
              style={{
                width: '100%',
                background: '#FAFAFA',
                border: leftOpen ? '1.5px solid #FA5D19' : '1.5px solid #E5E5E5',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!leftOpen) { e.currentTarget.style.borderColor = '#FA5D19'; e.currentTarget.style.background = '#FFFFFF'; } }}
              onMouseLeave={(e) => { if (!leftOpen) { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.background = '#FAFAFA'; } }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  background: '#FFF5F0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="#FA5D19" strokeWidth="1.5" fill="none" />
                  <circle cx="8" cy="8" r="2" fill="#FA5D19" />
                </svg>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#262626', margin: 0 }}>
                  {leftSelectedModel ? leftSelectedModel.name : 'Model seçin'}
                </p>
                {leftSelectedModel?.description && (
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {leftSelectedModel.description}
                  </p>
                )}
              </div>

              {/* Chevron */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#AAAAAA"
                strokeWidth="2"
                style={{
                  transition: 'transform 0.2s',
                  transform: leftOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown Overlay */}
            {leftOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: '#FFFFFF',
                  border: '1px solid #F0F0F0',
                  borderRadius: '14px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  zIndex: 10,
                }}
              >
                {models.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '14px', color: '#AAAAAA' }}>
                    Henüz model eklenmemiş
                  </div>
                ) : (
                  <div style={{ maxHeight: '256px', overflowY: 'auto' }}>
                    {models.map((model, idx) => (
                      <div key={model.id}>
                        <div
                          onClick={() => { setLeftModelId(model.id); setLeftOpen(false); setLeftResult(null); setLeftError(false); }}
                          style={{
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            background: leftModelId === model.id ? '#FFF5F0' : 'transparent',
                            borderLeft: leftModelId === model.id ? '3px solid #FA5D19' : '3px solid transparent',
                          }}
                          onMouseEnter={(e) => { if (leftModelId !== model.id) e.currentTarget.style.background = '#FFF9F7'; }}
                          onMouseLeave={(e) => { if (leftModelId !== model.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '14px', color: '#262626', margin: 0 }}>{model.name}</p>
                            {model.description && (
                              <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.description}</p>
                            )}
                          </div>
                        </div>
                        {idx < models.length - 1 && <div style={{ height: '1px', background: '#F5F5F5', margin: '0 16px' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Second Selector */}
          <div style={{ position: 'relative' }} ref={rightDropdownRef}>
            <button
              onClick={() => setRightOpen(!rightOpen)}
              style={{
                width: '100%',
                background: '#FAFAFA',
                border: rightOpen ? '1.5px solid #FA5D19' : '1.5px solid #E5E5E5',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => { if (!rightOpen) { e.currentTarget.style.borderColor = '#FA5D19'; e.currentTarget.style.background = '#FFFFFF'; } }}
              onMouseLeave={(e) => { if (!rightOpen) { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.background = '#FAFAFA'; } }}
            >
              {/* Icon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  background: '#FFF5F0',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="#FA5D19" strokeWidth="1.5" fill="none" />
                  <circle cx="8" cy="8" r="2" fill="#FA5D19" />
                </svg>
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: '15px', color: '#262626', margin: 0 }}>
                  {rightSelectedModel ? rightSelectedModel.name : 'Model seçin'}
                </p>
                {rightSelectedModel?.description && (
                  <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {rightSelectedModel.description}
                  </p>
                )}
              </div>

              {/* Chevron */}
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#AAAAAA"
                strokeWidth="2"
                style={{
                  transition: 'transform 0.2s',
                  transform: rightOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  flexShrink: 0,
                }}
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown Overlay */}
            {rightOpen && (
              <div
                className="animate-fade-in"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: '#FFFFFF',
                  border: '1px solid #F0F0F0',
                  borderRadius: '14px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  overflow: 'hidden',
                  zIndex: 10,
                }}
              >
                {models.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '14px', color: '#AAAAAA' }}>
                    Henüz model eklenmemiş
                  </div>
                ) : (
                  <div style={{ maxHeight: '256px', overflowY: 'auto' }}>
                    {models.map((model, idx) => (
                      <div key={model.id}>
                        <div
                          onClick={() => { setRightModelId(model.id); setRightOpen(false); setRightResult(null); setRightError(false); }}
                          style={{
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            cursor: 'pointer',
                            transition: 'background 0.15s',
                            background: rightModelId === model.id ? '#FFF5F0' : 'transparent',
                            borderLeft: rightModelId === model.id ? '3px solid #FA5D19' : '3px solid transparent',
                          }}
                          onMouseEnter={(e) => { if (rightModelId !== model.id) e.currentTarget.style.background = '#FFF9F7'; }}
                          onMouseLeave={(e) => { if (rightModelId !== model.id) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: '14px', color: '#262626', margin: 0 }}>{model.name}</p>
                            {model.description && (
                              <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.description}</p>
                            )}
                          </div>
                        </div>
                        {idx < models.length - 1 && <div style={{ height: '1px', background: '#F5F5F5', margin: '0 16px' }} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compare Button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
          <button
            onClick={handleCompare}
            disabled={processingStatus === 'uploading' || processingStatus === 'processing' || !leftModelId || !rightModelId}
            style={{
              minWidth: '220px',
              color: 'white',
              background: 'linear-gradient(135deg, #FA5D19 0%, #FF7A40 100%)',
              borderRadius: '12px',
              padding: '14px 32px',
              fontSize: '15px',
              fontWeight: 700,
              border: 'none',
              cursor: (processingStatus === 'uploading' || processingStatus === 'processing' || !leftModelId || !rightModelId) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(250,93,25,0.25)',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => { if (processingStatus !== 'uploading' && processingStatus !== 'processing' && leftModelId && rightModelId) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { if (processingStatus !== 'uploading' && processingStatus !== 'processing' && leftModelId && rightModelId) e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {processingStatus === 'uploading' || processingStatus === 'processing' ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                Karşılaştırılıyor...
              </>
            ) : (
              'Karşılaştır'
            )}
          </button>
        </div>

        {/* Timeline (ProcessingStatus) */}
        <div style={{ marginTop: '24px' }}>
          <ProcessingStatus />
        </div>
      </div>

      {/* Results View Section */}
      <div className="model-compare-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Side Result Panel */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          minHeight: '220px',
        }}>
          {leftLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '170px', gap: '12px' }}>
              <svg className="w-8 h-8 animate-spin text-app-orange" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p style={{ fontSize: '13px', color: '#888888', fontWeight: 500 }}>Temizleniyor...</p>
            </div>
          )}

          {leftError && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#EF4444' }}>
              <p style={{ fontWeight: 600 }}>İşlem başarısız oldu.</p>
            </div>
          )}

          {leftResult && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FA5D19', fontSize: '14px', fontWeight: 700 }}>
                <span style={{ width: '6px', height: '6px', background: '#FA5D19', borderRadius: '50%', display: 'inline-block' }} />
                {leftSelectedModel?.name} Sonucu
              </div>
              <WaveformViewer audioUrl={leftResult.cleanedAudioUrl} label={leftResult.modelName} />
            </div>
          )}

          {!leftLoading && !leftResult && !leftError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '170px', color: '#AAAAAA', gap: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13M9 10l12-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ fontSize: '13px', fontWeight: 500 }}>İlk model sonucunu görmek için karşılaştırın</p>
            </div>
          )}
        </div>

        {/* Right Side Result Panel */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          minHeight: '220px',
        }}>
          {rightLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '170px', gap: '12px' }}>
              <svg className="w-8 h-8 animate-spin text-app-orange" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <p style={{ fontSize: '13px', color: '#888888', fontWeight: 500 }}>Temizleniyor...</p>
            </div>
          )}

          {rightError && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#EF4444' }}>
              <p style={{ fontWeight: 600 }}>İşlem başarısız oldu.</p>
            </div>
          )}

          {rightResult && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FA5D19', fontSize: '14px', fontWeight: 700 }}>
                <span style={{ width: '6px', height: '6px', background: '#FA5D19', borderRadius: '50%', display: 'inline-block' }} />
                {rightSelectedModel?.name} Sonucu
              </div>
              <WaveformViewer audioUrl={rightResult.cleanedAudioUrl} label={rightResult.modelName} />
            </div>
          )}

          {!rightLoading && !rightResult && !rightError && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '170px', color: '#AAAAAA', gap: '8px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 19V6l12-3v13M9 10l12-3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p style={{ fontSize: '13px', fontWeight: 500 }}>İkinci model sonucunu görmek için karşılaştırın</p>
            </div>
          )}
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .model-compare-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
