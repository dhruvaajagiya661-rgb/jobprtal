import React, { useRef, useState, useCallback, useEffect } from 'react';

interface PhotoCropProps {
  file: File;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
  size?: number;
}

const PhotoCrop: React.FC<PhotoCropProps> = ({ file, onCrop, onCancel, size = 200 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  }, [dragging]);

  const handleMouseUp = () => setDragging(false);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.onload = () => {
      const imgSize = Math.min(img.width, img.height) * scale;
      const srcX = (img.width - imgSize) / 2 + offset.x / scale;
      const srcY = (img.height - imgSize) / 2 + offset.y / scale;

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, srcX, srcY, imgSize, imgSize, 0, 0, size, size);

      canvas.toBlob(blob => {
        if (blob) onCrop(blob);
      }, 'image/jpeg', 0.9);
    };
    img.src = preview;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-in" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-surface-900 mb-4">Crop your photo</h3>

        {/* Preview area */}
        <div
          className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-surface-200 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {preview && (
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover select-none"
              style={{
                transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
              }}
              draggable={false}
            />
          )}
          <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-full pointer-events-none" />
        </div>

        {/* Scale slider */}
        <div className="mt-4 px-2">
          <label className="text-xs font-semibold text-surface-500 mb-1 block">Zoom</label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.01"
            value={scale}
            onChange={e => setScale(Number(e.target.value))}
            className="w-full accent-primary-600"
          />
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleCrop} className="btn-primary flex-1">Apply</button>
        </div>
      </div>
    </div>
  );
};

export default PhotoCrop;
