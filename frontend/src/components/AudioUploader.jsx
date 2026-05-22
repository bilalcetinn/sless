import { useState, useRef, useCallback } from 'react';
import useStore from '../store/useStore';

const MAX_SIZE = 100 * 1024 * 1024;
const ALLOWED = ['.wav', '.mp3', '.ogg', '.flac', '.m4a'];

export default function AudioUploader() {
  const { uploadedFile, setUploadedFile, resetProcessing } = useStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const validateFile = useCallback((file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setError(`Desteklenmeyen format: ${ext}. Desteklenen: ${ALLOWED.join(', ')}`);
      return false;
    }
    if (file.size > MAX_SIZE) {
      setError('Dosya boyutu 100MB\'ı aşamaz.');
      return false;
    }
    setError('');
    return true;
  }, []);

  const handleFile = useCallback((file) => {
    if (validateFile(file)) {
      resetProcessing();
      setUploadedFile(file);
    }
  }, [validateFile, setUploadedFile, resetProcessing]);

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e) { e.preventDefault(); setIsDragging(true); }
  function handleDragLeave(e) { e.preventDefault(); setIsDragging(false); }
  function handleInputChange(e) { const file = e.target.files[0]; if (file) handleFile(file); }

  async function toggleRecording() {
    if (isRecording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const file = new File([blob], `kayit_${Date.now()}.wav`, { type: 'audio/wav' });
        stream.getTracks().forEach(track => track.stop());
        resetProcessing();
        setUploadedFile(file);
      };
      mediaRecorder.start();
      setIsRecording(true);
      setError('');
    } catch (err) {
      setError('Mikrofon erişimi reddedildi. Lütfen tarayıcı izinlerini kontrol edin.');
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return (
    <div>
      {/* Kart Başlığı */}
      <div
        style={{
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#AAAAAA',
          marginBottom: '12px',
        }}
      >
        SES DOSYASI
      </div>

      {/* Sürükle Bırak */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: uploadedFile
            ? '2px solid #FA5D19'
            : isDragging
              ? '2px dashed #FA5D19'
              : '2px dashed #E0E0E0',
          borderRadius: '14px',
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: uploadedFile
            ? '#FFF5F0'
            : isDragging
              ? '#FFF9F7'
              : '#FAFAFA',
          marginBottom: '12px',
          transform: isDragging ? 'scale(1.005)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          if (!isDragging && !uploadedFile) {
            e.currentTarget.style.borderColor = '#FA5D19';
            e.currentTarget.style.background = '#FFF9F7';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging && !uploadedFile) {
            e.currentTarget.style.borderColor = '#E0E0E0';
            e.currentTarget.style.background = '#FAFAFA';
          }
        }}
        id="audio-drop-zone"
      >
        <input ref={fileInputRef} type="file" accept={ALLOWED.join(',')} onChange={handleInputChange} style={{ display: 'none' }} />

        {uploadedFile ? (
          <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            {/* Dosya ikonu */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2">
                <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 600, color: '#262626', fontSize: '14px', margin: 0 }}>{uploadedFile.name}</p>
                <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{formatSize(uploadedFile.size)}</p>
              </div>
            </div>
            {/* Yeşil checkmark */}
            <div
              style={{
                width: '28px', height: '28px',
                background: '#F0FFF4', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #22C55E',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            {/* Sil */}
            <button
              onClick={(e) => { e.stopPropagation(); setUploadedFile(null); resetProcessing(); }}
              style={{
                fontSize: '12px', fontWeight: 600, color: '#EF4444',
                background: 'transparent', border: 'none', cursor: 'pointer',
                transition: 'color 0.15s', flexShrink: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#EF4444'; }}
            >
              Sil
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '56px', height: '56px',
                background: '#FFF5F0',
                borderRadius: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 600, color: '#262626' }}>
                Ses dosyanı sürükle veya <span style={{ color: '#FA5D19', fontWeight: 700 }}>tıkla</span>
              </p>
              <p style={{ fontSize: '12px', color: '#AAAAAA', marginTop: '6px' }}>
                WAV, MP3, OGG, FLAC, M4A — Maks 100MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Mikrofon Butonu */}
      <button
        onClick={toggleRecording}
        style={{
          width: '100%',
          background: isRecording ? '#FFF5F5' : 'transparent',
          border: isRecording ? '1.5px solid #EF4444' : '1.5px solid #E5E5E5',
          borderRadius: '10px',
          padding: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          color: isRecording ? '#EF4444' : '#888',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
          transition: 'all 0.2s',
          fontFamily: "'Inter', sans-serif",
        }}
        onMouseEnter={(e) => {
          if (!isRecording) {
            e.currentTarget.style.borderColor = '#FA5D19';
            e.currentTarget.style.color = '#FA5D19';
            e.currentTarget.style.background = '#FFF9F7';
          }
        }}
        onMouseLeave={(e) => {
          if (!isRecording) {
            e.currentTarget.style.borderColor = '#E5E5E5';
            e.currentTarget.style.color = '#888';
            e.currentTarget.style.background = 'transparent';
          }
        }}
        id="mic-record-btn"
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" />
          </svg>
          {isRecording && (
            <span
              className="animate-pulse-ring"
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                background: '#EF4444',
                borderRadius: '50%',
              }}
            />
          )}
        </div>
        {isRecording ? 'Kaydı Durdur' : 'Mikrofon ile Kayıt'}
      </button>

      {/* Hata */}
      {error && (
        <div
          className="animate-fade-in"
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
          {error}
        </div>
      )}
    </div>
  );
}
