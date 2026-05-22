import { create } from 'zustand';

const useStore = create((set) => ({
  // ══════════════════════════════════════════════════════════════
  // Auth
  // ══════════════════════════════════════════════════════════════
  user: JSON.parse(localStorage.getItem('sless_user') || 'null'),
  token: localStorage.getItem('sless_token') || null,

  setUser: (user) => {
    if (user) {
      localStorage.setItem('sless_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('sless_user');
    }
    set({ user });
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('sless_token', token);
    } else {
      localStorage.removeItem('sless_token');
    }
    set({ token });
  },

  logout: () => {
    localStorage.removeItem('sless_token');
    localStorage.removeItem('sless_user');
    set({ user: null, token: null });
  },

  // ══════════════════════════════════════════════════════════════
  // Modeller
  // ══════════════════════════════════════════════════════════════
  models: [],
  selectedModelId: null,

  setModels: (models) => set({ models }),
  setSelectedModel: (id) => set({ selectedModelId: id }),

  // ══════════════════════════════════════════════════════════════
  // Ses İşleme (ana akış)
  // ══════════════════════════════════════════════════════════════
  uploadedFile: null,
  recordId: null,
  processingStatus: 'idle', // idle | uploading | processing | done | error
  processingStep: '',
  uploadProgress: 0,
  originalAudioUrl: null,
  cleanedAudioUrl: null,

  setUploadedFile: (file) => set({ uploadedFile: file }),
  setRecordId: (id) => set({ recordId: id }),
  setProcessingStatus: (status) => set({ processingStatus: status }),
  setProcessingStep: (step) => set({ processingStep: step }),
  setUploadProgress: (pct) => set({ uploadProgress: pct }),
  setOriginalAudioUrl: (url) => set({ originalAudioUrl: url }),
  setCleanedAudioUrl: (url) => set({ cleanedAudioUrl: url }),

  // ══════════════════════════════════════════════════════════════
  // Kontrol Parametreleri
  // ══════════════════════════════════════════════════════════════
  noiseLevel: 50,
  filterSensitivity: 50,

  setNoiseLevel: (v) => set({ noiseLevel: v }),
  setFilterSensitivity: (v) => set({ filterSensitivity: v }),

  // ══════════════════════════════════════════════════════════════
  // UI
  // ══════════════════════════════════════════════════════════════
  activeView: 'waveform',    // waveform | spectrogram | 3d
  activeTab: 'main',         // main | compare
  comparisonMode: 'cleaned', // original | cleaned
  showAuthModal: false,

  setActiveView: (v) => set({ activeView: v }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setComparisonMode: (m) => set({ comparisonMode: m }),
  setShowAuthModal: (v) => set({ showAuthModal: v }),

  // ══════════════════════════════════════════════════════════════
  // Karşılaştırma Özelliği
  // ══════════════════════════════════════════════════════════════
  compareResults: [],

  addCompareResult: (result) =>
    set((state) => ({ compareResults: [...state.compareResults, result] })),

  clearCompareResults: () => set({ compareResults: [] }),

  // ══════════════════════════════════════════════════════════════
  // Reset (yeni ses dosyası yüklendiğinde)
  // ══════════════════════════════════════════════════════════════
  resetProcessing: () =>
    set({
      recordId: null,
      processingStatus: 'idle',
      processingStep: '',
      uploadProgress: 0,
      originalAudioUrl: null,
      cleanedAudioUrl: null,
      compareResults: [],
    }),
}));

export default useStore;
