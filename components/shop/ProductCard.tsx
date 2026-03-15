'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNTD } from '@/lib/constants';
import { useTransition } from 'react';
import { useCart } from '@/lib/hooks/useCart';
import { toast } from '@/components/ui/toast';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    image_url: string | null;
    description?: string | null;
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const [isPending, startTransition] = useTransition();
  const { addToCart } = useCart();

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      try {
        await addToCart(
          {
            id: product.id,
            name: product.name,
            price: product.price,
            stock: product.stock,
            image_url: product.image_url,
          },
          1
        );
        toast.success(`已加入「${product.name}」`);
      } catch (err: any) {
        toast.error(err?.message || '加入購物車失敗');
      }
    });
  }

  return (
    <Link href={`/shop/${product.id}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className="relative aspect-square bg-muted overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-4xl">
              📦
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
              <span className="text-white font-semibold text-sm">已售完</span>
            </div>
          )}
          {product.stock > 0 && product.stock <= 5 && (
            <Badge className="absolute top-2 left-2 bg-amber-500 text-white">
              僅剩 {product.stock} 件
            </Badge>
          )}
        </div>
        <CardContent className="p-4 space-y-2">
          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <span className="text-lg font-bold text-primary">
              {formatNTD(product.price)}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={handleAddToCart}
              disabled={isPending || product.stock === 0}
            >
              <ShoppingCart className="h-3.5 w-3.5 mr-1" />
              {product.stock === 0 ? '已售完' : '加入購物車'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
