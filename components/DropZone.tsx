import React, { useCallback } from 'react';
import { Upload, FileImage, MousePointer2, FileVideo, Grid3X3 } from 'lucide-react';

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
        
        // Check if file is image or MP4 video.
        const isImage = file.type.startsWith('image/');
        const isMp4 = file.type === 'video/mp4';

        if (isImage || isMp4) {
            onImageSelected(file);
        } else if (file.type.startsWith('video/')) {
            alert("Format not supported. Please use MP4 files only.");
        }
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
      className="card-hover-effect w-full aspect-[4/3] md:aspect-[16/9] lg:h-96 bg-[#111] border border-[#222] rounded-3xl flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer"
    >
      {/* Background Gradient Spot */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0a0a0a] opacity-80 pointer-events-none"></div>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
          
        {/* Icon Box */}
        <div className="mb-6 p-4 rounded-2xl bg-[#ff6b00]/10 border border-[#ff6b00]/20 group-hover:bg-[#ff6b00] group-hover:border-[#ff6b00] transition-all duration-300">
            <Grid3X3 className="w-10 h-10 text-[#ff6b00] group-hover:text-white transition-colors" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-2">
          Sprite Splitter
        </h3>
        <p className="text-gray-500 text-sm mb-8 max-w-xs text-center leading-relaxed">
          Split sprite sheets into individual frames. Supports PNG, JPG, GIF & MP4.
        </p>

        <label className="relative group/btn">
            <input
            type="file"
            accept="image/png, image/jpeg, image/gif, video/mp4"
            onChange={handleFileChange}
            className="hidden"
            />
            <span className="px-8 py-3 bg-white text-black font-bold text-sm rounded-lg hover:bg-[#e5e5e5] transition-all flex items-center gap-2">
                 <Upload className="w-4 h-4" />
                 Select File
            </span>
        </label>
      </div>

      <div className="absolute bottom-6 flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-700">
        <span className="flex items-center gap-1">Or Drag & Drop</span>
      </div>
    </div>
  );
};