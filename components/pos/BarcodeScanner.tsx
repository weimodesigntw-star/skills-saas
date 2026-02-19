'use client';

/**
 * Barcode Scanner Component (Mock Version)
 *
 * Currently implements a mock barcode scanner with:
 * - Full-screen overlay with camera viewfinder simulation
 * - Manual input field for typing/pasting barcodes
 * - Scan button to trigger the callback
 *
 * Future: Replace with html5-qrcode library for actual camera input
 */

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogOverlay } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
  const [barcode, setBarcode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleScan = () => {
    if (barcode.trim()) {
      onScan(barcode.trim());
      setBarcode('');
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full h-full max-w-none max-h-none p-0 border-0 rounded-none flex flex-col">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
          aria-label="Close"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Camera Viewfinder Simulation */}
        <div className="flex-1 bg-gradient-to-br from-gray-900 to-black flex items-center justify-center relative overflow-hidden">
          {/* Animated corner brackets */}
          <div className="absolute inset-8 border-2 border-green-500/50 rounded-lg pointer-events-none">
            {/* Top-left corner */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
            {/* Top-right corner */}
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
            {/* Bottom-left corner */}
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
            {/* Bottom-right corner */}
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
          </div>

          {/* Camera icon in center */}
          <div className="text-center z-5">
            <Camera className="h-16 w-16 text-green-500/50 mx-auto mb-4" />
            <p className="text-white/60 text-sm">對準條碼</p>
          </div>

          {/* Animated scan line */}
          <div className="absolute inset-8 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 animate-pulse">
              <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-green-500 to-transparent"></div>
            </div>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white dark:bg-slate-950 p-6 space-y-4 border-t">
          <h2 className="text-lg font-semibold text-center">掃描條碼</h2>

          <Input
            ref={inputRef}
            type="text"
            placeholder="輸入或掃描條碼..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-lg py-3"
            autoFocus
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12"
            >
              取消
            </Button>
            <Button
              onClick={handleScan}
              disabled={!barcode.trim()}
              className="flex-1 h-12 text-base font-semibold"
            >
              掃描
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
