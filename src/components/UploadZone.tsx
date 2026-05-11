import { motion } from 'framer-motion';
import { Camera, Check, ChevronDown, Images, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { PoseExample3D } from './PoseExample3D';

type Props = {
  label: string;
  uploadLabel: string;
  galleryLabel: string;
  cameraLabel: string;
  changeLabel: string;
  pasteHint: string;
  value: string;
  onChange: (file: File) => void;
  onError: (message: string) => void;
  fileTypeError: string;
  fileSizeError: string;
  goodTitle: string;
  badTitle: string;
  goodItems: string[];
  badItems: string[];
  acceptedText: string;
  isChecking?: boolean;
};

const maxImageBytes = 8 * 1024 * 1024;
const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const allowedImageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];

export function UploadZone({
  label,
  uploadLabel,
  galleryLabel,
  cameraLabel,
  changeLabel,
  pasteHint,
  value,
  onChange,
  onError,
  fileTypeError,
  fileSizeError,
  goodTitle,
  badTitle,
  goodItems,
  badItems,
  acceptedText,
  isChecking = false,
}: Props) {
  const inputId = `upload-${label.replace(/\s+/g, '-').toLowerCase()}`;
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [showTips, setShowTips] = useState(false);

  const isAllowedFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    return allowedImageTypes.includes(file.type) || allowedImageExtensions.some((extension) => fileName.endsWith(extension));
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    console.log('File selected:', file);
    if (!isAllowedFile(file)) {
      onError(fileTypeError);
      return;
    }
    if (file.size > maxImageBytes) {
      onError(fileSizeError);
      return;
    }
    onChange(file);
  };

  const clickGallery = () => {
    console.log('Upload button clicked');
    galleryInputRef.current?.click();
  };

  const clickCamera = () => {
    console.log('Upload button clicked');
    cameraInputRef.current?.click();
  };

  return (
    <div
      className="group block cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={clickGallery}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={() => {
        setIsDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        console.log('Upload button clicked');
        handleFile(event.dataTransfer.files?.[0]);
      }}
      onPaste={(event) => {
        console.log('Upload button clicked');
        handleFile(Array.from(event.clipboardData.files).find(isAllowedFile));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          clickGallery();
        }
      }}
    >
      <input
        ref={galleryInputRef}
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        id={`${inputId}-camera`}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        className={`glass premium-ring relative min-h-72 overflow-hidden rounded-[1.75rem] shadow-premium transition duration-300 ${
          isDragActive ? 'border-electric/70' : 'group-hover:border-electric/35'
        }`}
      >
        {value ? (
          <motion.img
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            src={value}
            alt={label}
            className="h-80 w-full object-cover"
          />
        ) : (
          <div className="flex min-h-80 flex-col items-center justify-center gap-5 p-6 text-center">
            <PoseGuide label={label} />
            <div>
              <p className="text-lg font-bold text-slate-900">{label}</p>
              <p className="mt-2 text-sm text-slate-600">Clear body photo. Good light. Full upper body.</p>
              <p className="mt-2 text-xs font-semibold text-slate-500">{acceptedText}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {['Good light', 'Upper body', 'Clear pose'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1 rounded-full border border-success/20 bg-success/10 px-3 py-1 text-xs font-bold text-success">
                  <Check size={12} />
                  {item}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-electric/35 hover:text-slate-900"
              onClick={(event) => {
                event.stopPropagation();
                setShowTips((current) => !current);
              }}
            >
              {showTips ? 'Hide photo tips' : 'View photo tips'}
              <ChevronDown size={14} className={`transition ${showTips ? 'rotate-180' : ''}`} />
            </button>
            {showTips && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid w-full gap-3 text-left sm:grid-cols-2">
                <ExampleList title={goodTitle} items={goodItems} tone="good" />
                <ExampleList title={badTitle} items={badItems} tone="bad" />
              </motion.div>
            )}
          </div>
        )}
        {isChecking && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-full border-2 border-electric/25 border-t-electric animate-spin" />
          </div>
        )}
        <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{label}</span>
            <span className="text-sm text-electric">{value ? changeLabel : uploadLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm transition hover:scale-[1.02] hover:border-electric/50 hover:text-electric"
              onClick={(event) => {
                event.stopPropagation();
                clickGallery();
              }}
            >
              <Images size={15} />
              {galleryLabel}
            </button>
            <button
              type="button"
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-800 shadow-sm transition hover:scale-[1.02] hover:border-electric/50 hover:text-electric"
              onClick={(event) => {
                event.stopPropagation();
                clickCamera();
              }}
            >
              <Camera size={15} />
              {cameraLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function PoseGuide({ label }: { label: string }) {
  const lower = label.toLowerCase();
  const isSide = lower.includes('side') || lower.includes('横') || lower.includes('侧');
  const isBack = lower.includes('back') || lower.includes('背');

  return (
    <div className="relative">
      <PoseExample3D pose={isSide ? 'side' : isBack ? 'back' : 'front'} compact />
      <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm">
        {isSide ? 'Side' : isBack ? 'Back' : 'Front'}
      </span>
    </div>
  );
}

function ExampleList({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'bad' }) {
  const Icon = tone === 'good' ? Check : X;
  const color = tone === 'good' ? 'text-success' : 'text-slate-400';

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">{title}</p>
      <div className="grid gap-1.5">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-xs text-slate-500">
            <Icon className={color} size={13} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
