'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { vendorSchema, type VendorFormValues } from '@/lib/schemas/vendor'
import { createVendor, updateVendor, fetchVendorById } from '@/app/actions/vendors'
import { toast } from '@/components/ui/toast'
import { useRouter } from 'next/navigation'

interface VendorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendorId?: string
}

export function VendorDialog({ open, onOpenChange, vendorId }: VendorDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const isEditing = !!vendorId

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendor_code: '',
      vendor_name: '',
      vendor_cat: '',
      uniform_num: '',
      currency: '台幣',
      tax_type: '',
      taxrate: 0.05,
      contact: '',
      phone: '',
      email: '',
      note: '',
    }
  })

  useEffect(() => {
    if (open && vendorId) {
      loadVendor()
    } else if (open && !vendorId) {
      form.reset({
        vendor_code: '',
        vendor_name: '',
        vendor_cat: '',
        uniform_num: '',
        currency: '台幣',
        tax_type: '',
        taxrate: 0.05,
        contact: '',
        phone: '',
        email: '',
        note: '',
      })
    }
  }, [open, vendorId])

  const loadVendor = async () => {
    if (!vendorId) return
    
    try {
      const vendor = await fetchVendorById(vendorId)
      if (vendor) {
        form.reset(vendor)
      }
    } catch (error) {
      toast.error('載入廠商資料失敗')
    }
  }

  const onSubmit = async (data: VendorFormValues) => {
    setIsLoading(true)
    
    try {
      const result = isEditing 
        ? await updateVendor(vendorId!, data)
        : await createVendor(data)
      
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(isEditing ? '廠商更新成功' : '廠商新增成功')
        onOpenChange(false)
        router.refresh()
      }
    } catch (error) {
      toast.error('操作失敗')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '編輯廠商' : '新增廠商'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_code">廠商代碼 *</Label>
              <Input
                id="vendor_code"
                {...form.register('vendor_code')}
                placeholder="請輸入廠商代碼"
              />
              {form.formState.errors.vendor_code && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.vendor_code.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_name">廠商名稱 *</Label>
              <Input
                id="vendor_name"
                {...form.register('vendor_name')}
                placeholder="請輸入廠商名稱"
              />
              {form.formState.errors.vendor_name && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.vendor_name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_cat">廠商類別</Label>
              <Input
                id="vendor_cat"
                {...form.register('vendor_cat')}
                placeholder="請輸入廠商類別"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="uniform_num">統一編號</Label>
              <Input
                id="uniform_num"
                {...form.register('uniform_num')}
                placeholder="請輸入統一編號"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">幣別</Label>
              <select
                id="currency"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.watch('currency')}
                onChange={(e) => form.setValue('currency', e.target.value)}
              >
                <option value="台幣">台幣</option>
                <option value="美元">美元</option>
                <option value="日幣">日幣</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_type">稅別</Label>
              <select
                id="tax_type"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.watch('tax_type') || ''}
                onChange={(e) => form.setValue('tax_type', e.target.value)}
              >
                <option value="">選擇稅別</option>
                <option value="稅內含">稅內含</option>
                <option value="稅外加">稅外加</option>
                <option value="免稅">免稅</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxrate">稅率</Label>
              <Input
                id="taxrate"
                type="number"
                step="0.001"
                min="0"
                max="1"
                {...form.register('taxrate')}
                placeholder="0.05"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact">聯絡人</Label>
              <Input
                id="contact"
                {...form.register('contact')}
                placeholder="請輸入聯絡人"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">電話</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder="請輸入電話"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="請輸入Email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-red-500">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">備註</Label>
            <Textarea
              id="note"
              {...form.register('note')}
              placeholder="請輸入備註"
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? '處理中...' : (isEditing ? '更新' : '新增')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}