'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import {
  Type,
  ImageIcon,
  ChevronUp,
  ChevronDown,
  Trash2,
  Upload,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ContentBlock } from '@/app/actions/news';

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  onImageUpload?: (file: File) => Promise<string>;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function ContentBlockEditor({ blocks, onChange, onImageUpload }: ContentBlockEditorProps) {
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function addTextBlock() {
    onChange([
      ...blocks,
      { id: generateId(), type: 'text', content: '' },
    ]);
  }

  function addImageBlock() {
    onChange([
      ...blocks,
      { id: generateId(), type: 'image', imageUrl: '', caption: '', maxWidth: '', align: 'center' },
    ]);
  }

  function updateBlock(id: string, updates: Partial<ContentBlock>) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
  }

  function moveBlock(id: string, direction: 'up' | 'down') {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const newBlocks = [...blocks];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return;
    [newBlocks[idx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[idx]];
    onChange(newBlocks);
  }

  async function handleBlockImageUpload(blockId: string, file: File) {
    if (!onImageUpload) return;
    setUploadingBlockId(blockId);
    try {
      const url = await onImageUpload(file);
      updateBlock(blockId, { imageUrl: url });
    } catch (err: any) {
      alert(err.message || '圖片上傳失敗');
    } finally {
      setUploadingBlockId(null);
    }
  }

  function execCommand(command: string, value?: string) {
    document.execCommand(command, false, value);
  }

  return (
    <div className="space-y-4">
      {/* Add Block Buttons */}
      <div className="flex gap-3">
        <Button type="button" variant="default" size="sm" onClick={addTextBlock}>
          <Type className="h-4 w-4 mr-2" />
          新增消息段落
        </Button>
        <Button type="button" variant="default" size="sm" onClick={addImageBlock}>
          <ImageIcon className="h-4 w-4 mr-2" />
          新增圖片段落
        </Button>
      </div>

      {/* Blocks */}
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          className="border rounded-lg bg-card overflow-hidden"
        >
          {/* Block Header */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
            <div className="flex items-center gap-2 text-sm font-medium">
              {block.type === 'text' ? (
                <>
                  <Type className="h-4 w-4" />
                  消息段落
                </>
              ) : (
                <>
                  <ImageIcon className="h-4 w-4" />
                  圖片段落
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => moveBlock(block.id, 'up')}
                disabled={idx === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => moveBlock(block.id, 'down')}
                disabled={idx === blocks.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={() => removeBlock(block.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Block Content */}
          <div className="p-4">
            {block.type === 'text' ? (
              <div className="space-y-2">
                {/* Simple Toolbar */}
                <div className="flex flex-wrap gap-1 p-2 border rounded-md bg-muted/30">
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                    title="粗體"
                  >
                    <Bold className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
                    title="斜體"
                  >
                    <Italic className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}
                    title="底線"
                  >
                    <Underline className="h-4 w-4" />
                  </button>
                  <div className="w-px bg-border mx-1" />
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }}
                    title="靠左"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }}
                    title="置中"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }}
                    title="靠右"
                  >
                    <AlignRight className="h-4 w-4" />
                  </button>
                  <div className="w-px bg-border mx-1" />
                  <button
                    type="button"
                    className="p-1.5 rounded hover:bg-muted"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const url = prompt('輸入連結網址:');
                      if (url) execCommand('createLink', url);
                    }}
                    title="插入連結"
                  >
                    <LinkIcon className="h-4 w-4" />
                  </button>
                </div>
                {/* Editable Area */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  className="min-h-[120px] p-3 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: block.content || '' }}
                  onBlur={(e) => {
                    updateBlock(block.id, { content: e.currentTarget.innerHTML });
                  }}
                />
              </div>
            ) : (
              <div className="space-y-3">
                {/* Image Upload / Preview */}
                <input
                  ref={(el) => { fileInputRefs.current[block.id] = el; }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleBlockImageUpload(block.id, file);
                    e.target.value = '';
                  }}
                />
                {block.imageUrl ? (
                  <div className="space-y-3">
                    <div className="relative max-w-lg mx-auto">
                      <Image
                        src={block.imageUrl}
                        alt={block.caption || '圖片'}
                        width={600}
                        height={400}
                        className="rounded-md object-contain w-full"
                        unoptimized
                      />
                    </div>
                    <div>
                      <Label>圖片說明:</Label>
                      <Input
                        value={block.caption || ''}
                        onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                        placeholder="圖片說明"
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div>
                        <Label>最大寬度 (px):</Label>
                        <Input
                          value={block.maxWidth || ''}
                          onChange={(e) => updateBlock(block.id, { maxWidth: e.target.value })}
                          placeholder="自動"
                          className="mt-1 w-28"
                        />
                      </div>
                      <div>
                        <Label>對齊方式:</Label>
                        <select
                          value={block.align || 'center'}
                          onChange={(e) => updateBlock(block.id, { align: e.target.value })}
                          className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="left">靠左</option>
                          <option value="center">置中</option>
                          <option value="right">靠右</option>
                        </select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => updateBlock(block.id, { imageUrl: '' })}
                    >
                      移除圖片
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[block.id]?.click()}
                    disabled={uploadingBlockId === block.id}
                    className="flex flex-col items-center justify-center w-full h-48 rounded-lg border-2 border-dashed border-input bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  >
                    {uploadingBlockId === block.id ? (
                      <span className="text-sm text-muted-foreground">上傳中...</span>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">點擊上傳圖片</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
