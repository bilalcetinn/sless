import { useEffect, useMemo, useState } from 'react';
import useStore from '../store/useStore';
import { deleteHistoryRecord, getHistory } from '../api/client';
import WaveformViewer from './WaveformViewer';
import SpectrogramView from './SpectrogramView';
import ThreeDSpectro from './ThreeDSpectro';
import { useAppDialog } from './appDialogContext';

const API_BASE = 'http://localhost:8000';

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status) {
  const config = {
    pending: { bg: '#FFFBEB', color: '#D97706', label: 'Bekliyor' },
    processing: { bg: '#EFF6FF', color: '#2563EB', label: 'İşleniyor' },
    done: { bg: '#F0FFF4', color: '#16A34A', label: 'Tamamlandı' },
    error: { bg: '#FFF1F2', color: '#E11D48', label: 'Hata' },
  };
  const c = config[status] || { bg: '#F5F5F5', color: '#888', label: status };
  return (
    <span
      style={{
        background: c.bg,
        color: c.color,
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

function buildFileUrl(path) {
  return path ? `${API_BASE}/files/${path}` : null;
}

export default function HistoryPanel({ showHeader = true }) {
  const { showAlert, showConfirm } = useAppDialog();
  const { user } = useStore();
  const [records, setRecords] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeView, setActiveView] = useState('waveform');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      loadHistory();
    }
  }, [user]);

  async function loadHistory() {
    try {
      setLoading(true);
      setError('');
      const data = await getHistory();
      setRecords(data);
      setSelectedId((currentId) => {
        if (data.some((record) => record.id === currentId && record.status === 'done')) {
          return currentId;
        }
        return data.find((record) => record.status === 'done')?.id || null;
      });
    } catch {
      setError('Geçmiş yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecord(record) {
    try {
      await deleteHistoryRecord(record.id);
      const nextRecords = records.filter((item) => item.id !== record.id);
      setRecords(nextRecords);
      if (selectedId === record.id) {
        const nextDone = nextRecords.find((item) => item.status === 'done');
        setSelectedId(nextDone?.id || null);
        setActiveView('waveform');
      }
    } catch {
      showAlert({ title: 'Silme başarısız', message: 'Geçmiş kaydı silinemedi.', variant: 'danger' });
    }
  }

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) || null,
    [records, selectedId]
  );

  const selectedOriginalUrl = buildFileUrl(selectedRecord?.original_file_path);
  const selectedCleanedUrl = buildFileUrl(selectedRecord?.cleaned_file_path);

  if (!user) return null;

  const viewTabs = [
    {
      key: 'waveform',
      label: 'Dalga Formu',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12h2l3-9 4 18 4-12 3 6h4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      key: 'spectrogram',
      label: 'Spektrogram',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 12h18M12 3v18" />
        </svg>
      ),
    },
    {
      key: '3d',
      label: '3D Görünüm',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div style={{ padding: showHeader ? '24px 0' : 0, display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: '#262626', margin: 0 }}>
            İşlem Geçmişi
          </h2>
          <button
            onClick={loadHistory}
            style={{
              background: 'transparent',
              border: '1.5px solid #FA5D19',
              color: '#FA5D19',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Yenile
          </button>
        </div>
      )}

      {!showHeader && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={loadHistory}
            style={{
              background: '#FFF5F0',
              border: '1.5px solid rgba(250,93,25,0.25)',
              color: '#FA5D19',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Yenile
          </button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #F0F0F0' }}>
              <div className="skeleton" style={{ height: '16px', width: '75%', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '12px', width: '50%', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '12px', width: '33%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', color: '#D32F2F', fontSize: '13px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      {!loading && records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#262626', margin: 0 }}>Henüz işlem geçmişiniz yok</p>
          <p style={{ fontSize: '13px', color: '#AAAAAA', marginTop: '6px' }}>Ses temizle sekmesinden başlayın</p>
        </div>
      )}

      {!loading && records.length > 0 && selectedRecord && (
        <section
          style={{
            background: '#FFFFFF',
            border: '1px solid #F0F0F0',
            borderRadius: '18px',
            padding: '22px',
            boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div>
              <p style={{ margin: 0, color: '#FA5D19', fontSize: '13px', fontWeight: 800 }}>
                {selectedRecord.model_name || 'Bilinmeyen Model'}
              </p>
              <p style={{ margin: '4px 0 0', color: '#888888', fontSize: '13px', fontWeight: 500 }}>
                {formatDate(selectedRecord.created_at)}
              </p>
            </div>

            <div style={{ display: 'inline-flex', background: '#F5F5F5', borderRadius: '10px', padding: '4px', gap: '3px' }}>
              {viewTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveView(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '7px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: activeView === tab.key ? '#262626' : 'transparent',
                    color: activeView === tab.key ? '#FFFFFF' : '#888888',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {activeView === 'waveform' && (
            <WaveformViewer
              originalUrl={selectedOriginalUrl}
              cleanedUrl={selectedCleanedUrl}
              title="Dalga Formu Karşılaştırması"
            />
          )}
          {activeView === 'spectrogram' && (
            <SpectrogramView
              originalUrl={selectedOriginalUrl}
              cleanedUrl={selectedCleanedUrl}
            />
          )}
          {activeView === '3d' && (
            <ThreeDSpectro
              originalUrl={selectedOriginalUrl}
              cleanedUrl={selectedCleanedUrl}
              status="done"
            />
          )}
        </section>
      )}

      {!loading && records.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {records.map((record) => {
            const isSelected = record.id === selectedId;
            const isDone = record.status === 'done';
            return (
              <div
                key={record.id}
                role="button"
                tabIndex={isDone ? 0 : -1}
                onClick={() => {
                  if (!isDone) return;
                  setSelectedId(record.id);
                  setActiveView('waveform');
                }}
                onKeyDown={(event) => {
                  if (!isDone) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedId(record.id);
                    setActiveView('waveform');
                  }
                }}
                style={{
                  background: isSelected ? '#FFF9F7' : '#FFFFFF',
                  border: isSelected ? '1.5px solid rgba(250,93,25,0.45)' : '1px solid #F0F0F0',
                  borderRadius: '14px',
                  padding: '16px',
                  boxShadow: isSelected ? '0 6px 20px rgba(250,93,25,0.10)' : '0 2px 8px rgba(0,0,0,0.04)',
                  cursor: isDone ? 'pointer' : 'not-allowed',
                  opacity: isDone ? 1 : 0.55,
                  textAlign: 'left',
                  transition: 'all 0.2s',
                  fontFamily: "'Inter', sans-serif",
                  position: 'relative',
                }}
              >
                <span
                  role="button"
                  tabIndex={0}
                  title="Kaydı sil"
                  aria-label="Kaydı sil"
                  onClick={(event) => {
                    event.stopPropagation();
                    showConfirm({
                      title: 'Geçmiş kaydı silinsin mi?',
                      message: `${record.model_name || 'Bu kayıt'} ve temizlenmiş ses dosyası geçmişten kaldırılacak.`,
                      confirmLabel: 'Sil',
                      cancelLabel: 'Vazgeç',
                      variant: 'danger',
                    }).then((confirmed) => {
                      if (confirmed) deleteRecord(record);
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      showConfirm({
                        title: 'Geçmiş kaydı silinsin mi?',
                        message: `${record.model_name || 'Bu kayıt'} ve temizlenmiş ses dosyası geçmişten kaldırılacak.`,
                        confirmLabel: 'Sil',
                        cancelLabel: 'Vazgeç',
                        variant: 'danger',
                      }).then((confirmed) => {
                        if (confirmed) deleteRecord(record);
                      });
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    bottom: '12px',
                    width: '30px',
                    height: '30px',
                    borderRadius: '9px',
                    border: '1px solid #F0F0F0',
                    background: '#FFFFFF',
                    color: '#AAAAAA',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.04)',
                  }}
                  onMouseEnter={(event) => {
                    event.currentTarget.style.color = '#EF4444';
                    event.currentTarget.style.borderColor = '#FFD0D0';
                    event.currentTarget.style.background = '#FFF5F5';
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.color = '#AAAAAA';
                    event.currentTarget.style.borderColor = '#F0F0F0';
                    event.currentTarget.style.background = '#FFFFFF';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" strokeLinecap="round" />
                    <path d="M8 6V5a2 2 0 012-2h4a2 2 0 012 2v1" strokeLinecap="round" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" />
                    <path d="M10 11v6M14 11v6" strokeLinecap="round" />
                  </svg>
                </span>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <p style={{ fontWeight: 750, fontSize: '14px', color: '#262626', margin: 0, lineHeight: 1.35 }}>
                    {record.model_name || 'Bilinmeyen Model'}
                  </p>
                  {getStatusBadge(record.status)}
                </div>
                <p style={{ fontSize: '13px', color: '#888', margin: '0 0 5px' }}>
                  {formatDate(record.created_at)}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '14px', color: isSelected ? '#FA5D19' : '#888888', fontSize: '12px', fontWeight: 800 }}>
                  <span>{isSelected ? 'Açık kayıt' : isDone ? 'İncele' : 'Hazır değil'}</span>
                  {isDone && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
