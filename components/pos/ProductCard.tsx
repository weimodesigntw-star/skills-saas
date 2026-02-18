/**
 * POS 商品卡片
 *
 * 顯示單個商品的卡片元件
 * 包含圖片、名稱、價格、庫存狀態
 * 支援點擊加入購物車，附帶動畫回饋
 */

'use client';

import Image from 'next/image';
import { usePosStore } from '@/store/usePosStore';
import { formatNTD } from '@/lib/constants';
import { Product } from '@/lib/types/pos';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = usePosStore();

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock < product.low_stock_threshold;

  const handleClick = () => {
    if (!isOutOfStock) {
      addToCart(product);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isOutOfStock}
      className={cn(
        'group relative min-h-[140px] min-w-[120px] rounded-lg border bg-card p-3 flex flex-col gap-2 transition-all duration-200',
        'hover:shadow-md',
        !isOutOfStock && 'hover:scale-95 hover:ring-2 hover:ring-primary cursor-pointer active:scale-90',
        isOutOfStock && 'opacity-50 cursor-not-allowed'
      )}
    >
      {/* 商品圖片 */}
      <div className="relative h-24 w-full overflow-hidden rounded bg-muted flex items-center justify-center">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            loading="lazy"
          />
        ) : (
          <div className="text-xs text-muted-foreground">無圖片</div>
        )}
      </div>

      {/* 商品名稱 */}
      <div className="flex-1 min-h-[2.5rem]">
        <p
          className="text-sm font-medium text-foreground line-clamp-2 leading-tight"
          title={product.name}
        >
          {product.name}
        </p>
      </div>

      {/* 商品價格 */}
      <div className="text-lg font-bold text-primary">
        {formatNTD(product.price)}
      </div>

      {/* 庫存徽章 */}
      {isOutOfStock && (
        <Badge variant="secondary" className="w-full justify-center text-xs">
          缺貨
        </Badge>
      )}

      {isLowStock && (
        <Badge variant="outline" className="w-full justify-center text-xs bg-orange-50 text-orange-700 border-orange-200">
          庫存低 ({product.stock})
        </Badge>
      )}

      {!isOutOfStock && !isLowStock && product.stock > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          庫存: {product.stock}
        </div>
      )}
    </button>
  );
}
