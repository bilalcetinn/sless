import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import useStore from '../store/useStore';

// ─── Sabitler ────────────────────────────────────────────────────────────────
const GRID_SIZE = 64;          // 64×64 = 4096 vertex
const PLANE_SIZE = 20;         // Three.js düzlem boyutu
const CANVAS_HEIGHT = 400;     // Canvas yüksekliği (px)
const LERP_SPEED = 0.06;       // Mod geçiş animasyonu hızı (her frame)
const HEIGHT_SCALE = 6;        // Enerji → yükseklik çarpanı
const NOISE_AMOUNT = 0.15;     // Hafif görsel texture gürültüsü

// ─── Audio → Enerji Grid Hesaplama ──────────────────────────────────────────
// AudioBuffer'dan GRID_SIZE×GRID_SIZE enerji haritası üretir.
// Her hücre için küçük bir pencere üzerinden RMS hesaplar.
function computeEnergyGrid(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const totalSamples = data.length;
  const gridTotal = GRID_SIZE * GRID_SIZE;
  const grid = new Float32Array(gridTotal);

  // Her grid hücresi için pencere boyutu
  const windowSize = Math.max(1, Math.floor(totalSamples / gridTotal));

  for (let i = 0; i < gridTotal; i++) {
    const start = Math.floor((i / gridTotal) * totalSamples);
    const end = Math.min(start + windowSize, totalSamples);

    // RMS enerji hesapla
    let sumSq = 0;
    for (let j = start; j < end; j++) {
      sumSq += data[j] * data[j];
    }
    const rms = Math.sqrt(sumSq / (end - start));

    // Hafif görsel texture gürültüsü ekle (ana veri audio-derived)
    const noise = (Math.random() - 0.5) * NOISE_AMOUNT;
    grid[i] = Math.max(0, rms * HEIGHT_SCALE + noise);
  }

  return grid;
}

// ─── Fark Grid Hesaplama ────────────────────────────────────────────────────
// difference = max(0, original - cleaned)
// Gürültü azaltılan bölgeler yükselir
function computeDifferenceGrid(originalGrid, cleanedGrid) {
  const grid = new Float32Array(originalGrid.length);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = Math.max(0, originalGrid[i] - cleanedGrid[i]);
  }
  return grid;
}

// ─── Demo Yüzey (audio yokken placeholder) ──────────────────────────────────
function generateDemoGrid() {
  const grid = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const x = i / GRID_SIZE;
      const z = j / GRID_SIZE;
      const val = Math.sin(x * 10) * Math.cos(z * 10) * 1.5 +
                  Math.sin(x * 5 + z * 3) * 0.8 +
                  Math.random() * 0.4;
      grid[i * GRID_SIZE + j] = Math.max(0, val);
    }
  }
  return grid;
}

// ─── Vertex Renkleri ────────────────────────────────────────────────────────
// Mode'a göre farklı renk paleti uygular
function applyVertexColors(colors, heights, mode) {
  for (let i = 0; i < heights.length; i++) {
    const val = Math.max(0, Math.min(1, heights[i] / (HEIGHT_SCALE * 0.5)));
    let r, g, b;

    if (mode === 'original') {
      // Koyu mavi (#1a1a4e) → turuncu (#FA5D19)
      r = 0.10 + val * 0.88;
      g = 0.14 + val * 0.22;
      b = 0.49 * (1 - val) + val * 0.10;
    } else if (mode === 'cleaned') {
      // Koyu mavi → sakin mavi/cyan → hafif turuncu
      r = 0.10 + val * 0.30;
      g = 0.14 + val * 0.55;
      b = 0.49 + val * 0.20;
    } else {
      // Difference: koyu mavi/mor → parlak turuncu (#FA5D19)
      r = 0.12 + val * 0.86;
      g = 0.08 + val * 0.28;
      b = 0.35 * (1 - val);
    }

    colors[i * 3]     = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
}

// ─── Ana Bileşen ────────────────────────────────────────────────────────────
export default function ThreeDSpectro() {
  const { originalAudioUrl, cleanedAudioUrl, processingStatus } = useStore();
  const containerRef = useRef(null);

  // Three.js referansları
  const sceneDataRef = useRef(null);
  const animFrameRef = useRef(null);

  // Audio-derived enerji gridleri
  const originalGridRef = useRef(null);
  const cleanedGridRef = useRef(null);
  const differenceGridRef = useRef(null);

  // Animasyon hedef ve mevcut yükseklikler
  const currentHeightsRef = useRef(null);
  const targetHeightsRef = useRef(null);

  // UI state
  const [viewMode, setViewMode] = useState('original'); // original | cleaned | difference
  const [loading, setLoading] = useState(false);

  // ── Three.js sahne kurulumu (bir kez) ──
  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    scene.fog = new THREE.Fog(0x1a1a2e, 30, 60);

    // Camera
    const camera = new THREE.PerspectiveCamera(50, width / CANVAS_HEIGHT, 0.1, 100);
    camera.position.set(20, 15, 20);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, CANVAS_HEIGHT);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;

    // PlaneGeometry (GRID_SIZE×GRID_SIZE vertex)
    const geometry = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, GRID_SIZE - 1, GRID_SIZE - 1);
    geometry.rotateX(-Math.PI / 2);

    // Vertex colors buffer
    const colorArray = new Float32Array(geometry.attributes.position.count * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe: false,
      flatShading: true,
      shininess: 60,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Işıklar
    scene.add(new THREE.AmbientLight(0x404060, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);
    const pointLight = new THREE.PointLight(0xFA5D19, 0.5, 30);
    pointLight.position.set(0, 10, 0);
    scene.add(pointLight);

    // Grid helper
    const gridHelper = new THREE.GridHelper(PLANE_SIZE, 20, 0x333355, 0x222244);
    gridHelper.position.y = -0.1;
    scene.add(gridHelper);

    // Demo yüzey ile başlat
    const demoGrid = generateDemoGrid();
    const totalVertices = GRID_SIZE * GRID_SIZE;
    currentHeightsRef.current = new Float32Array(totalVertices);
    targetHeightsRef.current = new Float32Array(totalVertices);

    // Demo'yu hem current hem target olarak ayarla
    for (let i = 0; i < totalVertices; i++) {
      currentHeightsRef.current[i] = demoGrid[i];
      targetHeightsRef.current[i] = demoGrid[i];
    }

    // İlk render'da demo yüzeyi uygula
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, demoGrid[i] || 0);
    }
    applyVertexColors(colorArray, currentHeightsRef.current, 'original');
    positions.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
    geometry.computeVertexNormals();

    // Referansları kaydet
    sceneDataRef.current = { scene, camera, renderer, controls, geometry, material, mesh, positions, colorArray };

    // ── Animasyon döngüsü: lerp + render ──
    let currentMode = 'original';
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      // Smooth lerp: currentHeights → targetHeights
      const current = currentHeightsRef.current;
      const target = targetHeightsRef.current;
      if (current && target && positions) {
        let needsUpdate = false;
        for (let i = 0; i < current.length && i < positions.count; i++) {
          const diff = target[i] - current[i];
          if (Math.abs(diff) > 0.001) {
            current[i] += diff * LERP_SPEED;
            needsUpdate = true;
          }
          positions.setY(i, current[i]);
        }
        if (needsUpdate) {
          positions.needsUpdate = true;
          geometry.computeVertexNormals();
          // Renkleri güncelle (mevcut yüksekliklere göre)
          applyVertexColors(colorArray, current, currentMode);
          geometry.attributes.color.needsUpdate = true;
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    // viewMode değişince animasyon döngüsüne bildirmek için
    // dışarıdan erişilebilir setter
    sceneDataRef.current.setMode = (mode) => { currentMode = mode; };

    // ── Resize ──
    function handleResize() {
      const w = container.clientWidth;
      camera.aspect = w / CANVAS_HEIGHT;
      camera.updateProjectionMatrix();
      renderer.setSize(w, CANVAS_HEIGHT);
    }
    window.addEventListener('resize', handleResize);

    // ── Cleanup: bellek sızıntısını önle ──
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      controls.dispose();
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      container.innerHTML = '';
      sceneDataRef.current = null;
    };
  }, []);

  // ── Audio Decode: originalAudioUrl değişince ──
  useEffect(() => {
    if (!originalAudioUrl) {
      originalGridRef.current = null;
      differenceGridRef.current = null;
      return;
    }

    let cancelled = false;

    async function decode() {
      try {
        setLoading(true);
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(originalAudioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Race condition koruması
        if (cancelled) { audioCtx.close(); return; }

        const grid = computeEnergyGrid(audioBuffer);
        originalGridRef.current = grid;

        // Eğer cleaned da varsa difference'ı güncelle
        if (cleanedGridRef.current) {
          differenceGridRef.current = computeDifferenceGrid(grid, cleanedGridRef.current);
        }

        // Aktif mod'a göre target'ı ayarla
        updateTargetForMode(viewMode);

        audioCtx.close();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[ThreeDSpectro] Original decode hatası:', err);
          setLoading(false);
        }
      }
    }

    decode();
    return () => { cancelled = true; };
  }, [originalAudioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio Decode: cleanedAudioUrl değişince ──
  useEffect(() => {
    if (!cleanedAudioUrl) {
      cleanedGridRef.current = null;
      differenceGridRef.current = null;
      return;
    }

    let cancelled = false;

    async function decode() {
      try {
        setLoading(true);
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const response = await fetch(cleanedAudioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        if (cancelled) { audioCtx.close(); return; }

        const grid = computeEnergyGrid(audioBuffer);
        cleanedGridRef.current = grid;

        // Difference grid'i hesapla
        if (originalGridRef.current) {
          differenceGridRef.current = computeDifferenceGrid(originalGridRef.current, grid);
        }

        updateTargetForMode(viewMode);

        audioCtx.close();
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[ThreeDSpectro] Cleaned decode hatası:', err);
          setLoading(false);
        }
      }
    }

    decode();
    return () => { cancelled = true; };
  }, [cleanedAudioUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Processing bitince otomatik difference moduna geç ──
  useEffect(() => {
    if (processingStatus === 'done' && cleanedAudioUrl && originalGridRef.current && cleanedGridRef.current) {
      setViewMode('difference');
    }
  }, [processingStatus, cleanedAudioUrl]);

  // ── viewMode değişince target grid'i güncelle ──
  const updateTargetForMode = useCallback((mode) => {
    if (!targetHeightsRef.current) return;

    let sourceGrid = null;

    if (mode === 'original') {
      sourceGrid = originalGridRef.current;
    } else if (mode === 'cleaned') {
      sourceGrid = cleanedGridRef.current;
    } else if (mode === 'difference') {
      sourceGrid = differenceGridRef.current;
    }

    // Grid yoksa demo yüzeyi kullan
    if (!sourceGrid) {
      sourceGrid = generateDemoGrid();
    }

    for (let i = 0; i < targetHeightsRef.current.length; i++) {
      targetHeightsRef.current[i] = sourceGrid[i] || 0;
    }

    // Animasyon döngüsüne modu bildir (renkleme için)
    if (sceneDataRef.current?.setMode) {
      sceneDataRef.current.setMode(mode);
    }
  }, []);

  // viewMode state değişince hedefi güncelle
  useEffect(() => {
    updateTargetForMode(viewMode);
  }, [viewMode, updateTargetForMode]);

  // ── Mod butonları ──
  const hasCleaned = !!cleanedAudioUrl;

  const modeButtons = [
    { key: 'original', label: 'Orijinal', enabled: true },
    { key: 'cleaned', label: 'Temizlenmiş', enabled: hasCleaned },
    { key: 'difference', label: 'Fark', enabled: hasCleaned },
  ];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '1px solid #F0F0F0',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        position: 'relative',
      }}
    >
      {/* Başlık + Mod Butonları */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#AAAAAA',
            }}
          >
            3D SES ENERJİ HARİTASI
          </span>
          {loading && (
            <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: '#FA5D19' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
              <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
        </div>

        {/* Segmented Control */}
        <div style={{ display: 'inline-flex', background: '#F5F5F5', borderRadius: '8px', padding: '3px', gap: '2px' }}>
          {modeButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => { if (btn.enabled) setViewMode(btn.key); }}
              disabled={!btn.enabled}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: btn.enabled ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                fontFamily: "'Inter', sans-serif",
                // Aktif
                ...(viewMode === btn.key && btn.enabled ? {
                  background: '#262626',
                  color: '#FFFFFF',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                } : {}),
                // Pasif ama etkin
                ...(viewMode !== btn.key && btn.enabled ? {
                  background: 'transparent',
                  color: '#888',
                } : {}),
                // Disabled
                ...(!btn.enabled ? {
                  background: 'transparent',
                  color: '#CCCCCC',
                  opacity: 0.5,
                } : {}),
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Temizlenmiş ses yokken bilgi mesajı */}
      {!hasCleaned && (
        <div
          style={{
            background: '#FFF9F7',
            border: '1px solid rgba(250,93,25,0.15)',
            borderRadius: '8px',
            padding: '8px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FA5D19" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '12px', color: '#888', fontWeight: 500 }}>
            Temizlenmiş ses oluşunca karşılaştırma aktif olur
          </span>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            left: '16px',
            right: '16px',
            bottom: '40px',
            top: '80px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            background: 'rgba(26,26,46,0.85)',
            borderRadius: '10px',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: '#FA5D19' }}>
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.2" />
            <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: '12px', color: '#AAAAAA', fontWeight: 500 }}>3D yüzey hazırlanıyor…</span>
        </div>
      )}

      {/* Three.js Canvas konteyneri */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: CANVAS_HEIGHT + 'px',
          borderRadius: '10px',
          overflow: 'hidden',
        }}
      />

      {/* Alt bilgi */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
        <p style={{ fontSize: '11px', color: '#BBBBBB', margin: 0 }}>
          Mouse ile döndürün, kaydırın, yakınlaştırın
        </p>
        {/* Aktif mod göstergesi */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              display: 'inline-block',
              background: viewMode === 'original' ? '#FA5D19'
                        : viewMode === 'cleaned' ? '#3B82F6'
                        : '#A855F7',
            }}
          />
          <span style={{ fontSize: '11px', color: '#AAAAAA', fontWeight: 600 }}>
            {viewMode === 'original' ? 'Orijinal enerji' : viewMode === 'cleaned' ? 'Temizlenmiş enerji' : 'Enerji farkı'}
          </span>
        </div>
      </div>
    </div>
  );
}
