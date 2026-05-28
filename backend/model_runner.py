"""
SLESS — Model Yükleme ve Çalıştırma Modülü

Desteklenen modeller:
  - FRCRN          (sless/backend/frcrn.py)
  - GTCRN          (sless/backend/gtcrn.py)
  - FullSubNet+    (RookieJunChen/FullSubNet-plus)
  - MossFormerGAN  (modelscope/ClearerVoice-Studio)

Kurulum için önce setup_models.sh çalıştırın.
"""

import os
import sys
import uuid
import warnings

import numpy as np

# NumPy 2.x uyumluluk yamaları (PyTorch 2.2 ile)
warnings.filterwarnings("ignore", category=UserWarning)
if not hasattr(np, "complex"):
    np.complex = np.complex128
if not hasattr(np, "float"):
    np.float = float

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
LIBS_DIR = os.path.join(BACKEND_DIR, "libs")

FULLSUBNET_REPO   = os.path.join(LIBS_DIR, "FullSubNet-plus")
CLEARERVOICE_REPO = os.path.join(LIBS_DIR, "ClearerVoice-Studio")

DEVICE = "cpu"


# ── Path kurulum yardımcıları ────────────────────────────────

def _add_path(p: str):
    if os.path.isdir(p) and p not in sys.path:
        sys.path.insert(0, p)


def _setup_fullsubnet_path():
    _add_path(FULLSUBNET_REPO)
    _add_path(os.path.join(FULLSUBNET_REPO, "speech_enhance"))


def _setup_mossformer_path():
    for sub in [
        os.path.join("clearvoice", "clearvoice"),
        "clearvoice",
        "train/speech_enhancement",
        "",
    ]:
        _add_path(os.path.join(CLEARERVOICE_REPO, sub) if sub else CLEARERVOICE_REPO)


# ── Model türü tespiti ──────────────────────────────────────

def _detect_model_type(checkpoint_path: str) -> str:
    """State dict anahtarlarına bakarak model türünü belirle."""
    import torch
    ckpt = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    if not isinstance(ckpt, dict):
        raise ValueError("Geçersiz checkpoint formatı — dict bekleniyor.")

    # Hem eski (model_state_dict) hem yeni (model_state) anahtar adlarını destekle
    if "model_state" in ckpt:
        state = ckpt["model_state"]
    elif "model_state_dict" in ckpt:
        state = ckpt["model_state_dict"]
    else:
        raise ValueError(
            "Checkpoint'te model_state veya model_state_dict anahtarı bulunamadı."
        )

    keys = list(state.keys())
    if not keys:
        raise ValueError("Model state dict boş.")

    # module. prefix'ini soy (DataParallel ile eğitilmiş modeller için)
    first = keys[0].replace("module.", "")
    all_keys_str = "".join(k.replace("module.", "") for k in keys[:10])

    if first.startswith("enc1."):
        return "frcrn"
    if first.startswith("encoder.0.net"):
        return "gtcrn"
    if first.startswith("channel_attention.") or "sb_model" in all_keys_str:
        return "fullsubnet_plus"
    if first.startswith("model.dense_encoder.") or first.startswith("model.mossformer"):
        return "mossformergan"

    raise ValueError(
        f"Bilinmeyen model türü. İlk anahtar: '{first}'\n"
        "Desteklenen: FRCRN, GTCRN, FullSubNet+, MossFormerGAN."
    )


# ── FRCRN ───────────────────────────────────────────────────

def _load_frcrn(checkpoint_path: str):
    _add_path(BACKEND_DIR)
    import torch
    from frcrn import FRCRN

    ckpt = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    # Hem eski (CFG) hem yeni (config) anahtar adlarını destekle
    cfg = ckpt.get("config", ckpt.get("CFG", {}))

    model = FRCRN(
        n_fft=cfg.get("n_fft", 512),
        hop_length=cfg.get("hop_length", 128),
        hidden_size=cfg.get("hidden_size", 128),
    )

    # LazyLinear katmanlarını materialize et (checkpoint'ten yüklemeden önce gerekli)
    with torch.no_grad():
        model(torch.zeros(1, 64000))

    state_key = "model_state" if "model_state" in ckpt else "model_state_dict"
    state = {k.replace("module.", ""): v for k, v in ckpt[state_key].items()}
    model.load_state_dict(state, strict=False)
    model.eval()
    return model, cfg


def _run_frcrn_inference(model, audio: np.ndarray, sr: int, cfg: dict) -> np.ndarray:
    """FRCRN modeli ses sinyalini kendi içinde STFT yaparak işler."""
    import torch
    # Ses zaten 16000 Hz'e pre-resample edilmiş (run() içinde)
    audio_t = torch.from_numpy(audio).float().unsqueeze(0)  # [1, T]
    with torch.no_grad():
        enhanced = model(audio_t)  # [1, T]
    return enhanced.squeeze(0).numpy()


# ── GTCRN ───────────────────────────────────────────────────

def _load_gtcrn(checkpoint_path: str):
    _add_path(BACKEND_DIR)
    import torch
    from gtcrn import GTCRN

    ckpt = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    cfg = ckpt.get("config", ckpt.get("CFG", {}))

    model = GTCRN(
        n_fft=cfg.get("n_fft", 512),
        hop_length=cfg.get("hop_length", 128),
        hidden_size=cfg.get("hidden_size", 128),
    )

    # LazyLinear katmanlarını materialize et
    with torch.no_grad():
        model(torch.zeros(1, 64000))

    state_key = "model_state" if "model_state" in ckpt else "model_state_dict"
    state = {k.replace("module.", ""): v for k, v in ckpt[state_key].items()}
    model.load_state_dict(state, strict=False)
    model.eval()
    return model, cfg


def _run_gtcrn_inference(model, audio: np.ndarray, sr: int, cfg: dict) -> np.ndarray:
    """GTCRN modeli ses sinyalini kendi içinde STFT yaparak işler."""
    import torch
    audio_t = torch.from_numpy(audio).float().unsqueeze(0)  # [1, T]
    with torch.no_grad():
        enhanced = model(audio_t)  # [1, T]
    return enhanced.squeeze(0).numpy()


# ── FullSubNet+ ─────────────────────────────────────────────

def _load_fullsubnet_plus(checkpoint_path: str):
    _setup_fullsubnet_path()

    if not os.path.isdir(FULLSUBNET_REPO):
        raise RuntimeError(
            "FullSubNet+ repo bulunamadı.\n"
            f"Beklenen konum: {FULLSUBNET_REPO}\n"
            "Çözüm: cd backend && bash setup_models.sh"
        )

    import torch
    from fullsubnet_plus.model.fullsubnet_plus import FullSubNet_Plus

    ckpt = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    cfg  = ckpt.get("config", {})

    model = FullSubNet_Plus(
        sb_num_neighbors            = cfg.get("sb_num_neighbors", 15),
        fb_num_neighbors            = cfg.get("fb_num_neighbors", 0),
        num_freqs                   = cfg.get("num_freqs", 257),
        look_ahead                  = cfg.get("look_ahead", 2),
        sequence_model              = cfg.get("sequence_model", "LSTM"),
        fb_output_activate_function = cfg.get("fb_output_activate_function", "ReLU"),
        sb_output_activate_function = cfg.get("sb_output_activate_function", False),
        channel_attention_model     = cfg.get("channel_attention_model", "TSSE"),
        fb_model_hidden_size        = cfg.get("fb_model_hidden_size", 512),
        sb_model_hidden_size        = cfg.get("sb_model_hidden_size", 384),
        weight_init                 = False,
        norm_type                   = cfg.get("norm_type", "offline_laplace_norm"),
        num_groups_in_drop_band     = cfg.get("num_groups_in_drop_band", 2),
        kersize                     = cfg.get("kersize", [3, 5, 10]),
        subband_num                 = cfg.get("subband_num", 1),
    )

    state = {k.replace("module.", ""): v for k, v in ckpt["model_state"].items()}
    model.load_state_dict(state, strict=False)
    model.eval()
    return model, cfg


def _run_fullsubnet_inference(model, audio: np.ndarray, sr: int, cfg: dict) -> np.ndarray:
    import torch

    n_fft      = cfg.get("n_fft", 512)
    hop_length = cfg.get("hop_length", 256)
    win_length = cfg.get("win_length", 512)

    audio_t = torch.from_numpy(audio).float()
    window  = torch.hann_window(win_length)

    noisy_c = torch.stft(
        audio_t, n_fft=n_fft, hop_length=hop_length,
        win_length=win_length, window=window, return_complex=True,
    ).unsqueeze(0)  # [1, F, T]

    noisy_mag = torch.abs(noisy_c)  # [1, F, T]

    with torch.no_grad():
        pred = model(
            noisy_mag.unsqueeze(1),
            noisy_c.real.unsqueeze(1),
            noisy_c.imag.unsqueeze(1),
        )  # [1, 2, F, T]

    mask_r = pred[:, 0, :, :]
    mask_i = pred[:, 1, :, :]

    enh_r = mask_r * noisy_c.real - mask_i * noisy_c.imag
    enh_i = mask_r * noisy_c.imag + mask_i * noisy_c.real

    enh_complex = torch.complex(enh_r.squeeze(0), enh_i.squeeze(0))
    enhanced = torch.istft(
        enh_complex, n_fft=n_fft, hop_length=hop_length,
        win_length=win_length, window=window, length=audio_t.shape[-1],
    )
    return enhanced.numpy()


# ── MossFormerGAN ────────────────────────────────────────────

def _load_mossformergan(checkpoint_path: str):
    _setup_mossformer_path()

    if not os.path.isdir(CLEARERVOICE_REPO):
        raise RuntimeError(
            "ClearerVoice-Studio repo bulunamadı.\n"
            f"Beklenen konum: {CLEARERVOICE_REPO}\n"
            "Çözüm: cd backend && bash setup_models.sh"
        )

    import argparse
    import torch
    from models.mossformer_gan_se.generator import MossFormerGAN_SE_16K

    ckpt = torch.load(checkpoint_path, map_location=DEVICE, weights_only=False)
    cfg  = ckpt.get("config", {})

    args = argparse.Namespace(
        fft_len=400, win_len=400, win_inc=100, win_type="hamming", mode="eval"
    )
    gan_model = MossFormerGAN_SE_16K(args)

    state = {k.replace("module.", ""): v for k, v in ckpt["model_state"].items()}
    gan_model.load_state_dict(state, strict=False)
    gan_model.eval()
    return gan_model, cfg


def _run_mossformergan_inference(model, audio: np.ndarray, sr: int, cfg: dict) -> np.ndarray:
    """
    Sabit CHUNK=20400 (~1.275s) boyutunda parçalı işlem.
    Bu boyut eğitim sırasında kullanılan kare matris T=201 boyutuna karşılık gelir.
    """
    import torch

    fft_len = 400
    win_len = 400
    hop_len = 100
    CHUNK   = 20400

    original_len = len(audio)
    window       = torch.hamming_window(win_len)
    all_enhanced = []

    for start in range(0, original_len, CHUNK):
        chunk            = audio[start : start + CHUNK]
        chunk_actual_len = len(chunk)

        if chunk_actual_len < CHUNK:
            chunk = np.pad(chunk, (0, CHUNK - chunk_actual_len))

        audio_t = torch.from_numpy(chunk).float()

        spec = torch.stft(
            audio_t, n_fft=fft_len, hop_length=hop_len,
            win_length=win_len, window=window,
            center=False, return_complex=True,
        ).unsqueeze(0)  # [1, F, T]

        noisy_spec = torch.stack([spec.real, spec.imag], dim=1)  # [1, 2, F, T]

        with torch.no_grad():
            out_list = model.model(noisy_spec)

        out_r, out_i = out_list[0], out_list[1]
        enh_complex = torch.complex(
            out_r.squeeze(1).squeeze(0),
            out_i.squeeze(1).squeeze(0),
        )
        enhanced_chunk = torch.istft(
            enh_complex, n_fft=fft_len, hop_length=hop_len,
            win_length=win_len, window=window,
            center=False, length=CHUNK,
        )
        all_enhanced.append(enhanced_chunk.numpy()[:chunk_actual_len])

    return np.concatenate(all_enhanced)


# ── Kullanıcı kontrolleri ────────────────────────────────────

def _clamp_control(value: float) -> float:
    try:
        value = float(value)
    except (TypeError, ValueError):
        value = 50.0
    return max(0.0, min(100.0, value)) / 100.0


def _match_length(audio: np.ndarray, target_len: int) -> np.ndarray:
    if len(audio) == target_len:
        return audio.astype("float32", copy=False)
    if len(audio) < 2 or target_len <= 0:
        return np.zeros(target_len, dtype="float32")

    source_x = np.linspace(0.0, 1.0, num=len(audio), endpoint=True)
    target_x = np.linspace(0.0, 1.0, num=target_len, endpoint=True)
    return np.interp(target_x, source_x, audio).astype("float32")


def _apply_user_controls(
    original: np.ndarray,
    enhanced: np.ndarray,
    noise_level: float,
    sensitivity: float,
) -> np.ndarray:
    noise_amount  = _clamp_control(noise_level)
    filter_amount = _clamp_control(sensitivity)

    # original ve enhanced ikisi de 16000 Hz'de; uzunluk farkı varsa hizala
    original = _match_length(original, len(enhanced))
    enhanced = enhanced.astype("float32", copy=False)

    # noise_level: 0 → orijinal ses korunur, 100 → tamamen model çıktısı
    controlled = (original * (1.0 - noise_amount)) + (enhanced * noise_amount)

    # sensitivity: sessiz bölgelerde ek zayıflatma uygular
    if filter_amount > 0.0 and controlled.size:
        abs_signal = np.abs(controlled)
        floor      = float(np.percentile(abs_signal, 25))
        threshold  = floor * (0.75 + filter_amount * 1.5)
        if threshold > 0:
            attenuation = 1.0 - (0.45 * filter_amount)
            quiet_mask  = abs_signal < threshold
            controlled  = controlled.copy()
            controlled[quiet_mask] *= attenuation

    return controlled.astype("float32", copy=False)


# ── ModelRunner ─────────────────────────────────────────────

class ModelRunner:
    def __init__(self):
        self._cache: dict = {}  # resolved_path → (model, model_type, cfg)

    def load_model(self, file_path: str):
        resolved = (
            file_path if os.path.isabs(file_path)
            else os.path.join(BASE_DIR, file_path)
        )

        if resolved in self._cache:
            return self._cache[resolved]

        if not os.path.exists(resolved):
            raise FileNotFoundError(f"Model dosyası bulunamadı: {resolved}")

        model_type = _detect_model_type(resolved)

        if model_type == "frcrn":
            model, cfg = _load_frcrn(resolved)
        elif model_type == "gtcrn":
            model, cfg = _load_gtcrn(resolved)
        elif model_type == "fullsubnet_plus":
            model, cfg = _load_fullsubnet_plus(resolved)
        elif model_type == "mossformergan":
            model, cfg = _load_mossformergan(resolved)
        else:
            raise ValueError(f"Desteklenmeyen model türü: {model_type}")

        self._cache[resolved] = (model, model_type, cfg)
        return self._cache[resolved]

    def run(
        self,
        model_file_path: str,
        input_audio_path: str,
        noise_level: float,
        sensitivity: float,
    ) -> str:
        import soundfile as sf
        import torch
        import torchaudio

        model, model_type, cfg = self.load_model(model_file_path)

        # Ses yükle
        audio, sr = sf.read(input_audio_path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=-1)  # stereo → mono

        # Tüm modeller 16000 Hz gerektirir; burada tek seferinde resample et.
        # Bu sayede _apply_user_controls'a giren original ve enhanced
        # ikisi de 16000 Hz'de olur — dry/wet mix doğru çalışır.
        if sr != 16000:
            t = torch.from_numpy(audio).float().unsqueeze(0)
            t = torchaudio.functional.resample(t, sr, 16000)
            audio = t.squeeze(0).numpy()
            sr = 16000

        # Tüm modeller eğitim sırasında peak-normalize edilmiş (0.9 peak) ses
        # kullandı. Inference'da da aynı dağılımı sağlamak için normalize edip
        # sonunda orijinal seviyeye geri döndürüyoruz.
        original_peak = float(np.max(np.abs(audio)))
        if original_peak > 1e-8:
            audio_normed = (audio / original_peak * 0.9).astype("float32")
        else:
            audio_normed = audio
            original_peak = 1.0

        # Inference
        if model_type == "frcrn":
            enhanced = _run_frcrn_inference(model, audio_normed, sr, cfg)
        elif model_type == "gtcrn":
            enhanced = _run_gtcrn_inference(model, audio_normed, sr, cfg)
        elif model_type == "fullsubnet_plus":
            enhanced = _run_fullsubnet_inference(model, audio_normed, sr, cfg)
        else:
            enhanced = _run_mossformergan_inference(model, audio_normed, sr, cfg)

        # Dry/wet mix: hem original hem enhanced normalize edilmiş aynı ölçekte
        enhanced = _apply_user_controls(audio_normed, enhanced, noise_level, sensitivity)

        # Karışımı orijinal ses seviyesine geri ölçekle
        enhanced = (enhanced * original_peak / 0.9).astype("float32")

        # Soft clipping
        peak = np.max(np.abs(enhanced))
        if peak > 0.99:
            enhanced = enhanced / peak * 0.95

        # Kaydet
        output_dir  = os.path.join(BASE_DIR, "uploads", "cleaned")
        os.makedirs(output_dir, exist_ok=True)
        output_path = os.path.join(output_dir, f"{uuid.uuid4().hex}.wav")
        sf.write(output_path, enhanced, 16000)
        return output_path

    def get_cached_models(self) -> list:
        return list(self._cache.keys())


model_runner = ModelRunner()
