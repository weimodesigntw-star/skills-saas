'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getProducts } from '@/app/actions/products';
import { formatNTD } from '@/lib/constants';

type ProductRow = {
  id: string;
  name: string;
  product_code?: string | null;
  purchase_price?: number | null;
};

export type ProductForPurchase = {
  id: string;
  name: string;
  product_code: string | null;
  unit_price: number;
};

interface PurchaseProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: ProductForPurchase) => void;
}

export function PurchaseProductPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: PurchaseProductPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getProducts({ search: search.trim() || undefined, limit: 30 })
      .then((res) => {
        setProducts((res.products as ProductRow[]) ?? []);
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [open, search]);

  const handleSelect = (p: ProductRow) => {
    const unit_price = Number(p.purchase_price) ?? 0;
    onSelect({
      id: p.id,
      name: p.name,
      product_code: p.product_code ?? null,
      unit_price,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>選擇商品（帶入採購單價）</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="搜尋商品名稱或代碼..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />
        <div className="flex-1 overflow-auto rounded border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-left py-2 px-3 font-semibold">商品代碼</th>
                <th className="text-left py-2 px-3 font-semibold">商品名稱</th>
                <th className="text-right py-2 px-3 font-semibold">採購單價</th>
                <th className="text-right py-2 px-3 font-semibold">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">載入中...</td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">無符合條件的商品</td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="py-2 px-3">{p.product_code ?? '—'}</td>
                    <td className="py-2 px-3 font-medium">{p.name}</td>
                    <td className="py-2 px-3 text-right">{formatNTD(Number(p.purchase_price) ?? 0)}</td>
                    <td className="py-2 px-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => handleSelect(p)}>選取</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
