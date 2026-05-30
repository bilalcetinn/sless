import { useState } from 'react';
import { Link } from 'react-router-dom';
import useStore from '../store/useStore';

export default function Navbar() {
  const { user, logout, setShowAuthModal } = useStore();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #F0F0F0',
        height: '64px',
        padding: '0 32px',
      }}
    >
      <div style={{ maxWidth: '1280px', margin: '0 auto', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h3l3-9 5 18 5-18 3 9h3" />
          </svg>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            <span style={{ color: '#FA5D19' }}>S</span>
            <span style={{ color: '#262626' }}>LESS</span>
          </span>
        </Link>

        {/* Desktop Menü */}
        <div className="hidden md:flex" style={{ alignItems: 'center', gap: '8px' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Avatar */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #FA5D19, #FF7A40)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '13px',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {user.username?.charAt(0).toUpperCase()}
              </div>

              {/* Kullanıcı adı */}
              <span style={{ fontWeight: 600, color: '#262626', fontSize: '14px' }}>
                {user.username}
              </span>

              {/* Geçmişim */}
              <Link
                to="/history"
                style={{
                  color: '#888',
                  fontSize: '14px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#FA5D19'; e.currentTarget.style.background = '#FFF5F0'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.background = 'transparent'; }}
              >
                Geçmişim
              </Link>

              {/* Çıkış */}
              <button
                onClick={logout}
                style={{
                  color: '#888',
                  fontSize: '14px',
                  background: 'transparent',
                  border: '1px solid #E5E5E5',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#262626'; e.currentTarget.style.borderColor = '#262626'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#E5E5E5'; }}
              >
                Çıkış
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setShowAuthModal(true)}
                style={{
                  background: 'transparent',
                  border: '1.5px solid #262626',
                  color: '#262626',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#FA5D19'; e.currentTarget.style.color = '#FA5D19'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#262626'; e.currentTarget.style.color = '#262626'; }}
              >
                Giriş Yap
              </button>
              <button
                onClick={() => setShowAuthModal(true)}
                style={{
                  background: '#FA5D19',
                  color: 'white',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(250,93,25,0.25)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#FF7A40'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#FA5D19'; }}
              >
                Üye Ol
              </button>
            </div>
          )}
        </div>

        {/* Mobil Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="md:hidden"
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#262626',
          }}
          aria-label="Menü"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobil Drawer */}
      {menuOpen && (
        <div
          className="md:hidden animate-fade-in"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #F0F0F0',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {user ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingBottom: '12px', borderBottom: '1px solid #F0F0F0' }}>
                  <div
                    style={{
                      width: '32px', height: '32px',
                      background: 'linear-gradient(135deg, #FA5D19, #FF7A40)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'white', fontWeight: 700, fontSize: '13px',
                    }}
                  >
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, color: '#262626', fontSize: '14px' }}>{user.username}</span>
                </div>
                <Link
                  to="/history"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'block', padding: '10px 14px', fontSize: '14px', fontWeight: 600,
                    color: '#262626', borderRadius: '8px', textDecoration: 'none', transition: 'all 0.2s',
                  }}
                >
                  Geçmişim
                </Link>
                <button
                  onClick={() => { logout(); setMenuOpen(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', fontSize: '14px', fontWeight: 600,
                    color: '#888', borderRadius: '8px', border: '1px solid #E5E5E5',
                    background: 'transparent', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  Çıkış
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setShowAuthModal(true); setMenuOpen(false); }}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px', fontWeight: 600,
                    color: '#262626', border: '1.5px solid #262626', borderRadius: '8px',
                    background: 'transparent', cursor: 'pointer',
                  }}
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => { setShowAuthModal(true); setMenuOpen(false); }}
                  style={{
                    width: '100%', padding: '10px', fontSize: '14px', fontWeight: 600,
                    color: 'white', background: '#FA5D19', borderRadius: '8px',
                    border: 'none', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(250,93,25,0.25)',
                  }}
                >
                  Üye Ol
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
