'use client';

/**
 * 規格管理：列表、新增（名稱+選項）、AI 建議
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from '@/components/ui/toast';
import {
  getSpecifications,
  createSpecificationSimple,
  deleteSpecification,
  generateSpecWithAI,
  type SpecSuggestion,
} from '@/app/actions/specifications';
import { fetchAiQuota } from '@/app/actions/ai-quota';
import { AiQuotaBadge } from '@/components/ui/AiQuotaBadge';
import { FileText, Plus, Pencil, Trash2, Sparkles, Loader2, X } from 'lucide-react';

type SpecRow = { id: string; title: string; spec_data?: { fields?: Record<string, { options?: string[] }> }; status?: string };

function getOptionCount(spec: SpecRow): number {
  const fields = spec.spec_data?.fields;
  if (!fields || typeof fields !== 'object') return 0;
  return Object.values(fields).reduce((s, f) => s + (f?.options?.length ?? 0), 0);
}

export default function SpecificationsPage() {
  const [list, setList] = useState<SpecRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SpecSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [productName, setProductName] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [quota, setQuota] = useState<{ remaining: number; limit: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSpecifications({ limit: 100 });
      setList(Array.isArray(data) ? (data as unknown as SpecRow[]) : []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (addOpen) {
      fetchAiQuota().then((q) => setQuota(q ? { remaining: q.remaining, limit: q.limit } : null));
    }
  }, [addOpen]);

  const addOption = () => {
    const v = optionInput.trim();
    if (v && !options.includes(v)) {
      setOptions([...options, v]);
      setOptionInput('');
    }
  };

  const removeOption = (i: number) => {
    setOptions(options.filter((_, idx) => idx !== i));
  };

  const handleAiSuggest = async () => {
    const p = productName.trim() || name.trim();
    if (!p) {
      toast.error('請輸入商品名稱或規格名稱');
      return;
    }
    setAiLoading(true);
    setSuggestions([]);
    setSelectedSuggestions(new Set());
    const result = await generateSpecWithAI(p, categoryName.trim() || undefined);
    setAiLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    setSuggestions(result.specs);
  };

  const applySelectedSuggestions = () => {
    const selected = Array.from(selectedSuggestions).sort((a, b) => a - b);
    if (selected.length === 0) {
      toast.error('請至少勾選一項建議');
      return;
    }
    const first = suggestions[selected[0]];
    if (first) {
      setName(first.name);
      setOptions([...first.options]);
    }
    setSuggestions([]);
    setSelectedSuggestions(new Set());
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('請輸入規格名稱');
      return;
    }
    if (options.length === 0) {
      toast.error('請至少新增一個選項');
      return;
    }
    setSubmitLoading(true);
    const result = await createSpecificationSimple(name.trim(), options, categoryName.trim() || undefined);
    setSubmitLoading(false);
    if ('error' in result) {
      toast.error(result.error);
      return;
    }
    toast.success('已新增規格');
    setAddOpen(false);
    setName('');
    setOptions([]);
    setProductName('');
    setCategoryName('');
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除此規格？')) return;
    try {
      await deleteSpecification(id);
      toast.success('已刪除');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '刪除失敗');
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">規格管理</h1>
        <Button onClick={() => { setAddOpen(true); setName(''); setOptions([]); setSuggestions([]); }}>
          <Plus className="h-4 w-4 mr-2" />
          新增規格
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>規格列表</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="尚無規格"
              description="新增規格後可於商品上使用，或使用 AI 生成建議"
            />
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">規格名稱</th>
                    <th className="text-right p-3 font-medium">選項數</th>
                    <th className="text-left p-3 font-medium">狀態</th>
                    <th className="p-3 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((spec) => (
                    <tr key={spec.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{spec.title}</td>
                      <td className="p-3 text-right">{getOptionCount(spec)}</td>
                      <td className="p-3">
                        <Badge variant="secondary">{spec.status ?? 'draft'}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/dashboard/specifications/${spec.id}`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(spec.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新增規格</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>商品名稱（供 AI 建議用）</Label>
                <Input
                  placeholder="例：iPhone 保護殼"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>分類（選填）</Label>
                <Input
                  placeholder="例：電子配件"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={aiLoading || (quota !== null && quota.limit >= 0 && quota.remaining === 0)}
                onClick={handleAiSuggest}
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                AI 生成建議
              </Button>
              {quota && (
                <AiQuotaBadge remaining={quota.remaining} limit={quota.limit} />
              )}
              {quota && quota.limit >= 0 && quota.remaining === 0 && (
                <span className="text-xs text-red-500">今日配額已用完</span>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className="rounded-md border p-3 space-y-2">
                <Label>勾選要套用的建議</Label>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <label key={i} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.has(i)}
                        onChange={(e) => {
                          const next = new Set(selectedSuggestions);
                          if (e.target.checked) next.add(i);
                          else next.delete(i);
                          setSelectedSuggestions(next);
                        }}
                      />
                      <span className="text-sm">{s.name} [{s.options.join(', ')}]</span>
                    </label>
                  ))}
                </div>
                <Button type="button" size="sm" onClick={applySelectedSuggestions}>
                  套用選取
                </Button>
              </div>
            )}
            <div className="space-y-2">
              <Label>規格名稱 *</Label>
              <Input
                placeholder="例：顏色、尺寸"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>選項 *（輸入後 Enter 或按新增）</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="輸入選項後 Enter"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                />
                <Button type="button" variant="outline" onClick={addOption}>新增</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {options.map((opt, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-sm">
                    {opt}
                    <button type="button" onClick={() => removeOption(i)} className="hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={submitLoading || !name.trim() || options.length === 0}>
              {submitLoading ? '新增中…' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
