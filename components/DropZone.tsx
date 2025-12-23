import React, { useCallback } from 'react';
import { Upload, Grid3X3 } from 'lucide-react';

interface DropZoneProps {
  onImageSelected: (file: File) => void;
}

export const DropZone: React.FC<DropZoneProps> = ({ onImageSelected }) => {
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        const isImage = file.type.startsWith('image/');
        const isMp4 = file.type === 'video/mp4';
        if (isImage || isMp4) onImageSelected(file);
      }
    },
    [onImageSelected]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        onImageSelected(e.target.files[0]);
      }
    },
    [onImageSelected]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="w-full aspect-[16/9] bg-brand-surface/40 border-2 border-dashed border-brand-primary/40 rounded-[20px] flex flex-col items-center justify-center relative overflow-hidden group hover:border-brand-primary hover:bg-brand-primary/10 transition-all duration-400 cursor-pointer shadow-lg"
    >
      <div className="relative z-10 flex flex-col items-center p-10 text-center">
        <div className="mb-8 p-6 rounded-[24px] bg-brand-primary/10 border border-brand-primary/20 group-hover:scale-110 group-hover:bg-brand-primary group-hover:shadow-glow-md transition-all duration-500">
            <Grid3X3 className="w-14 h-14 text-brand-primary group-hover:text-white transition-colors" />
        </div>
        
        <h3 className="text-3xl font-extrabold text-white mb-4 uppercase tracking-[3px]">
          Sprite Splitter
        </h3>
        <p className="text-brand-muted text-base mb-10 max-w-md font-medium leading-relaxed">
          Drop your sprite sheet here or click to browse.<br/>Supports PNG, JPG, GIF & MP4.
        </p>

        <label className="relative group/btn cursor-pointer">
            <input
              type="file"
              accept="image/png, image/jpeg, image/gif, video/mp4"
              onChange={handleFileChange}
              className="hidden"
            />
            <span className="btn-primary px-12 py-5 text-white font-extrabold text-sm uppercase tracking-[2px] rounded-xl flex items-center gap-3">
                 <Upload className="w-5 h-5" />
                 Select File
            </span>
        </label>
      </div>

      <div className="absolute bottom-10 flex gap-4 text-[11px] font-bold uppercase tracking-[4px] text-brand-muted opacity-40 group-hover:opacity-100 transition-opacity">
        <span>Drag & Drop Ready</span>
      </div>
    </div>
  );
};