import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { UploadedImage, FrameData } from './types';
import { sliceImage, getTrimmedData } from './utils/spriteLogic';
import { DropZone } from './components/DropZone';
import { SplitterWorkspace } from './components/SplitterWorkspace';
import { AnimationPreview } from './components/AnimationPreview';
import { Scissors, Download, Trash2, Layers, Archive, FileImage, FileJson, ChevronDown, Check, Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'frames'>('preview');
  
  // Export UI State
  const [showSpineOptions, setShowSpineOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const spineMenuRef = useRef<HTMLDivElement>(null);

  // Close spine menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (spineMenuRef.current && !spineMenuRef.current.contains(event.target as Node)) {
        setShowSpineOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageSelected = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setImage({
          src,
          name: file.name.replace(/\.[^/.]+$/, ""),
          width: img.width,
          height: img.height,
        });
        setFrames([]); // Clear old frames
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, []);

  const handleReset = () => {
    setImage(null);
    setFrames([]);
  };

  const handleDownloadZip = async () => {
    if (frames.length === 0 || !image) return;
    const zip = new JSZip();
    const folder = zip.folder(image.name + "_frames");
    
    frames.forEach((frame, i) => {
      // Remove data:image/png;base64, prefix
      const data = frame.url.split(',')[1];
      folder?.file(`frame_${i.toString().padStart(3, '0')}.png`, data, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${image.name}_sprites.zip`);
  };

  const handleExportSpine = async (trimWhitespace: boolean) => {
    if (frames.length === 0 || !image) return;
    setIsExporting(true);
    setShowSpineOptions(false);

    try {
        const frameWidth = frames[0].width;
        const frameHeight = frames[0].height;
        const fps = 30;

        const spineJson = {
          skeleton: {
            hash: "sprite-splitter-pro",
            spine: "3.8.99",
            width: frameWidth,
            height: frameHeight,
            images: "./images",
            audio: ""
          },
          bones: [
            { name: "root" }
          ],
          slots: [
            { name: "sprite_slot", bone: "root", attachment: `fx/frame_000` }
          ],
          skins: [
            {
              name: "default",
              attachments: {
                "sprite_slot": {} as Record<string, any>
              }
            }
          ],
          animations: {
            "animation": {
              slots: {
                "sprite_slot": {
                  attachment: [] as any[]
                }
              }
            }
          }
        };

        const zip = new JSZip();
        const fxFolder = zip.folder("images")?.folder("fx");

        // Process frames sequentially
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            let processedUrl = frame.url;
            let width = frame.width;
            let height = frame.height;
            let offsetX = 0; // Displacement in X
            let offsetY = 0; // Displacement in Y

            if (trimWhitespace) {
                const trimmed = await getTrimmedData(frame.url);
                processedUrl = trimmed.url;
                width = trimmed.width;
                height = trimmed.height;

                // Calculate Spine Offsets
                // Original Center: (frameWidth / 2, frameHeight / 2)
                // New Image Center relative to Original Top-Left: (trimmed.x + width/2, trimmed.y + height/2)
                // Spine X = NewCenterX - OriginalCenterX
                // Spine Y = -(NewCenterY - OriginalCenterY)  <-- Y is inverted in Spine usually

                const originalCenterX = frameWidth / 2;
                const originalCenterY = frameHeight / 2;
                const newCenterX = trimmed.x + (width / 2);
                const newCenterY = trimmed.y + (height / 2);

                offsetX = newCenterX - originalCenterX;
                offsetY = -(newCenterY - originalCenterY);
            }

            const base64Data = processedUrl.split(',')[1];
            const rawFileName = `frame_${i.toString().padStart(3, '0')}`;
            
            // 1. Add to ZIP
            fxFolder?.file(`${rawFileName}.png`, base64Data, { base64: true });

            const attachmentName = `fx/${rawFileName}`;

            // 2. Add Attachment
            spineJson.skins[0].attachments["sprite_slot"][attachmentName] = {
                x: Number(offsetX.toFixed(2)),
                y: Number(offsetY.toFixed(2)),
                width: width,
                height: height
            };

            // 3. Add Keyframe
            spineJson.animations["animation"].slots["sprite_slot"].attachment.push({
                time: Number((i / fps).toFixed(4)),
                name: attachmentName
            });
        }

        zip.file(`${image.name}.json`, JSON.stringify(spineJson, null, 2));

        const content = await zip.generateAsync({ type: "blob" });
        const suffix = trimWhitespace ? "_trimmed" : "";
        saveAs(content, `${image.name}_spine${suffix}.zip`);
    } catch (error) {
        console.error("Export failed", error);
        alert("An error occurred during export.");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <Scissors className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              SpriteSplitter <span className="text-indigo-500 text-sm font-mono tracking-wide px-1">PRO</span>
            </h1>
          </div>
          {image && (
             <button 
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 transition-colors px-3 py-1.5 rounded-md hover:bg-red-950/30 border border-transparent hover:border-red-900"
             >
                <Trash2 className="w-3 h-3" />
                Clear Project
             </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6 space-y-6">
        
        {!image ? (
          <div className="max-w-xl mx-auto mt-20">
            <DropZone onImageSelected={handleImageSelected} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {/* Editor Workspace (Grid & Canvas) */}
            <div className="min-h-[500px]">
              <SplitterWorkspace 
                image={image} 
                onFramesGenerated={setFrames} 
              />
            </div>

            {/* Bottom Panel: Preview & Export */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Animation Preview */}
                <div className="lg:col-span-1">
                    <AnimationPreview frames={frames} />
                </div>

                {/* Frames List & Export */}
                {/* Removed overflow-hidden to allow dropdown to show */}
                <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 shadow-xl flex flex-col relative">
                    <div className="p-4 border-b border-slate-700 flex flex-wrap items-center justify-between gap-4 relative z-10">
                        <div className="flex gap-2 bg-slate-900 p-1 rounded-lg">
                            <button 
                                onClick={() => setActiveTab('preview')}
                                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Frame List
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                             <span className="text-xs text-slate-400 hidden sm:inline mr-2">
                                {frames.length} frames ready
                             </span>
                             
                             {/* Spine Export Dropdown */}
                             <div className="relative" ref={spineMenuRef}>
                                 <button
                                    onClick={() => setShowSpineOptions(!showSpineOptions)}
                                    disabled={frames.length === 0 || isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-orange-500/20 active:translate-y-0.5"
                                 >
                                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileJson className="w-4 h-4" />}
                                    Spine ZIP
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSpineOptions ? 'rotate-180' : ''}`} />
                                 </button>
                                 
                                 {showSpineOptions && (
                                     <div className="absolute top-full right-0 mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                                         <div className="p-2 space-y-1">
                                             <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                                 Export Mode
                                             </div>
                                             <button 
                                                onClick={() => handleExportSpine(false)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg transition-colors text-left"
                                             >
                                                <span>Default (Full Size)</span>
                                                <div className="w-4 h-4 border border-slate-500 rounded-full flex items-center justify-center opacity-50"></div>
                                             </button>
                                             <button 
                                                onClick={() => handleExportSpine(true)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 rounded-lg transition-colors text-left group"
                                             >
                                                <div className="flex flex-col">
                                                    <span>Trim Whitespace</span>
                                                    <span className="text-[10px] text-slate-500">Optimizes file size</span>
                                                </div>
                                                <Scissors className="w-3 h-3 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                             </button>
                                         </div>
                                     </div>
                                 )}
                             </div>

                             <button
                                onClick={handleDownloadZip}
                                disabled={frames.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-emerald-500/20"
                             >
                                <Archive className="w-4 h-4" />
                                Export PNGs
                             </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[400px] p-4 bg-slate-900/30 rounded-b-xl">
                        {frames.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
                                <Layers className="w-12 h-12 mb-2" />
                                <p>Adjust grid to generate frames</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                                {frames.map((frame) => (
                                    <div key={frame.id} className="group relative bg-slate-800 border border-slate-700 rounded-lg p-2 hover:border-indigo-500 transition-all hover:-translate-y-1">
                                        <div className="aspect-square bg-slate-900 rounded-md mb-2 overflow-hidden checkerboard flex items-center justify-center">
                                            <img src={frame.url} className="max-w-full max-h-full object-contain rendering-pixelated" alt={`Frame ${frame.index}`} />
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] text-slate-400 font-mono">#{frame.index + 1}</span>
                                            <a 
                                                href={frame.url} 
                                                download={`${image.name}_frame_${frame.index}.png`}
                                                className="text-slate-500 hover:text-indigo-400 transition-colors"
                                                title="Download PNG"
                                            >
                                                <Download className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;