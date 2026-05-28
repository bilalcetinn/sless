import torch
import torch.nn as nn


class FRCRNConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.PReLU(),
            nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1),
            nn.BatchNorm2d(out_ch),
            nn.PReLU(),
        )

    def forward(self, x):
        return self.block(x)


class FRCRN(nn.Module):
    """
    FRCRN benzeri complex spectrogram gürültü giderme modeli.
    Encoder-Bottleneck(GRU)-Decoder + cIRM mask mimarisi.
    Eğitim: n_fft=512, hop_length=128, sr=16000
    """

    def __init__(self, n_fft=512, hop_length=128, hidden_size=128):
        super().__init__()
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.win_length = n_fft
        self.hidden_size = hidden_size

        self.enc1 = FRCRNConvBlock(2, 32)
        self.enc2 = FRCRNConvBlock(32, 64)
        self.enc3 = FRCRNConvBlock(64, 96)

        self.bottleneck_in = nn.LazyLinear(hidden_size)
        self.rnn = nn.GRU(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=2,
            batch_first=True,
            bidirectional=True,
        )
        self.bottleneck_out = nn.LazyLinear(96 * 257)

        self.dec3 = FRCRNConvBlock(96, 64)
        self.dec2 = FRCRNConvBlock(64, 32)
        self.dec1 = FRCRNConvBlock(32, 16)
        self.mask_head = nn.Conv2d(16, 2, kernel_size=1)

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

        x = self.enc1(x)
        x = self.enc2(x)
        x = self.enc3(x)  # [B, 96, F, T]

        b, c, f, t = x.shape
        z = x.permute(0, 3, 1, 2).contiguous().view(b, t, c * f)
        z = self.bottleneck_in(z)
        z, _ = self.rnn(z)
        z = self.bottleneck_out(z)

        z = z.view(b, t, 96, 257).permute(0, 2, 3, 1).contiguous()

        z = self.dec3(z)
        z = self.dec2(z)
        z = self.dec1(z)

        mask = self.mask_head(z)
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
