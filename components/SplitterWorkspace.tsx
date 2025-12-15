import React, { useEffect, useRef, useState } from 'react';
import { GridSettings, UploadedImage, FrameData, ColorSettings, GradientStop } from '../types';
import { sliceImage, applyGradientMap } from '../utils/spriteLogic';
import { Grid3X3, ArrowRight, Download, Box, RefreshCw, Lock, Unlock, RotateCcw, Palette, Plus, Trash2 } from 'lucide-react';

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

  // Gradient Map Settings
  const [colorSettings, setColorSettings] = useState<ColorSettings>({
    enabled: false,
    stops: [
        { id: '1', offset: 0, color: '#000000' },   // Black shadows
        { id: '2', offset: 100, color: '#ffffff' }  // White highlights
    ]
  });

  const [frameDimensions, setFrameDimensions] = useState({ w: 0, h: 0 });
  const [isCalculating, setIsCalculating] = useState(false);
  const [aspectRatioLocked, setAspectRatioLocked] = useState(true);
  const [originalAspectRatio, setOriginalAspectRatio] = useState(image.width / image.height);

  // Sync settings when image prop changes
  useEffect(() => {
      setSettings({
          rows: image.suggestedRows || 4,
          columns: image.suggestedColumns || 4,
          imageWidth: image.width,
          imageHeight: image.height,
      });
      setOriginalAspectRatio(image.width / image.height);
      setAspectRatioLocked(true);
      setColorSettings({
        enabled: false,
        stops: [
            { id: '1', offset: 0, color: '#000000' },
            { id: '2', offset: 100, color: '#ffffff' }
        ]
      });
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

  // Color Settings Handlers
  const handleAddStop = () => {
      const newStop: GradientStop = {
          id: Date.now().toString(),
          offset: 50,
          color: '#808080'
      };
      setColorSettings(prev => ({
          ...prev,
          stops: [...prev.stops, newStop].sort((a, b) => a.offset - b.offset)
      }));
  };

  const handleRemoveStop = (id: string) => {
      if (colorSettings.stops.length <= 2) return; // Maintain at least 2 stops
      setColorSettings(prev => ({
          ...prev,
          stops: prev.stops.filter(s => s.id !== id)
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

  // CSS Gradient string for preview
  const getCssGradient = () => {
      const sorted = [...colorSettings.stops].sort((a, b) => a.offset - b.offset);
      const stopsStr = sorted.map(s => `${s.color} ${s.offset}%`).join(', ');
      return `linear-gradient(to right, ${stopsStr})`;
  };

  // Draw Grid Overlay & Apply Gradient Map Preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.src = image.src;
    img.onload = () => {
        // Reset canvas size to match SETTINGS size (allow scaling)
        canvas.width = settings.imageWidth;
        canvas.height = settings.imageHeight;

        // Draw Image Scaled
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, settings.imageWidth, settings.imageHeight);

        // Apply Gradient Map PREVIEW to the big canvas
        if (colorSettings.enabled) {
            const imageData = ctx.getImageData(0, 0, settings.imageWidth, settings.imageHeight);
            applyGradientMap(imageData, colorSettings);
            ctx.putImageData(imageData, 0, 0);
        }

        // Calculate Cell Size
        const cellW = settings.imageWidth / settings.columns;
        const cellH = settings.imageHeight / settings.rows;
        
        setFrameDimensions({ w: Math.floor(cellW), h: Math.floor(cellH) });

        // --- GRID DRAWING LOGIC UPDATE ---
        // Calculate appropriate line width based on image size to ensure visibility when scaled down via CSS.
        // If image is 4000px wide but shown in a 500px container, a 1px line is 0.125px on screen (invisible).
        // We scale the line width so it stays roughly 1-1.5 visual pixels.
        const maxDim = Math.max(settings.imageWidth, settings.imageHeight);
        // Assuming typical container view width is ~600px
        const dynamicLineWidth = Math.max(1, Math.round(maxDim / 600));

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 0, 255, 1)'; // Solid Magenta for max contrast
        ctx.lineWidth = dynamicLineWidth;

        // Vertical lines
        for (let c = 1; c < settings.columns; c++) {
            // Snap to nearest integer to avoid sub-pixel blurring
            const x = Math.floor(c * cellW);
            // Offset by 0.5 only if line width is odd, to center it on the pixel grid
            const xPos = (dynamicLineWidth % 2 !== 0) ? x + 0.5 : x;
            
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, settings.imageHeight);
        }

        // Horizontal lines
        for (let r = 1; r < settings.rows; r++) {
            const y = Math.floor(r * cellH);
            const yPos = (dynamicLineWidth % 2 !== 0) ? y + 0.5 : y;
            
            ctx.moveTo(0, yPos);
            ctx.lineTo(settings.imageWidth, yPos);
        }

        ctx.stroke();
    };
  }, [image, settings, colorSettings]);

  // Handle Generating Frames
  const handleSplit = async () => {
    setIsCalculating(true);
    try {
        // Pass color settings to the slicer
        const frames = await sliceImage(image.src, settings, colorSettings);
        onFramesGenerated(frames);
    } catch (e) {
        console.error("Failed to slice", e);
    } finally {
        setIsCalculating(false);
    }
  };

  // Trigger split automatically when settings change with a small debounce
  useEffect(() => {
      const timer = setTimeout(() => {
          handleSplit();
      }, 500);
      return () => clearTimeout(timer);
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, image, colorSettings]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Configuration Panel */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-lg space-y-6 max-h-[calc(100vh-140px)] overflow-y-auto">
            
            {/* Grid Settings */}
            <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-4">
                    <Grid3X3 className="w-5 h-5 text-orange-400" />
                    Grid Layout
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">Columns (X)</label>
                        <input
                            type="number"
                            min="1"
                            max="64"
                            value={settings.columns}
                            onChange={(e) => setSettings({ ...settings, columns: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">Rows (Y)</label>
                        <input
                            type="number"
                            min="1"
                            max="64"
                            value={settings.rows}
                            onChange={(e) => setSettings({ ...settings, rows: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            <div className="border-t border-slate-700/50 pt-6">
                 <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                        <Box className="w-5 h-5 text-orange-400" />
                        Total Size
                    </h2>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setAspectRatioLocked(!aspectRatioLocked)}
                            className={`p-1.5 rounded hover:bg-slate-700 transition-colors ${aspectRatioLocked ? 'text-orange-400' : 'text-slate-500'}`}
                            title={aspectRatioLocked ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                        >
                            {aspectRatioLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button 
                            onClick={handleResetDimensions}
                            className="p-1.5 rounded hover:bg-slate-700 text-slate-500 hover:text-white transition-colors"
                            title="Reset to Original Size"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">Width (px)</label>
                        <input
                            type="number"
                            min="1"
                            value={settings.imageWidth}
                            onChange={(e) => handleDimensionChange('imageWidth', parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-slate-400 uppercase">Height (px)</label>
                        <input
                            type="number"
                            min="1"
                            value={settings.imageHeight}
                            onChange={(e) => handleDimensionChange('imageHeight', parseInt(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

             {/* Gradient Map Section */}
             <div className="border-t border-slate-700/50 pt-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                        <Palette className="w-5 h-5 text-orange-400" />
                        Gradient Map
                    </h2>
                    
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={colorSettings.enabled}
                            onChange={(e) => setColorSettings({...colorSettings, enabled: e.target.checked})}
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                    </label>
                </div>

                {colorSettings.enabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        {/* Gradient Preview Bar */}
                        <div 
                            className="h-6 w-full rounded-md border border-slate-600 shadow-inner"
                            style={{ background: getCssGradient() }}
                        />

                        {/* Stops List */}
                        <div className="space-y-2">
                            {colorSettings.stops.map((stop, index) => (
                                <div key={stop.id} className="flex items-center gap-2">
                                    <input 
                                        type="color"
                                        value={stop.color}
                                        onChange={(e) => handleStopChange(stop.id, 'color', e.target.value)}
                                        className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                                    />
                                    <input 
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={stop.offset}
                                        onChange={(e) => handleStopChange(stop.id, 'offset', Number(e.target.value))}
                                        className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />
                                    <span className="text-xs text-slate-400 w-8 text-right">{stop.offset}%</span>
                                    <button 
                                        onClick={() => handleRemoveStop(stop.id)}
                                        disabled={colorSettings.stops.length <= 2}
                                        className="p-1.5 text-slate-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button 
                            onClick={handleAddStop}
                            className="w-full flex items-center justify-center gap-2 py-2 border border-slate-600 rounded-lg text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Add Color Stop
                        </button>
                    </div>
                )}
             </div>

            <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-400">Original Size</span>
                    <span className="text-sm font-mono text-slate-500">{image.width} x {image.height} px</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm text-orange-400 font-medium">Frame Size</span>
                    <span className="text-sm font-mono text-white bg-orange-500/10 px-2 py-1 rounded border border-orange-500/20">
                        {frameDimensions.w} x {frameDimensions.h} px
                    </span>
                </div>
            </div>
            
        </div>
      </div>

      {/* Visual Editor */}
      <div className="lg:col-span-2 flex flex-col h-[500px] lg:h-auto bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg relative">
        <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-slate-300 border border-slate-700 flex items-center gap-2">
            <span>Preview</span>
            <span className="w-px h-3 bg-slate-600 mx-1"></span>
            <span className="text-orange-400">{settings.imageWidth} x {settings.imageHeight}</span>
            {colorSettings.enabled && <span className="ml-1 px-1.5 py-0.5 bg-orange-600 rounded text-[10px] text-white">GM Active</span>}
        </div>
        <div 
            ref={containerRef}
            className="flex-1 overflow-hidden p-8 checkerboard flex items-center justify-center relative"
        >
             <canvas 
                ref={canvasRef} 
                className="shadow-2xl rendering-pixelated max-w-full max-h-full object-contain"
                style={{ imageRendering: 'pixelated', filter: colorSettings.enabled ? 'none' : 'none' }}
            />
        </div>
        {isCalculating && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-20">
                <div className="flex items-center gap-2 text-orange-400 animate-pulse font-medium">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processing...
                </div>
            </div>
        )}
      </div>
    </div>
  );
};