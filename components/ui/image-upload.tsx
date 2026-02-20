'use client';

import { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  value?: string | null;
  onChange: (file: File | null) => void;
  accept?: string;
  maxSize?: number; // in bytes
  disabled?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  accept = 'image/jpeg,image/png,image/webp',
  maxSize = 5 * 1024 * 1024, // 5MB
  disabled = false,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(value || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file size
    if (file.size > maxSize) {
      setError(`File size must be less than ${(maxSize / 1024 / 1024).toFixed(1)}MB`);
      return false;
    }

    // Check file type
    const acceptedTypes = accept.split(',').map((t) => t.trim());
    if (!acceptedTypes.some((type) => file.type.match(type))) {
      setError(`File type must be one of: ${accept}`);
      return false;
    }

    return true;
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const file = e.target.files?.[0];
      if (!file) {
        onChange(null);
        setPreview(value || null);
        return;
      }
      if (!validateFile(file)) return;
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
        onChange(file);
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [value, maxSize, accept, onChange]
  );

  const handleClear = useCallback(() => {
    setPreview(null);
    setError(null);
    onChange(null);
    fileInputRef.current?.value && (fileInputRef.current.value = '');
  }, [onChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!validateFile(file)) return;
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
        onChange(file);
        setIsLoading(false);
      };
      reader.readAsDataURL(file);
    },
    [maxSize, accept, onChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
      />
      {preview ? (
        <div className="relative inline-block">
          <div className="relative w-40 h-40 rounded-md border border-input overflow-hidden bg-muted">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-1 right-1 rounded-full bg-destructive/90 text-destructive-foreground p-1 hover:bg-destructive"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'flex flex-col items-center justify-center w-40 h-40 rounded-md border-2 border-dashed border-input bg-muted/50 hover:bg-muted transition-colors',
            isDragging && 'border-primary bg-primary/5',
            disabled && 'pointer-events-none opacity-50'
          )}
        >
          {isLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          ) : (
            <Upload className="w-8 h-8 text-muted-foreground" />
          )}
        </button>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
