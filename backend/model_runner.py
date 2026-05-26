"""
SLESS — Model Yükleme ve Çalıştırma Modülü

Desteklenen modeller:
  - FullSubNet+  (RookieJunChen/FullSubNet-plus)
  - MossFormerGAN (modelscope/ClearerVoice-Studio)

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
LIBS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "libs")

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
    # generator.py → clearvoice/clearvoice/models/mossformer_gan_se/generator.py
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

    state = ckpt.get("model_state", ckpt)
    keys = list(state.keys())
    if not keys:
        raise ValueError("Model state dict boş.")

    first = keys[0]
    if first.startswith("channel_attention.") or "sb_model" in "".join(keys[:5]):
        return "fullsubnet_plus"
    if first.startswith("model.dense_encoder.") or first.startswith("model.mossformer"):
        return "mossformergan"

    raise ValueError(
        f"Bilinmeyen model türü. İlk anahtar: '{first}'\n"
        "Desteklenen: FullSubNet+ veya MossFormerGAN."
    )


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
        sb_num_neighbors          = cfg.get("sb_num_neighbors", 15),
        fb_num_neighbors          = cfg.get("fb_num_neighbors", 0),
        num_freqs                 = cfg.get("num_freqs", 257),
        look_ahead                = cfg.get("look_ahead", 2),
        sequence_model            = cfg.get("sequence_model", "LSTM"),
        fb_output_activate_function = cfg.get("fb_output_activate_function", "ReLU"),
        sb_output_activate_function = cfg.get("sb_output_activate_function", False),
        channel_attention_model   = cfg.get("channel_attention_model", "TSSE"),
        fb_model_hidden_size      = cfg.get("fb_model_hidden_size", 512),
        sb_model_hidden_size      = cfg.get("sb_model_hidden_size", 384),
        weight_init               = False,
        norm_type                 = cfg.get("norm_type", "offline_laplace_norm"),
        num_groups_in_drop_band   = cfg.get("num_groups_in_drop_band", 2),
        kersize                   = cfg.get("kersize", [3, 5, 10]),
        subband_num               = cfg.get("subband_num", 1),
    )

    state = {k.replace("module.", ""): v for k, v in ckpt["model_state"].items()}
    model.load_state_dict(state, strict=False)
    model.eval()
    return model, cfg


def _run_fullsubnet_inference(model, audio: np.ndarray, sr: int, cfg: dict) -> np.ndarray:
    import torch
    import torchaudio

    n_fft      = cfg.get("n_fft", 512)
    hop_length = cfg.get("hop_length", 256)
    win_length = cfg.get("win_length", 512)
    target_sr  = cfg.get("sample_rate", 16000)

    if sr != target_sr:
        t = torch.from_numpy(audio).float().unsqueeze(0)
        t = torchaudio.functional.resample(t, sr, target_sr)
        audio = t.squeeze(0).numpy()

    audio_t = torch.from_numpy(audio).float()  # [T]
    window  = torch.hann_window(win_length)

    # STFT → [F, T] complex
    noisy_c = torch.stft(
        audio_t, n_fft=n_fft, hop_length=hop_length,
        win_length=win_length, window=window, return_complex=True,
    ).unsqueeze(0)  # [1, F, T]

    noisy_mag = torch.abs(noisy_c)  # [1, F, T]

    with torch.no_grad():
        pred = model(
            noisy_mag.unsqueeze(1),      # [1, 1, F, T]
            noisy_c.real.unsqueeze(1),   # [1, 1, F, T]
            noisy_c.imag.unsqueeze(1),   # [1, 1, F, T]
        )  # → [1, 2, F, T]

    mask_r = pred[:, 0, :, :]  # [1, F, T]
    mask_i = pred[:, 1, :, :]

    # Complex Ideal Ratio Mask (cIRM) uygula
    enh_r = mask_r * noisy_c.real - mask_i * noisy_c.imag
    enh_i = mask_r * noisy_c.imag + mask_i * noisy_c.real

    enh_complex = torch.complex(enh_r.squeeze(0), enh_i.squeeze(0))  # [F, T]
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
    Notebook, sabit CHUNK=20400 örnek (~1.275s) boyutunda eğitildi.
    Bu boyutta T_frames=201=F, yani kare matris oluşur ve model çalışır.
    Uzun sesler için parçalı işlem yapılır.
    """
    import torch
    import torchaudio

    fft_len   = 400
    win_len   = 400
    hop_len   = 100
    CHUNK     = 20400   # eğitim parça boyutu
    target_sr = 16000

    if sr != target_sr:
        t = torch.from_numpy(audio).float().unsqueeze(0)
        t = torchaudio.functional.resample(t, sr, target_sr)
        audio = t.squeeze(0).numpy()

    original_len = len(audio)
    window       = torch.hamming_window(win_len)
    all_enhanced = []

    for start in range(0, original_len, CHUNK):
        chunk            = audio[start : start + CHUNK]
        chunk_actual_len = len(chunk)

        # Son parçayı CHUNK boyutuna tamamla
        if chunk_actual_len < CHUNK:
            chunk = np.pad(chunk, (0, CHUNK - chunk_actual_len))

        audio_t = torch.from_numpy(chunk).float()  # [CHUNK]

        # STFT → [1, 2, F=201, T=201]
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
            out_r.squeeze(1).squeeze(0),   # [F, T]
            out_i.squeeze(1).squeeze(0),
        )
        enhanced_chunk = torch.istft(
            enh_complex, n_fft=fft_len, hop_length=hop_len,
            win_length=win_len, window=window,
            center=False, length=CHUNK,
        )
        all_enhanced.append(enhanced_chunk.numpy()[:chunk_actual_len])

    return np.concatenate(all_enhanced)


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

        if model_type == "fullsubnet_plus":
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

        model, model_type, cfg = self.load_model(model_file_path)

        # Ses yükle
        audio, sr = sf.read(input_audio_path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=-1)  # stereo → mono

        # Inference
        if model_type == "fullsubnet_plus":
            enhanced = _run_fullsubnet_inference(model, audio, sr, cfg)
        else:
            enhanced = _run_mossformergan_inference(model, audio, sr, cfg)

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
