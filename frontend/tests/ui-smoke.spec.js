import { test, expect } from '@playwright/test';
import { Buffer } from 'node:buffer';

function wavBuffer(seconds = 0.7, sampleRate = 16000, frequency = 440) {
  const samples = Math.floor(seconds * sampleRate);
  const bytes = 44 + samples * 2;
  const buffer = Buffer.alloc(bytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(bytes - 8, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(samples * 2, 40);

  for (let i = 0; i < samples; i += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.35;
    buffer.writeInt16LE(Math.max(-1, Math.min(1, sample)) * 32767, 44 + i * 2);
  }

  return buffer;
}

async function mockApi(page) {
  const original = wavBuffer(0.8, 16000, 440);
  const cleaned = wavBuffer(0.8, 16000, 660);

  await page.route('**/api/models', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'FullSubNet+ Demo', description: 'Smoke test modeli' },
        { id: 2, name: 'MossFormerGAN Demo', description: 'Karşılaştırma modeli' },
      ]),
    });
  });

  await page.route('**/api/audio/upload', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ record_id: 101, original_file: 'original.wav' }),
    });
  });

  await page.route('**/api/audio/process/101', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'processing' }),
    });
  });

  await page.route('**/api/audio/status/101', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'done', cleaned_file_path: 'cleaned.wav' }),
    });
  });

  await page.route('**/api/audio/process-with-model', async (route) => {
    const body = route.request().postDataJSON();
    const suffix = body.model_id === 2 ? 'mossformer' : 'fullsubnet';
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        record_id: body.model_id === 2 ? 202 : 201,
        status: 'done',
        cleaned_file_path: `cleaned-${suffix}.wav`,
        model_name: body.model_id === 2 ? 'MossFormerGAN Demo' : 'FullSubNet+ Demo',
      }),
    });
  });

  await page.route('**/api/audio/history', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 77,
          model_name: 'FullSubNet+ Demo',
          status: 'done',
          original_file_path: 'original.wav',
          cleaned_file_path: 'cleaned.wav',
          noise_reduction_level: 50,
          created_at: '2026-05-27T16:30:00',
        },
      ]),
    });
  });

  await page.route('**/files/original.wav', async (route) => {
    await route.fulfill({
      contentType: 'audio/wav',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: original,
    });
  });

  await page.route('**/files/cleaned.wav', async (route) => {
    await route.fulfill({
      contentType: 'audio/wav',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: cleaned,
    });
  });

  await page.route('**/files/cleaned-fullsubnet.wav', async (route) => {
    await route.fulfill({
      contentType: 'audio/wav',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: wavBuffer(0.8, 16000, 520),
    });
  });

  await page.route('**/files/cleaned-mossformer.wav', async (route) => {
    await route.fulfill({
      contentType: 'audio/wav',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: wavBuffer(0.8, 16000, 760),
    });
  });
}

test.beforeEach(async ({ page }) => {
  const errors = [];
  const pushError = (message) => {
    if (message.includes('signal is aborted')) return;
    errors.push(message);
  };
  page.on('pageerror', (error) => pushError(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pushError(msg.text());
  });
  page.errors = errors;
  await mockApi(page);
});

test.afterEach(async ({ page }) => {
  expect(page.errors).toEqual([]);
});

test('ana sayfa sekmeleri ve bos gorsel durumlar calisir', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page.getByText('Ses Bekleniyor')).toBeVisible();

  await page.locator('#view-spectrogram').click();
  await expect(page.getByText('Spektrogram Bekleniyor')).toBeVisible();

  await page.locator('#view-3d').click();
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(250);
  expect(box.height).toBeGreaterThan(250);

  await page.locator('#tab-compare').click();
  await expect(page.getByRole('heading', { name: 'Model Karşılaştırma' })).toBeVisible();
  await expect(page.getByText(/Karşılaştırma başlatıldığında ilk sonuç/i)).toBeVisible();
});

test('ses yukleme sonrasi spektrogram canvas cizer', async ({ page }) => {
  await page.goto('http://localhost:5173/');

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'test.wav',
    mimeType: 'audio/wav',
    buffer: wavBuffer(),
  });

  await page.locator('#clean-audio-btn').click();
  await expect(page.getByText('Dalga Formu Karşılaştırması')).toBeVisible({ timeout: 8000 });

  await page.locator('#view-spectrogram').click();
  await expect(page.getByText('Orijinal Ses')).toBeVisible();
  await expect(page.getByText('Temizlenmiş Ses')).toBeVisible();

  await page.waitForFunction(() => {
    return [...document.querySelectorAll('canvas')]
      .filter((canvas) => canvas.width > 100 && canvas.height > 100)
      .some((canvas) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        const width = Math.min(canvas.width, 80);
        const height = Math.min(canvas.height, 80);
        const data = ctx.getImageData(0, 0, width, height).data;
        return data.some((value, index) => index % 4 !== 3 && value !== 0);
      });
  }, null, { timeout: 10000 });
});

test('ana temizleme varsayilan filtre degerleriyle calisir', async ({ page }) => {
  const uploads = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/audio/upload')) {
      uploads.push(request.postData() || '');
    }
  });

  await page.goto('http://localhost:5173/');
  await expect(page.locator('#noise-level-slider')).toHaveCount(0);
  await expect(page.locator('#filter-sensitivity-slider')).toHaveCount(0);

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'test.wav',
    mimeType: 'audio/wav',
    buffer: wavBuffer(),
  });

  await page.locator('#clean-audio-btn').click();
  await expect(page.getByText('Dalga Formu Karşılaştırması')).toBeVisible({ timeout: 8000 });

  expect(uploads.length).toBeGreaterThan(0);
  expect(uploads[0]).toContain('name="noise_level"');
  expect(uploads[0]).toContain('\r\n\r\n100\r\n');
  expect(uploads[0]).toContain('name="filter_sensitivity"');
  expect(uploads[0]).toContain('\r\n\r\n0\r\n');
});

test('mikrofon kaydi gercek wav olarak yuklenir', async ({ page }) => {
  let uploadBody = null;
  page.on('request', (request) => {
    if (request.url().includes('/api/audio/upload')) {
      uploadBody = request.postDataBuffer();
    }
  });

  await page.addInitScript(() => {
    const fakeTrack = { stop() {} };
    const fakeStream = { getTracks: () => [fakeTrack] };

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => fakeStream,
      },
    });

    class FakeAudioContext {
      constructor() {
        this.sampleRate = 16000;
        this.destination = {};
      }

      createMediaStreamSource() {
        return {
          connect() {},
          disconnect() {},
        };
      }

      createScriptProcessor() {
        window.__slessProcessor = {
          connect() {},
          disconnect() {},
          onaudioprocess: null,
        };
        return window.__slessProcessor;
      }

      close() {
        return Promise.resolve();
      }
    }

    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;
  });

  await page.goto('http://localhost:5173/');
  await page.locator('#mic-record-btn').click();
  await expect(page.locator('#mic-record-btn')).toContainText('Kaydı Durdur');

  await page.evaluate(() => {
    const samples = new Float32Array(4096);
    for (let i = 0; i < samples.length; i += 1) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 16000) * 0.25;
    }
    window.__slessProcessor.onaudioprocess({
      inputBuffer: {
        getChannelData: () => samples,
      },
    });
  });

  await page.locator('#mic-record-btn').click();
  await expect(page.getByText(/kayit_.*\.wav/)).toBeVisible();

  await page.locator('#clean-audio-btn').click();
  await expect(page.getByText('Dalga Formu Karşılaştırması')).toBeVisible({ timeout: 8000 });

  expect(uploadBody).toBeTruthy();
  expect(uploadBody.includes(Buffer.from('RIFF'))).toBe(true);
  expect(uploadBody.includes(Buffer.from('WAVE'))).toBe(true);
});

test('giris sonrasi gecmis sayfasi tasarimli liste gosterir', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sless_token', 'fake-token');
    localStorage.setItem('sless_user', JSON.stringify({ id: 1, username: 'can', email: 'can@example.com' }));
  });

  await page.goto('http://localhost:5173/history');
  await expect(page.getByRole('heading', { name: 'İşlem Geçmişi' })).toBeVisible();
  await expect(page.getByText('Hesap Geçmişi')).toHaveCount(0);
  await expect(page.getByText('FullSubNet+ Demo').first()).toBeVisible();
  await expect(page.getByText('Tamamlandı')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yenile' })).toBeVisible();
  await expect(page.getByText('Dalga Formu Karşılaştırması')).toBeVisible();
});

test('model karsilastirma iki paneli isler', async ({ page }) => {
  const comparisonRequests = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/audio/process-with-model')) {
      comparisonRequests.push(request.postDataJSON());
    }
  });

  await page.goto('http://localhost:5173/');

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'test.wav',
    mimeType: 'audio/wav',
    buffer: wavBuffer(),
  });

  await page.locator('#clean-audio-btn').click();
  await expect(page.getByText('Dalga Formu Karşılaştırması')).toBeVisible({ timeout: 8000 });

  await page.locator('#tab-compare').click();
  await expect(page.getByText('Model Karşılaştırma')).toBeVisible();

  await page.getByRole('button', { name: 'Karşılaştır', exact: true }).click();
  await expect(page.getByText('FullSubNet+ Demo Sonucu')).toBeVisible({ timeout: 8000 });
  await expect(page.getByText('MossFormerGAN Demo Sonucu')).toBeVisible({ timeout: 8000 });

  expect(comparisonRequests).toEqual([
    expect.objectContaining({ noise_level: 100, filter_sensitivity: 0 }),
    expect.objectContaining({ noise_level: 100, filter_sensitivity: 0 }),
  ]);
  await expect(page.getByText('Hangisi daha iyi?')).toHaveCount(0);
});
