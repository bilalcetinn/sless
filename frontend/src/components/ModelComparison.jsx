import { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import { fetchModels, processWithModel } from '../api/client';
import WaveformViewer from './WaveformViewer';

export default function ModelComparison() {
  const { recordId, models, setModels } = useStore();

  // Sol panel state
  const [leftModelId, setLeftModelId] = useState(null);
  const [leftNoise, setLeftNoise] = useState(50);
  const [leftSensitivity, setLeftSensitivity] = useState(50);
  const [leftResult, setLeftResult] = useState(null);
  const [leftLoading, setLeftLoading] = useState(false);

  // Sağ panel state
  const [rightModelId, setRightModelId] = useState(null);
  const [rightNoise, setRightNoise] = useState(50);
  const [rightSensitivity, setRightSensitivity] = useState(50);
  const [rightResult, setRightResult] = useState(null);
  const [rightLoading, setRightLoading] = useState(false);

  useEffect(() => {
    async function loadModels() {
      try {
        const data = await fetchModels();
        setModels(data);
        setLeftModelId((current) => current || data[0]?.id || null);
        setRightModelId((current) => current || data[1]?.id || data[0]?.id || null);
      } catch (err) {
        console.error('Modeller yüklenemedi:', err);
      }
    }
    loadModels();
  }, [setModels]);

  async function processLeft() {
    if (!recordId || !leftModelId) return;
    try {
      setLeftLoading(true);
      const result = await processWithModel(recordId, leftModelId, leftNoise, leftSensitivity);
      setLeftResult({
        recordId: result.record_id,
        modelName: result.model_name,
        cleanedAudioUrl: `http://localhost:8001/files/${result.cleaned_file_path}`,
        status: result.status,
      });
    } catch (err) {
      console.error('Sol model işlenirken hata oluştu:', err);
      alert('Sol model işlenirken hata oluştu.');
    } finally {
      setLeftLoading(false);
    }
  }

  async function processRight() {
    if (!recordId || !rightModelId) return;
    try {
      setRightLoading(true);
      const result = await processWithModel(recordId, rightModelId, rightNoise, rightSensitivity);
      setRightResult({
        recordId: result.record_id,
        modelName: result.model_name,
        cleanedAudioUrl: `http://localhost:8001/files/${result.cleaned_file_path}`,
        status: result.status,
      });
    } catch (err) {
      console.error('Sağ model işlenirken hata oluştu:', err);
      alert('Sağ model işlenirken hata oluştu.');
    } finally {
      setRightLoading(false);
    }
  }

  // recordId yoksa uyarı göster
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

  function renderPanel(side, modelId, setModelId, noise, setNoise, sensitivity, setSensitivity, result, isLoading, onProcess) {
    const sideLabel = side === 'left' ? 'Sol' : 'Sağ';
    return (
      <div className="bg-white border border-app-gray rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-app-dark">{sideLabel} Model</h3>

        {/* Model Seçimi */}
        <select
          value={modelId || ''}
          onChange={(e) => setModelId(Number(e.target.value))}
          className="w-full px-4 py-2.5 border border-app-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-app-orange/30 focus:border-app-orange"
        >
          <option value="" disabled>Model seçin</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {/* Slider: Gürültü */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-app-dark/60">Gürültü Azaltma</span>
            <span className="font-bold text-app-orange">{noise}</span>
          </div>
          <input type="range" min="0" max="100" value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="w-full" />
        </div>

        {/* Slider: Hassasiyet */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-app-dark/60">Filtre Hassasiyeti</span>
            <span className="font-bold text-app-orange">{sensitivity}</span>
          </div>
          <input type="range" min="0" max="100" value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="w-full" />
        </div>

        {/* İşle Butonu */}
        <button
          onClick={onProcess}
          disabled={isLoading || !modelId}
          className="w-full py-2.5 bg-app-orange text-white font-semibold rounded-lg hover:bg-app-orange-light transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {isLoading && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
          Bu Modelle İşle
        </button>

        {/* Sonuç */}
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

      {/* İki Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderPanel('left', leftModelId, setLeftModelId, leftNoise, setLeftNoise, leftSensitivity, setLeftSensitivity, leftResult, leftLoading, processLeft)}
        {renderPanel('right', rightModelId, setRightModelId, rightNoise, setRightNoise, rightSensitivity, setRightSensitivity, rightResult, rightLoading, processRight)}
      </div>
    </div>
  );
}
