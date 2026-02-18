'use client';

/**
 * Custom Hook: useBarcodeScanner
 *
 * Detects barcode scanner gun input by listening to rapid sequential keystrokes.
 * A barcode scanner typically sends input very quickly (< 50ms between keys).
 *
 * Features:
 * - Detects rapid sequential keyboard input
 * - Buffer clears after 200ms of no input
 * - Triggers callback when Enter is pressed after rapid input
 * - Does not interfere with regular typing in input fields
 *
 * @param callback Function called with scanned code when Enter is pressed
 * @returns Object with lastScannedCode and isScanning state
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { BARCODE_SCANNER_INTERVAL_MS } from '@/lib/constants';

interface UseBarcodesScannerReturn {
  lastScannedCode: string | null;
  isScanning: boolean;
}

export function useBarcodeScanner(
  callback?: (code: string) => void
): UseBarcodesScannerReturn {
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Buffer to accumulate keystrokes
  const bufferRef = useRef<string>('');
  // Track timing of keystrokes
  const lastKeystrokeRef = useRef<number>(0);
  // Flag to know if we're in "rapid input" mode
  const isRapidInputRef = useRef<boolean>(false);
  // Timer to clear buffer after no input
  const clearBufferTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear the buffer
  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    isRapidInputRef.current = false;
    setIsScanning(false);
  }, []);

  // Setup buffer clear timer
  const resetClearBufferTimer = useCallback(() => {
    if (clearBufferTimerRef.current) {
      clearTimeout(clearBufferTimerRef.current);
    }
    clearBufferTimerRef.current = setTimeout(() => {
      clearBuffer();
    }, 200);
  }, [clearBuffer]);

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea that's not a barcode field
      const target = event.target as HTMLElement;
      const isInputField =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;

      // Skip if it's a normal text input (but allow barcode-specific inputs)
      if (
        isInputField &&
        !target.classList.contains('barcode-input') &&
        !target.classList.contains('pos-barcode-field')
      ) {
        return;
      }

      const now = Date.now();
      const timeSinceLastKeystroke = now - lastKeystrokeRef.current;

      // Handle Enter key
      if (event.key === 'Enter') {
        // Only process if we have accumulated characters
        if (bufferRef.current.length > 0 && isRapidInputRef.current) {
          event.preventDefault();

          const scannedCode = bufferRef.current;
          setLastScannedCode(scannedCode);

          if (callback) {
            callback(scannedCode);
          }

          clearBuffer();
          return;
        }
      }

      // For other keys, check if input is rapid
      if (event.key.length === 1) {
        // This is a regular character

        // If it's the first keystroke or rapid enough, add to buffer
        if (timeSinceLastKeystroke < BARCODE_SCANNER_INTERVAL_MS) {
          // Rapid input detected
          isRapidInputRef.current = true;
          setIsScanning(true);
          bufferRef.current += event.key;
        } else if (bufferRef.current.length === 0) {
          // Start of a new potential scan
          bufferRef.current = event.key;
          isRapidInputRef.current = false;
        } else {
          // Too slow, reset
          clearBuffer();
          bufferRef.current = event.key;
        }

        lastKeystrokeRef.current = now;
        resetClearBufferTimer();
      }
    },
    [callback, clearBuffer, resetClearBufferTimer]
  );

  // Attach/detach event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (clearBufferTimerRef.current) {
        clearTimeout(clearBufferTimerRef.current);
      }
    };
  }, [handleKeyDown]);

  return {
    lastScannedCode,
    isScanning,
  };
}
