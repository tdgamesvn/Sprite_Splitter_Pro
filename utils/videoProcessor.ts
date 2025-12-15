/**
 * Processes a video file, extracting frames at a specific FPS and stitching them into a sprite sheet.
 * Returns the sprite sheet data URL and grid configuration.
 */
export const processVideoFile = async (file: File, fps = 12): Promise<{
    src: string;
    width: number;
    height: number;
    rows: number;
    columns: number;
    frameCount: number;
}> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        
        // Critical attributes for headless processing
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('webkit-playsinline', 'true'); // iOS/Safari compatibility
        video.crossOrigin = "anonymous";
        video.preload = "auto"; // Ensure data loads for seeking
        
        // Hide it but keep it in layout pipeline if needed by some browsers
        video.style.position = 'fixed';
        video.style.top = '-9999px';
        video.style.left = '-9999px';
        video.style.visibility = 'hidden';

        // Append to DOM to ensure some browsers (like Safari) process it correctly
        document.body.appendChild(video);

        const objectUrl = URL.createObjectURL(file);

        // Cleanup function
        const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            video.removeAttribute('src');
            video.load();
            if (video.parentNode) {
                video.parentNode.removeChild(video);
            }
        };

        // Attach listeners BEFORE setting src to avoid race conditions
        video.onerror = () => {
            const err = video.error;
            let message = "Failed to load video file.";
            if (err) {
                 switch (err.code) {
                    case 1: message = "Video loading aborted."; break;
                    case 2: message = "Network error loading video."; break;
                    case 3: message = "Video decoding failed. The format might be unsupported."; break;
                    case 4: message = "Video format not supported. Please ensure the file is a standard MP4/H.264 video."; break;
                }
            }
            cleanup();
            reject(new Error(message));
        };

        // We wait for 'loadedmetadata' to get dimensions and duration
        video.onloadedmetadata = async () => {
            try {
                const width = video.videoWidth;
                const height = video.videoHeight;
                let duration = video.duration;

                if (!width || !height) {
                    throw new Error("Invalid video dimensions.");
                }
                
                // Handle Infinity duration (rare edge case with Blobs in some browsers)
                if (duration === Infinity) {
                    // Attempt to resolve duration by forcing a tiny seek
                     video.currentTime = 10000;
                     // Small delay to allow browser to update duration
                     await new Promise(r => setTimeout(r, 200)); 
                     if (video.duration !== Infinity && !isNaN(video.duration)) {
                         duration = video.duration;
                         video.currentTime = 0;
                     } else {
                         // Fallback for infinite streams or un-seekable files
                         throw new Error("Could not determine video duration. Try converting to a standard MP4.");
                     }
                }

                // Calculate total frames to extract
                const totalFrames = Math.floor(duration * fps);
                
                // Limit to prevent browser crash (e.g., max 300 frames)
                const MAX_FRAMES = 300; 
                const frameCount = Math.min(Math.max(1, totalFrames), MAX_FRAMES);

                // Calculate Grid (Square-ish)
                const columns = Math.ceil(Math.sqrt(frameCount));
                const rows = Math.ceil(frameCount / columns);

                // Create the Sheet Canvas
                const canvas = document.createElement('canvas');
                canvas.width = columns * width;
                canvas.height = rows * height;
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    throw new Error("Failed to create canvas context.");
                }

                // Seek and Draw Loop
                let currentFrame = 0;
                const timeStep = 1 / fps;

                // Helper to wait for seek with timeout
                const seekTo = (time: number) => new Promise<void>((res, rej) => {
                    // Create a one-off handler to ensure clean removal
                    const onSeek = () => {
                        clearTimeout(timeout);
                        res();
                    };

                    const timeout = setTimeout(() => {
                        video.removeEventListener('seeked', onSeek);
                        // Don't reject, just resolve to skip frame rather than crash whole process
                        console.warn(`Seek timeout at ${time}s`);
                        res(); 
                    }, 1000); // 1s timeout per frame

                    video.addEventListener('seeked', onSeek, { once: true });
                    video.currentTime = time;
                });

                while (currentFrame < frameCount) {
                    // Calculate time, clamp to just slightly before duration end
                    const time = Math.min(currentFrame * timeStep, duration - 0.05);
                    
                    try {
                        // Optimization: for the first frame, if we are already at 0, skip seek
                        if (currentFrame === 0 && video.currentTime < 0.1 && video.readyState >= 2) {
                            // Already there
                        } else {
                            await seekTo(time);
                        }
                    } catch (e) {
                         console.warn(`Frame ${currentFrame} seek failed, skipping.`);
                    }

                    // Calculate position
                    const col = currentFrame % columns;
                    const row = Math.floor(currentFrame / columns);
                    const x = col * width;
                    const y = row * height;

                    ctx.drawImage(video, 0, 0, width, height, x, y, width, height);

                    currentFrame++;
                }

                resolve({
                    src: canvas.toDataURL('image/png'),
                    width: canvas.width,
                    height: canvas.height,
                    rows,
                    columns,
                    frameCount
                });
            } catch (error) {
                reject(error);
            } finally {
                cleanup();
            }
        };

        // Set src AFTER attaching listeners
        video.src = objectUrl;
    });
};