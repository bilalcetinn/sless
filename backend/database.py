"""
SLESS — Türkçe Ses Gürültü Giderme Uygulaması
Veritabanı modülü: SQLite (aiosqlite) ile async işlemler.
4 tablo: models, users, sessions, audio_records
"""

import aiosqlite
import os

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "sless.db")


async def get_db():
    """Veritabanı bağlantısı döndürür."""
    db = await aiosqlite.connect(DATABASE_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    """
    Tüm tabloları oluşturur ve seed data ekler.
    Uygulama başlatıldığında çağrılır.
    """
    db = await get_db()
    try:
        # ── Tablo 1: models ──
        await db.execute("""
            CREATE TABLE IF NOT EXISTS models (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                name        TEXT NOT NULL,
                file_path   TEXT NOT NULL,
                description TEXT,
                is_active   INTEGER DEFAULT 1,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Tablo 2: users ──
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                username      TEXT UNIQUE NOT NULL,
                email         TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # ── Tablo 3: sessions ──
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER,
                token      TEXT UNIQUE NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)

        # ── Tablo 4: audio_records ──
        await db.execute("""
            CREATE TABLE IF NOT EXISTS audio_records (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id               INTEGER,
                original_file_path    TEXT NOT NULL,
                cleaned_file_path     TEXT,
                model_id              INTEGER,
                noise_reduction_level REAL DEFAULT 50,
                filter_sensitivity    REAL DEFAULT 50,
                status                TEXT DEFAULT 'pending',
                created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id)  REFERENCES users(id),
                FOREIGN KEY (model_id) REFERENCES models(id)
            )
        """)

        await db.commit()

        # ── Seed Data ──
        # Model 1: DeepFilterNet v1
        cursor = await db.execute(
            "SELECT id FROM models WHERE name = ?", ("DeepFilterNet v1",)
        )
        if not await cursor.fetchone():
            await db.execute(
                "INSERT INTO models (name, file_path, description) VALUES (?, ?, ?)",
                (
                    "DeepFilterNet v1",
                    "models/dfn_v1.pt",
                    "Derin filtre tabanlı gürültü giderici",
                ),
            )

        # Model 2: RNNoise v2
        cursor = await db.execute(
            "SELECT id FROM models WHERE name = ?", ("RNNoise v2",)
        )
        if not await cursor.fetchone():
            await db.execute(
                "INSERT INTO models (name, file_path, description) VALUES (?, ?, ?)",
                (
                    "RNNoise v2",
                    "models/rnnoise_v2.pt",
                    "RNN tabanlı gerçek zamanlı gürültü giderici",
                ),
            )

        await db.commit()
        print("[OK] Veritabani basariyla olusturuldu ve seed data eklendi.")
    finally:
        await db.close()
