'use client';

/**
 * Barcode Scanner Component
 *
 * Uses native camera (getUserMedia) for live video feed.
 * If BarcodeDetector API is available, auto-detects barcodes.
 * Otherwise shows camera + manual input as fallback.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Camera, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectorRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setScanning(false);
    setAutoDetect(false);
  }, []);

  // Barcode detection loop
  const startDetectionLoop = useCallback(() => {
    const detect = async () => {
      if (!mountedRef.current) return;
      if (!videoRef.current || !detectorRef.current || !canvasRef.current) return;
      if (videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const barcodes = await detectorRef.current.detect(canvas);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code) {
              onScan(code);
              stopCamera();
              onClose();
              return;
            }
          }
        }
      } catch (err) {
        // Detection error - continue scanning
        console.warn('Barcode detection error:', err);
      }

      if (mountedRef.current) {
        animFrameRef.current = requestAnimationFrame(detect);
      }
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, [onScan, onClose, stopCamera]);

  // Start camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    setScanning(false);
    setAutoDetect(false);

    // Check getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('此瀏覽器不支援相機功能，請使用手動輸入');
      return;
    }

    try {
      // Request camera - prefer rear camera on mobile
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          if (!mountedRef.current || !videoRef.current) return;
          videoRef.current.play().then(() => {
            if (!mountedRef.current) return;
            setCameraReady(true);
            setScanning(true);

            // Try to set up BarcodeDetector for auto-scanning
            const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
            if (hasBarcodeDetector) {
              try {
                // @ts-ignore
                detectorRef.current = new window.BarcodeDetector({
                  formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'qr_code', 'itf'],
                });
                canvasRef.current = document.createElement('canvas');
                setAutoDetect(true);
                startDetectionLoop();
              } catch (e) {
                console.warn('BarcodeDetector init failed:', e);
                // Camera still works, just no auto-detection
              }
            }
          }).catch((playErr) => {
            console.error('Video play error:', playErr);
            setCameraError('無法播放相機畫面，請在下方手動輸入');
          });
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('請允許相機權限以使用掃碼功能。\n可在瀏覽器網址列左側的鎖頭圖示中開啟。');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('找不到相機裝置');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('相機被其他應用程式佔用中');
      } else if (err.name === 'OverconstrainedError') {
        // Try again without constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (!mountedRef.current) {
            stream.getTracks().forEach(track => track.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setCameraReady(true);
                setScanning(true);
              });
            };
          }
        } catch {
          setCameraError('無法啟動相機');
        }
      } else {
        setCameraError(`無法啟動相機：${err.message || err.name || '未知錯誤'}`);
      }
    }
  }, [startDetectionLoop]);

  // Lifecycle
  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      // Small delay to let dialog animation complete
      const timer = setTimeout(() => {
        startCamera();
      }, 300);
      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        stopCamera();
      };
    } else {
      stopCamera();
      setBarcode('');
      setCameraError(null);
    }
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

  // Focus input when camera fails
  useEffect(() => {
    if (cameraError && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [cameraError]);

  const handleScan = () => {
    if (barcode.trim()) {
      onScan(barcode.trim());
      setBarcode('');
      stopCamera();
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full h-full max-w-none max-h-none p-0 border-0 rounded-none flex flex-col">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Camera View */}
        <div className="flex-1 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative overflow-hidden">
          {/* Real camera video - always rendered */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            style={{ display: cameraReady ? 'block' : 'none' }}
          />

          {/* Scanning frame overlay */}
          {cameraReady && (
            <div className="absolute inset-8 border-2 border-green-500/50 rounded-lg pointer-events-none z-[5]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg" />
              {/* Scan line animation */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan" />
              </div>
            </div>
          )}

          {/* Loading state */}
          {!cameraReady && !cameraError && (
            <div className="text-center z-[5]">
              <Loader2 className="h-12 w-12 text-green-500 mx-auto mb-4 animate-spin" />
              <p className="text-white/80 text-sm">正在啟動相機...</p>
            </div>
          )}

          {/* Error state */}
          {cameraError && (
            <div className="text-center z-[5] px-8">
              <Camera className="h-16 w-16 text-yellow-500/70 mx-auto mb-4" />
              <p className="text-white/80 text-sm mb-2 whitespace-pre-line">{cameraError}</p>
              <p className="text-white/50 text-xs">請在下方手動輸入條碼</p>
            </div>
          )}

          {/* Scanning indicator */}
          {scanning && cameraReady && (
            <div className="absolute bottom-4 left-0 right-0 text-center z-[5]">
              <span className="bg-black/60 text-green-400 text-sm px-4 py-2 rounded-full">
                {autoDetect ? '自動掃描中...對準條碼' : '請對準條碼後在下方輸入'}
              </span>
            </div>
          )}
        </div>

        {/* Manual Input Section */}
        <div className="bg-white dark:bg-slate-950 p-6 space-y-4 border-t">
          <h2 className="text-lg font-semibold text-center">
            {cameraReady && autoDetect ? '自動掃描中，或手動輸入' : '掃描條碼'}
          </h2>

          <Input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            placeholder="輸入或掃描條碼..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-lg py-3"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 h-12"
            >
              取消
            </Button>
            <Button
              onClick={handleScan}
              disabled={!barcode.trim()}
              className="flex-1 h-12 text-base font-semibold"
            >
              確認
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
