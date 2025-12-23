import React, { useEffect, useRef, useState } from 'react';
import { GridSettings, UploadedImage, FrameData, ColorSettings, GradientStop } from '../types';
import { sliceImage, applyGradientMap } from '../utils/spriteLogic';
import { Grid3X3, Box, RefreshCw, Lock, Unlock, RotateCcw, Palette, Plus, Trash2 } from 'lucide-react';

interface SplitterWorkspaceProps {
  image: UploadedImage;
  onFramesGenerated: (frames: FrameData[]) => void;
}

export const SplitterWorkspace: React.FC<SplitterWorkspaceProps> = ({
  image,
  onFramesGenerated,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [settings, setSettings] = useState<GridSettings>({
    rows: 4,
    columns: 4,
    imageWidth: image.width,
    imageHeight: image.height,
  });

  const [colorSettings, setColorSettings] = useState<ColorSettings>({
    enabled: false,
    stops: [
        { id: '1', offset: 0, color: '#000000' },
        { id: '2', offset: 100, color: '#ffffff' }
    ]
  });

  const [frameDimensions, setFrameDimensions] = useState({ w: 0, h: 0 });
  const [isCalculating, setIsCalculating] = useState(false);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState(image.width / image.height);

  useEffect(() => {
      setSettings({
          rows: image.suggestedRows || 4,
          columns: image.suggestedColumns || 4,
          imageWidth: image.width,
          imageHeight: image.height,
      });
      setOriginalAspectRatio(image.width / image.height);
      setAspectRatioLocked(true);
  }, [image]);

  const handleDimensionChange = (field: 'imageWidth' | 'imageHeight', value: number) => {
      if (value < 1) return;
      let newSettings = { ...settings, [field]: value };
      if (aspectRatioLocked) {
          if (field === 'imageWidth') {
              newSettings.imageHeight = Math.round(value / originalAspectRatio);
          } else {
              newSettings.imageWidth = Math.round(value * originalAspectRatio);
          }
      }
      setSettings(newSettings);
  };

  const handleResetDimensions = () => {
      setSettings(prev => ({
          ...prev,
          imageWidth: image.width,
          imageHeight: image.height
      }));
  };

  const handleStopChange = (id: string, field: 'offset' | 'color', value: string | number) => {
      setColorSettings(prev => ({
          ...prev,
          stops: prev.stops.map(s => 
              s.id === id ? { ...s, [field]: value } : s
          ).sort((a, b) => a.offset - b.offset)
      }));
  };

  const handleAddStop = () => {
      const newStop: GradientStop = {
          id: Date.now().toString(),
          offset: 50,
          color: '#FF9500'
      };
      setColorSettings(prev => ({
          ...prev,
          stops: [...prev.stops, newStop].sort((a, b) => a.offset - b.offset)
      }));
  };

  const handleRemoveStop = (id: string) => {
      if (colorSettings.stops.length <= 2) return;
      setColorSettings(prev => ({
          ...prev,
          stops: prev.stops.filter(s => s.id !== id)
      }));
  };

  const getCssGradient = () => {
      const sorted = [...colorSettings.stops].sort((a, b) => a.offset - b.offset);
      const stopsStr = sorted.map(s => `${s.color} ${s.offset}%`).join(', ');
      return `linear-gradient(to right, ${stopsStr})`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.src = image.src;
    img.onload = () => {
        canvas.width = settings.imageWidth;
        canvas.height = settings.imageHeight;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, settings.imageWidth, settings.imageHeight);

        if (colorSettings.enabled) {
            const imageData = ctx.getImageData(0, 0, settings.imageWidth, settings.imageHeight);
            applyGradientMap(imageData, colorSettings);
            ctx.putImageData(imageData, 0, 0);
        }

        const cellW = settings.imageWidth / settings.columns;
        const cellH = settings.imageHeight / settings.rows;
        setFrameDimensions({ w: Math.floor(cellW), h: Math.floor(cellH) });

        const maxDim = Math.max(settings.imageWidth, settings.imageHeight);
        const dynamicLineWidth = Math.max(1, Math.round(maxDim / 800));
        ctx.beginPath();
        ctx.strokeStyle = '#FF9500'; 
        ctx.lineWidth = dynamicLineWidth;

        for (let c = 1; c < settings.columns; c++) {
            const x = Math.floor(c * cellW);
            ctx.moveTo(x, 0); ctx.lineTo(x, settings.imageHeight);
        }
        for (let r = 1; r < settings.rows; r++) {
            const y = Math.floor(r * cellH);
            ctx.moveTo(0, y); ctx.lineTo(settings.imageWidth, y);
        }
        ctx.stroke();
    };
  }, [image, settings, colorSettings]);

  const handleSplit = async () => {
    setIsCalculating(true);
    try {
        const frames = await sliceImage(image.src, settings, colorSettings);
        onFramesGenerated(frames);
    } catch (e) {
        console.error("Failed to slice", e);
    } finally {
        setIsCalculating(false);
    }
  };

  useEffect(() => {
      const timer = setTimeout(() => handleSplit(), 400);
      return () => clearTimeout(timer);
  }, [settings, image, colorSettings]);

  const inputClass = "w-full bg-brand-bg border border-brand-primary/20 rounded-xl px-4 py-3 text-white focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all font-bold text-sm tracking-wider";
  const labelClass = "text-[10px] font-extrabold text-brand-muted uppercase tracking-[2px] mb-2 block";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
      {/* Configuration Sidebar */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-brand-surface p-8 rounded-[24px] border border-brand-primary/20 shadow-xl space-y-10 max-h-[85vh] overflow-y-auto custom-scrollbar">
            
            {/* Grid Configuration */}
            <div>
                <div className="flex items-center gap-3 mb-8">
                    <Grid3X3 className="w-5 h-5 text-brand-primary" />
                    <h2 className="text-sm font-extrabold text-white uppercase tracking-[3px]">Layout Engine</h2>
                </div>
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className={labelClass}>Columns (X)</label>
                        <input
                            type="number" min="1" max="64" value={settings.columns}
                            onChange={(e) => setSettings({ ...settings, columns: Math.max(1, parseInt(e.target.value) || 1) })}
                            className={inputClass}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Rows (Y)</label>
                        <input
                            type="number" min="1" max="64" value={settings.rows}
                            onChange={(e) => setSettings({ ...settings, rows: Math.max(1, parseInt(e.target.value) || 1) })}
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>

            {/* Dimension Configuration */}
            <div className="border-t border-brand-primary/10 pt-8">
                 <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Box className="w-5 h-5 text-brand-primary" />
                        <h2 className="text-sm font-extrabold text-white uppercase tracking-[3px]">Total Scale</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                            className={`p-2 rounded-lg hover:bg-brand-primary/10 transition-colors ${aspectRatioLocked ? 'text-brand-primary' : 'text-brand-muted'}`}
                        >
                            {aspectRatioLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                        </button>
                        <button onClick={handleResetDimensions} className="p-2 rounded-lg hover:bg-brand-primary/10 text-brand-muted transition-colors">
                            <RotateCcw className="w-5 h-5" />
                        </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className={labelClass}>Width (PX)</label>
                        <input
                            type="number" min="1" value={settings.imageWidth}
                            onChange={(e) => handleDimensionChange('imageWidth', parseInt(e.target.value) || 0)}
                            className={inputClass}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className={labelClass}>Height (PX)</label>
                        <input
                            type="number" min="1" value={settings.imageHeight}
                            onChange={(e) => handleDimensionChange('imageHeight', parseInt(e.target.value) || 0)}
                            className={inputClass}
                        />
                    </div>
                </div>
            </div>

            {/* Color Grading Panel */}
            <div className="border-t border-brand-primary/10 pt-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Palette className="w-5 h-5 text-brand-primary" />
                        <h2 className="text-sm font-extrabold text-white uppercase tracking-[3px]">Gradient Map</h2>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer group">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={colorSettings.enabled}
                            onChange={(e) => setColorSettings({...colorSettings, enabled: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-brand-bg border border-brand-primary/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-brand-muted after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary peer-checked:after:bg-white"></div>
                    </label>
                </div>

                {colorSettings.enabled && (
                    <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                        {/* Gradient Bar Preview */}
                        <div className="h-10 w-full rounded-xl border border-brand-primary/30 shadow-inner overflow-hidden" style={{ background: getCssGradient() }}></div>

                        {/* Stops List */}
                        <div className="space-y-4">
                            {colorSettings.stops.map((stop) => (
                                <div key={stop.id} className="grid grid-cols-12 gap-3 items-end bg-brand-bg/50 p-3 rounded-xl border border-brand-primary/10">
                                    <div className="col-span-4">
                                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest mb-1.5 block">Color</label>
                                        <div className="relative h-[42px] rounded-lg overflow-hidden border border-brand-primary/20">
                                            <input 
                                                type="color" 
                                                value={stop.color}
                                                onChange={(e) => handleStopChange(stop.id, 'color', e.target.value)}
                                                className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer bg-transparent"
                                            />
                                        </div>
                                    </div>
                                    <div className="col-span-5">
                                        <label className="text-[9px] font-bold text-brand-muted uppercase tracking-widest mb-1.5 block">Pos (%)</label>
                                        <input 
                                            type="number" min="0" max="100" value={stop.offset}
                                            onChange={(e) => handleStopChange(stop.id, 'offset', parseInt(e.target.value) || 0)}
                                            className="w-full bg-brand-bg border border-brand-primary/10 rounded-lg h-[42px] px-3 text-white font-bold text-xs"
                                        />
                                    </div>
                                    <div className="col-span-3 flex justify-end">
                                        <button 
                                            onClick={() => handleRemoveStop(stop.id)}
                                            disabled={colorSettings.stops.length <= 2}
                                            className="h-[42px] w-full flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all disabled:opacity-20"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={handleAddStop}
                            className="btn-ghost w-full py-4 text-xs font-bold uppercase tracking-widest rounded-xl flex items-center justify-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Color Stop
                        </button>
                    </div>
                )}
            </div>

             {/* Dynamic Info Panel */}
            <div className="p-6 bg-brand-bg rounded-2xl border border-brand-primary/20 shadow-inner space-y-4">
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-brand-muted uppercase font-extrabold tracking-widest">Master File</span>
                    <span className="text-[11px] font-bold text-white tracking-widest">{image.width}×{image.height} PX</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-[10px] text-brand-primary uppercase font-extrabold tracking-widest">Sliced Frame</span>
                    <span className="text-[11px] font-bold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg border border-brand-primary/20 tracking-widest">
                        {frameDimensions.w}×{frameDimensions.h} PX
                    </span>
                </div>
            </div>
            
        </div>
      </div>

      {/* Interactive Visual Canvas */}
      <div className="lg:col-span-2 flex flex-col h-[600px] lg:h-auto bg-brand-surface rounded-[24px] border border-brand-primary/20 overflow-hidden shadow-glow-sm relative">
        <div className="absolute top-6 left-6 z-10 bg-black/70 backdrop-blur-md px-5 py-2.5 rounded-full text-[10px] font-extrabold uppercase text-white border border-brand-primary/30 flex items-center gap-3 tracking-[1.5px]">
            <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse"></div>
                Canvas Preview
            </span>
            <span className="w-px h-3 bg-brand-primary/30"></span>
            <span className="text-brand-primary">{settings.imageWidth}×{settings.imageHeight} PX</span>
        </div>
        
        <div className="flex-1 overflow-hidden p-12 checkerboard flex items-center justify-center relative">
             <canvas 
                ref={canvasRef} 
                className="shadow-2xl rendering-pixelated max-w-full max-h-full object-contain border-4 border-brand-surface"
                style={{ imageRendering: 'pixelated' }}
            />
        </div>

        {isCalculating && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
                <div className="flex items-center gap-4 text-brand-primary font-black uppercase tracking-[5px] text-lg">
                    <RefreshCw className="w-7 h-7 animate-spin" />
                    Syncing...
                </div>
            </div>
        )}
      </div>
    </div>
  );
};