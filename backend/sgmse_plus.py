import math

import torch
import torch.nn as nn
import torch.nn.functional as F


class TimeEmbedding(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.dim = dim
        self.mlp = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.SiLU(),
            nn.Linear(dim * 4, dim),
        )

    def forward(self, t):
        half = self.dim // 2
        freqs = torch.exp(
            -math.log(10000) * torch.arange(half, device=t.device).float() / half
        )
        args = t[:, None] * freqs[None, :]
        emb = torch.cat([torch.sin(args), torch.cos(args)], dim=-1)

        if emb.shape[-1] < self.dim:
            emb = F.pad(emb, (0, self.dim - emb.shape[-1]))

        return self.mlp(emb)


class ResBlock2D(nn.Module):
    def __init__(self, in_ch: int, out_ch: int, time_dim: int):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3, padding=1)
        self.norm1 = nn.GroupNorm(8, out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3, padding=1)
        self.norm2 = nn.GroupNorm(8, out_ch)
        self.time_proj = nn.Linear(time_dim, out_ch)
        self.skip = nn.Conv2d(in_ch, out_ch, 1) if in_ch != out_ch else nn.Identity()
        self.act = nn.SiLU()

    def forward(self, x, t_emb):
        h = self.conv1(x)
        h = self.norm1(h)
        h = self.act(h)

        time = self.time_proj(t_emb)
        h = h + time[:, :, None, None]

        h = self.conv2(h)
        h = self.norm2(h)
        h = self.act(h)

        return h + self.skip(x)


class SGMSEPlusNet(nn.Module):
    def __init__(
        self,
        n_fft: int = 512,
        hop_length: int = 128,
        base_ch: int = 80,
        time_dim: int = 128,
    ):
        super().__init__()
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.win_length = n_fft

        self.time_emb = TimeEmbedding(time_dim)

        self.in_proj = nn.Conv2d(4, base_ch, 3, padding=1)
        self.enc1 = ResBlock2D(base_ch, base_ch, time_dim)
        self.down1 = nn.Conv2d(base_ch, base_ch * 2, 4, stride=2, padding=1)
        self.enc2 = ResBlock2D(base_ch * 2, base_ch * 2, time_dim)
        self.down2 = nn.Conv2d(base_ch * 2, base_ch * 4, 4, stride=2, padding=1)

        self.mid1 = ResBlock2D(base_ch * 4, base_ch * 4, time_dim)
        self.mid2 = ResBlock2D(base_ch * 4, base_ch * 4, time_dim)

        self.up1 = nn.ConvTranspose2d(base_ch * 4, base_ch * 2, 4, stride=2, padding=1)
        self.dec1 = ResBlock2D(base_ch * 4, base_ch * 2, time_dim)
        self.up2 = nn.ConvTranspose2d(base_ch * 2, base_ch, 4, stride=2, padding=1)
        self.dec2 = ResBlock2D(base_ch * 2, base_ch, time_dim)

        self.out = nn.Conv2d(base_ch, 2, 3, padding=1)

    def stft(self, waveform):
        window = torch.hann_window(self.win_length, device=waveform.device)
        return torch.stft(
            waveform,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            win_length=self.win_length,
            window=window,
            return_complex=True,
        )

    def istft(self, spec, length: int):
        window = torch.hann_window(self.win_length, device=spec.device)
        return torch.istft(
            spec,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            win_length=self.win_length,
            window=window,
            length=length,
        )

    def forward(self, noisy_waveform, perturbed_waveform, t):
        noisy_spec = self.stft(noisy_waveform)
        pert_spec = self.stft(perturbed_waveform)

        x = torch.stack(
            [
                noisy_spec.real,
                noisy_spec.imag,
                pert_spec.real,
                pert_spec.imag,
            ],
            dim=1,
        )

        t_emb = self.time_emb(t)

        x0 = self.in_proj(x)
        e1 = self.enc1(x0, t_emb)
        d1 = self.down1(e1)

        e2 = self.enc2(d1, t_emb)
        d2 = self.down2(e2)

        m = self.mid1(d2, t_emb)
        m = self.mid2(m, t_emb)

        u1 = self.up1(m)
        if u1.shape[-2:] != e2.shape[-2:]:
            u1 = F.interpolate(u1, size=e2.shape[-2:], mode="bilinear", align_corners=False)
        u1 = torch.cat([u1, e2], dim=1)
        u1 = self.dec1(u1, t_emb)

        u2 = self.up2(u1)
        if u2.shape[-2:] != e1.shape[-2:]:
            u2 = F.interpolate(u2, size=e1.shape[-2:], mode="bilinear", align_corners=False)
        u2 = torch.cat([u2, e1], dim=1)
        u2 = self.dec2(u2, t_emb)

        out = self.out(u2)
        clean_spec = torch.complex(out[:, 0], out[:, 1])
        enhanced = self.istft(clean_spec, length=noisy_waveform.shape[-1])
        return torch.nan_to_num(enhanced)
