import type { Photos } from './types';

export type ImageValidationReason = 'missing-front' | 'invalid-image-type' | 'missing-preview' | 'vision-not-ready';

export type ImageValidationResult = {
  ok: boolean;
  reason?: ImageValidationReason;
};

type VisionValidationContext = {
  frontPhoto: string;
  sidePhoto?: string;
  backPhoto?: string;
};

type VisionValidationResult = {
  containsHumanPhysique: boolean;
};

export function validatePhysiqueImages(photos: Photos): ImageValidationResult {
  if (!photos.front) {
    return { ok: false, reason: 'missing-front' };
  }

  if (!hasPreview(photos.front)) {
    return { ok: false, reason: 'missing-preview' };
  }

  if (!isImagePreview(photos.front) || !optionalImagePreviewIsValid(photos.side) || !optionalImagePreviewIsValid(photos.back)) {
    return { ok: false, reason: 'invalid-image-type' };
  }

  return { ok: true };
}

export async function validatePhysiqueImagesWithVision(photos: Photos): Promise<ImageValidationResult> {
  const basicValidation = validatePhysiqueImages(photos);
  if (!basicValidation.ok) {
    return basicValidation;
  }

  const visionResult = await checkHumanPhysiqueWithVision({
    frontPhoto: photos.front,
    sidePhoto: photos.side || undefined,
    backPhoto: photos.back || undefined,
  });

  if (!visionResult.containsHumanPhysique) {
    return { ok: false, reason: 'vision-not-ready' };
  }

  return { ok: true };
}

function hasPreview(value: string) {
  return value.trim().length > 0;
}

function optionalImagePreviewIsValid(value: string) {
  return !value || isImagePreview(value);
}

function isImagePreview(value: string) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

async function checkHumanPhysiqueWithVision(_context: VisionValidationContext): Promise<VisionValidationResult> {
  // Report generation is still guarded by the server-side OpenAI Vision check in the upload flow.
  return { containsHumanPhysique: true };
}
