/**
 * CategoryActionMenu - 分類操作選單
 * 
 * 使用 DropdownMenu 提供：
 * - Edit（編輯）
 * - Add Sub-category（新增子分類）
 * - Delete（刪除）
 */

'use client';

import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CategoryActionMenuProps {
  onEdit: () => void;
  onAddSubCategory: () => void;
  onDelete: () => void;
}

export function CategoryActionMenu({
  onEdit,
  onAddSubCategory,
  onDelete,
}: CategoryActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="h-3.5 w-3.5" />
          <span className="sr-only">開啟選單</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          編輯
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onAddSubCategory}>
          <Plus className="mr-2 h-4 w-4" />
          新增子分類
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          刪除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
