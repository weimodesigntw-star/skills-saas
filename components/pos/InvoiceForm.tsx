'use client';

/**
 * Invoice Form Component
 *
 * 結帳流程中的發票資訊表單：
 * - B2C / B2B 切換
 * - 統編驗証（B2B）
 * - 載具選擇（互斥：選載具或捐贈）
 * - 愛心碼輸入
 *
 * 使用 React Hook Form + Zod 驗証
 * 透過 setInvoiceInfo 更新 POS Store
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { usePosStore } from '@/store/usePosStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { COMMON_DONATE_CODES } from '@/lib/constants';

// ============================================
// Form Schema
// ============================================

const InvoiceFormSchema = z.object({
  invoiceType: z.enum(['B2C', 'B2B']),
  buyerName: z.string().optional(),
  buyerIdentifier: z
    .string()
    .optional()
    .refine(
      (val) =>
        !val || /^\d{8}$/.test(val),
      '統編必須為 8 位數字'
    ),
  carrierType: z
    .enum(['phone_barcode', 'cert', 'member'])
    .nullable()
    .optional(),
  carrierId: z.string().nullable().optional(),
  enableDonate: z.boolean().optional(),
  donateCode: z
    .string()
    .nullable()
    .optional()
    .refine(
      (val) =>
        !val || /^\d{3,7}$/.test(val),
      '愛心碼必須為 3-7 位數字'
    ),
})
  .refine(
    (data) => {
      // B2B 必須有統編
      if (data.invoiceType === 'B2B' && !data.buyerIdentifier) {
        return false;
      }
      return true;
    },
    {
      message: '三聯式(B2B)必須填寫統編',
      path: ['buyerIdentifier'],
    }
  )
  .refine(
    (data) => {
      // 載具和捐贈互斥
      if (data.carrierType && data.enableDonate) {
        return false;
      }
      return true;
    },
    {
      message: '載具和捐贈不能同時選擇',
      path: ['donateCode'],
    }
  );

type InvoiceFormData = z.infer<typeof InvoiceFormSchema>;

interface InvoiceFormProps {
  onClose?: () => void;
}

export function InvoiceForm({ onClose }: InvoiceFormProps) {
  const { invoiceType, setInvoiceInfo } = usePosStore();
  const [enableDonate, setEnableDonate] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(InvoiceFormSchema),
    defaultValues: {
      invoiceType: (invoiceType as 'B2C' | 'B2B') || 'B2C',
      carrierType: null,
      enableDonate: false,
    },
  });

  const watchInvoiceType = watch('invoiceType');
  const watchCarrierType = watch('carrierType');

  const handleTypeChange = (type: 'B2C' | 'B2B') => {
    setValue('invoiceType', type);
    // 清除 B2B 特有欄位
    if (type === 'B2C') {
      setValue('buyerIdentifier', '');
      setValue('buyerName', '');
    }
  };

  const handleCarrierToggle = (type: string | null) => {
    setValue('carrierType', type as any);
    if (type) {
      setEnableDonate(false);
      setValue('enableDonate', false);
    }
  };

  const handleDonateToggle = () => {
    const newState = !enableDonate;
    setEnableDonate(newState);
    setValue('enableDonate', newState);
    if (newState) {
      setValue('carrierType', null);
      setValue('carrierId', null);
    } else {
      setValue('donateCode', null);
    }
  };

  const onSubmit = (data: InvoiceFormData) => {
    try {
      // 更新 POS Store
      setInvoiceInfo({
        invoiceType: data.invoiceType,
        buyerIdentifier: data.buyerIdentifier || '0000000000',
        carrierType: data.carrierType,
        carrierId: data.carrierId || null,
        donateCode: data.enableDonate ? data.donateCode : null,
      });

      toast.success('發票資訊已更新');
      onClose?.();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '更新失敗';
      toast.error(msg);
    }
  };

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">發票設定</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Invoice Type Toggle */}
          <div className="space-y-2">
            <Label>發票類型</Label>
            <div className="grid grid-cols-2 gap-2">
              {['B2C', 'B2B'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type as 'B2C' | 'B2B')}
                  className={`p-2 rounded-lg border-2 transition-all text-sm font-medium ${
                    watchInvoiceType === type
                      ? 'border-primary bg-primary/10'
                      : 'border-input hover:border-primary'
                  }`}
                >
                  {type === 'B2C' ? '二聯式(B2C)' : '三聯式(B2B)'}
                </button>
              ))}
            </div>
          </div>

          {/* B2B Fields */}
          {watchInvoiceType === 'B2B' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="buyer-identifier">
                  統一編號 *
                  {errors.buyerIdentifier && (
                    <span className="ml-2 text-destructive text-xs">
                      {errors.buyerIdentifier.message}
                    </span>
                  )}
                </Label>
                <Input
                  id="buyer-identifier"
                  type="text"
                  placeholder="8 位統編"
                  {...register('buyerIdentifier')}
                  maxLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="buyer-name">公司抬頭</Label>
                <Input
                  id="buyer-name"
                  type="text"
                  placeholder="公司名稱"
                  {...register('buyerName')}
                />
              </div>
            </>
          )}

          {/* Carrier Type Selection */}
          <div className="space-y-2">
            <Label>載具類型</Label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleCarrierToggle(null)}
                className={`p-2 rounded-lg border-2 transition-all text-sm text-left ${
                  watchCarrierType === null
                    ? 'border-primary bg-primary/10'
                    : 'border-input hover:border-primary'
                }`}
              >
                <span className="font-medium">不使用載具</span>
                <span className="text-xs text-muted-foreground block">列印紙本發票</span>
              </button>

              <button
                type="button"
                onClick={() => handleCarrierToggle('phone_barcode')}
                className={`p-2 rounded-lg border-2 transition-all text-sm text-left ${
                  watchCarrierType === 'phone_barcode'
                    ? 'border-primary bg-primary/10'
                    : 'border-input hover:border-primary'
                }`}
              >
                <span className="font-medium">手機條碼</span>
                <span className="text-xs text-muted-foreground block">格式: /XXXXXXXX</span>
              </button>

              <button
                type="button"
                onClick={() => handleCarrierToggle('cert')}
                className={`p-2 rounded-lg border-2 transition-all text-sm text-left ${
                  watchCarrierType === 'cert'
                    ? 'border-primary bg-primary/10'
                    : 'border-input hover:border-primary'
                }`}
              >
                <span className="font-medium">自然人憑證</span>
                <span className="text-xs text-muted-foreground block">2大寫字母 + 14 位數字</span>
              </button>
            </div>
          </div>

          {/* Carrier ID Input */}
          {watchCarrierType && (
            <div className="space-y-2">
              <Label htmlFor="carrier-id">
                {watchCarrierType === 'phone_barcode' ? '手機條碼號碼' : '自然人憑證號碼'}
                {errors.carrierId && (
                  <span className="ml-2 text-destructive text-xs">
                    {errors.carrierId.message}
                  </span>
                )}
              </Label>
              <Input
                id="carrier-id"
                type="text"
                placeholder={
                  watchCarrierType === 'phone_barcode' ? '/XXXXXXXX' : 'XXXXXXXXXXXX'
                }
                {...register('carrierId')}
              />
            </div>
          )}

          {/* Donate Toggle */}
          {!watchCarrierType && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleDonateToggle}
                className={`w-full p-3 rounded-lg border-2 transition-all text-sm text-left ${
                  enableDonate
                    ? 'border-primary bg-primary/10'
                    : 'border-input hover:border-primary'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">捐贈統一發票</span>
                  <Badge variant={enableDonate ? 'default' : 'outline'}>
                    {enableDonate ? '已啟用' : '未啟用'}
                  </Badge>
                </div>
              </button>

              {enableDonate && (
                <div className="space-y-2">
                  <Label htmlFor="donate-code">
                    愛心碼 *
                    {errors.donateCode && (
                      <span className="ml-2 text-destructive text-xs">
                        {errors.donateCode.message}
                      </span>
                    )}
                  </Label>
                  <Input
                    id="donate-code"
                    type="text"
                    placeholder="輸入 3-7 位愛心碼"
                    {...register('donateCode')}
                    maxLength={7}
                  />

                  {/* Common Donate Codes Suggestions */}
                  <div className="grid grid-cols-2 gap-2">
                    {COMMON_DONATE_CODES.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setValue('donateCode', item.code)}
                        className="p-2 rounded-md border border-input text-xs hover:bg-accent transition-colors text-left"
                      >
                        <div className="font-medium">{item.code}</div>
                        <div className="text-muted-foreground text-xs">{item.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full mt-6">
            確認發票資訊
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
