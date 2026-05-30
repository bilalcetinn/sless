import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { DialogContext } from './appDialogContext';

export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const closeDialog = useCallback((result) => {
    setDialog((current) => {
      if (current?.resolve) current.resolve(result);
      return null;
    });
  }, []);

  const showAlert = useCallback((options) => {
    const config = typeof options === 'string' ? { message: options } : options;
    return new Promise((resolve) => {
      setDialog({
        type: 'alert',
        variant: config.variant || 'info',
        title: config.title || 'Bilgi',
        message: config.message,
        confirmLabel: config.confirmLabel || 'Tamam',
        resolve,
      });
    });
  }, []);

  const showConfirm = useCallback((options) => {
    return new Promise((resolve) => {
      setDialog({
        type: 'confirm',
        variant: options.variant || 'danger',
        title: options.title || 'Onay gerekiyor',
        message: options.message,
        confirmLabel: options.confirmLabel || 'Onayla',
        cancelLabel: options.cancelLabel || 'Vazgeç',
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ showAlert, showConfirm }), [showAlert, showConfirm]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && createPortal(
        <AppDialog dialog={dialog} onClose={closeDialog} />,
        document.body
      )}
    </DialogContext.Provider>
  );
}

function AppDialog({ dialog, onClose }) {
  const isDanger = dialog.variant === 'danger';
  const accent = isDanger ? '#EF4444' : '#FA5D19';
  const softBg = isDanger ? '#FFF5F5' : '#FFF5F0';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={dialog.title}
      onClick={() => {
        if (dialog.type === 'confirm') onClose(false);
        else onClose(true);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(38,38,38,0.38)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
    >
      <div
        className="animate-fade-in"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: '#FFFFFF',
          border: '1px solid #F0F0F0',
          borderRadius: '18px',
          padding: '22px',
          boxShadow: '0 24px 70px rgba(0,0,0,0.18)',
        }}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: softBg,
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isDanger ? (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18" strokeLinecap="round" />
                <path d="M8 6V5a2 2 0 012-2h4a2 2 0 012 2v1" strokeLinecap="round" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" strokeLinecap="round" />
                <path d="M10 11v6M14 11v6" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
              </svg>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, color: '#262626', fontSize: '18px', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
              {dialog.title}
            </h3>
            {dialog.message && (
              <p style={{ margin: '8px 0 0', color: '#888888', fontSize: '13px', lineHeight: 1.55 }}>
                {dialog.message}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '22px' }}>
          {dialog.type === 'confirm' && (
            <button
              type="button"
              onClick={() => onClose(false)}
              style={{
                padding: '10px 16px',
                borderRadius: '10px',
                border: '1px solid #E5E5E5',
                background: '#FFFFFF',
                color: '#262626',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {dialog.cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => onClose(true)}
            style={{
              minWidth: '96px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: isDanger ? '#EF4444' : 'linear-gradient(135deg, #FA5D19, #FF7A40)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: isDanger ? '0 8px 18px rgba(239,68,68,0.22)' : '0 8px 18px rgba(250,93,25,0.22)',
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
