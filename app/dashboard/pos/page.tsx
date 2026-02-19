/**
 * POS 銷售主畫面
 *
 * 左右分割佈局：
 * - 左側 65%：商品分類、搜尋、商品網格
 * - 右側 35%：購物車、金額摘要、結帳按鈕
 *
 * 響應式：
 * - 桌面 (>= 1280px)：左右分割
 * - 平板 (768-1279px)：上下佈局或側邊欄隱藏
 * - 手機 (< 768px)：全螢幕商品 + 底部工單
 *
 * Features:
 * - Barcode scanner gun support
 * - Multi-step checkout flow
 * - Invoice information capture
 */

'use client';

import { useEffect, useState } from 'react';
import { CategoryTabs } from '@/components/pos/CategoryTabs';
import { SearchBar } from '@/components/pos/SearchBar';
import { ProductGrid } from '@/components/pos/ProductGrid';
import { CartSection } from '@/components/pos/CartSection';
import { BarcodeScanner } from '@/components/pos/BarcodeScanner';
import { CheckoutDialog } from '@/components/pos/CheckoutDialog';
import { Sheet, SheetContent, SheetTrigger } from 'A/components/ui/sheet';
import { Button } from 'A/components/ui/button';
import { ShoppingCart, Barcode } from 'lucide-react';
import { usePosStore } from '@/store/usePosStore';
import { useBarcodeScanner } from '@/lib/hooks/useBarcodeScanner';
import { toast } from '@/components/ui/toast';
import { fetchProductByBarcode } from '@/app/actions/pos';

export default function PosPage() {
  const { cart, isScannerOpen, isCheckoutOpen, addToCart, setScannerOpen, setCheckoutOpen } = usePosStore();
  const [isScanning, setIsScanning] = useState(false);

  // Setup barcode scanner gun listener
  const { lastScannedCode } = useBarcodeScanner(async (code) => {
    await handleBarcodeScanned(code);
  });

  // Handle barcode scanned from scanner (gun or dialog)
  const handleBarcodeScanned = async (barcode: string) => {
    if (!barcode.trim()) {
      return;
    }

    try {
      setIsScanning(true);
      const product = await fetchProductByBarcode(barcode);

      if (product) {
        addToCart(product);
        toast.success(`已加入 ${product.name}`);
      } else {
        toast.error('查無此商品');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '掃碼失敗';
      toast.error(message);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle barcode scanner dialog
  const handleBarcodeScan = async (code: string) => {
    await handleBarcodeScanned(code);
    setScannerOpen(false);
  };

  return (
    <>
      <div className="h-full w-full flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* 左側：商品區 (桌面 65%, 平板/手機全寬) */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* 分類、搜尋和掃碼 */}
          <div className="flex-shrink-0 px-4 py-3 space-y-3 border-b bg-card">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <CategoryTabs />
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScannerOpen(true)}
                disabled={isScanning}
                title="掃描條碼"
              >
                <Barcode className="h-5 w-5" />
              </Button>
            </div>
            <SearchBar />
          </div>

        {/* 商品網格 */}
        <div className="flex-1 overflow-auto px-4 py-4">
          <ProductGrid />
        </div>
      </div>

      {/* 右側：購物車 (桌面可覉, 平板/手機用 Sheet) */}

      {/* 桌面版購物車 (隱藏於 lg 以下) */}
      <div className="hidden lg:flex lg:w-[35%] lg:min-w0 lg:flex-col bg-card">
        <CartSection />
      </div>

      {/* 扮機/平板剈購物車 (�与—匕 Sheet+呈現) */}
      <div className="lg:hidden fixed bottom-6 right-6 z-40">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              size="lg"
              className="h-14 w-14 rounded-full shadow-lg relative"
            >
              <ShoppingCart className="h-6 w-6" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs flex items-center justify-center font-bold">
                  {cart.length}
                </span>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent
            side="bottom"
            className="h-[70vh] rounded-t-lg p-0"
          >
            <CartSection />
          </SheetContent>
        </Sheet>
      </div>
    </div>

      {/* Barcode Scanner Dialog */}
      <BarcodeScanner
        open={isScannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleBarcodeScan}
      />

      {/* Checkout Dialog */}
      <CheckoutDialog
        open={isCheckoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
(T��()�