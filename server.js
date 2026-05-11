import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import os from 'os';
import crypto from 'crypto';
import https from 'https';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '';
const ALLOW_LOCAL_ORIGINS = process.env.ALLOW_LOCAL_ORIGINS !== 'false';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const VALID_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UNSUPPORTED_SOURCE_TYPES = ['image/heic', 'image/heif'];
const PRIMARY_MODEL = 'gpt-4.1-mini';
const OPENAI_TIMEOUT_MS = 180_000;
const OPENAI_RETRY_ATTEMPTS = 3;
const OPENAI_RETRY_DELAY_MS = 2_000;
const reportJobs = new Map();

console.log('API key exists:', !!process.env.OPENAI_API_KEY);

const openaiProxyUrl = getOpenAiProxyUrl();
const openaiProxyAgent = openaiProxyUrl ? new ProxyAgent(openaiProxyUrl) : null;
if (openaiProxyUrl) {
  console.log('OpenAI proxy configured:', maskProxyUrl(openaiProxyUrl));
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  fetch: openaiProxyAgent
    ? (url, init = {}) => undiciFetch(url, { ...init, dispatcher: openaiProxyAgent })
    : undefined,
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught server error:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled server rejection:', reason);
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  }),
);
app.use(express.json({ limit: '16mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Backend is working',
    apiKeyExists: !!process.env.OPENAI_API_KEY,
    openAiModel: PRIMARY_MODEL,
    proxyConfigured: !!openaiProxyUrl,
    frontendOriginConfigured: !!FRONTEND_ORIGIN,
    localOriginsAllowed: ALLOW_LOCAL_ORIGINS,
    environment: process.env.NODE_ENV || 'development',
  });
});

app.get('/api/openai-test', async (req, res) => {
  console.log('OpenAI test route reached');
  console.log('API key exists:', !!process.env.OPENAI_API_KEY);

  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY');
      return res.status(500).json({ ok: false, code: 'MISSING_API_KEY', error: 'Server API key missing.' });
    }

    const connectivity = await testOpenAiHttpsReachability();
    console.log('OpenAI HTTPS reachability:', connectivity.reachable ? 'yes' : 'no');

    const result = await callWithOpenAiRetry(
      () =>
        openai.responses.create({
          model: PRIMARY_MODEL,
          input: 'Say OK',
          max_output_tokens: 20,
        }),
      'OpenAI text test failed',
    );

    res.json({
      success: true,
      model: PRIMARY_MODEL,
      output: result.output_text,
      diagnostics: {
        apiKeyExists: true,
        apiHostReachable: connectivity.reachable,
        apiHostStatus: connectivity.statusCode,
        proxyConfigured: !!openaiProxyUrl,
      },
    });
  } catch (error) {
    console.error('OpenAI test failed');
    logOpenAiError(error);
    const connectivity = await testOpenAiHttpsReachability().catch((reachabilityError) => ({
      reachable: false,
      error: safeErrorDetails(reachabilityError),
    }));
    res.status(error?.status || 500).json({
      success: false,
      model: PRIMARY_MODEL,
      message: previewEnvironmentMessage(error),
      diagnostics: {
        apiKeyExists: !!process.env.OPENAI_API_KEY,
        apiHostReachable: connectivity.reachable,
        apiHostStatus: connectivity.statusCode,
        proxyConfigured: !!openaiProxyUrl,
        error: safeErrorDetails(error),
      },
    });
  }
});

app.post('/api/analyze-physique-image', async (req, res) => {
  console.log('Analyze route reached');

  try {
    console.log('Request body received');
    const { base64Image, mimeType, formData = {} } = req.body ?? {};
    const validation = validateImagePayload(base64Image, mimeType);
    if (!validation.ok) return res.status(validation.status).json({ code: validation.code, error: validation.error });
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY');
      return res.status(500).json({ code: 'MISSING_API_KEY', error: 'Server API key missing.' });
    }

    const imageDataUrl = `data:${mimeType};base64,${base64Image}`;
    const response = await callWithFallback((model) => createImageValidationResponse(model, imageDataUrl, formData), 'OpenAI image request failed');
    const parsed = parseOpenAiJson(response);
    const report = normalizeReportPayload(parsed);

    res.json({
      ...report,
      valid: report.valid,
      canGenerateReport: report.canGenerateReport,
      praise: report.praise || 'Nice upload.',
      reason: report.message || '',
      message: report.message || report.physiqueSummary || '',
      physiqueSummary: report.valid ? report.physiqueSummary : '',
      strongPoints: report.valid ? report.overall?.bestBodyParts ?? [] : [],
      weakPoints: report.valid ? report.overall?.weakestBodyParts ?? [] : [],
      trainingCommand: report.valid ? report.overall?.topPriorities?.[0] || report.trainingRecommendation?.[0]?.focus || '' : '',
    });
  } catch (error) {
    return handleRouteError(res, error, 'IMAGE_CHECK_FAILED', 'Image checking failed');
  }
});

app.post('/api/generate-physique-report', async (req, res) => {
  console.log('Report API started');

  try {
    const normalized = await generateReportFromBody(req.body);
    res.json(normalized);
    console.log('Report response sent');
  } catch (error) {
    console.error('Report generation error:', error);
    return handleRouteError(res, error, 'REPORT_FAILED', 'Report generation failed');
  }
});

app.post('/api/generate-physique-report-job', (req, res) => {
  console.log('Report job requested');
  const jobId = crypto.randomUUID();
  reportJobs.set(jobId, {
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  generateReportFromBody(req.body)
    .then((result) => {
      reportJobs.set(jobId, {
        status: 'done',
        createdAt: reportJobs.get(jobId)?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        result,
      });
      console.log('Report job completed:', jobId);
    })
    .catch((error) => {
      console.error('Report job failed:', jobId, error);
      reportJobs.set(jobId, {
        status: 'failed',
        createdAt: reportJobs.get(jobId)?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
        error: serializeRouteError(error),
      });
    });

  res.status(202).json({ jobId, status: 'pending' });
});

app.get('/api/generate-physique-report-job/:jobId', (req, res) => {
  const job = reportJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ code: 'REPORT_JOB_NOT_FOUND', error: 'Report job not found.' });
  res.json(job);
});

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    console.error('Image too large');
    return res.status(413).json({ code: 'IMAGE_TOO_LARGE', error: 'Image must be under 8MB.' });
  }
  return next(error);
});

function validateImagePayload(base64Image, mimeType) {
  console.log('Mime type:', mimeType);
  console.log('Base64 exists:', !!base64Image);

  if (!base64Image || typeof base64Image !== 'string') {
    console.error('Base64 missing');
    return { ok: false, status: 400, code: 'BASE64_MISSING', error: 'Base64 missing' };
  }
  if (UNSUPPORTED_SOURCE_TYPES.includes(mimeType)) {
    console.error('Invalid image type');
    return { ok: false, status: 400, code: 'HEIC_NOT_CONVERTED', error: 'iPhone HEIC photo detected. Please convert to JPG or allow automatic conversion.' };
  }
  if (!VALID_MIME_TYPES.includes(mimeType)) {
    console.error('Invalid image type');
    return { ok: false, status: 400, code: 'INVALID_IMAGE_TYPE', error: 'Only JPG, PNG, and WEBP are allowed.' };
  }
  if (base64Image.startsWith('data:')) {
    console.error('Base64 contains data URL prefix');
    return { ok: false, status: 400, code: 'DOUBLE_PREFIX_RISK', error: 'Frontend must send raw base64 only.' };
  }
  if (Buffer.byteLength(base64Image, 'base64') > MAX_IMAGE_BYTES) {
    console.error('Image too large');
    return { ok: false, status: 413, code: 'IMAGE_TOO_LARGE', error: 'Image must be under 8MB.' };
  }
  return { ok: true };
}

async function generateReportFromBody(body = {}) {
  console.log('Report request body received');
  const { photos = {}, formData = {} } = body ?? {};
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY');
    const error = new Error('MISSING_API_KEY');
    error.status = 500;
    throw error;
  }

  const preparedPhotos = [];
  for (const angle of ['front', 'side', 'back']) {
    const photo = photos?.[angle];
    if (!photo?.base64Image) continue;
    const validation = validateImagePayload(photo.base64Image, photo.mimeType);
    if (!validation.ok) {
      const error = new Error(validation.code);
      error.status = validation.status;
      error.publicMessage = validation.error;
      throw error;
    }
    preparedPhotos.push({ angle, imageDataUrl: `data:${photo.mimeType};base64,${photo.base64Image}` });
  }
  console.log('Photos received:', preparedPhotos.map((photo) => photo.angle).join(', ') || 'none');

  if (!preparedPhotos.some((photo) => photo.angle === 'front')) {
    console.error('Base64 missing');
    const error = new Error('FRONT_PHOTO_REQUIRED');
    error.status = 400;
    throw error;
  }

  console.log('Sending OpenAI request');
  const response = await callWithFallback((model) => createReportResponse(model, preparedPhotos, formData), 'OpenAI report request failed');
  console.log('OpenAI response received');
  const parsed = parseOpenAiJson(response);
  console.log('Parsed report JSON');
  const normalized = normalizeReportPayload(parsed);
  console.log('Report normalized:', {
    valid: normalized.valid,
    canGenerateReport: normalized.canGenerateReport,
    hasOverall: !!normalized.overall,
    frontAnnotations: normalized.frontReport?.annotations?.length ?? 0,
    sideAnnotations: normalized.sideReport?.annotations?.length ?? 0,
    backAnnotations: normalized.backReport?.annotations?.length ?? 0,
  });
  return normalized;
}

async function callWithFallback(factory, label) {
  return callWithOpenAiRetry(() => factory(PRIMARY_MODEL), label);
}

async function callWithOpenAiRetry(factory, label) {
  let lastError;

  for (let attempt = 1; attempt <= OPENAI_RETRY_ATTEMPTS; attempt += 1) {
    try {
      console.log(`Calling OpenAI... attempt ${attempt}/${OPENAI_RETRY_ATTEMPTS}`);
      const response = await withTimeout(factory(), OPENAI_TIMEOUT_MS);
      console.log('OpenAI response received');
      return response;
    } catch (error) {
      lastError = error;
      console.error(`${label} attempt ${attempt}/${OPENAI_RETRY_ATTEMPTS}`);
      logOpenAiError(error);

      if (!isRetryableOpenAiError(error) || attempt === OPENAI_RETRY_ATTEMPTS) break;
      console.log(`Retrying OpenAI request in ${OPENAI_RETRY_DELAY_MS / 1000}s...`);
      await sleep(OPENAI_RETRY_DELAY_MS);
    }
  }

  if (lastError?.message === 'OPENAI_TIMEOUT') throw lastError;
  if (isInvalidOpenAiImageError(lastError)) {
    const wrapped = new Error('INVALID_IMAGE_DATA');
    wrapped.status = 400;
    wrapped.details = lastError;
    throw wrapped;
  }
  const wrapped = new Error(isOpenAiConnectionError(lastError) ? 'OPENAI_CONNECTION_ERROR' : 'OPENAI_FAILED');
  wrapped.status = isOpenAiConnectionError(lastError) ? 502 : lastError?.status || 502;
  wrapped.details = lastError;
  throw wrapped;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      windowlessSetTimeout(() => reject(new Error('OPENAI_TIMEOUT')), ms);
    }),
  ]);
}

function windowlessSetTimeout(callback, ms) {
  return setTimeout(callback, ms);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logOpenAiError(error) {
  console.error('Message:', error?.message);
  console.error('Status:', error?.status);
  console.error('Code:', error?.code);
  console.error('Type:', error?.type);
}

function isOpenAiConnectionError(error) {
  return error?.message === 'Connection error.' || error?.name === 'APIConnectionError' || error?.cause;
}

function isRetryableOpenAiError(error) {
  return error?.message === 'OPENAI_TIMEOUT' || isOpenAiConnectionError(error) || [408, 409, 429, 500, 502, 503, 504].includes(error?.status);
}

function isInvalidOpenAiImageError(error) {
  return error?.status === 400 && (error?.code === 'invalid_value' || error?.error?.code === 'invalid_value') && String(error?.message || '').toLowerCase().includes('image data');
}

function getOpenAiProxyUrl() {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || '';
  if (!proxyUrl) return '';
  const noProxy = process.env.NO_PROXY || process.env.no_proxy || '';
  const noProxyItems = noProxy
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (noProxyItems.includes('*') || noProxyItems.includes('api.openai.com') || noProxyItems.includes('.openai.com')) return '';
  return proxyUrl;
}

function maskProxyUrl(proxyUrl) {
  try {
    const url = new URL(proxyUrl);
    if (url.username) url.username = '***';
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return 'configured';
  }
}

function testOpenAiHttpsReachability() {
  return new Promise((resolve) => {
    if (!process.env.OPENAI_API_KEY) {
      resolve({ reachable: false, error: { message: 'OPENAI_API_KEY is missing.' } });
      return;
    }

    const request = https.request(
      {
        hostname: 'api.openai.com',
        path: '/v1/models',
        method: 'GET',
        timeout: 10_000,
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'User-Agent': 'AI-Physique-Judge-Diagnostic',
        },
      },
      (response) => {
        response.resume();
        resolve({ reachable: true, statusCode: response.statusCode });
      },
    );

    request.on('timeout', () => {
      request.destroy(new Error('OPENAI_HOST_TIMEOUT'));
    });
    request.on('error', (error) => {
      resolve({ reachable: false, error: safeErrorDetails(error) });
    });
    request.end();
  });
}

function safeErrorDetails(error) {
  const cause = error?.cause;
  return {
    name: error?.name,
    message: error?.message,
    status: error?.status,
    code: error?.code,
    type: error?.type,
    causeName: cause?.name,
    causeMessage: cause?.message,
    causeCode: cause?.code,
  };
}

function previewEnvironmentMessage(error) {
  if (isOpenAiConnectionError(error)) {
    return 'OpenAI connection failed from this preview environment. Please run locally or deploy backend to Render/Railway/Fly.io/Vercel server functions.';
  }
  if (error?.message === 'OPENAI_TIMEOUT') return 'OpenAI request timed out. Please try again.';
  return error?.message || 'OpenAI test failed.';
}

function parseOpenAiJson(response) {
  const text = response.output_text?.trim();
  if (!text) {
    console.error('AI returned invalid JSON');
    throw new Error('INVALID_AI_JSON');
  }

  console.log('OpenAI output text length:', text.length);
  const candidates = buildJsonCandidates(text);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next cleanup candidate.
    }
  }

    console.error('AI returned invalid JSON');
    console.error('AI text preview:', text.slice(0, 600));
    throw new Error('INVALID_AI_JSON');
}

function buildJsonCandidates(text) {
  const cleaned = text
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const candidates = [cleaned];
  const firstObject = cleaned.indexOf('{');
  const lastObject = cleaned.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) candidates.push(cleaned.slice(firstObject, lastObject + 1));
  return [...new Set(candidates)];
}

function handleRouteError(res, error, fallbackCode, fallbackMessage) {
  const serialized = serializeRouteError(error, fallbackCode, fallbackMessage);
  return res.status(serialized.status).json(serialized.body);
}

function serializeRouteError(error, fallbackCode = 'REPORT_FAILED', fallbackMessage = 'Report generation failed') {
  if (error?.message === 'MISSING_API_KEY') {
    return { status: 500, body: { code: 'MISSING_API_KEY', error: 'Server API key missing.' } };
  }
  if (error?.message === 'FRONT_PHOTO_REQUIRED') {
    return { status: 400, body: { code: 'FRONT_PHOTO_REQUIRED', error: 'Front photo is required.' } };
  }
  if (['INVALID_IMAGE_TYPE', 'IMAGE_TOO_LARGE', 'HEIC_NOT_CONVERTED', 'DOUBLE_PREFIX_RISK', 'BASE64_MISSING'].includes(error?.message)) {
    return { status: error.status || 400, body: { code: error.message, error: error.publicMessage || 'Invalid image.' } };
  }
  if (error?.message === 'INVALID_IMAGE_DATA') {
    return { status: 400, body: { code: 'INVALID_IMAGE_DATA', error: 'Photo check failed. Please try again or upload a clearer image.' } };
  }
  if (error?.message === 'OPENAI_FAILED') {
    return { status: 502, body: { code: 'OPENAI_FAILED', error: 'OpenAI image check failed.' } };
  }
  if (error?.message === 'OPENAI_CONNECTION_ERROR') {
    return {
      status: 502,
      body: {
        code: 'OPENAI_CONNECTION_ERROR',
        error: 'OpenAI connection failed from this preview environment. Please run locally or deploy backend to Render/Railway/Fly.io/Vercel server functions.',
      },
    };
  }
  if (error?.message === 'OPENAI_TIMEOUT') {
    return { status: 504, body: { code: 'OPENAI_TIMEOUT', error: 'AI response took too long. Please try again.' } };
  }
  if (error?.message === 'INVALID_AI_JSON') {
    return { status: 502, body: { code: 'INVALID_AI_JSON', error: 'AI response formatting failed.' } };
  }
  console.error(`${fallbackCode}:`, error instanceof Error ? error.message : 'Unknown error');
  return { status: 500, body: { code: fallbackCode, error: fallbackMessage } };
}

function createImageValidationResponse(model, imageDataUrl, formData = {}) {
  return openai.responses.create({
    model,
    max_output_tokens: 1400,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `
You are an AI physique judge and fitness coach.

Analyze the uploaded image carefully.
Use the user context when available:
${JSON.stringify(formData ?? {})}

First decide if the image is useful for physique/body feedback.
A useful physique image means a real human body is visible enough to assess shape, balance, muscle structure, or body composition.

Return ONLY valid JSON in this shape:
{
  "valid": true,
  "imageType": "physique_photo",
  "canGenerateReport": true,
  "praise": "short positive sentence",
  "message": "short human message",
  "overall": {
    "physiqueScore": 0,
    "muscleMassScore": 0,
    "symmetryScore": 0,
    "conditioningScore": 0,
    "aestheticScore": 0,
    "summary": "",
    "bestBodyParts": [],
    "weakestBodyParts": [],
    "topPriorities": []
  },
  "frontReport": { "good": [], "needsImprovement": [], "improveMore": [], "coachCommand": "", "annotations": [] },
  "sideReport": { "good": [], "needsImprovement": [], "improveMore": [], "coachCommand": "", "annotations": [] },
  "backReport": { "good": [], "needsImprovement": [], "improveMore": [], "coachCommand": "", "annotations": [] },
  "trainingRecommendation": [],
  "prediction": { "fourWeeks": "", "eightWeeks": "", "twelveWeeks": "" },
  "nextPhotoSuggestion": "",
  "safetyNote": "For fitness education only. Not medical advice."
}

If not clear body/physique photo, valid and canGenerateReport must be false. Do not give anatomy advice.
No medical diagnosis, body shaming, sexual comments, or identity guesses.
`,
          },
          { type: 'input_image', image_url: imageDataUrl },
        ],
      },
    ],
  });
}

function createReportResponse(model, preparedPhotos, formData = {}) {
  const imageContent = preparedPhotos.flatMap((photo) => [
    { type: 'input_text', text: `${photo.angle.toUpperCase()} photo: analyze this angle only when it is visible and useful.` },
    { type: 'input_image', image_url: photo.imageDataUrl, detail: 'low' },
  ]);

  return openai.responses.create({
    model,
    max_output_tokens: 1800,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `
You are an AI physique judge and fitness coach.

Generate a useful but concise physique report from the uploaded photos.
Use the user's form data:
${JSON.stringify(formData ?? {})}

Only analyze uploaded and clear angles. Front photo is required. Side and back are optional.
Do not invent anatomy feedback for missing or unclear angles.
Food advice must respect country, food budget, dietary preference, training experience, and goal.

Return ONLY valid JSON:
{
  "valid": true,
  "canGenerateReport": true,
  "overall": {
    "physiqueScore": 0,
    "muscleMassScore": 0,
    "symmetryScore": 0,
    "conditioningScore": 0,
    "aestheticScore": 0,
    "summary": "",
    "bestBodyParts": [],
    "weakestBodyParts": [],
    "topPriorities": []
  },
  "frontReport": {
    "good": [],
    "needsImprovement": [],
    "improveMore": [],
    "coachCommand": "",
    "annotations": [{ "label": "", "comment": "", "position": "top-left", "tone": "strong" }]
  },
  "sideReport": { "good": [], "needsImprovement": [], "improveMore": [], "coachCommand": "", "annotations": [] },
  "backReport": { "good": [], "needsImprovement": [], "improveMore": [], "coachCommand": "", "annotations": [] },
  "trainingRecommendation": [
    { "focus": "", "reason": "", "exercises": [], "weeklyTarget": "", "sets": "", "reps": "" }
  ],
  "nutritionAdvice": {
    "calories": "",
    "macros": "",
    "foodSuggestions": [],
    "notes": []
  },
  "prediction": { "fourWeeks": "", "eightWeeks": "", "twelveWeeks": "" },
  "nextPhotoSuggestion": "",
  "safetyNote": "For fitness education only. Not medical advice."
}

If image is not a clear physique photo:
{
  "valid": false,
  "imageType": "non_physique",
  "canGenerateReport": false,
  "message": "I can't give physique guidance because the body is not clearly visible.",
  "nextPhotoSuggestion": "Upload a clear front, side, or back physique photo."
}

Front checks: shoulder width, chest fullness, upper chest, arms, waist, V taper, abs visibility, left/right balance.
Side checks: posture, chest thickness, shoulder roundness, arm thickness, stomach control, side balance.
Back checks: lat width, back thickness, traps, rear delts, lower back, V taper, symmetry, conditioning.
Annotation positions: top-left, top-right, upper-center, middle-left, middle-right, center, lower-center.
Annotation tone: strong, improve, warning.
Use 1 to 3 annotations per clear uploaded angle.
Predictions must say may improve, likely direction, or depends on consistency. No guarantees.
No medical diagnosis, exact body fat percentage, body shaming, sexual comments, or identity guesses.
`,
          },
          ...imageContent,
        ],
      },
    ],
  });
}

function normalizeReportPayload(parsed) {
  const valid = parsed.valid === true && parsed.canGenerateReport === true;
  if (!valid) {
    return {
      valid: false,
      imageType: 'non_physique',
      canGenerateReport: false,
      message: typeof parsed.message === 'string' ? parsed.message : "I can't give physique guidance because the body is not clearly visible.",
      nextPhotoSuggestion: typeof parsed.nextPhotoSuggestion === 'string' ? parsed.nextPhotoSuggestion : 'Upload a clear front, side, or back physique photo.',
    };
  }

  const overall = normalizeOverall(parsed.overall);
  const trainingRecommendation = normalizeTrainingRecommendation(parsed.trainingRecommendation);
  return {
    valid: true,
    imageType: 'physique_photo',
    canGenerateReport: true,
    praise: typeof parsed.praise === 'string' ? parsed.praise : 'Good check-in.',
    message: typeof parsed.message === 'string' ? parsed.message : overall.summary,
    physiqueSummary: overall.summary,
    strongPoints: overall.bestBodyParts,
    weakPoints: overall.weakestBodyParts,
    trainingCommand: overall.topPriorities[0] || trainingRecommendation[0]?.focus || '',
    overall,
    frontReport: normalizePhotoReport(parsed.frontReport),
    sideReport: normalizePhotoReport(parsed.sideReport),
    backReport: normalizePhotoReport(parsed.backReport),
    trainingRecommendation,
    nutritionAdvice: normalizeNutritionAdvice(parsed.nutritionAdvice),
    prediction: normalizePrediction(parsed.prediction),
    nextPhotoSuggestion: typeof parsed.nextPhotoSuggestion === 'string' ? parsed.nextPhotoSuggestion : 'Upload front, side, and back photos in the same lighting.',
    safetyNote: typeof parsed.safetyNote === 'string' ? parsed.safetyNote : 'For fitness education only. Not medical advice.',
  };
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function list(value, limit = 5) {
  return Array.isArray(value) ? value.slice(0, limit).map(String).filter(Boolean) : [];
}

function normalizeOverall(value = {}) {
  return {
    physiqueScore: clampScore(value.physiqueScore),
    muscleMassScore: clampScore(value.muscleMassScore),
    symmetryScore: clampScore(value.symmetryScore),
    conditioningScore: clampScore(value.conditioningScore),
    aestheticScore: clampScore(value.aestheticScore),
    summary: typeof value.summary === 'string' ? value.summary : '',
    bestBodyParts: list(value.bestBodyParts, 3),
    weakestBodyParts: list(value.weakestBodyParts, 3),
    topPriorities: list(value.topPriorities, 3),
  };
}

function normalizePhotoReport(value = {}) {
  return {
    good: list(value.good, 4),
    needsImprovement: list(value.needsImprovement, 4),
    improveMore: list(value.improveMore, 4),
    coachCommand: typeof value.coachCommand === 'string' ? value.coachCommand : '',
    annotations: normalizeAnnotations(value.annotations),
  };
}

function normalizeAnnotations(value) {
  const positions = ['top-left', 'top-right', 'upper-center', 'middle-left', 'middle-right', 'center', 'lower-center'];
  const tones = ['improve', 'strong', 'warning'];
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 4)
    .map((item, index) => ({
      label: typeof item?.label === 'string' && item.label ? item.label : typeof item?.comment === 'string' ? item.comment : 'Coach note',
      comment: typeof item?.comment === 'string' ? item.comment : '',
      position: positions.includes(item?.position) ? item.position : positions[index % positions.length],
      tone: tones.includes(item?.tone) ? item.tone : 'improve',
    }))
    .filter((item) => item.label);
}

function normalizeTrainingRecommendation(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).map((item) => ({
    focus: typeof item?.focus === 'string' ? item.focus : '',
    reason: typeof item?.reason === 'string' ? item.reason : '',
    exercises: list(item?.exercises, 4),
    weeklyTarget: typeof item?.weeklyTarget === 'string' ? item.weeklyTarget : '',
    sets: typeof item?.sets === 'string' ? item.sets : '',
    reps: typeof item?.reps === 'string' ? item.reps : '',
  }));
}

function normalizeNutritionAdvice(value = {}) {
  return {
    calories: typeof value.calories === 'string' ? value.calories : '',
    macros: typeof value.macros === 'string' ? value.macros : '',
    foodSuggestions: list(value.foodSuggestions, 6),
    notes: list(value.notes, 4),
  };
}

function normalizePrediction(value = {}) {
  return {
    fourWeeks: typeof value.fourWeeks === 'string' ? value.fourWeeks : '',
    eightWeeks: typeof value.eightWeeks === 'string' ? value.eightWeeks : '',
    twelveWeeks: typeof value.twelveWeeks === 'string' ? value.twelveWeeks : '',
  };
}

const apiServer = app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
  console.log('Frontend: http://localhost:5173');
  console.log(`Backend: http://localhost:${PORT}/api/health`);
  console.log(`Network frontend: http://${localIp}:5173`);
  console.log(`Network backend: http://${localIp}:${PORT}/api/health`);
  console.log('CORS frontend origin:', FRONTEND_ORIGIN || 'local development origins');
});

apiServer.on('error', (error) => {
  console.error('Server failed to start', error instanceof Error ? error.message : 'Unknown error');
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const values of Object.values(interfaces)) {
    for (const value of values ?? []) {
      if (value.family === 'IPv4' && !value.internal) return value.address;
    }
  }
  return 'YOUR_LOCAL_IP';
}

function isAllowedOrigin(origin) {
  if (!origin) return true;

  const configuredOrigins = FRONTEND_ORIGIN.split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins.includes(origin) || (ALLOW_LOCAL_ORIGINS && isLocalDevelopmentOrigin(origin));
  }

  return isLocalDevelopmentOrigin(origin);
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const url = new URL(origin);
    const isLocalHost = ['localhost', '127.0.0.1'].includes(url.hostname);
    const isPrivateLan = /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname) || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname);
    return (isLocalHost || isPrivateLan) && ['5173', '5174', '4173'].includes(url.port);
  } catch {
    return false;
  }
}
