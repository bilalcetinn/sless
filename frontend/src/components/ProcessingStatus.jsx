import useStore from '../store/useStore';

const STEPS = [
  { key: 'upload', label: 'Dosya yükleniyor...' },
  { key: 'preprocess', label: 'Ön işleme uygulanıyor...' },
  { key: 'model', label: 'Model çalışıyor...' },
  { key: 'output', label: 'Çıktı hazırlanıyor...' },
];

function getStepIndex(step) {
  if (step.includes('yükleniyor')) return 0;
  if (step.includes('Ön işleme')) return 1;
  if (step.includes('Model')) return 2;
  if (step.includes('Çıktı')) return 3;
  return -1;
}

export default function ProcessingStatus() {
  const { processingStatus, processingStep, uploadProgress } = useStore();

  if (processingStatus === 'idle' || processingStatus === 'done') return null;

  const currentIdx = getStepIndex(processingStep);

  // Toplam progress hesapla
  let totalProgress = 0;
  if (currentIdx === 0) totalProgress = uploadProgress * 0.25;
  else if (currentIdx === 1) totalProgress = 25 + 25 * 0.5;
  else if (currentIdx === 2) totalProgress = 50 + 25 * 0.5;
  else if (currentIdx === 3) totalProgress = 75 + 25 * 0.5;

  return (
    <div
      className="animate-fade-in"
      style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '16px',
        padding: '20px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}
    >
      {/* Aşamalar */}
      <div>
        {STEPS.map((step, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;

          return (
            <div
              key={step.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 0',
                borderBottom: idx < STEPS.length - 1 ? '1px solid #F5F5F5' : 'none',
              }}
            >
              {/* İkon */}
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: isComplete ? '#F0FFF4' : isCurrent ? '#FFF5F0' : '#F5F5F5',
                  animation: isCurrent ? 'pulse 2s ease-in-out infinite' : 'none',
                }}
              >
                {isComplete ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isCurrent ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2">
                    {step.key === 'upload' && <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" /><path d="M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" /></>}
                    {step.key === 'preprocess' && <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>}
                    {step.key === 'model' && <><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" /></>}
                    {step.key === 'output' && <><path d="M22 11.08V12a10 10 0 11-5.93-9.14" strokeLinecap="round" /><path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" /></>}
                  </svg>
                ) : (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#BBBBBB' }} />
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: isComplete ? '#22C55E' : isCurrent ? '#262626' : '#BBBBBB',
                  textDecoration: isComplete ? 'line-through' : 'none',
                  flex: 1,
                }}
              >
                {step.label}
              </span>

              {/* Sağ taraf */}
              {isCurrent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {step.key === 'upload' && uploadProgress > 0 && (
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#FA5D19' }}>{uploadProgress}%</span>
                  )}
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#FA5D19' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                    <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              {isComplete && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          );
        })}
      </div>

      {/* Genel Progress Bar */}
      <div
        style={{
          height: '4px',
          borderRadius: '2px',
          background: '#EEEEEE',
          marginTop: '16px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: '2px',
            background: 'linear-gradient(90deg, #FA5D19, #FF7A40)',
            transition: 'width 0.5s ease',
            width: `${totalProgress}%`,
          }}
        />
      </div>

      {/* Hata durumu */}
      {processingStatus === 'error' && (
        <div
          style={{
            marginTop: '12px',
            background: '#FFF0F0',
            border: '1px solid #FFD0D0',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#D32F2F',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          İşlem sırasında hata oluştu. Lütfen tekrar deneyin.
        </div>
      )}
    </div>
  );
}
