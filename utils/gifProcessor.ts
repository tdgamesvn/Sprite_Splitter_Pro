import { parseGIF, decompressFrames } from 'gifuct-js';

/**
 * Processes a GIF file, extracting frames and stitching them into a sprite sheet.
 * Returns the sprite sheet data URL and grid configuration.
 */
export const processGifFile = async (file: File): Promise<{
    src: string;
    width: number;
    height: number;
    rows: number;
    columns: number;
    frameCount: number;
}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const buffer = e.target?.result as ArrayBuffer;
                if (!buffer) throw new Error("Failed to read file buffer");

                // Parse GIF
                const gif = parseGIF(buffer);
                const frames = decompressFrames(gif, true);

                if (!frames || frames.length === 0) {
                    throw new Error("No frames found in GIF");
                }

                // GIF logical screen size
                const width = gif.lsd.width;
                const height = gif.lsd.height;
                const frameCount = frames.length;

                // Calculate Grid
                const columns = Math.ceil(Math.sqrt(frameCount));
                const rows = Math.ceil(frameCount / columns);

                // Create Sheet Canvas
                const sheetCanvas = document.createElement('canvas');
                sheetCanvas.width = columns * width;
                sheetCanvas.height = rows * height;
                const sheetCtx = sheetCanvas.getContext('2d');
                if (!sheetCtx) throw new Error("Could not create sheet context");

                // Create a temporary "render buffer" canvas to compose frames
                // GIFs are often optimized with patches, so we need to draw over the previous frame
                const renderCanvas = document.createElement('canvas');
                renderCanvas.width = width;
                renderCanvas.height = height;
                const renderCtx = renderCanvas.getContext('2d', { willReadFrequently: true });
                if (!renderCtx) throw new Error("Could not create render context");

                // Temporary canvas for the current frame patch
                const patchCanvas = document.createElement('canvas');
                const patchCtx = patchCanvas.getContext('2d');

                frames.forEach((frame, i) => {
                    // 1. Handle Disposal of previous frame
                    // disposalType: 2 = restore to background (clear), 3 = restore to previous. 
                    // However, for simple sprite sheets, standard draw-over (1) is most common.
                    // We'll stick to standard cumulative rendering for now as it's safest for extraction.
                    const prevFrame = i > 0 ? frames[i - 1] : null;
                    if (prevFrame && prevFrame.disposalType === 2) {
                        renderCtx.clearRect(0, 0, width, height);
                    }

                    // 2. Draw current frame patch
                    const dims = frame.dims;
                    if (patchCtx && dims.width > 0 && dims.height > 0) {
                        patchCanvas.width = dims.width;
                        patchCanvas.height = dims.height;
                        
                        const imageData = new ImageData(
                            new Uint8ClampedArray(frame.patch), 
                            dims.width, 
                            dims.height
                        );
                        patchCtx.putImageData(imageData, 0, 0);

                        // Composite onto the render buffer
                        renderCtx.drawImage(patchCanvas, dims.left, dims.top);
                    }

                    // 3. Draw the full composed frame onto the sprite sheet
                    const col = i % columns;
                    const row = Math.floor(i / columns);
                    const x = col * width;
                    const y = row * height;

                    sheetCtx.drawImage(renderCanvas, 0, 0, width, height, x, y, width, height);
                });

                resolve({
                    src: sheetCanvas.toDataURL('image/png'),
                    width: sheetCanvas.width,
                    height: sheetCanvas.height,
                    rows,
                    columns,
                    frameCount
                });

            } catch (error) {
                console.error(error);
                reject(new Error("Failed to parse GIF. It might be corrupted or unsupported."));
            }
        };

        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsArrayBuffer(file);
    });
};