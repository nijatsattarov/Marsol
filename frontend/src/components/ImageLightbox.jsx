import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Lightweight image lightbox. Accepts array of URLs (or legacy multiline string).
 * Closes on Escape, arrows navigate, backdrop click closes.
 */
export default function ImageLightbox({ open, images, initialIndex = 0, onClose }) {
  const [idx, setIdx] = useState(initialIndex);

  // Normalize input
  let urls = [];
  if (Array.isArray(images)) urls = images;
  else if (typeof images === 'string') urls = images.split('\n').map(s => s.trim()).filter(Boolean);

  const next = useCallback(() => setIdx(i => (i + 1) % urls.length), [urls.length]);
  const prev = useCallback(() => setIdx(i => (i - 1 + urls.length) % urls.length), [urls.length]);

  useEffect(() => { setIdx(initialIndex); }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, next, prev]);

  if (!open || urls.length === 0) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center"
      onClick={onClose}
      data-testid="image-lightbox"
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white/80 hover:text-white"
        data-testid="lightbox-close"
      >
        <X className="w-8 h-8" />
      </button>

      {urls.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            className="absolute left-4 text-white/70 hover:text-white"
            data-testid="lightbox-prev"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="absolute right-4 text-white/70 hover:text-white"
            data-testid="lightbox-next"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}

      <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <img
          src={urls[idx]}
          alt={`${idx + 1} / ${urls.length}`}
          className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
        />
        <div className="mt-3 text-white/70 text-sm font-medium">
          {idx + 1} / {urls.length}
        </div>
      </div>
    </div>
  );
}
