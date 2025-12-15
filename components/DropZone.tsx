import React, { useCallback } from 'react';
import { Upload, FileImage, MousePointer2, FileVideo } from 'lucide-react';

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
        // Explicitly exclude generic video/ types that might be MOV to prevent errors.
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
      className="w-full h-96 border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center bg-slate-900/50 hover:bg-slate-800/50 hover:border-orange-500 transition-all cursor-pointer group animate-in fade-in zoom-in duration-500"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-xl group-hover:bg-orange-500/30 transition-all"></div>
        <div className="relative bg-slate-800 p-6 rounded-full border border-slate-700 group-hover:border-orange-500 group-hover:scale-110 transition-all duration-300">
          <Upload className="w-10 h-10 text-orange-400" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold text-slate-200 mb-2">
        Upload Sprite Sheet, GIF, or Video
      </h3>
      <p className="text-slate-400 text-sm mb-6 max-w-xs text-center">
        Drag and drop PNG, JPG, GIF, or MP4 files here.
      </p>

      <label className="relative">
        <input
          type="file"
          accept="image/png, image/jpeg, image/gif, video/mp4"
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer">
          <FileImage className="w-4 h-4" />
          <span className="mx-1">/</span>
          <FileVideo className="w-4 h-4" />
          Select File
        </span>
      </label>
      
      <div className="mt-8 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><MousePointer2 className="w-3 h-3"/> Images & Video</span>
        <span className="flex items-center gap-1">Drag & Drop</span>
      </div>
    </div>
  );
};