'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';

import { getProduct, updateProduct, deleteProduct } from '@/app/actions/products';
import { getDepots } from '@/app/actions/depots';
import { fetchVendors } from '@/app/actions/vendors';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ImageUpload } from '@/components/ui/image-upload';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { getCategoriesFlatForSelect } from '@/app/actions/categories';
import { ProductEditHistoryTabs } from '@/components/products/ProductEditHistoryTabs';

const ProductFormSchema = z.object({
  name: z.string().min(1, '商品名稱為必填').max(255),
  description: z.string().max(2000).optional().default(''),
  barcode: z.string().max(255).optional().default(''),
  sku: z.string().max(100).optional().default(''),
  price: z.coerce.number().positive('售價必須大於 0'),
  cost: z.coerce.number().nonnegative('成本必須大於等於 0').optional(),
  stock: z.coerce.number().nonnegative('庫存必須大於等於 0'),
  low_stock_threshold: z.coerce.number().nonnegative('低庫存門檻必須大於等於 0').default(5),
  category_id: z.string().optional().default(''),
  tax_type: z.enum(['taxable', 'tax_free', 'zero_rate']).default('taxable'),
  is_active: z.boolean().default(true),
  product_code: z.string().max(100).optional().default(''),
  whole_sell_price: z.coerce.number().nonnegative().optional().default(0),
  purchase_price: z.coerce.number().nonnegative().optional().default(0),
  vendor_id: z.string().optional().default(''),
  depot_id: z.string().optional().default(''),
  unit_name: z.string().optional().default(''),
});

type ProductFormData = z.infer<typeof ProductFormSchema>;

interface Category {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  vendor_code: string | null;
  vendor_name: string;
}

interface Depot {
  id: string;
  depot_code: string | null;
  depot_name: string;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  barcode: string | null;
  sku: string | null;
  price: number;
  cost: number | null;
  stock: number;
  low_stock_threshold: number;
  image_url: string | null;
  category_id: string | null;
  tax_type: 'taxable' | 'tax_free' | 'zero_rate';
  is_active: boolean;
  product_code?: string | null;
  whole_sell_price?: number | null;
  purchase_price?: number | null;
  vendor_id?: string | null;
  depot_id?: string | null;
}

interface EditProductPageProps {
  params: {
    id: string;
  };
}

export default function EditProductPage({ params }: EditProductPageProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);

  const form = useForm<ProductFormData>({
    resolver: zodResolver(ProductFormSchema),
    defaultValues: {
      name: '',
      description: '',
      barcode: '',
      sku: '',
      price: 0,
      cost: 0,
      stock: 0,
      low_stock_threshold: 5,
      category_id: '',
      tax_type: 'taxable',
      is_active: true,
      product_code: '',
      whole_sell_price: 0,
      purchase_price: 0,
      vendor_id: '',
      depot_id: '',
      unit_name: '',
    },
  });

  // Load product and categories
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load product
        const productData = await getProduct(params.id);
        setProduct(productData as any);

        // Set form values
        form.reset({
          name: productData.name,
          description: productData.description || '',
          barcode: productData.barcode || '',
          sku: productData.sku || '',
          price: productData.price,
          cost: productData.cost || 0,
          stock: productData.stock,
          low_stock_threshold: productData.low_stock_threshold,
          category_id: productData.category_id || '',
          tax_type: productData.tax_type,
          is_active: productData.is_active,
          product_code: (productData as any).product_code || '',
          whole_sell_price: (productData as any).whole_sell_price ?? 0,
          purchase_price: (productData as any).purchase_price ?? 0,
          vendor_id: (productData as any).vendor_id || '',
          depot_id: (productData as any).depot_id || '',
          unit_name: (productData as any).unit_name || '',
        });

        // Load categories and ERP options
        const [cats, depotsRes, vendorsRes] = await Promise.all([
          getCategoriesFlatForSelect(),
          getDepots(),
          fetchVendors({ pageSize: 500 }),
        ]);
        setCategories(cats);
        setDepots(depotsRes);
        setVendors(vendorsRes.vendors || []);

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '載入商品失敗');
        setIsLoading(false);
      }
    };

    loadData();
  }, [params.id, form]);

  const onSubmit = async (data: ProductFormData) => {
    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('description', data.description || '');
      formData.append('barcode', data.barcode || '');
      formData.append('sku', data.sku || '');
      formData.append('price', data.price.toString());
      formData.append('cost', (data.cost || 0).toString());
      formData.append('stock', data.stock.toString());
      formData.append('low_stock_threshold', data.low_stock_threshold.toString());
      formData.append('category_id', data.category_id || '');
      formData.append('tax_type', data.tax_type);
      formData.append('is_active', data.is_active.toString());
      formData.append('product_code', data.product_code || '');
      formData.append('whole_sell_price', String(data.whole_sell_price ?? 0));
      formData.append('purchase_price', String(data.purchase_price ?? 0));
      formData.append('vendor_id', data.vendor_id || '');
      formData.append('depot_id', data.depot_id || '');
      formData.append('unit_name', data.unit_name || '');
      formData.append('removeImage', removeImage.toString());

      if (imageFile) {
        formData.append('image', imageFile);
      }

      await updateProduct(params.id, formData);
      router.push('/dashboard/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新商品失敗');
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteProduct(params.id, false);
      router.push('/dashboard/products');
    } catch (err) {
      setError(err instanceof Error ? err.message : '刪除商品失敗');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center text-muted-foreground">載入中...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center text-destructive">商品未找到</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/dashboard/products" className="flex items-center text-primary hover:underline mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回商品列表
        </Link>
        <h1 className="text-3xl font-bold">編輯商品</h1>
        <p className="text-muted-foreground mt-2">
          修改商品資訊和庫存設定
        </p>
      </div>

      <div className="max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle>商品資訊</CardTitle>
            <CardDescription>更新商品的基本信息</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>商品名稱 *</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：iPhone 15 Pro"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Price */}
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>售價 (NT$) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Barcode */}
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>條碼</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="可選，商品條碼"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 單位 */}
                  <FormField
                    control={form.control}
                    name="unit_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>單位</FormLabel>
                        <FormControl>
                          <select
                            disabled={isSaving}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...field}
                          >
                            <option value="">請選擇單位</option>
                            <option value="個">個</option>
                            <option value="件">件</option>
                            <option value="組">組</option>
                            <option value="公尺">公尺</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>商品描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="輸入商品的詳細描述（可選）"
                          disabled={isSaving}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>提供關於此商品的更多信息</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Barcode */}
                  <FormField
                    control={form.control}
                    name="barcode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>條碼</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：4710178790699"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>商品的唯一條碼（可選）</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* SKU */}
                  <FormField
                    control={form.control}
                    name="sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SKU</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="例如：SKU-001"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>庫存單位代碼（可選）</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Cost */}
                  <FormField
                    control={form.control}
                    name="cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>成本 (NT$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>進貨成本（可選）</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Stock */}
                  <FormField
                    control={form.control}
                    name="stock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>庫存 *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Low Stock Threshold */}
                  <FormField
                    control={form.control}
                    name="low_stock_threshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>低庫存門檻</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="5"
                            disabled={isSaving}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>庫存警示門檻</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="product_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>商品代碼</FormLabel>
                        <FormControl>
                          <Input placeholder="選填" disabled={isSaving} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="whole_sell_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>批發價 (NT$)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" disabled={isSaving} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchase_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>採購單價 (NT$)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" disabled={isSaving} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendor_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>廠商</FormLabel>
                        <FormControl>
                          <select
                            disabled={isSaving}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...field}
                          >
                            <option value="">請選擇廠商</option>
                            {vendors.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.vendor_code ? `${v.vendor_code} ${v.vendor_name}` : v.vendor_name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="depot_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>倉庫</FormLabel>
                        <FormControl>
                          <select
                            disabled={isSaving}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            {...field}
                          >
                            <option value="">請選擇倉庫</option>
                            {depots.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.depot_name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Category */}
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>分類</FormLabel>
                        <FormControl>
                          <select
                            disabled={isSaving}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="">未分類</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </FormControl>
                        <FormDescription>選擇商品所屬的分類</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Tax Type */}
                  <FormField
                    control={form.control}
                    name="tax_type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>稅務類型</FormLabel>
                        <FormControl>
                          <select
                            disabled={isSaving}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            {...field}
                          >
                            <option value="taxable">應稅</option>
                            <option value="tax_free">免稅</option>
                            <option value="zero_rate">零稅率</option>
                          </select>
                        </FormControl>
                        <FormDescription>選擇適用的稅務類型</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Image Upload */}
                <FormField
                  control={form.control}
                  name="name"
                  render={() => (
                    <FormItem>
                      <FormLabel>商品圖片</FormLabel>
                      <FormControl>
                        <ImageUpload
                          value={removeImage ? null : product.image_url}
                          onChange={(file) => {
                            setImageFile(file);
                            if (file) setRemoveImage(false);
                          }}
                          accept="image/jpeg,image/png,image/webp"
                          maxSize={5 * 1024 * 1024}
                          disabled={isSaving}
                        />
                      </FormControl>
                      <FormDescription>上傳商品圖片（可選，最大 5MB）</FormDescription>
                    </FormItem>
                  )}
                />

                {/* Active Status */}
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        disabled={isSaving}
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded border border-input"
                      />
                      <div>
                        <FormLabel className="cursor-pointer">啟用此商品</FormLabel>
                        <FormDescription>停用後將無法在 POS 中選擇</FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex gap-4 pt-4">
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? '儲存中...' : '儲存變更'}
                  </Button>
                  <Link href="/dashboard/products">
                    <Button variant="outline" disabled={isSaving}>
                      取消
                    </Button>
                  </Link>

                  {/* Delete Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon" disabled={isSaving} className="ml-auto">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogTitle>刪除商品</AlertDialogTitle>
                      <AlertDialogDescription>
                        確認要刪除「{product.name}」嗎？此操作無法復原。
                      </AlertDialogDescription>
                      <div className="flex gap-4 justify-end">
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          刪除
                        </AlertDialogAction>
                      </div>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <ProductEditHistoryTabs productId={params.id} />
      </div>
    </div>
  );
}
