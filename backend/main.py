"""
SLESS — FastAPI Ana Uygulama
Türkçe Ses Gürültü Giderme Uygulaması Backend API
"""

import os
import uuid
import asyncio
from datetime import datetime, timedelta
from typing import Optional

from fastapi import (
    FastAPI,
    File,
    Form,
    UploadFile,
    HTTPException,
    Depends,
    Request,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, field_validator
import bcrypt
from jose import jwt, JWTError

from database import get_db, init_db
from model_runner import model_runner

# ── Ayarlar ──
SECRET_KEY = "sless-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
ALLOWED_EXTENSIONS = {".wav", ".mp3", ".ogg", ".flac", ".m4a"}

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
UPLOAD_ORIGINAL = os.path.join(BASE_DIR, "uploads", "original")
UPLOAD_CLEANED = os.path.join(BASE_DIR, "uploads", "cleaned")

app = FastAPI(
    title="SLESS API",
    description="Türkçe Ses Gürültü Giderme Uygulaması",
    version="1.0.0",
)

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ──
@app.on_event("startup")
async def startup():
    await init_db()
    os.makedirs(UPLOAD_ORIGINAL, exist_ok=True)
    os.makedirs(UPLOAD_CLEANED, exist_ok=True)
    os.makedirs(os.path.join(BASE_DIR, "models"), exist_ok=True)
    print("[OK] SLESS API baslatildi.")


# ── Static Files ──
os.makedirs(os.path.join(BASE_DIR, "uploads"), exist_ok=True)
app.mount("/files", StaticFiles(directory=os.path.join(BASE_DIR, "uploads")), name="files")


# ── Global Exception Handler ──
@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Sunucu hatası oluştu. Lütfen tekrar deneyin."},
    )


# ── Yardımcı Fonksiyonlar ──
def create_token(user_id: int) -> str:
    """JWT token oluştur."""
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[int]:
    """JWT token'ı doğrula, user_id döndür."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        return user_id
    except (JWTError, ValueError, TypeError):
        return None


async def get_current_user(request: Request) -> Optional[dict]:
    """Authorization header'dan kullanıcıyı al."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    user_id = verify_token(token)
    if not user_id:
        return None
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "email": row["email"],
                "created_at": row["created_at"],
            }
        return None
    finally:
        await db.close()


async def require_auth(request: Request) -> dict:
    """Kimlik doğrulama zorunlu olan endpoint'ler için."""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Giriş yapmanız gerekiyor.")
    return user


# ══════════════════════════════════════════════════════════════
# 1. MODEL YÖNETİMİ
# ══════════════════════════════════════════════════════════════


class ModelCreate(BaseModel):
    name: str
    file_path: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Model adı boş olamaz.")
        return v.strip()

    @field_validator("file_path")
    @classmethod
    def valid_file_path(cls, v):
        if not v.endswith(".pt") and not v.endswith(".pth"):
            raise ValueError("Dosya yolu .pt veya .pth ile bitmelidir.")
        return v


@app.get("/api/models")
async def list_models():
    """Tüm aktif modelleri listele."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, name, description, file_path, created_at FROM models WHERE is_active = 1 ORDER BY id"
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "file_path": r["file_path"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        await db.close()


@app.post("/api/models")
async def add_model(data: ModelCreate):
    """Yeni model ekle."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "INSERT INTO models (name, file_path, description) VALUES (?, ?, ?)",
            (data.name, data.file_path, data.description),
        )
        await db.commit()
        model_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM models WHERE id = ?", (model_id,))
        row = await cursor.fetchone()
        return {
            "id": row["id"],
            "name": row["name"],
            "file_path": row["file_path"],
            "description": row["description"],
            "created_at": row["created_at"],
        }
    finally:
        await db.close()


@app.delete("/api/models/{model_id}")
async def delete_model(model_id: int):
    """Modeli devre dışı bırak (fiziksel silme yok)."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT id FROM models WHERE id = ?", (model_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Model bulunamadı.")
        await db.execute("UPDATE models SET is_active = 0 WHERE id = ?", (model_id,))
        await db.commit()
        return {"success": True, "message": "Model devre dışı bırakıldı"}
    finally:
        await db.close()


# ══════════════════════════════════════════════════════════════
# 2. KULLANICI YÖNETİMİ
# ══════════════════════════════════════════════════════════════


class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/register")
async def register(data: RegisterRequest):
    """Yeni kullanıcı kaydı."""
    if not data.username or not data.email or not data.password:
        raise HTTPException(status_code=400, detail="Tüm alanlar zorunludur.")

    if len(data.password) < 6:
        raise HTTPException(
            status_code=400, detail="Şifre en az 6 karakter olmalıdır."
        )

    db = await get_db()
    try:
        # Kullanıcı adı kontrolü
        cursor = await db.execute(
            "SELECT id FROM users WHERE username = ?", (data.username,)
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor."
            )

        # Email kontrolü
        cursor = await db.execute(
            "SELECT id FROM users WHERE email = ?", (data.email,)
        )
        if await cursor.fetchone():
            raise HTTPException(
                status_code=400, detail="Bu e-posta adresi zaten kayıtlı."
            )

        # Şifreyi hashle
        password_hash = bcrypt.hashpw(
            data.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        cursor = await db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (data.username, data.email, password_hash),
        )
        await db.commit()
        user_id = cursor.lastrowid

        token = create_token(user_id)

        # Session kaydet
        expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
        await db.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user_id, token, expires_at.isoformat()),
        )
        await db.commit()

        return {
            "token": token,
            "user": {
                "id": user_id,
                "username": data.username,
                "email": data.email,
            },
        }
    finally:
        await db.close()


@app.post("/api/auth/login")
async def login(data: LoginRequest):
    """Kullanıcı girişi."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT * FROM users WHERE email = ?", (data.email,)
        )
        user = await cursor.fetchone()

        if not user:
            raise HTTPException(
                status_code=401, detail="E-posta veya şifre hatalı."
            )

        if not bcrypt.checkpw(
            data.password.encode("utf-8"),
            user["password_hash"].encode("utf-8"),
        ):
            raise HTTPException(
                status_code=401, detail="E-posta veya şifre hatalı."
            )

        token = create_token(user["id"])

        # Session kaydet
        expires_at = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
        await db.execute(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
            (user["id"], token, expires_at.isoformat()),
        )
        await db.commit()

        return {
            "token": token,
            "user": {
                "id": user["id"],
                "username": user["username"],
                "email": user["email"],
            },
        }
    finally:
        await db.close()


@app.get("/api/auth/me")
async def get_me(request: Request):
    """Mevcut kullanıcı bilgisi."""
    user = await require_auth(request)
    return user


# ══════════════════════════════════════════════════════════════
# 3. SES İŞLEME
# ══════════════════════════════════════════════════════════════


@app.post("/api/audio/upload")
async def upload_audio(
    file: UploadFile = File(...),
    model_id: int = Form(...),
    noise_level: float = Form(50.0),
    filter_sensitivity: float = Form(50.0),
    token: Optional[str] = Form(None),
):
    """Ses dosyası yükle."""
    # Uzantı kontrolü
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya formatı: {ext}. Desteklenen: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Dosyayı oku ve boyut kontrolü yap
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Dosya boyutu 100MB'ı aşamaz.",
        )

    # Model kontrolü
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id FROM models WHERE id = ? AND is_active = 1", (model_id,)
        )
        if not await cursor.fetchone():
            raise HTTPException(status_code=404, detail="Seçilen model bulunamadı.")

        # Kullanıcı tespiti
        user_id = None
        if token:
            user_id = verify_token(token)

        # Dosyayı kaydet
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_ORIGINAL, unique_name)
        with open(file_path, "wb") as f:
            f.write(contents)

        # Veritabanına kayıt
        relative_path = f"original/{unique_name}"
        cursor = await db.execute(
            """INSERT INTO audio_records
               (user_id, original_file_path, model_id, noise_reduction_level, filter_sensitivity, status)
               VALUES (?, ?, ?, ?, ?, 'pending')""",
            (user_id, relative_path, model_id, noise_level, filter_sensitivity),
        )
        await db.commit()
        record_id = cursor.lastrowid

        return {
            "record_id": record_id,
            "status": "pending",
            "message": "Dosya başarıyla yüklendi.",
            "original_file": relative_path,
        }
    finally:
        await db.close()


@app.post("/api/audio/process/{record_id}")
async def process_audio(record_id: int):
    """Ses dosyasını modelle işle."""
    db = await get_db()
    try:
        # Kayıt bilgisini al
        cursor = await db.execute(
            "SELECT * FROM audio_records WHERE id = ?", (record_id,)
        )
        record = await cursor.fetchone()
        if not record:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")

        if record["status"] == "processing":
            raise HTTPException(status_code=400, detail="Bu dosya zaten işleniyor.")

        # Model bilgisini al
        cursor = await db.execute(
            "SELECT * FROM models WHERE id = ? AND is_active = 1",
            (record["model_id"],),
        )
        model = await cursor.fetchone()
        if not model:
            raise HTTPException(status_code=404, detail="Model bulunamadı.")

        # Status: processing
        await db.execute(
            "UPDATE audio_records SET status = 'processing' WHERE id = ?",
            (record_id,),
        )
        await db.commit()

        try:
            # Model inference
            input_path = os.path.join(
                BASE_DIR, "uploads", record["original_file_path"]
            )
            output_path = model_runner.run(
                model_file_path=model["file_path"],
                input_audio_path=input_path,
                noise_level=record["noise_reduction_level"],
                sensitivity=record["filter_sensitivity"],
            )

            # Temizlenmiş dosyanın relative yolunu kaydet
            cleaned_filename = os.path.basename(output_path)
            relative_cleaned = f"cleaned/{cleaned_filename}"

            await db.execute(
                "UPDATE audio_records SET status = 'done', cleaned_file_path = ? WHERE id = ?",
                (relative_cleaned, record_id),
            )
            await db.commit()

            return {
                "record_id": record_id,
                "status": "done",
                "cleaned_file_path": relative_cleaned,
            }
        except Exception as e:
            await db.execute(
                "UPDATE audio_records SET status = 'error' WHERE id = ?",
                (record_id,),
            )
            await db.commit()
            raise HTTPException(
                status_code=500,
                detail=f"Model işleme hatası: {str(e)}",
            )
    finally:
        await db.close()


@app.post("/api/audio/process-with-model")
async def process_with_model(request: Request):
    """
    Karşılaştırma özelliği: Aynı ses dosyasını farklı bir modelle işle.
    Yeni bir audio_records satırı oluşturur.
    """
    body = await request.json()
    record_id = body.get("record_id")
    model_id = body.get("model_id")
    noise_level = body.get("noise_level", 50.0)
    filter_sensitivity = body.get("filter_sensitivity", 50.0)

    if not record_id or not model_id:
        raise HTTPException(
            status_code=400, detail="record_id ve model_id zorunludur."
        )

    db = await get_db()
    try:
        # Orijinal kaydı al
        cursor = await db.execute(
            "SELECT * FROM audio_records WHERE id = ?", (record_id,)
        )
        original_record = await cursor.fetchone()
        if not original_record:
            raise HTTPException(status_code=404, detail="Orijinal kayıt bulunamadı.")

        # Model kontrolü
        cursor = await db.execute(
            "SELECT * FROM models WHERE id = ? AND is_active = 1", (model_id,)
        )
        model = await cursor.fetchone()
        if not model:
            raise HTTPException(status_code=404, detail="Model bulunamadı.")

        # Yeni kayıt oluştur
        cursor = await db.execute(
            """INSERT INTO audio_records
               (user_id, original_file_path, model_id, noise_reduction_level, filter_sensitivity, status)
               VALUES (?, ?, ?, ?, ?, 'processing')""",
            (
                original_record["user_id"],
                original_record["original_file_path"],
                model_id,
                noise_level,
                filter_sensitivity,
            ),
        )
        await db.commit()
        new_record_id = cursor.lastrowid

        try:
            # Model inference
            input_path = os.path.join(
                BASE_DIR, "uploads", original_record["original_file_path"]
            )
            output_path = model_runner.run(
                model_file_path=model["file_path"],
                input_audio_path=input_path,
                noise_level=noise_level,
                sensitivity=filter_sensitivity,
            )

            cleaned_filename = os.path.basename(output_path)
            relative_cleaned = f"cleaned/{cleaned_filename}"

            await db.execute(
                "UPDATE audio_records SET status = 'done', cleaned_file_path = ? WHERE id = ?",
                (relative_cleaned, new_record_id),
            )
            await db.commit()

            return {
                "record_id": new_record_id,
                "status": "done",
                "cleaned_file_path": relative_cleaned,
                "model_name": model["name"],
            }
        except Exception as e:
            await db.execute(
                "UPDATE audio_records SET status = 'error' WHERE id = ?",
                (new_record_id,),
            )
            await db.commit()
            raise HTTPException(
                status_code=500,
                detail=f"Model işleme hatası: {str(e)}",
            )
    finally:
        await db.close()


@app.get("/api/audio/status/{record_id}")
async def get_audio_status(record_id: int):
    """Ses işleme durumunu sorgula."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, status, cleaned_file_path, created_at FROM audio_records WHERE id = ?",
            (record_id,),
        )
        record = await cursor.fetchone()
        if not record:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")
        return {
            "record_id": record["id"],
            "status": record["status"],
            "cleaned_file_path": record["cleaned_file_path"],
            "created_at": record["created_at"],
        }
    finally:
        await db.close()


@app.get("/api/audio/download/{record_id}")
async def download_audio(record_id: int):
    """Temizlenmiş ses dosyasını indir."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT cleaned_file_path, status FROM audio_records WHERE id = ?",
            (record_id,),
        )
        record = await cursor.fetchone()
        if not record:
            raise HTTPException(status_code=404, detail="Kayıt bulunamadı.")

        if record["status"] != "done":
            raise HTTPException(
                status_code=400, detail="Dosya henüz hazır değil."
            )

        file_path = os.path.join(BASE_DIR, "uploads", record["cleaned_file_path"])
        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404, detail="Temizlenmiş dosya bulunamadı."
            )

        return FileResponse(
            file_path,
            media_type="audio/wav",
            filename=f"sless_cleaned_{record_id}.wav",
        )
    finally:
        await db.close()


@app.get("/api/audio/history")
async def get_history(request: Request):
    """Kullanıcının ses işleme geçmişini listele."""
    user = await require_auth(request)

    db = await get_db()
    try:
        cursor = await db.execute(
            """SELECT ar.id, ar.original_file_path, ar.cleaned_file_path,
                      m.name as model_name, ar.status,
                      ar.noise_reduction_level, ar.created_at
               FROM audio_records ar
               LEFT JOIN models m ON ar.model_id = m.id
               WHERE ar.user_id = ?
               ORDER BY ar.created_at DESC""",
            (user["id"],),
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": r["id"],
                "original_file_path": r["original_file_path"],
                "cleaned_file_path": r["cleaned_file_path"],
                "model_name": r["model_name"],
                "status": r["status"],
                "noise_reduction_level": r["noise_reduction_level"],
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    finally:
        await db.close()


# ── Sağlık kontrolü ──
@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "SLESS", "version": "1.0.0"}
