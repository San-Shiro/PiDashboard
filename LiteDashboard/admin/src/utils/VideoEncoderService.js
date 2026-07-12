import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Utility to generate a hardware-accelerated H.264 MP4 file 
 * from a list of images using WebCodecs and an OffscreenCanvas.
 */
export async function generateSlideshowVideo(config, onProgress) {
  const rawImages = config.images || "";
  const images = typeof rawImages === 'string' 
    ? rawImages.split(',').map(s => s.trim()).filter(Boolean) 
    : (Array.isArray(rawImages) ? rawImages : []);

  if (images.length === 0) {
    throw new Error('No images selected for slideshow video.');
  }

  // Configuration defaults
  const interval = Number(config.interval) || 5;
  const transitionSpeed = Math.max(0, Number(config.transitionSpeed) || 1);
  const fps = 30;
  const width = 1920;
  const height = 1080;
  const duration = images.length * interval; // Total video duration in seconds
  const totalFrames = Math.floor(duration * fps);

  if (onProgress) onProgress(0, 'Fetching images...');

  // 1. Fetch and decode all images into ImageBitmaps
  const bitmaps = [];
  for (let i = 0; i < images.length; i++) {
    const imgPath = images[i];
    const url = imgPath.startsWith('/') || imgPath.startsWith('http') ? imgPath : `/media/${imgPath}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch ${url}`);
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      bitmaps.push(bitmap);
    } catch (err) {
      console.error(err);
      throw new Error(`Could not load image: ${images[i]}`);
    }
  }

  if (onProgress) onProgress(10, 'Initializing WebCodecs...');

  // 2. Setup Canvas
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { alpha: false });

  // Helper to draw an image covering the canvas (object-fit: cover)
  const drawCover = (bitmap, alpha) => {
    ctx.globalAlpha = alpha;
    const canvasRatio = width / height;
    const imgRatio = bitmap.width / bitmap.height;
    let sWidth = bitmap.width;
    let sHeight = bitmap.height;
    let sx = 0;
    let sy = 0;

    if (canvasRatio > imgRatio) {
      sHeight = sWidth / canvasRatio;
      sy = (bitmap.height - sHeight) / 2;
    } else {
      sWidth = sHeight * canvasRatio;
      sx = (bitmap.width - sWidth) / 2;
    }
    ctx.drawImage(bitmap, sx, sy, sWidth, sHeight, 0, 0, width, height);
  };

  // 3. Setup Muxer & Encoder
  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: width,
      height: height
    },
    fastStart: 'in-memory'
  });

  const encoderCandidates = [
    {
      codec: 'avc1.42E01E', // Baseline
      width,
      height,
      bitrate: 4000000,
      framerate: fps,
      avc: { format: 'avc' },
    },
    {
      codec: 'avc1.42001E', // Baseline variant used by some implementations
      width,
      height,
      bitrate: 3500000,
      framerate: fps,
      avc: { format: 'annexb' },
    },
    {
      codec: 'avc1.4D401E', // Main profile fallback
      width,
      height,
      bitrate: 4000000,
      framerate: fps,
      avc: { format: 'annexb' },
    },
  ];

  let encoderConfig = null;
  for (const candidate of encoderCandidates) {
    try {
      const support = await VideoEncoder.isConfigSupported(candidate);
      if (support?.supported) {
        encoderConfig = support.config || candidate;
        break;
      }
    } catch {
      // Try next candidate.
    }
  }

  if (!encoderConfig) {
    throw new Error('UNSUPPORTED_H264_WEBCODECS');
  }

  let encoderError = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e;
      console.error('VideoEncoder error:', e);
    }
  });

  videoEncoder.configure(encoderConfig);

  if (onProgress) onProgress(15, 'Encoding frames...');

  // 4. Render loop
  for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    const cycleTime = time % duration;
    
    // Which interval block are we in?
    const currentIdx = Math.floor(cycleTime / interval);
    const timeInInterval = cycleTime % interval;

    // Default: draw current image fully opaque
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    if (transitionSpeed > 0 && timeInInterval < transitionSpeed) {
      // Crossfading from previous to current
      const prevIdx = (currentIdx - 1 + bitmaps.length) % bitmaps.length;
      drawCover(bitmaps[prevIdx], 1.0);
      
      const fadeProgress = timeInInterval / transitionSpeed;
      drawCover(bitmaps[currentIdx], fadeProgress);
    } else {
      // Solid phase
      drawCover(bitmaps[currentIdx], 1.0);
    }

    // Capture the canvas as a VideoFrame
    const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / fps) });
    
    // Check queue to prevent memory overflow
    if (videoEncoder.encodeQueueSize > 30) {
      // Wait for the encoder to catch up
      await new Promise(resolve => {
        const check = () => {
          if (videoEncoder.encodeQueueSize < 10) resolve();
          else setTimeout(check, 10);
        };
        check();
      });
    }

    if (encoderError) {
      frame.close();
      throw new Error(`Video encoder failed: ${encoderError.message || String(encoderError)}`);
    }

    // Every 30 frames (1s), emit a keyframe for better seeking
    try {
      videoEncoder.encode(frame, { keyFrame: i % 30 === 0 });
    } catch (err) {
      frame.close();
      throw new Error(`Video encode failed at frame ${i}: ${err.message || String(err)}`);
    }
    frame.close();

    // Update progress occasionally
    if (i % 30 === 0 && onProgress) {
      const p = 15 + Math.floor((i / totalFrames) * 80);
      onProgress(p, `Encoding frame ${i} / ${totalFrames}...`);
    }
  }

  if (onProgress) onProgress(95, 'Finalizing video file...');

  try {
    if (encoderError) {
      throw new Error(`Video encoder failed: ${encoderError.message || String(encoderError)}`);
    }
    await videoEncoder.flush();
    if (encoderError) {
      throw new Error(`Video encoder failed during flush: ${encoderError.message || String(encoderError)}`);
    }
    muxer.finalize();
    const buffer = muxer.target.buffer;
    return new Blob([buffer], { type: 'video/mp4' });
  } finally {
    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {
      // no-op
    }
    for (const b of bitmaps) {
      try { b.close(); } catch { /* no-op */ }
    }
  }
}
