import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from '../components/Navbar';
import HistoryPanel from '../components/HistoryPanel';
import AuthModal from '../components/AuthModal';

export default function History() {
  const { token } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  if (!token) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#F9F9F9' }}>
      <Navbar />
      <AuthModal />

      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 24px 80px' }}>
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '24px',
            alignItems: 'end',
            marginBottom: '24px',
          }}
        >
          <div>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                color: '#888888',
                textDecoration: 'none',
                fontSize: '13px',
                fontWeight: 700,
                marginBottom: '18px',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Ana sayfaya dön
            </Link>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#FEE8DC',
                color: '#FA5D19',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '11px',
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '14px',
                border: '1px solid rgba(250,93,25,0.18)',
              }}
            >
              <span style={{ width: '6px', height: '6px', background: '#FA5D19', borderRadius: '50%', display: 'inline-block' }} />
              Hesap Geçmişi
            </div>

            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 'clamp(30px, 4vw, 48px)',
                lineHeight: 1.05,
                fontWeight: 800,
                color: '#262626',
                margin: 0,
              }}
            >
              İşlem Geçmişi
            </h1>
            <p style={{ color: '#888888', fontSize: '15px', lineHeight: 1.7, maxWidth: '560px', marginTop: '12px' }}>
              Daha önce temizlediğiniz ses kayıtlarını inceleyin, dinleyin veya tekrar indirin.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: '#FFFFFF',
              border: '1px solid #F0F0F0',
              borderRadius: '14px',
              padding: '14px 18px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              minWidth: '220px',
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#FFF5F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FA5D19',
                flexShrink: 0,
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v5l3 2M3 12a9 9 0 1018 0 9 9 0 00-18 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '12px', color: '#AAAAAA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Kayıtlar
              </p>
              <p style={{ margin: '2px 0 0', fontSize: '14px', color: '#262626', fontWeight: 700 }}>
                Hesabınıza bağlı
              </p>
            </div>
          </div>
        </section>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #F0F0F0',
            borderRadius: '16px',
            padding: '22px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <HistoryPanel showHeader={false} />
        </div>
      </main>

      <style>{`
        @media (max-width: 760px) {
          main section {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
