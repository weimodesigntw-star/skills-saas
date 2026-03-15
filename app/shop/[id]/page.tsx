'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Minus, Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatNTD } from '@/lib/constants';
import { getShopProductById } from '@/app/actions/shop';
import { useCart } from '@/lib/hooks/useCart';
import { toast } from '@/components/ui/toast';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  sku: string | null;
  barcode: string | null;
};

export default function ProductDetailPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const { addToCart } = useCart();

  useEffect(() => {
    async function load() {
      try {
        const data = await getShopProductById(params.id as string);
        setProduct(data);
      } catch {
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [params.id]);

  function handleAddToCart() {
    if (!product) return;
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
          quantity
        );
        toast.success(`已將 ${quantity} 件「${product.name}」加入購物車`);
      } catch (err: any) {
        toast.error(err?.message || '加入購物車失敗');
      }
    });
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        載入中...
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-bold mb-2">找不到商品</h2>
        <p className="text-muted-foreground mb-4">此商品可能已下架或不存在</p>
        <Button variant="outline" asChild>
          <Link href="/shop">返回商品目錄</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      {/* Back */}
      <Link
        href="/shop"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回商品目錄
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="relative aspect-square bg-muted rounded-xl overflow-hidden">
          {product.image_url ? (
            <Image
              src={product.image_url}
              alt={product.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">
              📦
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
            {product.sku && (
              <p className="text-sm text-muted-foreground">SKU: {product.sku}</p>
            )}
          </div>

          <div className="text-3xl font-bold text-primary">
            {formatNTD(product.price)}
          </div>

          {/* Stock */}
          <div>
            {product.stock > 10 ? (
              <Badge className="bg-emerald-100 text-emerald-700">有庫存</Badge>
            ) : product.stock > 0 ? (
              <Badge className="bg-amber-100 text-amber-700">僅剩 {product.stock} 件</Badge>
            ) : (
              <Badge variant="destructive">缺貨中</Badge>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="font-semibold mb-2">商品說明</h3>
              <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Quantity + Add to Cart */}
          {product.stock > 0 && (
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">數量</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    小計：{formatNTD(product.price * quantity)}
                  </span>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={isPending}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {isPending ? '加入中...' : '加入購物車'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
