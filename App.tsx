import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { UploadedImage, FrameData } from './types';
import { sliceImage, getTrimmedData } from './utils/spriteLogic';
import { processVideoFile } from './utils/videoProcessor';
import { processGifFile } from './utils/gifProcessor';
import { DropZone } from './components/DropZone';
import { SplitterWorkspace } from './components/SplitterWorkspace';
import { AnimationPreview } from './components/AnimationPreview';
import { Scissors, Download, Trash2, Layers, Archive, FileImage, FileJson, ChevronDown, Check, Loader2, Video, Grid3X3, ArrowLeft } from 'lucide-react';

const App: React.FC = () => {
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [frames, setFrames] = useState<FrameData[]>([]);
  const [activeTab, setActiveTab] = useState<'preview' | 'frames'>('preview');
  
  const [showSpineOptions, setShowSpineOptions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingType, setProcessingType] = useState<'video' | 'gif'>('video');

  const spineMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (spineMenuRef.current && !spineMenuRef.current.contains(event.target as Node)) {
        setShowSpineOptions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleFileSelected = useCallback(async (file: File) => {
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    
    if (isVideo) {
        setIsProcessing(true);
        setProcessingType('video');
        try {
            const result = await processVideoFile(file);
            setImage({
                src: result.src,
                name: file.name.replace(/\.[^/.]+$/, ""),
                width: result.width,
                height: result.height,
                suggestedRows: result.rows,
                suggestedColumns: result.columns
            });
            setFrames([]); 
        } catch (error: any) {
            console.error("Video processing failed", error);
            const msg = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to process video: ${msg}`);
        } finally {
            setIsProcessing(false);
        }
    } else if (isGif) {
        setIsProcessing(true);
        setProcessingType('gif');
        try {
            const result = await processGifFile(file);
            setImage({
                src: result.src,
                name: file.name.replace(/\.[^/.]+$/, ""),
                width: result.width,
                height: result.height,
                suggestedRows: result.rows,
                suggestedColumns: result.columns
            });
            setFrames([]);
        } catch (error: any) {
            console.error("GIF processing failed", error);
            const msg = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to process GIF: ${msg}`);
        } finally {
            setIsProcessing(false);
        }
    } else {
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
            setFrames([]);
          };
          img.src = src;
        };
        reader.readAsDataURL(file);
    }
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
          bones: [{ name: "root" }],
          slots: [{ name: "sprite_slot", bone: "root", attachment: `fx/frame_000` }],
          skins: [{
              name: "default",
              attachments: { "sprite_slot": {} as Record<string, any> }
          }],
          animations: {
            "animation": { slots: { "sprite_slot": { attachment: [] as any[] } } }
          }
        };

        const zip = new JSZip();
        const fxFolder = zip.folder("images")?.folder("fx");

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            let processedUrl = frame.url;
            let width = frame.width;
            let height = frame.height;
            let offsetX = 0;
            let offsetY = 0;

            if (trimWhitespace) {
                const trimmed = await getTrimmedData(frame.url);
                processedUrl = trimmed.url;
                width = trimmed.width;
                height = trimmed.height;

                const originalCenterX = frameWidth / 2;
                const originalCenterY = frameHeight / 2;
                const newCenterX = trimmed.x + (width / 2);
                const newCenterY = trimmed.y + (height / 2);

                offsetX = newCenterX - originalCenterX;
                offsetY = -(newCenterY - originalCenterY);
            }

            const base64Data = processedUrl.split(',')[1];
            const rawFileName = `frame_${i.toString().padStart(3, '0')}`;
            
            fxFolder?.file(`${rawFileName}.png`, base64Data, { base64: true });

            const attachmentName = `fx/${rawFileName}`;
            spineJson.skins[0].attachments["sprite_slot"][attachmentName] = {
                x: Number(offsetX.toFixed(2)),
                y: Number(offsetY.toFixed(2)),
                width: width,
                height: height
            };
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
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col font-sans relative text-brand-text">
      {/* Processing Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
            <div className="bg-brand-surface p-12 rounded-[24px] border-2 border-brand-primary shadow-glow-lg flex flex-col items-center gap-6 animate-in scale-in duration-400">
                <Loader2 className="w-16 h-16 text-brand-primary animate-spin" />
                <div className="text-center space-y-2">
                    <h3 className="text-2xl font-extrabold text-white uppercase tracking-wider">
                        Processing {processingType}
                    </h3>
                    <p className="text-brand-muted font-medium">Please wait while we extract frames...</p>
                </div>
            </div>
        </div>
      )}

      {/* Navigation Bar */}
      <header className="h-[80px] border-b border-brand-primary/10 bg-brand-bg/95 backdrop-blur-[10px] sticky top-0 z-[100]">
        <div className="max-w-[1400px] mx-auto px-10 h-full flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center justify-center bg-brand-primary/15 p-3 rounded-xl border border-brand-primary/20">
                 <Grid3X3 className="w-7 h-7 text-brand-primary" />
            </div>
            <span className="text-2xl font-extrabold text-white uppercase tracking-[2px]">Sprite Splitter</span>
          </div>
          
          <div className="flex items-center gap-6">
             {image && (
                <button 
                   onClick={handleReset}
                   className="text-sm font-semibold text-brand-muted hover:text-red-500 flex items-center gap-2 transition-all px-4 py-2 rounded-lg hover:bg-red-500/10 border border-transparent"
                >
                   <Trash2 className="w-4 h-4" />
                   Clear Project
                </button>
             )}
             
             <a 
                href="https://app.tdgamestudio.com"
                className="btn-ghost text-sm font-bold uppercase tracking-wider px-6 py-3 flex items-center gap-2 rounded-xl"
             >
                <ArrowLeft className="w-4 h-4" />
                Back to Tools
             </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full p-10 space-y-12 animate-fade-in-up">
        
        {!image ? (
          <div className="flex flex-col items-center justify-center pt-24 pb-24">
            <div className="w-full max-w-[800px] mx-auto">
               <DropZone onImageSelected={handleFileSelected} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
             {/* Breadcrumbs */}
             <div className="flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-brand-muted">
                <span className="hover:text-brand-primary cursor-pointer transition-colors">Tools</span>
                <span className="text-brand-primary/30">/</span>
                <span className="text-brand-primary">Sprite Splitter</span>
             </div>

            {/* Editor Workspace */}
            <div className="min-h-[500px]">
              <SplitterWorkspace 
                image={image} 
                onFramesGenerated={setFrames} 
              />
            </div>

            {/* Bottom Actions Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                
                {/* Animation Preview Panel */}
                <div className="lg:col-span-1">
                    <AnimationPreview frames={frames} />
                </div>

                {/* Frames List Panel */}
                <div className="lg:col-span-2 bg-brand-surface rounded-[20px] border border-brand-primary/20 shadow-lg flex flex-col relative overflow-hidden">
                    <div className="p-6 border-b border-brand-primary/10 flex flex-wrap items-center justify-between gap-6 bg-brand-surface">
                        <div className="flex gap-3 bg-brand-bg p-1.5 rounded-xl border border-brand-primary/10">
                            <span className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-brand-primary text-white shadow-glow-sm">
                                Frame List
                            </span>
                        </div>

                        <div className="flex items-center gap-4">
                             <div className="px-3 py-1 bg-brand-primary/10 border border-brand-primary/20 rounded-full">
                                <span className="text-[10px] font-extrabold text-brand-primary tracking-[1.5px]">
                                    {frames.length} FRAMES
                                </span>
                             </div>
                             
                             {/* Spine Export Dropdown */}
                             <div className="relative" ref={spineMenuRef}>
                                 <button
                                    onClick={() => setShowSpineOptions(!showSpineOptions)}
                                    disabled={frames.length === 0 || isExporting}
                                    className="btn-secondary h-[48px] px-6 text-xs font-bold uppercase tracking-widest rounded-xl flex items-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
                                 >
                                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileJson className="w-4 h-4" />}
                                    Spine ZIP
                                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showSpineOptions ? 'rotate-180' : ''}`} />
                                 </button>
                                 
                                 {showSpineOptions && (
                                     <div className="absolute bottom-full right-0 mb-3 w-[240px] bg-brand-surface border border-brand-primary/30 rounded-2xl shadow-xl overflow-hidden z-[200] animate-in slide-in-from-bottom-2">
                                         <div className="p-3 space-y-1.5">
                                             <div className="px-4 py-2 text-[10px] font-bold text-brand-muted uppercase tracking-[2px]">
                                                 Export Mode
                                             </div>
                                             <button 
                                                onClick={() => handleExportSpine(false)}
                                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-brand-text hover:bg-brand-primary/10 rounded-xl transition-all text-left"
                                             >
                                                <span>Default (Full Size)</span>
                                             </button>
                                             <button 
                                                onClick={() => handleExportSpine(true)}
                                                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-brand-text hover:bg-brand-primary/10 rounded-xl transition-all text-left group"
                                             >
                                                <div className="flex flex-col">
                                                    <span>Trim Whitespace</span>
                                                    <span className="text-[10px] text-brand-muted mt-0.5">Optimized Assets</span>
                                                </div>
                                                <Scissors className="w-4 h-4 text-brand-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                             </button>
                                         </div>
                                     </div>
                                 )}
                             </div>

                             <button
                                onClick={handleDownloadZip}
                                disabled={frames.length === 0}
                                className="btn-primary h-[48px] px-8 text-xs font-extrabold uppercase tracking-widest rounded-xl text-white flex items-center gap-3 disabled:opacity-30"
                             >
                                <Archive className="w-4 h-4" />
                                PNG ZIP
                             </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[500px] p-8 bg-brand-bg/50 min-h-[300px]">
                        {frames.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-brand-muted/40">
                                <Layers className="w-20 h-20 mb-4 stroke-[1px]" />
                                <p className="text-lg font-semibold uppercase tracking-wider">Generate frames to start</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-6">
                                {frames.map((frame) => (
                                    <div key={frame.id} className="group relative bg-brand-surface border border-brand-primary/10 rounded-2xl p-3 hover:border-brand-primary hover:shadow-glow-sm transition-all duration-300">
                                        <div className="aspect-square bg-brand-bg rounded-xl mb-3 overflow-hidden checkerboard flex items-center justify-center border border-brand-primary/5">
                                            <img src={frame.url} className="max-w-[90%] max-h-[90%] object-contain rendering-pixelated" alt={`Frame ${frame.index}`} />
                                        </div>
                                        <div className="flex items-center justify-between px-2 pb-1">
                                            <span className="text-[11px] text-brand-muted font-bold tracking-widest">#{frame.index + 1}</span>
                                            <a 
                                                href={frame.url} 
                                                download={`${image.name}_frame_${frame.index}.png`}
                                                className="text-brand-muted hover:text-brand-primary transition-colors"
                                            >
                                                <Download className="w-4 h-4" />
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

      <footer className="border-t border-brand-primary/5 py-12 mt-20 text-center text-brand-muted text-sm font-medium">
        <p className="tracking-widest uppercase">© 2025 TD Game Studio. CREATED FOR DEVELOPERS.</p>
      </footer>
    </div>
  );
};

export default App;