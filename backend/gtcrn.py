import torch
import torch.nn as nn


class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.PReLU(),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.PReLU(),
        )

    def forward(self, x):
        return self.net(x)


class GTCRN(nn.Module):
    """
    Basitleştirilmiş GTCRN gürültü giderme modeli.
    Encoder-GRU-Decoder + cIRM mask mimarisi.
    Eğitim: n_fft=512, hop_length=128, sr=16000
    """

    def __init__(self, n_fft=512, hop_length=128, hidden_size=128):
        super().__init__()
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.win_length = n_fft
        self.hidden_size = hidden_size

        self.encoder = nn.Sequential(
            ConvBlock(2, 16),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.PReLU(),
            ConvBlock(32, 32),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.PReLU(),
        )

        self.proj_in = nn.LazyLinear(hidden_size)
        self.gru = nn.GRU(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
        )
        self.proj_out = nn.LazyLinear(64 * 257)

        self.decoder = nn.Sequential(
            ConvBlock(64, 32),
            ConvBlock(32, 16),
            nn.Conv2d(16, 2, kernel_size=1),
        )

    def forward(self, waveform):
        """waveform: [B, T] → enhanced: [B, T]"""
        window = torch.hann_window(self.win_length, device=waveform.device)

        spec = torch.stft(
            waveform,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            win_length=self.win_length,
            window=window,
            return_complex=True,
        )

        real = spec.real  # [B, F, T]
        imag = spec.imag
        x = torch.stack([real, imag], dim=1)  # [B, 2, F, T]

        enc = self.encoder(x)  # [B, 64, F, T]

        b, c, f, t = enc.shape
        enc_t = enc.permute(0, 3, 1, 2).contiguous().view(b, t, c * f)

        z = self.proj_in(enc_t)
        z, _ = self.gru(z)
        z = self.proj_out(z)

        z = z.view(b, t, 64, 257).permute(0, 2, 3, 1).contiguous()

        mask = self.decoder(z)
        mask = mask[:, :, : real.shape[1], : real.shape[2]]

        mask_r = torch.tanh(mask[:, 0])
        mask_i = torch.tanh(mask[:, 1])

        enh_r = real * mask_r - imag * mask_i
        enh_i = real * mask_i + imag * mask_r

        enhanced = torch.istft(
            torch.complex(enh_r, enh_i),
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            win_length=self.win_length,
            window=window,
            length=waveform.shape[-1],
        )

        return torch.nan_to_num(enhanced)
