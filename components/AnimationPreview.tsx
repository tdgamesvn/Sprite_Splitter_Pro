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
      <div className="flex flex-col items-center justify-center h-64 bg-[#111] rounded-2xl border border-[#222] text-gray-700">
        <p className="text-sm font-medium">No frames generated</p>
      </div>
    );
  }

  const currentFrame = frames[currentFrameIndex];

  return (
    <div className="bg-[#111] rounded-2xl border border-[#222] p-4 shadow-xl flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Animation</h3>
        <div className="text-[10px] text-[#ff6b00] font-mono border border-[#ff6b00]/30 px-2 py-0.5 rounded bg-[#ff6b00]/10">
           {currentFrameIndex + 1}/{frames.length}
        </div>
      </div>

      <div className="flex-1 min-h-[200px] flex items-center justify-center bg-[#050505] rounded-xl border border-[#1a1a1a] checkerboard overflow-hidden relative">
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
                className="p-3 bg-[#ff6b00] hover:bg-[#ff8a00] text-white rounded-full shadow-lg shadow-orange-500/20 transition-all active:scale-95"
            >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>
        </div>

        {/* FPS Slider */}
        <div className="space-y-2">
            <div className="flex justify-between text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <span>Speed</span>
                <span className="text-white">{fps} FPS</span>
            </div>
            <input
                type="range"
                min="1"
                max="60"
                value={fps}
                onChange={(e) => setFps(Number(e.target.value))}
                className="w-full h-1.5 bg-[#222] rounded-lg appearance-none cursor-pointer accent-[#ff6b00]"
            />
        </div>
      </div>
    </div>
  );
};