import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { getHistory, downloadAudio } from '../api/client';

export default function HistoryPanel({ showHeader = true }) {
  const { user } = useStore();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [audioElement, setAudioElement] = useState(null);

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
    } catch {
      setError('Geçmiş yüklenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(recordId) {
    try {
      await downloadAudio(recordId);
    } catch {
      alert('İndirme sırasında hata oluştu.');
    }
  }

  function handlePlay(record) {
    if (playingId === record.id) {
      // Durdur
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
      setPlayingId(null);
      setAudioElement(null);
      return;
    }

    // Öncekini durdur
    if (audioElement) {
      audioElement.pause();
    }

    const url = `http://localhost:8001/files/${record.cleaned_file_path}`;
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => {
      setPlayingId(null);
      setAudioElement(null);
    };
    setPlayingId(record.id);
    setAudioElement(audio);
  }

  function formatDate(dateStr) {
    try {
      const date = new Date(dateStr);
      const months = [
        'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
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
          fontWeight: 600,
        }}
      >
        {c.label}
      </span>
    );
  }

  if (!user) return null;

  return (
    <div style={{ padding: showHeader ? '24px 0' : 0 }}>
      {/* Başlık satırı */}
      {showHeader && (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '20px', color: '#262626', margin: 0 }}>
          İşlem Geçmişi
        </h2>
        <button
          onClick={loadHistory}
          style={{
            background: 'transparent',
            border: '1.5px solid #FA5D19',
            color: '#FA5D19',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            fontFamily: "'Inter', sans-serif",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF5F0'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          Yenile
        </button>
      </div>
      )}

      {!showHeader && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
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

      {/* Yükleniyor */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #F0F0F0' }}>
              <div className="skeleton" style={{ height: '16px', width: '75%', marginBottom: '12px' }} />
              <div className="skeleton" style={{ height: '12px', width: '50%', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '12px', width: '33%' }} />
            </div>
          ))}
        </div>
      )}

      {/* Hata */}
      {error && (
        <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', color: '#D32F2F', fontSize: '13px', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {/* Boş durum */}
      {!loading && records.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div
            style={{
              width: '64px', height: '64px',
              background: '#F5F5F5', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#AAAAAA" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
          </div>
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#262626', margin: 0 }}>Henüz işlem geçmişiniz yok</p>
          <p style={{ fontSize: '13px', color: '#AAAAAA', marginTop: '6px' }}>Ses temizle sekmesinden başlayın</p>
        </div>
      )}

      {/* Kayıt Kartları */}
      {!loading && records.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {records.map((record) => (
            <div
              key={record.id}
              style={{
                background: '#FFFFFF',
                border: '1px solid #F0F0F0',
                borderRadius: '14px',
                padding: '18px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
            >
              {/* Üst: model adı + statü */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: '#262626', margin: 0 }}>
                  {record.model_name || 'Bilinmeyen Model'}
                </p>
                {getStatusBadge(record.status)}
              </div>

              {/* Orta: tarih */}
              <p style={{ fontSize: '13px', color: '#888', margin: '0 0 4px' }}>
                {formatDate(record.created_at)}
              </p>
              <p style={{ fontSize: '12px', color: '#AAAAAA', margin: '0 0 14px' }}>
                Gürültü: {record.noise_reduction_level}%
              </p>

              {/* Alt: butonlar */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handlePlay(record)}
                  disabled={record.status !== 'done'}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: record.status === 'done' ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    background: 'transparent',
                    border: '1.5px solid #FA5D19',
                    color: '#FA5D19',
                    opacity: record.status === 'done' ? 1 : 0.3,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    {playingId === record.id ? (
                      <>
                        <rect x="3" y="2" width="4" height="12" rx="1" />
                        <rect x="9" y="2" width="4" height="12" rx="1" />
                      </>
                    ) : (
                      <path d="M4 2l10 6-10 6V2z" />
                    )}
                  </svg>
                  {playingId === record.id ? 'Durdur' : 'Dinle'}
                </button>
                <button
                  onClick={() => handleDownload(record.id)}
                  disabled={record.status !== 'done'}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: record.status === 'done' ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                    background: '#FA5D19',
                    border: 'none',
                    color: 'white',
                    opacity: record.status === 'done' ? 1 : 0.3,
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  İndir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
