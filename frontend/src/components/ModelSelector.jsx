import { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import { fetchModels, addModel, deleteModel } from '../api/client';

export default function ModelSelector() {
  const { models, setModels, selectedModelId, setSelectedModel } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newModel, setNewModel] = useState({ name: '', file_path: '', description: '' });
  const [error, setError] = useState('');
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadModels() {
    try {
      setLoading(true);
      const data = await fetchModels();
      setModels(data);
      if (data.length > 0 && !selectedModelId) {
        setSelectedModel(data[0].id);
      }
    } catch (err) {
      console.error('Modeller yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddModel(e) {
    e.preventDefault();
    setError('');
    if (!newModel.name.trim()) {
      setError('Model adı boş olamaz.');
      return;
    }
    if (!newModel.file_path.endsWith('.pt') && !newModel.file_path.endsWith('.pth')) {
      setError('Dosya yolu .pt veya .pth ile bitmelidir.');
      return;
    }
    try {
      const created = await addModel(newModel);
      setShowAddModal(false);
      setNewModel({ name: '', file_path: '', description: '' });
      await loadModels();
      setSelectedModel(created.id);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Model eklenirken hata oluştu.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`"${name}" modelini silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteModel(id);
      await loadModels();
      if (selectedModelId === id) {
        const remaining = models.filter((m) => m.id !== id);
        setSelectedModel(remaining.length > 0 ? remaining[0].id : null);
      }
    } catch (err) {
      alert('Model silinirken hata oluştu.');
    }
  }

  const selectedModel = models.find((m) => m.id === selectedModelId);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      {/* Kart Başlığı */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAAAAA' }}>
          MODEL SEÇİMİ
        </span>
        <span
          style={{
            background: '#FEE8DC',
            color: '#FA5D19',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 10px',
            borderRadius: '20px',
          }}
        >
          {models.length} model mevcut
        </span>
      </div>

      {/* Dropdown Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          background: '#FAFAFA',
          border: isOpen ? '1.5px solid #FA5D19' : '1.5px solid #E5E5E5',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left',
        }}
        onMouseEnter={(e) => { if (!isOpen) { e.currentTarget.style.borderColor = '#FA5D19'; e.currentTarget.style.background = '#FFFFFF'; } }}
        onMouseLeave={(e) => { if (!isOpen) { e.currentTarget.style.borderColor = '#E5E5E5'; e.currentTarget.style.background = '#FAFAFA'; } }}
        id="model-selector-trigger"
      >
        {/* Sol İkon */}
        <div
          style={{
            width: '36px',
            height: '36px',
            background: '#FFF5F0',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" stroke="#FA5D19" strokeWidth="1.5" fill="none" />
            <circle cx="8" cy="8" r="2" fill="#FA5D19" />
          </svg>
        </div>

        {/* Metin */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '15px', color: '#262626', margin: 0 }}>
            {loading ? 'Yükleniyor...' : selectedModel ? selectedModel.name : 'Model seçin'}
          </p>
          {selectedModel?.description && (
            <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedModel.description}
            </p>
          )}
        </div>

        {/* Chevron */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#AAAAAA"
          strokeWidth="2"
          style={{
            transition: 'transform 0.2s',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        >
          <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown Listesi */}
      {isOpen && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            background: '#FFFFFF',
            border: '1px solid #F0F0F0',
            borderRadius: '14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            overflow: 'hidden',
            zIndex: 10,
          }}
        >
          {models.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', fontSize: '14px', color: '#AAAAAA' }}>
              Henüz model eklenmemiş
            </div>
          ) : (
            <div style={{ maxHeight: '256px', overflowY: 'auto' }}>
              {models.map((model, idx) => (
                <div key={model.id}>
                  <div
                    onClick={() => { setSelectedModel(model.id); setIsOpen(false); }}
                    style={{
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: selectedModelId === model.id ? '#FFF5F0' : 'transparent',
                      borderLeft: selectedModelId === model.id ? '3px solid #FA5D19' : '3px solid transparent',
                    }}
                    onMouseEnter={(e) => { if (selectedModelId !== model.id) e.currentTarget.style.background = '#FFF9F7'; }}
                    onMouseLeave={(e) => { if (selectedModelId !== model.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#262626', margin: 0 }}>{model.name}</p>
                      {model.description && (
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.description}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(model.id, model.name); }}
                      style={{
                        padding: '6px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#CCCCCC',
                        transition: 'color 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#EF4444'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#CCCCCC'; }}
                      title="Modeli sil"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M2 4h12M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1M6 7v5M10 7v5M3 4l1 9a1 1 0 001 1h6a1 1 0 001-1l1-9" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {idx < models.length - 1 && <div style={{ height: '1px', background: '#F5F5F5', margin: '0 16px' }} />}
                </div>
              ))}
            </div>
          )}

          {/* + Model Ekle */}
          <div style={{ borderTop: '1px solid #F5F5F5' }}>
            <button
              onClick={() => { setShowAddModal(true); setIsOpen(false); }}
              style={{
                width: '100%',
                padding: '14px 16px',
                color: '#FA5D19',
                fontWeight: 600,
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#FFF9F7',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
                fontFamily: "'Inter', sans-serif",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#FFF5F0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '#FFF9F7'; }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M8 3v10M3 8h10" strokeLinecap="round" />
              </svg>
              Yeni Model Ekle
            </button>
          </div>
        </div>
      )}

      {/* Model Ekleme Modalı */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
        >
          <div
            className="animate-fade-in"
            style={{
              background: '#FFFFFF',
              borderRadius: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.15)',
              width: '100%',
              maxWidth: '480px',
            }}
          >
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #F0F0F0' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#262626', fontFamily: "'Space Grotesk', sans-serif" }}>Yeni Model Ekle</h3>
              <p style={{ fontSize: '14px', color: '#888', marginTop: '4px' }}>Eğitilmiş model dosyasını sisteme tanımlayın</p>
            </div>
            <form onSubmit={handleAddModel} style={{ padding: '24px 32px' }}>
              {error && (
                <div style={{ background: '#FFF0F0', border: '1px solid #FFD0D0', borderRadius: '8px', padding: '10px 14px', color: '#D32F2F', fontSize: '13px', fontWeight: 500, marginBottom: '16px' }}>
                  {error}
                </div>
              )}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#262626', marginBottom: '6px', display: 'block' }}>
                  Model Adı <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newModel.name}
                  onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                  placeholder="örn: UNet Denoiser v3"
                  style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E5E5', borderRadius: '10px', fontSize: '15px', color: '#262626', background: '#FAFAFA', outline: 'none' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#262626', marginBottom: '6px', display: 'block' }}>
                  Dosya Yolu <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={newModel.file_path}
                  onChange={(e) => setNewModel({ ...newModel, file_path: e.target.value })}
                  placeholder="örn: models/model_v2.pt"
                  style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E5E5', borderRadius: '10px', fontSize: '15px', color: '#262626', background: '#FAFAFA', outline: 'none' }}
                />
                <p style={{ fontSize: '12px', color: '#AAAAAA', marginTop: '6px' }}>.pt veya .pth uzantılı dosya yolu girin</p>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#262626', marginBottom: '6px', display: 'block' }}>Açıklama</label>
                <textarea
                  value={newModel.description}
                  onChange={(e) => setNewModel({ ...newModel, description: e.target.value })}
                  placeholder="Model hakkında kısa açıklama yazın..."
                  rows={3}
                  style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #E5E5E5', borderRadius: '10px', fontSize: '15px', color: '#262626', background: '#FAFAFA', outline: 'none', resize: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setError(''); setNewModel({ name: '', file_path: '', description: '' }); }}
                  style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 600, color: '#262626', border: '1.5px solid #E5E5E5', borderRadius: '10px', background: 'transparent', cursor: 'pointer' }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: '12px', fontSize: '14px', fontWeight: 600, color: 'white', background: 'linear-gradient(135deg, #FA5D19, #FF7A40)', borderRadius: '10px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 16px rgba(250,93,25,0.3)' }}
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
