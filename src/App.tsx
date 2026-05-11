import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, Eye, TrendingUp, Zap } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AnimatedSection } from './components/AnimatedSection';
import { AnnotatedPhotoFeedback } from './components/AnnotatedPhotoFeedback';
import { AppLayout } from './components/AppLayout';
import { CTAButton } from './components/CTAButton';
import { DashboardReportCard } from './components/DashboardReportCard';
import { HeroVisual } from './components/HeroVisual';
import { NutritionCard } from './components/NutritionCard';
import { PhysiqueForm } from './components/PhysiqueForm';
import { ReportSection } from './components/ReportSection';
import { ScoreCard } from './components/ScoreCard';
import { ShareActions } from './components/ShareActions';
import { TrainingPlanCard } from './components/TrainingPlanCard';
import { UploadZone } from './components/UploadZone';
import { translations } from './i18n';
import type { T } from './i18n';
import { createAiReport } from './mockReport';
import { analyzePhysiqueImageFile, normalizeImageFile, previewFile } from './services/imageValidation';
import { compressPhotosForHistory, generatePhysiqueReport } from './services/reportGenerator';
import type { FormData, Language, Page, PhotoKey, Photos, PhysiqueImageResult, Report } from './types';
import { validatePhysiqueImages } from './validation';

const emptyPhotos: Photos = { front: '', side: '', back: '' };
const emptyForm: FormData = {
  age: '',
  gender: '',
  height: '',
  weight: '',
  experience: '',
  goal: '',
  division: '',
  country: '',
  budget: '',
  diet: '',
};

const reportKey = 'ai-physique-judge-reports';
const languageKey = 'ai-physique-judge-language';
const ProgressChart = lazy(() => import('./components/ProgressChart').then((module) => ({ default: module.ProgressChart })));
const loadingStepKeys = [
  'Checking uploaded photos',
  'Reading front, side, and back views',
  'Detecting strengths',
  'Detecting improvement areas',
  'Building your report',
];

export default function App() {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem(languageKey);
    return saved === 'en' || saved === 'ja' || saved === 'zh' ? saved : 'en';
  });
  const [page, setPage] = useState<Page>('landing');
  const [photos, setPhotos] = useState<Photos>(emptyPhotos);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showUploadError, setShowUploadError] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState('');
  const [imageCheckResult, setImageCheckResult] = useState<PhysiqueImageResult | null>(null);
  const [imageCheckResults, setImageCheckResults] = useState<Partial<Record<PhotoKey, PhysiqueImageResult>>>({});
  const [isCheckingImage, setIsCheckingImage] = useState(false);
  const [checkingPhotoKey, setCheckingPhotoKey] = useState<PhotoKey | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportLoading, setReportLoading] = useState({ progress: 0, remaining: 0, stepIndex: 0, total: 30 });
  const [reports, setReports] = useState<Report[]>(() => readReports());
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const t = translations[language];
  const activeReport = useMemo(() => reports.find((report) => report.id === activeReportId) ?? null, [activeReportId, reports]);

  useEffect(() => {
    localStorage.setItem(languageKey, language);
  }, [language]);

  useEffect(() => {
    console.log('Frontend: http://localhost:5173');
    console.log('Backend: http://localhost:3001/api/health');
    console.log('Network frontend: http://192.168.132.174:5173');
    console.log('Network backend: http://192.168.132.174:3001/api/health');
  }, []);

  useEffect(() => {
    writeReports(reports);
  }, [reports]);

  useEffect(() => {
    if (!isGeneratingReport) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setReportLoading((current) => {
        const remaining = Math.max(0, current.total - elapsed);
        const progress = Math.min(85, Math.round(8 + (Math.min(elapsed, current.total) / current.total) * 77));
        const stepIndex = Math.min(loadingStepKeys.length - 1, Math.floor((Math.min(elapsed, current.total) / current.total) * loadingStepKeys.length));
        return { ...current, remaining, progress, stepIndex };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isGeneratingReport]);

  const canGenerate = useMemo(
    () =>
      imageCheckResults.front?.isPhysiquePhoto === true &&
      imageCheckResults.front?.canGenerateReport === true &&
      !isCheckingImage &&
      !isGeneratingReport &&
      ['age', 'height', 'weight', 'goal', 'division'].every((key) => form[key as keyof FormData]),
    [form, imageCheckResults.front, isCheckingImage, isGeneratingReport],
  );

  const navigate = (nextPage: Page) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const generateReport = async () => {
    console.log('Generate Report clicked');
    if (isGeneratingReport) return;
    setShowUploadError(false);
    setUploadErrorMessage('');
    const total = photos.side && photos.back ? 45 : 30;
    setReportLoading({ progress: 8, remaining: total, stepIndex: 0, total });
    setIsGeneratingReport(true);
    const imageValidation = validatePhysiqueImages(photos);
    if (!canGenerate || imageCheckResults.front?.isPhysiquePhoto !== true || imageCheckResults.front?.canGenerateReport !== true || !imageValidation.ok) {
      setShowUploadError(true);
      setIsGeneratingReport(false);
      return;
    }

    try {
      console.log('Report request started');
      const aiReport = await generatePhysiqueReport(form, photos);
      setReportLoading((current) => ({ ...current, progress: 100, remaining: 0, stepIndex: loadingStepKeys.length - 1 }));
      if (!aiReport.isPhysiquePhoto || !aiReport.canGenerateReport) {
        setUploadErrorMessage(aiReport.safeMessage || aiReport.message || t.upload.reportFailed);
        return;
      }
      const historyPhotos = await compressPhotosForHistory(photos);
      const report = createAiReport(form, historyPhotos, language, { front: aiReport });
      setReports((current) => [report, ...current]);
      setActiveReportId(report.id);
      navigate('report');
    } catch (error) {
      console.error('Frontend report generation error:', error);
      const code = error instanceof Error ? error.message : '';
      if (code === 'BACKEND_UNREACHABLE') setUploadErrorMessage(t.upload.backendUnreachable);
      else if (code === 'MISSING_API_KEY') setUploadErrorMessage(t.upload.serverApiKeyMissing);
      else if (code === 'OPENAI_FAILED') setUploadErrorMessage(t.upload.openAiCheckFailed);
      else if (code === 'OPENAI_CONNECTION_ERROR') setUploadErrorMessage(t.upload.openAiConnectionFailed);
      else if (code === 'OPENAI_TIMEOUT') setUploadErrorMessage(t.upload.openAiTimeout);
      else if (code === 'REPORT_TIMEOUT') setUploadErrorMessage(t.upload.reportTimeout);
      else if (code === 'INVALID_AI_JSON') setUploadErrorMessage(t.upload.invalidAiJson);
      else if (code === 'INVALID_IMAGE_DATA') setUploadErrorMessage(t.upload.openAiCheckFailed);
      else if (code === 'IMAGE_TOO_LARGE') setUploadErrorMessage(t.upload.reportImageTooLarge);
      else if (code === 'NETWORK_ERROR') setUploadErrorMessage(t.upload.networkError);
      else if (code === 'SERVER_ERROR') setUploadErrorMessage(t.upload.serverError);
      else if (code === 'FRONT_PHOTO_REQUIRED') setUploadErrorMessage(t.upload.validationError);
      else setUploadErrorMessage(t.upload.reportFailed);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handlePhotoUpload = async (photoKey: PhotoKey, file: File) => {
    setShowUploadError(false);
    setUploadErrorMessage('');
    setImageCheckResult(null);
    setImageCheckResults((current) => ({ ...current, [photoKey]: undefined }));
    setIsCheckingImage(true);
    setCheckingPhotoKey(photoKey);

    try {
      const normalizedFile = await normalizeImageFile(file);
      const preview = await previewFile(normalizedFile);
      setPhotos((current) => ({ ...current, [photoKey]: preview }));
      const result = await analyzePhysiqueImageFile(normalizedFile, form);
      setImageCheckResult(result);
      setImageCheckResults((current) => ({ ...current, [photoKey]: result }));

      if (!result.isPhysiquePhoto) {
        setUploadErrorMessage('');
        return;
      }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'BACKEND_UNREACHABLE') setUploadErrorMessage(t.upload.backendUnreachable);
      else if (code === 'MISSING_API_KEY') setUploadErrorMessage(t.upload.serverApiKeyMissing);
      else if (code === 'OPENAI_FAILED') setUploadErrorMessage(t.upload.openAiCheckFailed);
      else if (code === 'INVALID_IMAGE_TYPE') setUploadErrorMessage(t.upload.fileTypeError);
      else if (code === 'IMAGE_TOO_LARGE') setUploadErrorMessage(t.upload.fileSizeError);
      else if (code === 'HEIC_CONVERSION_FAILED') setUploadErrorMessage(t.upload.heicConversionFailed);
      else setUploadErrorMessage(t.upload.imageCheckFailed);
    } finally {
      setIsCheckingImage(false);
      setCheckingPhotoKey(null);
    }
  };

  const startNew = () => {
    setPhotos(emptyPhotos);
    setForm(emptyForm);
    setShowUploadError(false);
    setUploadErrorMessage('');
    setImageCheckResult(null);
    setImageCheckResults({});
    setIsCheckingImage(false);
    setCheckingPhotoKey(null);
    setIsGeneratingReport(false);
    setActiveReportId(null);
    navigate('upload');
  };

  return (
    <AppLayout language={language} t={t} page={page} onLanguageChange={setLanguage} onNavigate={navigate}>
      <AnimatePresence mode="wait">
        <motion.div
          key={page}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.28 }}
        >
          {page === 'landing' && <LandingPage t={t} onStart={startNew} onHistory={() => navigate('dashboard')} />}
          {page === 'upload' && (
            <UploadPage
              t={t}
              photos={photos}
              form={form}
              canGenerate={canGenerate}
              showUploadError={showUploadError}
              uploadErrorMessage={uploadErrorMessage}
              imageCheckResult={imageCheckResult}
              isCheckingImage={isCheckingImage}
              checkingPhotoKey={checkingPhotoKey}
              isGeneratingReport={isGeneratingReport}
              reportLoading={reportLoading}
              onPhotoUpload={handlePhotoUpload}
              onUploadError={setUploadErrorMessage}
              onFormChange={setForm}
              onGenerate={generateReport}
            />
          )}
          {page === 'report' && (activeReport ? <ReportPage t={t} report={activeReport} onNew={startNew} /> : <DashboardPage t={t} reports={reports} onNew={startNew} onOpen={openReport} />)}
          {page === 'dashboard' && (
            <DashboardPage
              t={t}
              reports={reports}
              onNew={startNew}
              onOpen={openReport}
            />
          )}
          {isGeneratingReport && page !== 'upload' && (
            <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl">
              <ReportLoadingCard t={t} progress={reportLoading.progress} remaining={reportLoading.remaining} stepIndex={reportLoading.stepIndex} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  );

  function openReport(report: Report) {
    setActiveReportId(report.id);
    navigate('report');
  }
}

function LandingPage({ t, onStart, onHistory }: { t: T; onStart: () => void; onHistory: () => void }) {
  const benefitIcons = [Eye, Camera, TrendingUp];
  const benefits = [
    ['Clear Feedback', 'Know what looks strong and what needs work.'],
    ['Better Photos', 'Use guided front, side, and back poses for better results.'],
    ['Track Progress', 'Save each check and see your score change over time.'],
  ] as const;

  return (
    <div className="space-y-12 pb-10">
      <section className="grid min-h-[76vh] items-center gap-10 py-10 lg:grid-cols-[1.02fr_0.98fr]">
        <AnimatedSection className="max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
            Premium fitness check
          </div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-5xl font-black leading-tight text-slate-950 sm:text-6xl lg:text-7xl">
            {t.landing.title}
          </motion.h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{t.landing.subtitle}</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500">{t.landing.mission}</p>
          <p className="mt-3 max-w-xl text-sm font-semibold text-success">{t.landing.support}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CTAButton onClick={onStart}>
              Start New Analysis
              <ArrowRight size={18} className="ml-2" />
            </CTAButton>
            <CTAButton variant="ghost" onClick={onHistory}>
              View Progress History
            </CTAButton>
          </div>
        </AnimatedSection>

        <AnimatedSection direction="right" className="relative">
          <HeroVisual />
        </AnimatedSection>
      </section>

      <AnimatedSection>
        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map(([title, text], index) => {
            const Icon = benefitIcons[index];
            return (
              <motion.div key={title} whileHover={{ y: -4 }} className="glass rounded-3xl p-5 shadow-premium">
                <Icon className="text-electric" size={22} />
                <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </motion.div>
            );
          })}
        </div>
      </AnimatedSection>

      <AnimatedSection>
        <h2 className="text-2xl font-bold text-slate-900">{t.landing.how}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {t.landing.steps.map((step, index) => (
            <div key={step} className="glass rounded-3xl p-6">
              <span className="text-sm font-bold text-electric">0{index + 1}</span>
              <p className="mt-3 text-lg font-semibold text-slate-900">{step}</p>
            </div>
          ))}
        </div>
      </AnimatedSection>
    </div>
  );
}

function UploadPage({
  t,
  photos,
  form,
  canGenerate,
  showUploadError,
  uploadErrorMessage,
  imageCheckResult,
  isCheckingImage,
  checkingPhotoKey,
  isGeneratingReport,
  reportLoading,
  onPhotoUpload,
  onUploadError,
  onFormChange,
  onGenerate,
}: {
  t: T;
  photos: Photos;
  form: FormData;
  canGenerate: boolean;
  showUploadError: boolean;
  uploadErrorMessage: string;
  imageCheckResult: PhysiqueImageResult | null;
  isCheckingImage: boolean;
  checkingPhotoKey: PhotoKey | null;
  isGeneratingReport: boolean;
  reportLoading: { progress: number; remaining: number; stepIndex: number; total: number };
  onPhotoUpload: (photoKey: PhotoKey, file: File) => void;
  onUploadError: (message: string) => void;
  onFormChange: (form: FormData) => void;
  onGenerate: () => void;
}) {
  useEffect(() => {
    const handleWindowPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => ['image/jpeg', 'image/png', 'image/webp'].includes(item.type));
      if (!file) return;
      console.log('Upload button clicked');
      onPhotoUpload('front', file);
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, [onPhotoUpload]);

  return (
    <div className="space-y-8 pb-10">
      <AnimatedSection>
        <h1 className="text-4xl font-black text-slate-900">{t.upload.title}</h1>
        <p className="mt-3 max-w-2xl text-slate-600">{t.upload.subtitle}</p>
      </AnimatedSection>
      <AnimatedSection className="grid gap-4 lg:grid-cols-3">
        <UploadZone label={t.upload.front} uploadLabel={t.upload.upload} galleryLabel={t.upload.gallery} cameraLabel={t.upload.camera} changeLabel={t.upload.change} pasteHint={t.upload.pasteHint} value={photos.front} onChange={(file) => onPhotoUpload('front', file)} onError={onUploadError} fileTypeError={t.upload.fileTypeError} fileSizeError={t.upload.fileSizeError} goodTitle={t.upload.goodTitle} badTitle={t.upload.badTitle} goodItems={t.upload.frontGood} badItems={t.upload.notUseful} acceptedText={t.upload.validationWarning} isChecking={checkingPhotoKey === 'front'} />
        <UploadZone label={t.upload.side} uploadLabel={t.upload.upload} galleryLabel={t.upload.gallery} cameraLabel={t.upload.camera} changeLabel={t.upload.change} pasteHint={t.upload.pasteHint} value={photos.side} onChange={(file) => onPhotoUpload('side', file)} onError={onUploadError} fileTypeError={t.upload.fileTypeError} fileSizeError={t.upload.fileSizeError} goodTitle={t.upload.goodTitle} badTitle={t.upload.badTitle} goodItems={t.upload.sideGood} badItems={t.upload.notUseful} acceptedText={t.upload.validationWarning} isChecking={checkingPhotoKey === 'side'} />
        <UploadZone label={t.upload.back} uploadLabel={t.upload.upload} galleryLabel={t.upload.gallery} cameraLabel={t.upload.camera} changeLabel={t.upload.change} pasteHint={t.upload.pasteHint} value={photos.back} onChange={(file) => onPhotoUpload('back', file)} onError={onUploadError} fileTypeError={t.upload.fileTypeError} fileSizeError={t.upload.fileSizeError} goodTitle={t.upload.goodTitle} badTitle={t.upload.badTitle} goodItems={t.upload.backGood} badItems={t.upload.notUseful} acceptedText={t.upload.validationWarning} isChecking={checkingPhotoKey === 'back'} />
      </AnimatedSection>
      <AnimatedSection direction="right">
        <PhysiqueForm t={t} value={form} onChange={onFormChange} />
        <div className="mt-5 rounded-3xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          We check photo quality first so your report is more accurate.
        </div>
        {photos.front && (!photos.side || !photos.back) && (
          <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-700">
            {t.upload.accuracyNote}
          </div>
        )}
        {showUploadError && (
          <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
            {t.upload.validationError}
          </div>
        )}
        {uploadErrorMessage && (
          <div className="mt-4 rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-600">
            {uploadErrorMessage}
          </div>
        )}
        {isCheckingImage && (
          <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 shadow-premium">
            {t.upload.checkingPhoto}
          </div>
        )}
        {imageCheckResult?.isPhysiquePhoto && !isCheckingImage && (
          <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
            {t.upload.photoConfirmed}
          </div>
        )}
        {imageCheckResult && !isCheckingImage && <AnalysisResultCard t={t} result={imageCheckResult} />}
        {isGeneratingReport && <ReportLoadingCard t={t} progress={reportLoading.progress} remaining={reportLoading.remaining} stepIndex={reportLoading.stepIndex} />}
        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <CTAButton onClick={onGenerate} disabled={!canGenerate}>
            {isGeneratingReport ? t.upload.generating : t.upload.generate}
          </CTAButton>
          {uploadErrorMessage && !isGeneratingReport && (
            <button onClick={onGenerate} className="rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 shadow-sm transition hover:-translate-y-0.5">
              {t.upload.retry}
            </button>
          )}
          {!canGenerate && <p className="text-sm text-slate-500">{t.upload.required}</p>}
        </div>
      </AnimatedSection>
    </div>
  );
}

function ReportLoadingCard({ t, progress, remaining, stepIndex }: { t: T; progress: number; remaining: number; stepIndex: number }) {
  const steps = t.upload.loadingSteps;
  const step = steps[stepIndex] ?? steps[steps.length - 1];
  const timeText = remaining > 0 ? t.upload.remaining.replace('{seconds}', String(remaining)) : t.upload.almostDone;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 rounded-[1.75rem] border border-blue-100 bg-white p-5 shadow-premium">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-black text-slate-900">{t.upload.generating}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">{timeText}</p>
        </div>
        <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-black text-blue-700">{progress}%</div>
      </div>
      <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
        <motion.div className="h-full rounded-full bg-blue-600" animate={{ width: `${progress}%` }} transition={{ duration: 0.6, ease: 'easeOut' }} />
      </div>
      <p className="mt-4 text-sm font-bold text-slate-700">
        {t.upload.stepLabel.replace('{current}', String(Math.min(stepIndex + 1, steps.length))).replace('{total}', String(steps.length)).replace('{step}', step)}
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-5">
        {steps.map((item, index) => (
          <div key={item} className={`rounded-2xl px-3 py-2 text-xs font-bold ${index <= stepIndex ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400'}`}>
            {item}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function AnalysisResultCard({ t, result }: { t: T; result: PhysiqueImageResult }) {
  const isValid = result.isPhysiquePhoto && result.canGenerateReport;
  const weakItems = result.weakPoints.length ? result.weakPoints : [result.message || t.upload.invalidBody];
  const strongItems = result.strongPoints.length ? result.strongPoints : [result.praise || t.upload.fallbackPraise];
  const command = result.trainingCommand || (isValid ? t.mock.priorities[0] : t.upload.fallbackCommand);
  const nextPhoto = result.nextPhotoSuggestion || t.upload.fallbackCommand;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mt-5 overflow-hidden rounded-[1.75rem] border p-5 shadow-premium ${
        isValid ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-3 ${isValid ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
          {isValid ? <CheckCircle2 size={22} /> : <AlertTriangle size={22} />}
        </div>
        <div>
          <p className="text-lg font-black text-slate-900">{result.praise || t.upload.fallbackPraise}</p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {isValid ? result.physiqueSummary || result.message : result.message || t.upload.invalidBody}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <MiniInsight title={t.upload.resultStrong} items={strongItems} tone="good" />
        <MiniInsight title={t.upload.resultWeak} items={weakItems} tone="warn" />
        <MiniInsight title={t.upload.resultCommand} items={[command]} tone="blue" />
        <MiniInsight title={t.upload.resultNextPhoto} items={[nextPhoto]} tone="blue" />
      </div>
    </motion.div>
  );
}

function MiniInsight({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' | 'blue' }) {
  const color = tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-gold' : 'text-electric';

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className={`mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] ${color}`}>
        <Zap size={14} />
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <p key={item} className="text-sm leading-6 text-slate-600">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function ReportPage({ t, report, onNew }: { t: T; report: Report; onNew: () => void }) {
  const localized = localizeReport(report, t);
  const scoreLabels = [
    ['symmetry', t.report.symmetry],
    ['muscularity', t.report.muscularity],
    ['conditioning', t.report.conditioning],
    ['taper', t.report.taper],
    ['posing', t.report.posing],
    ['stage', t.report.stage],
  ] as const;

  return (
    <div className="space-y-8 pb-10">
      <AnimatedSection className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900">{t.report.title}</h1>
          <p className="mt-3 text-slate-500">{t.report.subtitle}</p>
        </div>
        <CTAButton onClick={onNew}>{t.report.newCheckin}</CTAButton>
      </AnimatedSection>

      <AnimatedSection>
        <ShareActions report={report} />
      </AnimatedSection>

      <AnimatedSection className="grid gap-4 lg:grid-cols-4">
        <ScoreCard label={t.report.overall} score={report.scores.overall} featured />
        {scoreLabels.slice(0, 3).map(([key, label]) => (
          <ScoreCard key={key} label={label} score={report.scores[key]} />
        ))}
      </AnimatedSection>
      <AnimatedSection className="grid gap-4 lg:grid-cols-3" direction="left">
        {scoreLabels.slice(3).map(([key, label]) => (
          <ScoreCard key={key} label={label} score={report.scores[key]} />
        ))}
      </AnimatedSection>

      <div className="grid gap-5 lg:grid-cols-3">
        <AnimatedSection>
          <ReportSection title={t.report.strong}>
            <PillList items={localized.strongParts} tone="gold" />
          </ReportSection>
        </AnimatedSection>
        <AnimatedSection delay={0.05}>
          <ReportSection title={t.report.weak}>
            <PillList items={localized.weakParts} tone="ember" />
          </ReportSection>
        </AnimatedSection>
        <AnimatedSection delay={0.1}>
          <ReportSection title={t.report.weeks}>
            <p className="text-5xl font-black text-gold">{report.weeksToGoal}</p>
            <p className="mt-2 text-slate-500">{t.report.weeksUnit}</p>
          </ReportSection>
        </AnimatedSection>
      </div>

      {(report.photos.front || report.photos.side || report.photos.back) && (
        <div className="grid gap-5 lg:grid-cols-3">
          {report.photos.front && (
            <AnimatedSection>
              <AnnotatedPhotoFeedback title="Annotated Front Photo" image={report.photos.front} annotations={report.frontReport?.annotations} />
            </AnimatedSection>
          )}
          {report.photos.side && (
            <AnimatedSection delay={0.05}>
              <AnnotatedPhotoFeedback title="Annotated Side Photo" image={report.photos.side} annotations={report.sideReport?.annotations} />
            </AnimatedSection>
          )}
          {report.photos.back && (
            <AnimatedSection delay={0.1}>
              <AnnotatedPhotoFeedback title="Annotated Back Photo" image={report.photos.back} annotations={report.backReport?.annotations} />
            </AnimatedSection>
          )}
        </div>
      )}

      {(report.frontReport || report.sideReport || report.backReport) && (
        <div className="grid gap-5 lg:grid-cols-3">
          <AnimatedSection>
            <PhotoReportCard title="Front Photo Report" report={report.frontReport} />
          </AnimatedSection>
          <AnimatedSection delay={0.05}>
            <PhotoReportCard title="Side Photo Report" report={report.sideReport} />
          </AnimatedSection>
          <AnimatedSection delay={0.1}>
            <PhotoReportCard title="Back Photo Report" report={report.backReport} />
          </AnimatedSection>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AnimatedSection direction="left">
          <ReportSection title={t.report.priorities}>
            <NumberList items={localized.priorities} />
          </ReportSection>
        </AnimatedSection>
        <AnimatedSection direction="right">
          <ReportSection title={t.report.feedback}>
            <p className="leading-7 text-slate-600">{localized.feedback}</p>
          </ReportSection>
        </AnimatedSection>
      </div>

      {report.trainingRecommendation?.length ? (
        <AnimatedSection>
          <ReportSection title="Training Focus">
            <div className="grid gap-4 lg:grid-cols-3">
              {report.trainingRecommendation.map((focus) => (
                <div key={focus.focus} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-black text-electric">{focus.focus}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{focus.reason}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {focus.exercises.map((exercise) => (
                      <span key={exercise} className="rounded-full bg-electric/10 px-3 py-1 text-xs font-bold text-electric">
                        {exercise}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">{focus.weeklyTarget}</p>
                  <p className="mt-1 text-xs text-slate-500">{focus.sets} · {focus.reps}</p>
                </div>
              ))}
            </div>
          </ReportSection>
        </AnimatedSection>
      ) : null}

      {report.prediction && (
        <AnimatedSection>
          <ReportSection title="Progress Prediction">
            <div className="grid gap-3 md:grid-cols-3">
              <PredictionCard title="4 weeks" text={report.prediction.fourWeeks} />
              <PredictionCard title="8 weeks" text={report.prediction.eightWeeks} />
              <PredictionCard title="12 weeks" text={report.prediction.twelveWeeks} />
            </div>
          </ReportSection>
        </AnimatedSection>
      )}

      {report.nutritionAdvice && (
        <AnimatedSection>
          <ReportSection title="Food Suggestions">
            <div className="grid gap-4 lg:grid-cols-3">
              <PredictionCard title="Calories" text={report.nutritionAdvice.calories || `${report.calories} kcal`} />
              <PredictionCard title="Macros" text={report.nutritionAdvice.macros || `${report.macros.protein}g protein, ${report.macros.carbs}g carbs, ${report.macros.fat}g fat`} />
              <PredictionCard title="Food Direction" text={[...report.nutritionAdvice.foodSuggestions, ...report.nutritionAdvice.notes].slice(0, 4).join(' · ') || localized.meals.slice(0, 3).join(' · ')} />
            </div>
          </ReportSection>
        </AnimatedSection>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <AnimatedSection direction="left">
          <TrainingPlanCard t={t} report={localized} />
        </AnimatedSection>
        <AnimatedSection direction="right">
          <NutritionCard t={t} report={localized} />
        </AnimatedSection>
      </div>

      <AnimatedSection>
        <ReportSection title={t.report.checkin}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {localized.checkins.map((item) => (
              <div key={item} className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </ReportSection>
      </AnimatedSection>

      <AnimatedSection>
        <ShareActions report={report} />
      </AnimatedSection>
    </div>
  );
}

function DashboardPage({ t, reports, onOpen, onNew }: { t: T; reports: Report[]; onOpen: (report: Report) => void; onNew: () => void }) {
  const graphData = reports
    .slice()
    .reverse()
    .map((report) => ({
      date: new Intl.DateTimeFormat(t.common.locale, { month: 'short', day: 'numeric' }).format(new Date(report.createdAt)),
      physique: report.aiOverall?.physiqueScore ?? report.scores.overall,
      muscle: report.aiOverall?.muscleMassScore ?? report.scores.muscularity,
      symmetry: report.aiOverall?.symmetryScore ?? report.scores.symmetry,
      conditioning: report.aiOverall?.conditioningScore ?? report.scores.conditioning,
      weight: Number(report.form.weight) || 0,
    }));

  return (
    <div className="space-y-8 pb-10">
      <AnimatedSection className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900">{t.dashboard.title}</h1>
          <p className="mt-3 text-slate-500">{t.dashboard.subtitle}</p>
        </div>
        <CTAButton onClick={onNew}>{t.dashboard.new}</CTAButton>
      </AnimatedSection>

      {reports.length === 0 ? (
        <AnimatedSection>
          <div className="glass rounded-3xl p-10 text-center text-slate-500">Upload your first physique check to start tracking progress.</div>
        </AnimatedSection>
      ) : (
        <>
          <AnimatedSection>
            <ReportSection title="Progress History">
              <div className="h-72">
                <Suspense fallback={<div className="flex h-full items-center justify-center text-sm font-semibold text-slate-500">Loading chart...</div>}>
                  <ProgressChart data={graphData} />
                </Suspense>
              </div>
            </ReportSection>
          </AnimatedSection>
          <AnimatedSection className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => (
              <DashboardReportCard key={report.id} t={t} report={localizeReport(report, t)} onOpen={() => onOpen(report)} />
            ))}
          </AnimatedSection>
        </>
      )}
    </div>
  );
}

function PhotoReportCard({ title, report }: { title: string; report?: Report['frontReport'] }) {
  if (!report) {
    return (
      <ReportSection title={title}>
        <p className="text-sm text-slate-500">Upload this angle for a more complete check.</p>
      </ReportSection>
    );
  }

  return (
    <ReportSection title={title}>
      <ReportList title="Good" items={report.good} tone="good" />
      <ReportList title="Needs Work" items={report.needsImprovement} tone="warn" />
      <ReportList title="Improve Next" items={report.improveMore} tone="blue" />
      <div className="mt-4 rounded-2xl bg-electric/10 p-4 text-sm font-semibold text-electric">{report.coachCommand}</div>
    </ReportSection>
  );
}

function ReportList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'warn' | 'blue' }) {
  const color = tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-gold' : 'text-electric';
  return (
    <div className="mb-4">
      <p className={`mb-2 text-xs font-black uppercase tracking-[0.16em] ${color}`}>{title}</p>
      <div className="grid gap-2">
        {(items.length ? items : ['No clear data from this angle.']).map((item) => (
          <p key={item} className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function PredictionCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-black text-electric">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function localizeReport(report: Report, t: T): Report {
  return {
    ...report,
    strongParts: report.strongParts.length ? report.strongParts : t.mock.strong.slice(0, 3),
    weakParts: report.weakParts.length ? report.weakParts : t.mock.weak.slice(0, 3),
    priorities: report.priorities.length ? report.priorities : [...t.mock.priorities],
    feedback: report.feedback || t.mock.feedback,
    training: report.training.length ? report.training : [...t.mock.training],
    cardio: report.cardio || t.mock.cardio,
    meals: report.meals.length ? report.meals : [...t.mock.meals],
    convenienceFoods: report.convenienceFoods.length ? report.convenienceFoods : [...t.mock.convenience],
    checkins: report.checkins.length ? report.checkins : [...t.mock.checkins],
  };
}

function PillList({ items, tone }: { items: string[]; tone: 'gold' | 'ember' }) {
  const color = tone === 'gold' ? 'bg-gold/15 text-gold ring-gold/20' : 'bg-ember/15 text-[#f0a1a1] ring-ember/25';
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-2 text-xs font-bold ring-1 ${color}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function NumberList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={item} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
          <span className="text-sm font-black text-gold">0{index + 1}</span>
          <span className="text-sm text-slate-700">{item}</span>
        </div>
      ))}
    </div>
  );
}

function readReports(): Report[] {
  try {
    const raw = localStorage.getItem(reportKey);
    return raw ? (JSON.parse(raw) as Report[]) : [];
  } catch {
    return [];
  }
}

function writeReports(reports: Report[]) {
  try {
    localStorage.setItem(reportKey, JSON.stringify(reports.slice(0, 20)));
  } catch (error) {
    console.error('Report history save failed:', error);
    try {
      const compactReports = reports.slice(0, 10).map((report) => ({
        ...report,
        photos: {
          front: report.photos.front ? report.photos.front.slice(0, 180_000) : '',
          side: '',
          back: '',
        },
      }));
      localStorage.setItem(reportKey, JSON.stringify(compactReports));
    } catch (compactError) {
      console.error('Compact report history save failed:', compactError);
    }
  }
}
