import type { FormData, Photos, PhysiqueImageResult, PhotoKey } from '../types';
import { API_BASE_URL } from './apiClient';

type PhotoPayload = {
  base64Image: string;
  mimeType: string;
};

const REPORT_TIMEOUT_MS = 210_000;
const REPORT_POLL_MS = 2500;
const MAX_AI_IMAGE_SIZE = 900;
const JPEG_QUALITY = 0.55;

async function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('INVALID_IMAGE_DATA'));
    image.src = dataUrl;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('IMAGE_COMPRESSION_FAILED'));
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== 'string') {
            reject(new Error('IMAGE_COMPRESSION_FAILED'));
            return;
          }
          resolve(reader.result);
        };
        reader.onerror = () => reject(new Error('IMAGE_COMPRESSION_FAILED'));
        reader.readAsDataURL(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

export async function resizeImageForAI(dataUrl: string): Promise<PhotoPayload> {
  const image = await dataUrlToImage(dataUrl);
  const scale = Math.min(1, MAX_AI_IMAGE_SIZE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('IMAGE_COMPRESSION_FAILED');
  context.drawImage(image, 0, 0, width, height);

  let compressedDataUrl = await canvasToJpeg(canvas, JPEG_QUALITY);
  let base64Image = compressedDataUrl.split(',')[1];
  if (!base64Image) throw new Error('INVALID_IMAGE_DATA');

  if (base64Image.length > 1_600_000) {
    compressedDataUrl = await canvasToJpeg(canvas, 0.45);
    base64Image = compressedDataUrl.split(',')[1];
  }

  if (!base64Image) throw new Error('INVALID_IMAGE_DATA');
  return { base64Image, mimeType: 'image/jpeg' };
}

export async function compressPhotoForHistory(dataUrl: string): Promise<string> {
  if (!dataUrl) return '';
  const image = await dataUrlToImage(dataUrl);
  const maxSize = 720;
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.drawImage(image, 0, 0, width, height);
  return canvasToJpeg(canvas, 0.62);
}

export async function compressPhotosForHistory(photos: Photos): Promise<Photos> {
  const [front, side, back] = await Promise.all([
    compressPhotoForHistory(photos.front),
    compressPhotoForHistory(photos.side),
    compressPhotoForHistory(photos.back),
  ]);
  return { front, side, back };
}

export async function generatePhysiqueReport(formData: FormData, photos: Photos): Promise<PhysiqueImageResult> {
  const photoPayloads: Partial<Record<PhotoKey, PhotoPayload>> = {};

  for (const key of ['front', 'side', 'back'] as PhotoKey[]) {
    if (photos[key]) {
      photoPayloads[key] = await resizeImageForAI(photos[key]);
      console.log(`Compressed ${key} photo for report`, {
        mimeType: photoPayloads[key]?.mimeType,
        approxBytes: Math.round((photoPayloads[key]?.base64Image.length ?? 0) * 0.75),
      });
    }
  }

  console.log('Sending report request');
  const startResponse = await fetchJson(`${API_BASE_URL}/api/generate-physique-report-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formData, photos: photoPayloads }),
  });
  const jobId = startResponse.data?.jobId;
  if (!jobId) throw new Error('REPORT_FAILED');

  console.log('Waiting for OpenAI');
  const deadline = Date.now() + REPORT_TIMEOUT_MS;
  let data: any = null;
  while (Date.now() < deadline) {
    await delay(REPORT_POLL_MS);
    const pollResponse = await fetchJson(`${API_BASE_URL}/api/generate-physique-report-job/${jobId}`);
    if (pollResponse.data?.status === 'done') {
      data = pollResponse.data.result;
      console.log('Report received');
      console.log('Report response received:', data);
      break;
    }
    if (pollResponse.data?.status === 'failed') {
      throwErrorFromData(pollResponse.data.error?.body ?? pollResponse.data.error);
    }
  }

  if (!data) throw new Error('REPORT_TIMEOUT');

  return {
    isPhysiquePhoto: data.valid === true && data.canGenerateReport === true,
    confidence: data.valid === true ? 90 : 0,
    photoType: data.valid === true ? 'front' : 'not_human',
    reason: data.message || data.reason || '',
    safeMessage: data.message || data.nextPhotoSuggestion || '',
    imageType: data.imageType || (data.valid ? 'physique_photo' : 'non_physique'),
    praise: data.praise || 'Good check-in.',
    message: data.message || data.physiqueSummary || '',
    physiqueSummary: data.physiqueSummary || data.overall?.summary || '',
    strongPoints: Array.isArray(data.strongPoints) ? data.strongPoints : data.overall?.bestBodyParts ?? [],
    weakPoints: Array.isArray(data.weakPoints) ? data.weakPoints : data.overall?.weakestBodyParts ?? [],
    trainingCommand: data.trainingCommand || data.overall?.topPriorities?.[0] || '',
    nextPhotoSuggestion: data.nextPhotoSuggestion || '',
    canGenerateReport: data.canGenerateReport === true,
    overall: data.overall,
    frontReport: data.frontReport,
    sideReport: data.sideReport,
    backReport: data.backReport,
    trainingRecommendation: data.trainingRecommendation,
    nutritionAdvice: data.nutritionAdvice,
    prediction: data.prediction,
    safetyNote: data.safetyNote,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<{ response: Response; data: any }> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('NETWORK_ERROR');
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) throwErrorFromData(data, response.status);
  return { response, data };
}

function throwErrorFromData(data: any, status?: number): never {
  if (data?.code === 'MISSING_API_KEY') throw new Error('MISSING_API_KEY');
  if (data?.code === 'OPENAI_FAILED') throw new Error('OPENAI_FAILED');
  if (data?.code === 'OPENAI_CONNECTION_ERROR') throw new Error('OPENAI_CONNECTION_ERROR');
  if (data?.code === 'OPENAI_TIMEOUT') throw new Error('OPENAI_TIMEOUT');
  if (data?.code === 'INVALID_AI_JSON') throw new Error('INVALID_AI_JSON');
  if (data?.code === 'INVALID_IMAGE_DATA') throw new Error('INVALID_IMAGE_DATA');
  if (data?.code === 'INVALID_IMAGE_TYPE') throw new Error('INVALID_IMAGE_TYPE');
  if (data?.code === 'IMAGE_TOO_LARGE') throw new Error('IMAGE_TOO_LARGE');
  if (data?.code === 'FRONT_PHOTO_REQUIRED') throw new Error('FRONT_PHOTO_REQUIRED');
  if (status && status >= 500) throw new Error('SERVER_ERROR');
  throw new Error('REPORT_FAILED');
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
