import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import Navbar from '../components/Navbar';
import HistoryPanel from '../components/HistoryPanel';
import AuthModal from '../components/AuthModal';

export default function History() {
  const { user, token } = useStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate('/');
    }
  }, [token, navigate]);

  if (!token) return null;

  return (
    <div className="min-h-screen bg-app-bg">
      <Navbar />
      <AuthModal />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-app-dark font-mono">
            İşlem Geçmişi
          </h1>
          <p className="mt-2 text-sm text-app-dark/50">
            Daha önce işlediğiniz tüm ses dosyalarını burada bulabilirsiniz
          </p>
        </div>

        <HistoryPanel />
      </div>
    </div>
  );
}
