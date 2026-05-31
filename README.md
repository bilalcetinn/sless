# SLESS - Turkce Ses Gurultu Giderme Uygulamasi

Model dosyaları şu drive linkinde bulunmaktadır: https://drive.google.com/drive/folders/1tNJFp4gnWfNjT3tM8icvhKkqByHh0k_G

SLESS, Turkce konusma seslerindeki arka plan gurultusunu azaltmak icin gelistirilmis FastAPI + React/Vite tabanli bir web uygulamasidir.

Uygulama ses dosyasi yukleme, sabit modeller arasindan temizleme yapma, iki modeli yan yana karsilastirma, temizlenmis sesi indirme ve kayitli kullanicilar icin islem gecmisi goruntuleme ozelliklerini icerir.

---

## Proje Yapisi

```text
sless/
├── backend/
│   ├── main.py              # FastAPI ana uygulama ve endpointler
│   ├── database.py          # SQLite baglantisi, tablo kurulumu ve sabit model seed'i
│   ├── model_runner.py      # FRCRN, GTCRN, SGMSE+, FullSubNet+ ve MossFormerGAN calistirma katmani
│   ├── frcrn.py             # FRCRN model mimarisi
│   ├── gtcrn.py             # GTCRN model mimarisi
│   ├── sgmse_plus.py        # SGMSE+ model mimarisi
│   ├── requirements.txt     # Python bagimliliklari
│   ├── setup_models.sh      # Harici model kutuphanelerini backend/libs altina kurar
│   └── sless.db             # Yerel SQLite veritabani
├── frontend/
│   ├── src/
│   │   ├── api/client.js    # Axios API istemcisi
│   │   ├── store/useStore.js
│   │   ├── components/
│   │   └── pages/
│   ├── tests/ui-smoke.spec.js
│   └── package.json
├── models/                  # Yerel .pt model dosyalari; Git'e eklenmez
├── uploads/                 # Yuklenen ve temizlenen ses dosyalari; Git'e eklenmez
└── README.md
```

---

## Model Dosyalari

Model dosyalari normal Git ile pushlanmaz. Bunun iki nedeni var:

- `*.pt` dosyalari buyuktur.
- GitHub normal Git push icin tek dosyada 100 MB limiti uygular.

Bu projede kullanilan dosyalardan `frcrn_best_model.pt` ve `fullsubnet+-best_model.pt` 100 MB ustundedir. Bu yuzden `models/` klasoru ve `*.pt` / `*.pth` dosyalari `.gitignore` ile disarida tutulur.

Uygulamayi calistirmak icin asagidaki dosyalari yerel olarak `models/` klasorune koyun:

```text
models/
├── mossformergan-best_model.pt
├── fullsubnet+-best_model.pt
├── frcrn_best_model.pt
├── gtcrn_best_model.pt
└── sgmse_plus_best_model.pt
```

Model dosyalarini repoda saklamak gerekiyorsa normal Git yerine Git LFS veya GitHub Releases kullanin.

---

## Backend Kurulum

Gereksinimler:

- Python 3.10+
- pip

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```

Linux, macOS veya WSL:

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Harici Model Kutuphaneleri

FullSubNet+ ve MossFormerGAN icin yardimci kaynak kodlar `backend/libs/` altinda bulunmalidir. Bu klasor Git'e eklenmez.

Linux, macOS, WSL veya Git Bash ortaminda:

```bash
cd backend
bash setup_models.sh
```

Windows PowerShell'de `bash` komutu yoksa Git Bash veya WSL kullanin.

Backend'i baslatmak icin:

```powershell
cd backend
.\venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend adresi: `http://localhost:8000`

API dokumantasyonu: `http://localhost:8000/docs`

---

## Frontend Kurulum

Gereksinimler:

- Node.js 18+
- npm

```powershell
cd frontend
npm install
npm run dev
```

Frontend adresi: `http://localhost:5173`

---

## Kullanici ve Veritabani Notu

`backend/sless.db` yerel gelistirme veritabanidir. Icinde kullanici, session ve islem gecmisi verileri tutulur. Yeni kurulumda kayit ekranindan test kullanicisi olusturabilirsiniz.

Yerel test veritabani Git'e veri kaybi olmamasi icin repoda bulunabilir; ancak aktif gelistirme sirasinda olusan session/gecmis kayitlarini commit'e almamak daha sagliklidir.

---

## Sabit Modeller

UI'da model ekleme akisi kaldirildi. Uygulama yalnizca veritabaninda seed edilen su 5 modeli kullanir:

| Model | Beklenen dosya |
|-------|----------------|
| MossFormerGAN Best Model | `models/mossformergan-best_model.pt` |
| FullSubNet+ Best Model | `models/fullsubnet+-best_model.pt` |
| FRCRN Best Model | `models/frcrn_best_model.pt` |
| GTCRN Best Model | `models/gtcrn_best_model.pt` |
| SGMSE+ Best Model | `models/sgmse_plus_best_model.pt` |

Sabit model listesi [backend/database.py](backend/database.py) icindeki `FIXED_MODELS` alanindan yonetilir.

---

## API Endpointleri

UI'nin calismasi icin temel endpointler:

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| GET | `/api/health` | Backend saglik kontrolu |
| GET | `/api/models` | Aktif sabit modelleri listeler |
| POST | `/api/auth/register` | Kullanici kaydi |
| POST | `/api/auth/login` | Kullanici girisi |
| GET | `/api/auth/me` | Mevcut kullanici bilgisi |
| POST | `/api/audio/upload` | Ses dosyasi yukler |
| POST | `/api/audio/process/{id}` | Yuklenen sesi secili modelle isler |
| POST | `/api/audio/process-with-model` | Ayni sesi farkli modelle isler |
| GET | `/api/audio/status/{id}` | Islem durumunu sorgular |
| GET | `/api/audio/download/{id}` | Temizlenmis sesi indirir |
| GET | `/api/audio/history` | Kullanici islem gecmisini listeler |
| DELETE | `/api/audio/history/{id}` | Gecmis kaydini siler |

Not: Backend'de model ekleme/silme endpointleri eski uyumluluk icin duruyor olabilir, ancak mevcut UI bu akisi kullanmaz.

---

## Test ve Dogrulama

Frontend:

```powershell
cd frontend
npm run lint
npm run build
npm run test:ui
```

Backend soz dizimi kontrolu:

```powershell
backend\venv\Scripts\python.exe -m py_compile backend\main.py backend\database.py backend\model_runner.py
```

---

## Bu Surumdeki Degisiklikler

Son `master` durumundan sonra yapilan ana guncellemeler:

- UI model ekleme akisi kaldirildi; uygulama sabit 5 model uzerinden calisacak sekilde duzenlendi.
- SGMSE+ modeli sabit model listesine ve backend inference akisine eklendi.
- Veritabani seed mantigi `MossFormerGAN`, `FullSubNet+`, `FRCRN`, `GTCRN` ve `SGMSE+` modellerine gore guncellendi.
- `asker` test kullanicisinin sifresi yerel test icin `123456` olarak sifirlandi.
- Model karsilastirma ekraninda iki panelin de islem sirasinda birlikte yukleme durumuna gecmesi saglandi.
- Temizlenmis ses icin dalga formu panellerine kucuk indirme butonu eklendi.
- Gecmis sayfasi yeniden duzenlendi: gereksiz basliklar kaldirildi, kayda tiklayinca dalga formu/spektrogram/3D gorunumleri acilir hale getirildi.
- Her gecmis kartina naif cop kutusu butonu eklendi; silme islemi icin uygulama icinde ortak dialog tasarimi kullanildi.
- Native `alert` / `confirm` popup'lari yerine ortak `AppDialog` formati eklendi.
- UI metinleri sadele┼ştirildi ve Turkcelestirildi; `Speech Focus` yerine `Konusma bandi` kullanildi.
- Frontend smoke testleri mevcut UI akisini dogrulayacak sekilde guncellendi.
- README ve model kurulum notlari mevcut sabit model akisina gore yenilendi.
