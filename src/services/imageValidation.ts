import type { PhysiqueImageResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const maxImageBytes = 8 * 1024 * 1024;
const acceptedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const acceptedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

function hasAcceptedImageType(file: File) {
  const fileName = file.name.toLowerCase();
  return acceptedMimeTypes.includes(file.type) || acceptedExtensions.some((extension) => fileName.endsWith(extension));
}

function isHeicImage(file: File) {
  const fileName = file.name.toLowerCase();
  return file.type === 'image/heic' || file.type === 'image/heif' || fileName.endsWith('.heic') || fileName.endsWith('.heif');
}

export async function normalizeImageFile(file: File): Promise<File> {
  if (!hasAcceptedImageType(file)) throw new Error('INVALID_IMAGE_TYPE');
  if (file.size > maxImageBytes) throw new Error('IMAGE_TOO_LARGE');
  if (!isHeicImage(file)) return file;

  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const safeName = file.name.replace(/\.(heic|heif)$/i, '.jpg') || 'iphone-photo.jpg';
    return new File([blob], safeName, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    throw new Error('HEIC_CONVERSION_FAILED');
  }
}

export async function fileToBase64(file: File): Promise<string> {
  console.log('Converting image...');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;

      if (typeof result !== 'string') {
        reject(new Error('Failed to read image.'));
        return;
      }

      const base64 = result.split(',')[1];

      if (!base64) {
        reject(new Error('Invalid image data.'));
        return;
      }

      console.log('Base64 created');
      resolve(base64);
    };

    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });
}

export async function analyzePhysiqueImageFile(file: File, formData?: unknown): Promise<PhysiqueImageResult> {
  console.log('Uploading image...');
  const base64Image = await fileToBase64(file);
  console.log('Sending request...');

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/analyze-physique-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64Image,
        mimeType: file.type,
        formData,
      }),
    });
  } catch {
    throw new Error('BACKEND_UNREACHABLE');
  }

  const data = await response.json().catch(() => ({}));
  console.log('Response received:', data);

  if (!response.ok) {
    if (data?.code === 'MISSING_API_KEY') throw new Error('MISSING_API_KEY');
    if (data?.code === 'OPENAI_FAILED') throw new Error('OPENAI_FAILED');
    if (data?.code === 'INVALID_IMAGE_TYPE') throw new Error('INVALID_IMAGE_TYPE');
    if (data?.code === 'IMAGE_TOO_LARGE') throw new Error('IMAGE_TOO_LARGE');
    if (data?.code === 'HEIC_NOT_CONVERTED') throw new Error('HEIC_CONVERSION_FAILED');
    throw new Error(data?.error || 'IMAGE_CHECK_FAILED');
  }

  return {
    isPhysiquePhoto: data.valid === true && data.canGenerateReport === true,
    confidence: data.valid === true ? 100 : 0,
    photoType: data.valid === true ? 'unclear' : 'not_human',
    reason: typeof data.reason === 'string' ? data.reason : '',
    safeMessage:
      data.valid === true
        ? 'Photo looks good. You can generate your report.'
        : 'This does not look like a clear physique photo. I can still recognize the effort, but I need a visible body pose to give useful training feedback.',
    imageType: ['physique_photo', 'text_screenshot', 'random_object', 'unclear', 'non_physique'].includes(data.imageType) ? data.imageType : 'unclear',
    praise: typeof data.praise === 'string' && data.praise ? data.praise : 'Nice upload.',
    message:
      typeof data.message === 'string' && data.message
        ? data.message
        : data.valid === true
          ? 'Photo looks good. You can generate your report.'
          : 'I can’t give physique guidance from this image because the body is not clearly visible.',
    physiqueSummary: typeof data.physiqueSummary === 'string' ? data.physiqueSummary : '',
    strongPoints: Array.isArray(data.strongPoints) ? data.strongPoints.map(String) : [],
    weakPoints: Array.isArray(data.weakPoints) ? data.weakPoints.map(String) : [],
    trainingCommand: typeof data.trainingCommand === 'string' ? data.trainingCommand : '',
    nextPhotoSuggestion:
      typeof data.nextPhotoSuggestion === 'string' && data.nextPhotoSuggestion
        ? data.nextPhotoSuggestion
        : 'Please upload a clear front, side, or back physique photo.',
    canGenerateReport: data.canGenerateReport === true,
    overall: data.overall,
    frontReport: data.frontReport,
    sideReport: data.sideReport,
    backReport: data.backReport,
    trainingRecommendation: data.trainingRecommendation,
    prediction: data.prediction,
    safetyNote: data.safetyNote,
  };
}

export function previewFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read image.'));
    };
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.readAsDataURL(file);
  });
}
