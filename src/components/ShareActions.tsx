import { Camera, Copy, Download, Facebook, Share2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import type { Report } from '../types';
import { CTAButton } from './CTAButton';
import { ShareResultCard } from './ShareResultCard';

type Props = {
  report: Report;
};

export function ShareActions({ report }: Props) {
  const [includePhoto, setIncludePhoto] = useState(false);
  const [message, setMessage] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const shareUrl = window.location.href;
  const topPriority = report.priorities[0] || report.mainImprovementCommand || 'training focus';
  const shareText = `I checked my physique with AI Physique Judge. Score: ${report.scores.overall}/100. Main focus: ${topPriority}.`;

  const copy = async (text: string, nextMessage: string) => {
    await navigator.clipboard.writeText(text);
    setMessage(nextMessage);
  };

  const nativeShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'My AI Physique Judge Result',
        text: shareText,
        url: shareUrl,
      });
      return;
    }
    await copy(`${shareText} ${shareUrl}`, 'Summary copied.');
  };

  const downloadImage = async () => {
    if (!cardRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = 'ai-physique-judge-result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    setMessage('Result image downloaded.');
  };

  const summary = [
    'AI Physique Judge Result',
    `Score: ${report.scores.overall}/100`,
    `Strong points: ${report.strongParts.slice(0, 3).join(', ')}`,
    `Improve next: ${report.weakParts.slice(0, 3).join(', ')}`,
    `Coach command: ${report.mainImprovementCommand || report.priorities[0] || ''}`,
  ].join('\n');

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-premium">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-black text-slate-900">Share Result</h3>
          <p className="mt-1 text-sm text-slate-500">Share score and focus. Photos stay private unless you include them.</p>
        </div>
        <CTAButton onClick={nativeShare}>
          <Share2 size={17} className="mr-2" />
          Share Result
        </CTAButton>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ShareLink href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`} label="Facebook" icon={<Facebook size={16} />} />
        <ShareLink href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`} label="X" />
        <ShareLink href={`https://www.threads.net/intent/post?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`} label="Threads" />
        <button onClick={() => copy(shareUrl, 'Link copied.')} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
          <Copy size={15} className="mr-2 inline" />
          Copy Link
        </button>
        <button onClick={() => copy(summary, 'Summary copied.')} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
          <Copy size={15} className="mr-2 inline" />
          Copy Summary
        </button>
        <button onClick={downloadImage} className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
          <Download size={15} className="mr-2 inline" />
          Download Image
        </button>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={includePhoto} onChange={(event) => setIncludePhoto(event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600" />
          <Camera size={17} className="text-blue-600" />
          Include my photo
        </label>
        {includePhoto && <p className="mt-2 text-sm font-semibold text-amber-600">This may include your body photo. Only share if you are comfortable.</p>}
        <p className="mt-2 text-sm text-slate-500">Instagram direct sharing is not supported. Download your result image, then post to Instagram.</p>
      </div>

      {message && <p className="mt-3 text-sm font-bold text-emerald-600">{message}</p>}

      <div className="pointer-events-none fixed -left-[9999px] top-0">
        <ShareResultCard ref={cardRef} report={report} includePhoto={includePhoto} />
      </div>
    </div>
  );
}

function ShareLink({ href, label, icon }: { href: string; label: string; icon?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm">
      {icon && <span className="mr-2 inline-block align-[-3px]">{icon}</span>}
      {label}
    </a>
  );
}
