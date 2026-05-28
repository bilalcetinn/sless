import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { fetchModels, processWithModel } from '../api/client';
import WaveformViewer from './WaveformViewer';

export default function ModelComparison() {
  const { recordId, models, setModels } = useStore();

  const [leftModelId, setLeftModelId] = useState(null);
  const [leftResult, setLeftResult] = useState(null);
  const [leftLoading, setLeftLoading] = useState(false);

  const [rightModelId, setRightModelId] = useState(null);
  const [rightResult, setRightResult] = useState(null);
  const [rightLoading, setRightLoading] = useState(false);

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await fetchModels();
        setModels(data);
        setLeftModelId((cur) => cur || data[0]?.id || null);
        setRightModelId((cur) => cur || data[1]?.id || data[0]?.id || null);
      } catch (err) {
        console.error('Modeller yüklenemedi:', err);
      }
    }
    loadModels();
  }, [setModels]);

  async function processPanel(modelId, setLoading, setResult) {
    if (!recordId || !modelId) return;
    try {
      setLoading(true);
      const result = await processWithModel(recordId, modelId, 100, 0);
      setResult({
        modelName: result.model_name,
        cleanedAudioUrl: `http://localhost:8000/files/${result.cleaned_file_path}`,
      });
    } catch (err) {
      console.error('Model işlenirken hata:', err);
      alert('Model işlenirken hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  if (!recordId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-app-orange/10 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="1.5">
            <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" />
          </svg>
        </div>
        <p className="text-lg font-medium text-app-dark">Önce bir ses dosyası yükleyin</p>
        <p className="text-sm text-app-dark/50">
          Ana sayfadan bir ses dosyası yükleyip işledikten sonra burada farklı modellerle karşılaştırabilirsiniz.
        </p>
      </div>
    );
  }

  function renderPanel(side, modelId, setModelId, result, isLoading, onProcess) {
    const label = side === 'left' ? 'Sol Model' : 'Sağ Model';
    return (
      <div className="bg-white border border-app-gray rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-app-dark">{label}</h3>

        <select
          value={modelId || ''}
          onChange={(e) => {
            setModelId(Number(e.target.value));
            /* seçim değişince eski sonucu sıfırla */
            if (side === 'left') setLeftResult(null);
            else setRightResult(null);
          }}
          className="w-full px-4 py-2.5 border border-app-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-orange/30 focus:border-app-orange"
        >
          <option value="" disabled>Model seçin</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <button
          onClick={onProcess}
          disabled={isLoading || !modelId}
          className="w-full py-2.5 bg-app-orange text-white font-semibold rounded-lg hover:bg-app-orange-light transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              İşleniyor...
            </>
          ) : 'Bu Modelle İşle'}
        </button>

        {result && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs text-green-600 font-medium">✓ {result.modelName} ile işlendi</p>
            <WaveformViewer audioUrl={result.cleanedAudioUrl} label={result.modelName} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold text-app-dark font-mono">Model Karşılaştırma</h2>
        <p className="text-sm text-app-dark/50">
          Aynı ses dosyasını farklı modellerle işleyip sonuçları karşılaştırın
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPanel('left',  leftModelId,  setLeftModelId,  leftResult,  leftLoading,  () => processPanel(leftModelId,  setLeftLoading,  setLeftResult))}
        {renderPanel('right', rightModelId, setRightModelId, rightResult, rightLoading, () => processPanel(rightModelId, setRightLoading, setRightResult))}
      </div>
    </div>
  );
}
