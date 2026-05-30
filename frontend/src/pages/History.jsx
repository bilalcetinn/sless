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
    </div>
  );
}
