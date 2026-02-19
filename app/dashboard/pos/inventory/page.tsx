import { redirect } from 'next/navigation';

/**
 * POS 庫存管理 — 重導向至商品管理頁面
 *
 * 庫存管理目前與商品管理共用同一頁面，
 * 此頁面自動將使用者重導向至 /dashboard/products。
 */
export default function InventoryPage() {
  redirect('/dashboard/products');
}
