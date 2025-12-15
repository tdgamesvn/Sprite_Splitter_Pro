import { FrameData, GridSettings, ColorSettings, GradientStop } from '../types';

/**
 * Helper to convert hex to rgb
 */
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

/**
 * Generates a 256-element array of RGB values representing the gradient.
 * This acts as a Lookup Table (LUT) for fast pixel mapping.
 */
const generateGradientLUT = (stops: GradientStop[]) => {
  const lut = new Uint8ClampedArray(256 * 3); // R, G, B for each of 256 levels
  
  // Sort stops by offset
  const sortedStops = [...stops].sort((a, b) => a.offset - b.offset);
  
  // Helper to find color at a specific percentage (0-1)
  const getColorAt = (t: number) => {
    // Find the two stops t falls between
    let start = sortedStops[0];
    let end = sortedStops[sortedStops.length - 1];

    for (let i = 0; i < sortedStops.length - 1; i++) {
        const s1 = sortedStops[i];
        const s2 = sortedStops[i+1];
        const o1 = s1.offset / 100;
        const o2 = s2.offset / 100;
        if (t >= o1 && t <= o2) {
            start = s1;
            end = s2;
            break;
        }
    }

    const o1 = start.offset / 100;
    const o2 = end.offset / 100;
    
    // Normalize t between the two stops (0 to 1)
    const range = o2 - o1;
    const localT = range === 0 ? 0 : (t - o1) / range;

    const c1 = hexToRgb(start.color);
    const c2 = hexToRgb(end.color);

    // Linear interpolation
    return {
        r: c1.r + (c2.r - c1.r) * localT,
        g: c1.g + (c2.g - c1.g) * localT,
        b: c1.b + (c2.b - c1.b) * localT
    };
  };

  for (let i = 0; i < 256; i++) {
      const t = i / 255;
      const color = getColorAt(t);
      lut[i * 3] = color.r;
      lut[i * 3 + 1] = color.g;
      lut[i * 3 + 2] = color.b;
  }

  return lut;
};

/**
 * Applies the gradient map to the ImageData in place.
 */
export const applyGradientMap = (imageData: ImageData, colorSettings: ColorSettings) => {
    if (!colorSettings.enabled || colorSettings.stops.length < 2) return;

    const lut = generateGradientLUT(colorSettings.stops);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        // Skip fully transparent pixels
        if (data[i + 3] === 0) continue;

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate luminance (Perceived brightness)
        // Rec. 709 constants: 0.2126 R + 0.7152 G + 0.0722 B
        const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);

        // Map luminance to LUT
        const lutIndex = luminance * 3;
        data[i] = lut[lutIndex];     // R
        data[i + 1] = lut[lutIndex + 1]; // G
        data[i + 2] = lut[lutIndex + 2]; // B
        // Alpha (data[i+3]) remains unchanged
    }
};

/**
 * Slices an image based on grid settings and returns an array of FrameData.
 * Supports scaling and Color Grading (Gradient Map).
 */
export const sliceImage = async (
  imageSrc: string,
  settings: GridSettings,
  colorSettings?: ColorSettings
): Promise<FrameData[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const frames: FrameData[] = [];
      const { rows, columns } = settings;
      
      const targetW = settings.imageWidth || img.width;
      const targetH = settings.imageHeight || img.height;

      // 1. Create a canvas for the FULL resized image
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = targetW;
      fullCanvas.height = targetH;
      const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });

      if (!fullCtx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      // 2. Draw resized image
      fullCtx.imageSmoothingEnabled = true;
      fullCtx.imageSmoothingQuality = 'high';
      fullCtx.drawImage(img, 0, 0, targetW, targetH);

      // 3. Apply Gradient Map if enabled
      if (colorSettings?.enabled) {
          const imageData = fullCtx.getImageData(0, 0, targetW, targetH);
          applyGradientMap(imageData, colorSettings);
          fullCtx.putImageData(imageData, 0, 0);
      }

      // 4. Slice from the modified full canvas
      const destFrameWidth = Math.floor(targetW / columns);
      const destFrameHeight = Math.floor(targetH / rows);

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = destFrameWidth;
      frameCanvas.height = destFrameHeight;
      const frameCtx = frameCanvas.getContext('2d');

      if (!frameCtx) {
          reject(new Error("Could not get frame context"));
          return;
      }

      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          frameCtx.clearRect(0, 0, destFrameWidth, destFrameHeight);
          
          frameCtx.drawImage(
            fullCanvas,
            c * destFrameWidth,    // Source X
            r * destFrameHeight,   // Source Y
            destFrameWidth,        // Source Width
            destFrameHeight,       // Source Height
            0,                     // Dest X
            0,                     // Dest Y
            destFrameWidth,        // Dest Width
            destFrameHeight        // Dest Height
          );

          frames.push({
            id: `frame-${r}-${c}-${Date.now()}`,
            url: frameCanvas.toDataURL('image/png'),
            index: count,
            width: destFrameWidth,
            height: destFrameHeight,
          });
          count++;
        }
      }
      resolve(frames);
    };
    img.onerror = (err) => reject(err);
    img.src = imageSrc;
  });
};

/**
 * Scans an image (DataURL) for transparent pixels and returns a trimmed version
 * along with the offset relative to the original size.
 */
export const getTrimmedData = (base64: string): Promise<{
    url: string;
    x: number;
    y: number;
    width: number;
    height: number;
}> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve({ url: base64, x: 0, y: 0, width: img.width, height: img.height });
                return;
            }
            ctx.drawImage(img, 0, 0);
            const w = canvas.width;
            const h = canvas.height;
            const imageData = ctx.getImageData(0, 0, w, h);
            const data = imageData.data;

            let minX = w, minY = h, maxX = 0, maxY = 0;
            let found = false;

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (data[(y * w + x) * 4 + 3] > 0) {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                        found = true;
                    }
                }
            }

            if (!found) {
                const emptyCanvas = document.createElement('canvas');
                emptyCanvas.width = 1;
                emptyCanvas.height = 1;
                resolve({ url: emptyCanvas.toDataURL(), x: 0, y: 0, width: 1, height: 1 });
                return;
            }

            const trimW = maxX - minX + 1;
            const trimH = maxY - minY + 1;

            const trimmedCanvas = document.createElement('canvas');
            trimmedCanvas.width = trimW;
            trimmedCanvas.height = trimH;
            const tCtx = trimmedCanvas.getContext('2d');
            tCtx?.drawImage(canvas, minX, minY, trimW, trimH, 0, 0, trimW, trimH);

            resolve({
                url: trimmedCanvas.toDataURL(),
                x: minX,
                y: minY,
                width: trimW,
                height: trimH
            });
        };
        img.src = base64;
    });
};