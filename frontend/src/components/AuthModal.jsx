import { useState } from 'react';
import useStore from '../store/useStore';
import { register, login } from '../api/client';

export default function AuthModal() {
  const { showAuthModal, setShowAuthModal, setUser, setToken } = useStore();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });

  if (!showAuthModal) return null;

  function closeModal() {
    setShowAuthModal(false);
    setError('');
    setLoginForm({ email: '', password: '' });
    setRegisterForm({ username: '', email: '', password: '', passwordConfirm: '' });
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    if (!loginForm.email || !loginForm.password) {
      setError('Tüm alanları doldurunuz.');
      return;
    }
    try {
      setLoading(true);
      const data = await login({ email: loginForm.email, password: loginForm.password });
      setToken(data.token);
      setUser(data.user);
      closeModal();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Giriş yapılırken hata oluştu.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (!registerForm.username || !registerForm.email || !registerForm.password) {
      setError('Tüm alanları doldurunuz.');
      return;
    }
    if (registerForm.password !== registerForm.passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (registerForm.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    try {
      setLoading(true);
      const data = await register({
        username: registerForm.username,
        email: registerForm.email,
        password: registerForm.password,
      });
      setToken(data.token);
      setUser(data.user);
      closeModal();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Kayıt olurken hata oluştu.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    border: '1.5px solid #E5E5E5',
    borderRadius: '10px',
    fontSize: '15px',
    color: '#262626',
    background: '#FAFAFA',
    outline: 'none',
    transition: 'border-color 0.2s, background 0.2s, box-shadow 0.2s',
    marginBottom: '16px',
    fontFamily: "'Inter', sans-serif",
  };

  const labelStyle = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#262626',
    marginBottom: '6px',
    display: 'block',
  };

  function handleInputFocus(e) {
    e.target.style.borderColor = '#FA5D19';
    e.target.style.background = '#FFFFFF';
    e.target.style.boxShadow = '0 0 0 3px rgba(250,93,25,0.08)';
  }

  function handleInputBlur(e) {
    e.target.style.borderColor = '#E5E5E5';
    e.target.style.background = '#FAFAFA';
    e.target.style.boxShadow = 'none';
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* Modal Kart */}
      <div
        className="animate-fade-in"
        style={{
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '40px',
          width: '440px',
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
          position: 'relative',
        }}
      >
        {/* Kapat Butonu */}
        <button
          onClick={closeModal}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#F5F5F5',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#888',
            fontSize: '18px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#E5E5E5'; e.currentTarget.style.color = '#262626'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.color = '#888'; }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M1 1l12 12M1 13L13 1" strokeLinecap="round" />
          </svg>
        </button>

        {/* Logo + Başlık */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              background: 'linear-gradient(135deg, #FA5D19, #FF7A40)',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h3l3-9 5 18 5-18 3 9h3" />
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '26px', fontWeight: 700, color: '#262626' }}>
            Hoş Geldiniz
          </h2>
          <p style={{ fontSize: '14px', color: '#888888', marginTop: '4px' }}>
            Hesabınıza giriş yapın veya yeni hesap oluşturun
          </p>
        </div>

        {/* Tab Seçici */}
        <div
          style={{
            background: '#F5F5F5',
            borderRadius: '10px',
            padding: '4px',
            display: 'flex',
            marginBottom: '28px',
          }}
        >
          <button
            onClick={() => { setActiveTab('login'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '7px',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'login' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'login' ? '#262626' : '#888888',
              boxShadow: activeTab === 'login' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Giriş Yap
          </button>
          <button
            onClick={() => { setActiveTab('register'); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '7px',
              fontWeight: 600,
              fontSize: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: activeTab === 'register' ? '#FFFFFF' : 'transparent',
              color: activeTab === 'register' ? '#262626' : '#888888',
              boxShadow: activeTab === 'register' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Üye Ol
          </button>
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div
            className="animate-fade-in"
            style={{
              background: '#FFF0F0',
              border: '1px solid #FFD0D0',
              borderRadius: '8px',
              padding: '10px 14px',
              color: '#D32F2F',
              fontSize: '13px',
              fontWeight: 500,
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        {/* Formlar */}
        {activeTab === 'login' ? (
          <form onSubmit={handleLogin}>
            <label style={labelStyle}>E-posta Adresi</label>
            <input
              type="email"
              value={loginForm.email}
              onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
              placeholder="ornek@email.com"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              id="login-email"
            />

            <label style={labelStyle}>Şifre</label>
            <input
              type="password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              id="login-password"
            />

            <button
              type="submit"
              disabled={loading}
              id="login-submit-btn"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #FA5D19 0%, #FF7A40 100%)',
                color: 'white',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px',
                boxShadow: '0 4px 16px rgba(250,93,25,0.3)',
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(250,93,25,0.4)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(250,93,25,0.3)'; }}
            >
              {loading && (
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              Giriş Yap
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <label style={labelStyle}>Kullanıcı Adı</label>
            <input
              type="text"
              value={registerForm.username}
              onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
              placeholder="kullaniciadi"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              id="register-username"
            />

            <label style={labelStyle}>E-posta Adresi</label>
            <input
              type="email"
              value={registerForm.email}
              onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              placeholder="ornek@email.com"
              style={inputStyle}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              id="register-email"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Şifre</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                  placeholder="Min 6 karakter"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  id="register-password"
                />
              </div>
              <div>
                <label style={labelStyle}>Şifre Tekrar</label>
                <input
                  type="password"
                  value={registerForm.passwordConfirm}
                  onChange={(e) => setRegisterForm({ ...registerForm, passwordConfirm: e.target.value })}
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  id="register-password-confirm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="register-submit-btn"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #FA5D19 0%, #FF7A40 100%)',
                color: 'white',
                padding: '14px',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 700,
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '8px',
                boxShadow: '0 4px 16px rgba(250,93,25,0.3)',
                transition: 'all 0.2s',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(250,93,25,0.4)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(250,93,25,0.3)'; }}
            >
              {loading && (
                <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              Üye Ol
            </button>
          </form>
        )}

        {/* Misafir olarak devam et */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            onClick={closeModal}
            style={{
              background: 'none',
              border: 'none',
              color: '#888888',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
              transition: 'color 0.2s',
              fontFamily: "'Inter', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#FA5D19'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888888'; }}
          >
            Misafir olarak devam et →
          </button>
        </div>
      </div>
    </div>
  );
}
