import useStore from '../store/useStore';

export default function ControlSliders() {
  const { noiseLevel, filterSensitivity, setNoiseLevel, setFilterSensitivity } = useStore();

  return (
    <div>
      {/* Slider 1: Gürültü Azaltma */}
      <div style={{ marginBottom: '24px' }}>
        {/* Üst satır */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#262626' }}>Gürültü Azaltma Şiddeti</span>
            <div className="group" style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: '#CCCCCC', cursor: 'help' }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="hidden group-hover:block" style={{
                position: 'absolute', zIndex: 20, bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                marginBottom: '8px', padding: '10px 14px', background: '#262626', color: 'white',
                fontSize: '12px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                width: '220px', textAlign: 'center', lineHeight: 1.5,
              }}>
                Yüksek değer daha agresif gürültü azaltma sağlar ancak konuşma doğallığı azalabilir
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: '#262626 transparent transparent transparent' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px', color: '#FA5D19' }}>
              {noiseLevel}
            </span>
            <span style={{ fontSize: '13px', color: '#AAAAAA' }}>/100</span>
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={noiseLevel}
          onChange={(e) => setNoiseLevel(Number(e.target.value))}
          style={{
            width: '100%',
            height: '5px',
            borderRadius: '3px',
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            appearance: 'none',
            background: `linear-gradient(to right, #FA5D19 0%, #FA5D19 ${noiseLevel}%, #EEEEEE ${noiseLevel}%, #EEEEEE 100%)`,
          }}
          id="noise-level-slider"
        />

        {/* Alt satır */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#BBBBBB', fontWeight: 500, marginTop: '6px' }}>
          <span>Hafif</span>
          <span>Agresif</span>
        </div>
      </div>

      {/* Slider 2: Filtre Hassasiyeti */}
      <div>
        {/* Üst satır */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '14px', color: '#262626' }}>Filtre Hassasiyeti</span>
            <div className="group" style={{ position: 'relative' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ color: '#CCCCCC', cursor: 'help' }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 7v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <div className="hidden group-hover:block" style={{
                position: 'absolute', zIndex: 20, bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                marginBottom: '8px', padding: '10px 14px', background: '#262626', color: 'white',
                fontSize: '12px', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                width: '220px', textAlign: 'center', lineHeight: 1.5,
              }}>
                Düşük değer yalnızca belirgin gürültüleri temizler
                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', borderWidth: '4px', borderStyle: 'solid', borderColor: '#262626 transparent transparent transparent' }} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '18px', color: '#FA5D19' }}>
              {filterSensitivity}
            </span>
            <span style={{ fontSize: '13px', color: '#AAAAAA' }}>/100</span>
          </div>
        </div>

        {/* Slider */}
        <input
          type="range"
          min="0"
          max="100"
          value={filterSensitivity}
          onChange={(e) => setFilterSensitivity(Number(e.target.value))}
          style={{
            width: '100%',
            height: '5px',
            borderRadius: '3px',
            outline: 'none',
            cursor: 'pointer',
            WebkitAppearance: 'none',
            appearance: 'none',
            background: `linear-gradient(to right, #FA5D19 0%, #FA5D19 ${filterSensitivity}%, #EEEEEE ${filterSensitivity}%, #EEEEEE 100%)`,
          }}
          id="filter-sensitivity-slider"
        />

        {/* Alt satır */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#BBBBBB', fontWeight: 500, marginTop: '6px' }}>
          <span>Düşük</span>
          <span>Yüksek</span>
        </div>
      </div>
    </div>
  );
}
