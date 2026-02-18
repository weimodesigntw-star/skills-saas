'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { z } from 'zod';

import { createSpecification } from '@/app/actions/specifications';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { SpecificationSchema } from '@/lib/validations/spec';

type SpecificationFormData = z.infer<typeof SpecificationSchema>;

export default function NewSpecificationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SpecificationFormData>({
    resolver: zodResolver(SpecificationSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      status: 'draft',
      tags: [],
      spec_data: {
        version: '1.0.0',
        fields: {},
      },
    },
  });

  const onSubmit = async (data: SpecificationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      await createSpecification(data);
      router.push('/dashboard/specifications');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create specification');
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <Link href="/dashboard/specifications" className="flex items-center text-primary hover:underline mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回規格列表
        </Link>
        <h1 className="text-3xl font-bold">建立新規格</h1>
        <p className="text-muted-foreground mt-2">
          定義產品規格的結構和內容
        </p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>規格資訊</CardTitle>
            <CardDescription>填寫規格的基本信息</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {error && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* Title */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>規格名稱 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：iPhone 15 Pro 規格"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>規格描述</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="輸入規格的詳細描述（可選）"
                          disabled={isLoading}
                          rows={4}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>提供關於此規格的更多信息</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Category */}
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>分類</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：電子產品、服飾等"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>用於組織和分類規格</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Status */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>狀態</FormLabel>
                      <FormControl>
                        <select
                          disabled={isLoading}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          {...field}
                        >
                          <option value="draft">草稿</option>
                          <option value="published">已發佈</option>
                          <option value="archived">已封存</option>
                        </select>
                      </FormControl>
                      <FormDescription>選擇規格的發佈狀態</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tags */}
                <FormField
                  control={form.control}
                  name="tags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>標籤</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="輸入標籤，用逗號分隔"
                          disabled={isLoading}
                          onChange={(e) => {
                            const tags = e.target.value
                              .split(',')
                              .map((tag) => tag.trim())
                              .filter((tag) => tag.length > 0);
                            field.onChange(tags);
                          }}
                          onBlur={field.onBlur}
                          value={field.value?.join(', ') || ''}
                        />
                      </FormControl>
                      <FormDescription>用於搜索和篩選的標籤</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Spec Data JSON Editor */}
                <FormField
                  control={form.control}
                  name="spec_data"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>規格數據 (JSON)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`{
  "version": "1.0.0",
  "fields": {
    "product_name": {
      "key": "product_name",
      "label": "產品名稱",
      "type": "text",
      "value": "iPhone 15 Pro",
      "required": true
    }
  }
}`}
                          disabled={isLoading}
                          rows={12}
                          className="font-mono text-xs"
                          onChange={(e) => {
                            try {
                              const json = JSON.parse(e.target.value);
                              field.onChange(json);
                            } catch {
                              // Allow invalid JSON while user is typing
                              field.onChange(e.target.value);
                            }
                          }}
                          onBlur={() => {
                            const current = field.value;
                            if (typeof current === 'string') {
                              try {
                                const json = JSON.parse(current);
                                field.onChange(json);
                              } catch {
                                // Keep invalid JSON as is
                              }
                            }
                            field.onBlur();
                          }}
                          value={typeof field.value === 'string' ? field.value : JSON.stringify(field.value, null, 2)}
                        />
                      </FormControl>
                      <FormDescription>
                        定義規格欄位的結構。參考文檔瞭解詳細的 JSON Schema 格式。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Form Actions */}
                <div className="flex gap-4">
                  <Button
                    type="submit"
                    disabled={isLoading}
                  >
                    {isLoading ? '建立中...' : '建立規格'}
                  </Button>
                  <Link href="/dashboard/specifications">
                    <Button variant="outline" disabled={isLoading}>
                      取消
                    </Button>
                  </Link>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
