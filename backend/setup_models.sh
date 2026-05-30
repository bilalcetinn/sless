#!/usr/bin/env bash
# ============================================================
# SLESS — Model Kurulum Scripti
# FullSubNet+ ve ClearerVoice-Studio repolarını klonlar,
# NumPy sürüm uyumunu düzeltir.
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIBS_DIR="$SCRIPT_DIR/libs"
VENV_PIP="$SCRIPT_DIR/venv/bin/pip"

echo "=== SLESS Model Kurulumu ==="

# ── NumPy sürüm düzeltmesi ──────────────────────────────────
echo "[1/3] NumPy ve MossFormerGAN bağımlılıkları kuruluyor..."
"$VENV_PIP" install "numpy<2" einops rotary-embedding-torch --quiet --upgrade
echo "      Paketler güncellendi."

# ── FullSubNet-plus repo ────────────────────────────────────
echo "[2/3] FullSubNet-plus klonlanıyor..."
if [ -d "$LIBS_DIR/FullSubNet-plus" ]; then
    echo "      Zaten mevcut, atlanıyor."
else
    git clone --depth 1 https://github.com/RookieJunChen/FullSubNet-plus.git \
        "$LIBS_DIR/FullSubNet-plus"
    echo "      FullSubNet-plus indirildi."
fi

# ── ClearerVoice-Studio repo ────────────────────────────────
echo "[3/3] ClearerVoice-Studio klonlanıyor..."
if [ -d "$LIBS_DIR/ClearerVoice-Studio" ]; then
    echo "      Zaten mevcut, atlanıyor."
else
    git clone --depth 1 https://github.com/modelscope/ClearerVoice-Studio.git \
        "$LIBS_DIR/ClearerVoice-Studio"
    echo "      ClearerVoice-Studio indirildi."
fi

echo ""
echo "=== Kurulum tamamlandı! ==="
echo "Backend'i yeniden başlatın: cd backend && venv/bin/uvicorn main:app --reload"
