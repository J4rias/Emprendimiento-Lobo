import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

interface BarcodeScannerProps {
  onDetected: (code: string) => void;
  onError?: (message: string) => void;
}

export const BarcodeScannerComponent = ({ onDetected, onError }: BarcodeScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanRef = useRef<{ code: string | null; ts: number }>({ code: null, ts: 0 });
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    // Save original console methods
    const originalWarn = console.warn;
    const originalLog = console.log;

    // Suppress ZXing library warnings
    console.warn = (...args) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('It was not possible to play the video') ||
        message.includes('Trying to play video that is already playing')
      ) {
        return; // Suppress these specific warnings
      }
      originalWarn.apply(console, args);
    };

    console.log = (...args) => {
      const message = args[0]?.toString() || '';
      if (
        message.includes('It was not possible to play the video') ||
        message.includes('Trying to play video that is already playing')
      ) {
        return; // Suppress these specific logs
      }
      originalLog.apply(console, args);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      if (reason?.name === 'AbortError') {
        // ZXing can trigger AbortError from an internal video.play() promise.
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      // Restore original console methods
      console.warn = originalWarn;
      console.log = originalLog;
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let cancelled = false;
    let activeStream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;

    const start = async () => {
      try {
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        };

        if (!videoRef.current || cancelled) return;

        setIsScanning(true);

        // Get video stream
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        activeStream = stream;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        // Manual scan loop with throttling
        let lastScanTime = 0;
        const SCAN_INTERVAL = 300; // Scan every 300ms instead of continuously

        const scan = async () => {
          if (cancelled) return;

          const now = Date.now();
          if (now - lastScanTime >= SCAN_INTERVAL) {
            lastScanTime = now;

            try {
              const result = await codeReader.decodeOnceFromStream(stream, videoRef.current!);

              if (result && !cancelled) {
                const code = result.getText();
                const last = lastScanRef.current;

                // Prevent duplicate scans within 2 seconds
                if (last.code !== code || now - last.ts > 2000) {
                  lastScanRef.current = { code, ts: now };
                  onDetectedRef.current?.(code);
                }
              }
            } catch (err) {
              // Ignore common scanning errors (NotFoundException, etc.)
            }
          }

          if (!cancelled) {
            animationFrameId = requestAnimationFrame(scan);
          }
        };

        scan();

      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === 'AbortError') return;

        let errorMessage = 'No se pudo acceder a la cámara';

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No se encontró ninguna cámara en el dispositivo.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'La cámara está siendo usada por otra aplicación.';
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          errorMessage = 'La cámara no cumple con los requisitos necesarios.';
        }

        onErrorRef.current?.(errorMessage);
      }
    };

    start();

    return () => {
      cancelled = true;
      setIsScanning(false);

      // Cancel animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Stop all tracks first
      if (activeStream && typeof activeStream.getTracks === 'function') {
        activeStream.getTracks().forEach((track) => {
          track.stop();
        });
      }

      // Then reset the code reader
      try {
        codeReader.reset();
      } catch {
        // ignore
      }

      // Finally clean up the video element
      if (videoRef.current) {
        try {
          const stream = videoRef.current.srcObject as MediaStream | null;
          if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
          }
          videoRef.current.srcObject = null;
          videoRef.current.pause();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      
      {/* Scanning overlay */}
      {isScanning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-64 h-40">
            {/* Corner markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500"></div>
            
            {/* Scanning line animation */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute w-full h-1 bg-primary-500 animate-scan"></div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0% {
            top: 0;
            opacity: 0.8;
          }
          50% {
            opacity: 1;
          }
          100% {
            top: 100%;
            opacity: 0.8;
          }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
