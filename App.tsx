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
  
  // Export UI State
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
            alert(`Failed to process video: ${msg}\nPlease ensure the file format (codec) is supported by your browser.`);
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
        alert("An error occurred during export.");
    } finally {
        setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col font-sans relative text-slate-200">
      {/* Full screen loader */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center">
            <div className="bg-[#111] p-8 rounded-2xl border border-[#222] shadow-2xl flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-[#ff6b00] rounded-full blur-xl opacity-20 animate-pulse"></div>
                    <Loader2 className="w-12 h-12 text-[#ff6b00] animate-spin relative z-10" />
                </div>
                <div className="text-center space-y-1">
                    <h3 className="text-xl font-bold text-white">
                        Processing {processingType === 'video' ? 'Video' : 'GIF'}
                    </h3>
                    <p className="text-gray-500">Extracting frames and creating sprite sheet...</p>
                </div>
            </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-[#222] bg-[#050505]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
             {/* Logo */}
            <div className="flex flex-col items-center justify-center bg-[#ff6b00]/10 p-2 rounded-xl border border-[#ff6b00]/20">
                 <Grid3X3 className="w-6 h-6 text-[#ff6b00]" />
            </div>
            {/* Brand Text */}
            <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-white tracking-wide">Sprite Splitter</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             {image && (
                <button 
                   onClick={handleReset}
                   className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-2 transition-colors px-4 py-2 rounded-lg hover:bg-red-950/20 border border-transparent hover:border-red-900/50"
                >
                   <Trash2 className="w-3 h-3" />
                   Clear Project
                </button>
             )}
             
             <a 
                href="https://app.tdgamestudio.com"
                className="text-xs font-bold text-gray-500 hover:text-[#ff6b00] flex items-center gap-2 transition-colors px-4 py-2 rounded-lg border border-[#333] hover:border-[#ff6b00] bg-[#111] hover:bg-[#1a1a1a]"
             >
                <ArrowLeft className="w-3 h-3" />
                Back to Tools
             </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8 space-y-8">
        
        {!image ? (
          <div className="flex flex-col items-center justify-center pt-20 pb-20">
            {/* DropZone / Tool Card */}
            <div className="w-full max-w-2xl mx-auto">
               <DropZone onImageSelected={handleFileSelected} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* Breadcrumb / Title */}
             <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <span>Tools</span>
                <span className="text-gray-700">/</span>
                <span className="text-[#ff6b00]">Sprite Splitter</span>
             </div>

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
                <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-[#222] shadow-xl flex flex-col relative overflow-hidden">
                    <div className="p-4 border-b border-[#222] flex flex-wrap items-center justify-between gap-4 relative z-10 bg-[#111]">
                        <div className="flex gap-2 bg-[#050505] p-1 rounded-lg border border-[#222]">
                            <button 
                                onClick={() => setActiveTab('preview')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all ${activeTab === 'preview' ? 'bg-[#ff6b00] text-white shadow-lg shadow-orange-500/20' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                Frame List
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500 hidden sm:inline mr-3 font-mono">
                                {frames.length} FRAMES
                             </span>
                             
                             {/* Spine Export Dropdown */}
                             <div className="relative" ref={spineMenuRef}>
                                 <button
                                    onClick={() => setShowSpineOptions(!showSpineOptions)}
                                    disabled={frames.length === 0 || isExporting}
                                    className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#333] hover:border-[#ff6b00] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide rounded-lg transition-all"
                                 >
                                    {isExporting ? <Loader2 className="w-3 h-3 animate-spin"/> : <FileJson className="w-3 h-3 text-[#ff6b00]" />}
                                    Spine ZIP
                                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showSpineOptions ? 'rotate-180' : ''}`} />
                                 </button>
                                 
                                 {showSpineOptions && (
                                     <div className="absolute top-full right-0 mt-2 w-56 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden z-20">
                                         <div className="p-2 space-y-1">
                                             <div className="px-3 py-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                 Export Mode
                                             </div>
                                             <button 
                                                onClick={() => handleExportSpine(false)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:bg-[#222] rounded-lg transition-colors text-left"
                                             >
                                                <span>Default (Full Size)</span>
                                             </button>
                                             <button 
                                                onClick={() => handleExportSpine(true)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-300 hover:bg-[#222] rounded-lg transition-colors text-left group"
                                             >
                                                <div className="flex flex-col">
                                                    <span>Trim Whitespace</span>
                                                    <span className="text-[10px] text-gray-600">Optimizes file size</span>
                                                </div>
                                                <Scissors className="w-3 h-3 text-[#ff6b00] opacity-0 group-hover:opacity-100 transition-opacity" />
                                             </button>
                                         </div>
                                     </div>
                                 )}
                             </div>

                             <button
                                onClick={handleDownloadZip}
                                disabled={frames.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-[#ff6b00] hover:bg-[#ff8a00] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wide rounded-lg transition-colors shadow-lg shadow-orange-500/10"
                             >
                                <Archive className="w-3 h-3" />
                                PNG ZIP
                             </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto max-h-[400px] p-4 bg-[#0a0a0a] min-h-[200px]">
                        {frames.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-700 opacity-50">
                                <Layers className="w-12 h-12 mb-2 stroke-1" />
                                <p className="text-sm font-medium">Generate frames to see them here</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {frames.map((frame) => (
                                    <div key={frame.id} className="group relative bg-[#151515] border border-[#222] rounded-lg p-2 hover:border-[#ff6b00] transition-all duration-300">
                                        <div className="aspect-square bg-[#050505] rounded-md mb-2 overflow-hidden checkerboard flex items-center justify-center border border-[#1a1a1a]">
                                            <img src={frame.url} className="max-w-full max-h-full object-contain rendering-pixelated" alt={`Frame ${frame.index}`} />
                                        </div>
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] text-gray-500 font-mono">#{frame.index + 1}</span>
                                            <a 
                                                href={frame.url} 
                                                download={`${image.name}_frame_${frame.index}.png`}
                                                className="text-gray-600 hover:text-[#ff6b00] transition-colors"
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

      <footer className="border-t border-[#111] py-8 mt-12 text-center text-gray-600 text-sm">
        <p>© 2025 TD Game Studio. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;