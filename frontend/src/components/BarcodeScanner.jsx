import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

export const BarcodeScannerComponent = ({ onDetected, onError }) => {
  const videoRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const codeReaderRef = useRef(null);
  const lastScanRef = useRef({ code: null, ts: 0 });
  const onDetectedRef = useRef(onDetected);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const reason = event?.reason;
      if (reason?.name === 'AbortError') {
        // ZXing can trigger AbortError from an internal video.play() promise.
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
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

        if (!videoRef.current) return;

        setIsScanning(true);

        await codeReader.decodeFromConstraints(constraints, videoRef.current, (result, error) => {
          if (cancelled) return;

          if (result) {
            const code = result.getText();
            const now = Date.now();
            const last = lastScanRef.current;

            // Prevent duplicate scans within 2 seconds
            if (last.code !== code || now - last.ts > 2000) {
              lastScanRef.current = { code, ts: now };
              onDetectedRef.current?.(code);
            }
          }

          // Ignore common errors during scanning
          if (error && error.name !== 'NotFoundException') {
            // AbortError can happen if video stream restarts; ignore it.
            if (error.name !== 'AbortError') {
              console.warn('Barcode scan error:', error);
            }
          }
        });
      } catch (err) {
        if (cancelled) return;
        if (err?.name === 'AbortError') return;

        console.error('Camera access error:', err);
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
      try {
        codeReader.reset();
      } catch {
        // ignore
      }
      if (videoRef.current) {
        try {
          const stream = videoRef.current.srcObject;
          if (stream && typeof stream.getTracks === 'function') {
            stream.getTracks().forEach((t) => t.stop());
          }
          videoRef.current.srcObject = null;
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
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500"></div>
            
            {/* Scanning line animation */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute w-full h-1 bg-blue-500 animate-scan"></div>
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
