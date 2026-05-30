import { useCallback, useEffect, useRef, useState } from 'react';
import useStore from '../store/useStore';
import { fetchModels } from '../api/client';

export default function ModelSelector() {
  const { models, setModels, selectedModelId, setSelectedModel } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadModels = useCallback(async function loadModels() {
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
  }, [selectedModelId, setModels, setSelectedModel]);

  useEffect(() => {
    queueMicrotask(() => {
      loadModels();
    });
  }, [loadModels]);

  const selectedModel = models.find((model) => model.id === selectedModelId);

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#AAAAAA' }}>
          MODEL SEÇİMİ
        </span>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading || models.length === 0}
        style={{
          width: '100%',
          background: '#FAFAFA',
          border: isOpen ? '1.5px solid #FA5D19' : '1.5px solid #E5E5E5',
          borderRadius: '12px',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: loading || models.length === 0 ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          textAlign: 'left',
          opacity: loading || models.length === 0 ? 0.75 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isOpen && !loading && models.length > 0) {
            e.currentTarget.style.borderColor = '#FA5D19';
            e.currentTarget.style.background = '#FFFFFF';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.borderColor = '#E5E5E5';
            e.currentTarget.style.background = '#FAFAFA';
          }
        }}
        id="model-selector-trigger"
      >
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

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: '15px', color: '#262626', margin: 0 }}>
            {loading ? 'Yükleniyor...' : selectedModel ? selectedModel.name : 'Model bulunamadı'}
          </p>
          {selectedModel?.description && (
            <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedModel.description}
            </p>
          )}
        </div>

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
              Model listesi boş
            </div>
          ) : (
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {models.map((model, idx) => (
                <div key={model.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModel(model.id);
                      setIsOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      background: selectedModelId === model.id ? '#FFF5F0' : 'transparent',
                      border: 'none',
                      borderLeft: selectedModelId === model.id ? '3px solid #FA5D19' : '3px solid transparent',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedModelId !== model.id) e.currentTarget.style.background = '#FFF9F7';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedModelId !== model.id) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '14px', color: '#262626', margin: 0 }}>{model.name}</p>
                      {model.description && (
                        <p style={{ fontSize: '12px', color: '#888', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {model.description}
                        </p>
                      )}
                    </div>
                  </button>
                  {idx < models.length - 1 && <div style={{ height: '1px', background: '#F5F5F5', margin: '0 16px' }} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
