import type { KeyboardEvent } from 'react';

/**
 * O-007：表單內按 Enter 時跳到下一個可聚焦欄位（類 Tab），避免誤觸送出行為混亂。
 * - 略過 textarea（保留換行）
 * - 唯讀 input：Enter 會跳到下一欄（略過預覽欄位）
 * - 最後一個欄位：不攔截，保留瀏覽器預設（通常為提交表單）
 */
export function onFormEnterFocusNext(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== 'Enter') return;
  const el = e.target as HTMLElement;
  if (el.tagName === 'TEXTAREA') return;

  const fields = Array.from(
    e.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]), select, textarea'
    )
  ).filter((n) => !n.disabled);

  const idx = fields.indexOf(el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement);
  if (idx < 0) return;
  if (idx >= fields.length - 1) return;

  e.preventDefault();
  fields[idx + 1]?.focus();
}
