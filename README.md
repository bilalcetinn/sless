# SLESS — Türkçe Ses Gürültü Giderme Uygulaması

Türkçe konuşma seslerindeki arka plan gürültüsünü azaltan, AI destekli bir web uygulamasıdır.
Kullanıcılar ses dosyası yükleyip, seçtikleri model ile gürültü giderme işlemi yapabilir.
Misafir olarak ya da kayıtlı kullanıcı olarak kullanılabilir.
Farklı modellerin sonuçlarını karşılaştırma özelliği de mevcuttur.

---

## 📁 Klasör Yapısı

```
sless/
├── backend/
│   ├── database.py          # SQLite veritabanı (aiosqlite)
│   ├── model_runner.py      # Dinamik model yükleme ve çalıştırma
│   ├── main.py              # FastAPI ana uygulama
│   ├── requirements.txt     # Python bağımlılıkları
│   └── sless.db             # SQLite veritabanı (otomatik oluşur)
├── frontend/
│   ├── src/
│   │   ├── api/client.js    # Axios API istemcisi
│   │   ├── store/useStore.js # Zustand state yönetimi
│   │   ├── components/      # React bileşenleri
│   │   │   ├── Navbar.jsx
│   │   │   ├── ModelSelector.jsx
│   │   │   ├── AudioUploader.jsx
│   │   │   ├── ControlSliders.jsx
│   │   │   ├── ProcessingStatus.jsx
│   │   │   ├── WaveformViewer.jsx
│   │   │   ├── SpectrogramView.jsx
│   │   │   ├── ThreeDSpectro.jsx
│   │   │   ├── AudioComparison.jsx
│   │   │   ├── AuthModal.jsx
│   │   │   ├── HistoryPanel.jsx
│   │   │   └── ModelComparison.jsx
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   └── History.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── uploads/                 # Yüklenen ve temizlenen sesler (otomatik oluşur)
│   ├── original/
│   └── cleaned/
├── models/                  # PyTorch model dosyaları (.pt / .pth)
└── README.md
```

---

## 🔧 Backend Kurulum ve Çalıştırma

### Gereksinimler
- Python 3.10+
- pip

### Adımlar

```bash
# 1. Backend klasörüne girin
cd backend

# 2. Sanal ortam oluşturun (önerilen)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# 3. Bağımlılıkları yükleyin
pip install -r requirements.txt

# 4. Sunucuyu başlatın
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend http://localhost:8000 adresinde çalışacaktır.
API dokümantasyonu: http://localhost:8000/docs

---

## 🎨 Frontend Kurulum ve Çalıştırma

### Gereksinimler
- Node.js 18+
- npm

### Adımlar

```bash
# 1. Frontend klasörüne girin
cd frontend

# 2. Bağımlılıkları yükleyin
npm install

# 3. Geliştirme sunucusunu başlatın
npm run dev
```

Frontend http://localhost:5173 adresinde çalışacaktır.

---

## 🤖 Model Ekleme Rehberi

Arkadaşınız modeli eğitip `.pt` dosyası olarak verdiyse:

### 1. Model Dosyasını Kopyalayın
```bash
# .pt veya .pth dosyasını models/ klasörüne koyun
cp path/to/trained_model.pt models/my_model_v1.pt
```

### 2. Uygulamadan Model Ekleyin
1. Uygulamayı tarayıcıda açın (http://localhost:5173)
2. Sol paneldeki "Model Seçimi" dropdown'ını açın
3. "**+ Model Ekle**" butonuna tıklayın
4. Aşağıdaki bilgileri girin:
   - **Model Adı:** örn. "UNet Denoiser v3"
   - **Dosya Yolu:** örn. `models/my_model_v1.pt`
   - **Açıklama:** örn. "UNet tabanlı denoiser, 50 saat Türkçe veri ile eğitildi"
5. "**Kaydet**" butonuna tıklayın

### 3. Kullanmaya Başlayın
Model otomatik olarak listeye eklenir ve seçilebilir hale gelir.
Kod değişikliği gerekmez!

### Not
Şu an model dosyaları mevcut olmadığı için, `model_runner.py` dosyası
ses dosyasını olduğu gibi kopyalayarak simüle etmektedir.
Gerçek model teslim edildiğinde, `model_runner.py` içindeki yorum
satırları aktif edilerek gerçek inference yapılabilir.

---

## 👤 Misafir vs Kayıtlı Kullanıcı

| Özellik | Misafir | Kayıtlı |
|---------|---------|---------|
| Ses yükleme | ✅ | ✅ |
| Ses temizleme | ✅ | ✅ |
| Model karşılaştırma | ✅ | ✅ |
| İşlem geçmişi | ❌ | ✅ |
| Temizlenmiş ses indirme | ✅ | ✅ |

Kayıt olmadan tüm temel özellikleri kullanabilirsiniz.
Geçmiş kayıtlarınıza erişmek için hesap oluşturmanız gerekir.

---

## 📡 API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/api/models` | Aktif modelleri listele |
| POST | `/api/models` | Yeni model ekle |
| DELETE | `/api/models/{id}` | Modeli devre dışı bırak |
| POST | `/api/auth/register` | Kullanıcı kaydı |
| POST | `/api/auth/login` | Kullanıcı girişi |
| GET | `/api/auth/me` | Mevcut kullanıcı bilgisi |
| POST | `/api/audio/upload` | Ses dosyası yükle |
| POST | `/api/audio/process/{id}` | Ses dosyasını işle |
| POST | `/api/audio/process-with-model` | Farklı modelle işle |
| GET | `/api/audio/status/{id}` | İşlem durumu sorgula |
| GET | `/api/audio/download/{id}` | Temizlenmiş sesi indir |
| GET | `/api/audio/history` | İşlem geçmişi |
