'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { memberSchema, type MemberFormValues } from '@/lib/schemas/member';
import type { CustomerMember } from '@/app/actions/customer-members';
import { toast } from '@/components/ui/toast';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: CustomerMember | null;
  onSuccess: () => void;
};

export function MemberDialog({ open, onOpenChange, member, onSuccess }: Props) {
  const isEdit = !!member;

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      birthday: '',
      note: '',
      client_code: '',
      uniform_num: '',
      currency: '台幣',
      tax_type: '',
      taxrate: 0.05,
      prepaid: 0,
      client_cat: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (member) {
        form.reset({
          name: member.name,
          phone: member.phone ?? '',
          email: member.email ?? '',
          birthday: member.birthday ?? '',
          note: member.note ?? '',
          client_code: member.client_code ?? '',
          uniform_num: member.uniform_num ?? '',
          currency: member.currency ?? '台幣',
          tax_type: member.tax_type ?? '',
          taxrate: member.taxrate ?? 0.05,
          prepaid: member.prepaid ?? 0,
          client_cat: member.client_cat ?? '',
        });
      } else {
        form.reset({
          name: '',
          phone: '',
          email: '',
          birthday: '',
          note: '',
          client_code: '',
          uniform_num: '',
          currency: '台幣',
          tax_type: '',
          taxrate: 0.05,
          prepaid: 0,
          client_cat: '',
        });
      }
    }
  }, [open, member, form]);

  async function onSubmit(values: MemberFormValues) {
    const { createMember, updateMember } = await import('@/app/actions/customer-members');
    const result = isEdit
      ? await updateMember(member!.id, values)
      : await createMember(values);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success(isEdit ? '已更新會員' : '已新增會員');
    onOpenChange(false);
    onSuccess();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '編輯會員' : '新增會員'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>姓名 *</FormLabel>
                  <FormControl>
                    <Input placeholder="王小明" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>電話</FormLabel>
                  <FormControl>
                    <Input placeholder="0912345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="a@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="birthday"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>生日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea placeholder="選填" rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">ERP 客戶資料（選填）</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>客戶代碼</FormLabel>
                      <FormControl>
                        <Input placeholder="客戶代碼" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="uniform_num"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>統一編號</FormLabel>
                      <FormControl>
                        <Input placeholder="統一編號" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>幣別</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        >
                          <option value="台幣">台幣</option>
                          <option value="美元">美元</option>
                          <option value="日幣">日幣</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tax_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>稅別</FormLabel>
                      <FormControl>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          value={field.value ?? ''}
                          onChange={(e) => field.onChange(e.target.value)}
                        >
                          <option value="">選擇稅別</option>
                          <option value="稅內含">稅內含</option>
                          <option value="稅外加">稅外加</option>
                          <option value="免稅">免稅</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxrate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>稅率</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          max={1}
                          placeholder="0.05"
                          value={field.value ?? 0.05}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          onChange={(e) => field.onChange(e.target.value === '' ? 0.05 : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prepaid"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>預收款</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder="0"
                          value={field.value ?? 0}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          onChange={(e) => field.onChange(e.target.value === '' ? 0 : Number(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_cat"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>客戶類別</FormLabel>
                      <FormControl>
                        <Input placeholder="客戶類別" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? '處理中...' : isEdit ? '儲存' : '新增'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
