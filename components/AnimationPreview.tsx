import React, { useEffect, useState, useRef } from 'react';
import { FrameData } from '../types';
import { Play, Pause } from 'lucide-react';

interface AnimationPreviewProps {
  frames: FrameData[];
}

export const AnimationPreview: React.FC<AnimationPreviewProps> = ({ frames }) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fps, setFps] = useState(24);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (frames.length === 0) return;

    if (isPlaying) {
      intervalRef.current = window.setInterval(() => {
        setCurrentFrameIndex((prev) => (prev + 1) % frames.length);
      }, 1000 / fps);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, fps, frames.length]);

  useEffect(() => {
    setCurrentFrameIndex(0);
  }, [frames.length]);

  if (frames.length === 0) {
    return (
      <div className="card-service flex flex-col items-center justify-center h-[400px] rounded-[20px] text-brand-muted/50">
        <Play className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">No animation data</p>
      </div>
    );
  }

  const currentFrame = frames[currentFrameIndex];

  return (
    <div className="bg-brand-surface rounded-[20px] border border-brand-primary/20 p-8 shadow-xl flex flex-col h-full card-service">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-extrabold text-brand-muted uppercase tracking-[2.5px]">Realtime Preview</h3>
        <div className="text-[11px] text-brand-primary font-extrabold tracking-widest border border-brand-primary/30 px-3 py-1 rounded-full bg-brand-primary/10">
           {currentFrameIndex + 1} / {frames.length}
        </div>
      </div>

      <div className="flex-1 min-h-[250px] flex items-center justify-center bg-brand-bg rounded-2xl border border-brand-primary/10 checkerboard overflow-hidden relative shadow-inner">
        {currentFrame && (
          <img
            src={currentFrame.url}
            alt={`Frame ${currentFrame.index}`}
            className="rendering-pixelated max-w-[90%] max-h-[90%] object-contain"
          />
        )}
      </div>

      <div className="mt-8 space-y-6">
        <div className="flex items-center justify-center">
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="btn-primary w-16 h-16 flex items-center justify-center text-white rounded-full shadow-glow-md"
            >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
        </div>

        <div className="space-y-3">
            <div className="flex justify-between text-[11px] font-extrabold text-brand-muted uppercase tracking-[2px]">
                <span>Animation Speed</span>
                <span className="text-brand-primary">{fps} FPS</span>
            </div>
            <input
                type="range"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full cursor-pointer"
            />
        </div>
      </div>
    </div>
  );
};