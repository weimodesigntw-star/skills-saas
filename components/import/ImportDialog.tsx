'use client';

import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { downloadProductTemplate, downloadMemberTemplate } from './templateExcel';
import {
  importProducts,
  importMembers,
  type ImportProductRow,
  type ImportMemberRow,
  type ImportResult,
} from '@/app/actions/import';
import { toast } from '@/components/ui/toast';
import { FileDown, Upload, Loader2 } from 'lucide-react';

type Step = 'upload' | 'preview' | 'importing' | 'done';
type ImportType = 'products' | 'members';

interface ImportDialogProps {
  type: ImportType;
  trigger?: React.ReactNode;
}

export function ImportDialog({ type, trigger }: ImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const typeLabel = type === 'products' ? '產品資料' : '客戶資料';

  const parseFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheetName = type === 'products' ? '產品資料' : '客戶資料';
          const ws = wb.Sheets[sheetName] ?? wb.Sheets[wb.SheetNames[0]];
          if (!ws) {
            toast.error('Excel 中找不到工作表');
            return;
          }

          // 自動偵測「產品名稱」或「客戶名稱」所在的標題列
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
          const targetHeader = type === 'products' ? '產品名稱' : '客戶名稱';
          const headerRowIndex = rawRows.findIndex(
            (row) => Array.isArray(row) && row.includes(targetHeader)
          );

          if (headerRowIndex === -1) {
            toast.error(`找不到「${targetHeader}」欄位，請確認 Excel 格式`);
            return;
          }

          const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
            range: headerRowIndex,
          });

          if (!parsed.length) {
            toast.error('沒有資料列，請確認標題列下方有資料');
            return;
          }

          setRows(parsed);
          setStep('preview');
        } catch (err) {
          toast.error('解析失敗，請確認為 .xlsx 格式');
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [type]
  );

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file?.name?.endsWith?.('.xlsx') || file?.name?.endsWith?.('.xls'))
      parseFile(file);
    else toast.error('請上傳 .xlsx 或 .xls 檔案');
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const downloadTemplate = () => {
    type === 'products' ? downloadProductTemplate() : downloadMemberTemplate();
    toast.success('範本已下載');
  };

  const handleImport = async () => {
    setStep('importing');
    setResult(null);
    try {
      if (type === 'products') {
        const res = await importProducts(rows as unknown as ImportProductRow[]);
        if ('error' in res) {
          toast.error(res.error);
          setStep('preview');
          return;
        }
        setResult(res);
        toast.success(`產品匯入完成：成功 ${res.success} 筆，失敗 ${res.failed} 筆`);
      } else {
        const res = await importMembers(rows as unknown as ImportMemberRow[]);
        if ('error' in res) {
          toast.error(res.error);
          setStep('preview');
          return;
        }
        setResult(res);
        toast.success(`客戶匯入完成：成功 ${res.success} 筆，失敗 ${res.failed} 筆`);
      }
      setStep('done');
    } catch {
      toast.error('匯入發生錯誤');
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('upload');
    setRows([]);
    setResult(null);
    setOpen(false);
  };

  const columns = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            匯入 Excel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>匯入 {typeLabel}</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground hover:border-primary/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <p className="mb-2">將 Excel 檔案拖放到此處，或點擊下方選擇檔案</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
                id="import-file"
              />
              <Button variant="outline" onClick={() => document.getElementById('import-file')?.click()}>
                選擇檔案
              </Button>
            </div>
            <Button variant="ghost" onClick={downloadTemplate}>
              <FileDown className="h-4 w-4 mr-2" />
              下載範本
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              共 <strong>{rows.length}</strong> 筆，以下預覽前 5 筆：
            </p>
            <div className="overflow-x-auto rounded border max-h-60">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    {columns.map((col) => (
                      <th key={col} className="text-left py-2 px-3 font-semibold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t">
                      {columns.map((col) => (
                        <td key={col} className="py-2 px-3 whitespace-nowrap">
                          {String(row[col] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>
                重新選擇
              </Button>
              <Button onClick={handleImport}>確認匯入全部</Button>
            </DialogFooter>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p>匯入中… 請稍候</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4">
            <p className="text-sm">✅ 成功 <strong>{result.success}</strong> 筆</p>
            <p className="text-sm">❌ 失敗 <strong>{result.failed}</strong> 筆</p>
            {result.errors?.length ? (
              <div className="text-sm text-muted-foreground max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <p key={i} className="truncate">⚠️ {e}</p>
                ))}
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={reset}>關閉</Button>
              <Button variant="outline" onClick={() => { setStep('upload'); setRows([]); setResult(null); }}>
                再匯入一筆
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
