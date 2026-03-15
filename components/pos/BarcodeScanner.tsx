'use client';

/**
 * Barcode Scanner Component
 *
 * - 鍵盤/掃碼槍：由 POS 頁面 useBarcodeScanner 處理（不在此元件內）
 * - 相機掃碼：使用 @zxing/browser，支援 iOS/Android
 * - 手動輸入：相機失敗或無相機時可手動輸入條碼
 *
 * 注意：相機需 HTTPS、iOS 需 video playsInline；手機/平板需讓 video 有尺寸且先取得權限。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
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
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const mountedRef = useRef(true);
  const lastScannedRef = useRef<string | null>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      try {
        controlsRef.current.stop();
      } catch (_) {}
      controlsRef.current = null;
    }
    readerRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    setScanning(false);
    lastScannedRef.current = null;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('此瀏覽器不支援相機功能，請使用手動輸入');
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    try {
      // 先取得相機權限（尤其 iOS），再交給 ZXing，避免手機上無反應
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.getTracks().forEach((t) => t.stop());
    } catch (preErr: unknown) {
      const e = preErr as { name?: string };
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraError('請允許相機權限以使用掃碼功能。\n可在瀏覽器網址列左側的鎖頭圖示中開啟。');
      } else {
        setCameraError('無法取得相機權限，請使用手動輸入');
      }
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    try {
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        video,
        (result, _err) => {
          if (!mountedRef.current) return;
          if (!result) return;
          const code = result.getText()?.trim();
          if (!code) return;
          if (lastScannedRef.current === code) return;
          lastScannedRef.current = code;
          controlsRef.current?.stop();
          controlsRef.current = null;
          stopCamera();
          onScanRef.current(code);
          onCloseRef.current();
        }
      );
      if (!mountedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraReady(true);
      setScanning(true);
      video.play().catch(() => {});
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const e = err as { name?: string; message?: string };
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setCameraError('請允許相機權限以使用掃碼功能。\n可在瀏覽器網址列左側的鎖頭圖示中開啟。');
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        setCameraError('找不到相機裝置');
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        setCameraError('相機被其他應用程式佔用中');
      } else {
        setCameraError(`無法啟動相機：${e.message || e.name || '未知錯誤'}`);
      }
    }
  }, [stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        stopCamera();
      };
    }
    stopCamera();
    setBarcode('');
    setCameraError(null);
    return () => {
      mountedRef.current = false;
      stopCamera();
    };
  }, [open, startCamera, stopCamera]);

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
    if (e.key === 'Enter') handleScan();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full h-full max-w-none max-h-none p-0 border-0 rounded-none flex flex-col">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          aria-label="關閉"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex-1 min-h-[200px] bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
            style={{ visibility: cameraReady ? 'visible' : 'hidden' }}
          />

          {cameraReady && (
            <div className="absolute inset-8 border-2 border-green-500/50 rounded-lg pointer-events-none z-[5]">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg" />
              <div className="absolute inset-0 overflow-hidden">
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-green-400 to-transparent animate-scan" />
              </div>
            </div>
          )}

          {!cameraReady && !cameraError && (
            <div className="text-center z-[5]">
              <Loader2 className="h-12 w-12 text-green-500 mx-auto mb-4 animate-spin" />
              <p className="text-white/80 text-sm">正在啟動相機...</p>
            </div>
          )}

          {cameraError && (
            <div className="text-center z-[5] px-8">
              <Camera className="h-16 w-16 text-yellow-500/70 mx-auto mb-4" />
              <p className="text-white/80 text-sm mb-2 whitespace-pre-line">{cameraError}</p>
              <p className="text-white/50 text-xs">請在下方手動輸入條碼</p>
            </div>
          )}

          {scanning && cameraReady && (
            <div className="absolute bottom-4 left-0 right-0 text-center z-[5]">
              <span className="bg-black/60 text-green-400 text-sm px-4 py-2 rounded-full">
                將條碼對準框內
              </span>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-950 p-6 space-y-4 border-t">
          <h2 className="text-lg font-semibold text-center">
            {cameraReady ? '自動掃描中，或手動輸入' : '掃描條碼'}
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
            <Button variant="outline" onClick={handleClose} className="flex-1 h-12">
              取消
            </Button>
            <Button onClick={handleScan} disabled={!barcode.trim()} className="flex-1 h-12 text-base font-semibold">
              確認
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
