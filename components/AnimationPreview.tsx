import React, { useEffect, useState, useRef } from 'react';
import { FrameData } from '../types';
import { Play, Pause, FastForward, Rewind } from 'lucide-react';

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

  // Reset index if frames change drastically
  useEffect(() => {
    setCurrentFrameIndex(0);
  }, [frames.length]);

  if (frames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-900 rounded-xl border border-slate-700 text-slate-500">
        <p>No frames generated yet.</p>
      </div>
    );
  }

  const currentFrame = frames[currentFrameIndex];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Preview</h3>
        <div className="text-xs text-indigo-400 font-mono">
           Frame: {currentFrameIndex + 1} / {frames.length}
        </div>
      </div>

      <div className="flex-1 min-h-[200px] flex items-center justify-center bg-slate-950/50 rounded-lg border border-slate-700 checkerboard overflow-hidden relative">
        {currentFrame && (
          <img
            src={currentFrame.url}
            alt={`Frame ${currentFrame.index}`}
            className="rendering-pixelated max-w-full max-h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
      </div>

      <div className="mt-4 space-y-4">
        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
            >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
        </div>

        {/* FPS Slider */}
        <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
                <span>Speed</span>
                <span>{fps} FPS</span>
            </div>
            <input
                type="range"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
      </div>
    </div>
  );
};