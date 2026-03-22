/**
 * POS Settings Page
 *
 * POS 模組設定頁面：
 * - 發票字軌管理（新增、編輯、停用）
 * - 字軌進度條顯示
 * - ECPay 連接狀態檢查
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { Plus, CheckCircle2, AlertCircle, PowerOff } from 'lucide-react';
import { getUserTracks, addTrack, activateTrack, deactivateTrack } from '@/app/actions/invoice-tracks';
import { createClient } from '@/lib/supabase/client';
import { Link2 } from 'lucide-react';

// ============================================
// Form Schema
// ============================================

const TrackFormSchema = z.object({
  trackPrefix: z
    .string()
    .length(2, '前綴必須為 2 個大寫英文字母')
    .regex(/^[A-Z]{2}$/, '前綴必須為大寫英文字母'),
  yearMonth: z
    .string()
    .length(5, '期別格式: YYMM (e.g. 11502 for 114年1-2月)'),
  startNumber: z.coerce.number().int().positive('起始號碼必須為正整數'),
  endNumber: z.coerce.number().int().positive('結束號碼必須為正整數'),
});

type TrackFormData = z.infer<typeof TrackFormSchema>;

interface InvoiceTrack {
  id: string;
  user_id: string;
  track_prefix: string;
  year_month: string;
  start_number: number;
  end_number: number;
  current_number: number;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const [tracks, setTracks] = useState<InvoiceTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [easyStoreUserId, setEasyStoreUserId] = useState<string | null>(null);
  const [easyStoreConnected, setEasyStoreConnected] = useState(false);
  const [easyStoreShop, setEasyStoreShop] = useState<string | null>(null);
  const [easyStoreVerifying, setEasyStoreVerifying] = useState(false);
  const [easyStoreVerifyOk, setEasyStoreVerifyOk] = useState<boolean | null>(null);
  const [easyStoreVerifyMessage, setEasyStoreVerifyMessage] = useState<string | null>(null);

  // ECPay Status
  const ecpayConfigured = !!process.env.NEXT_PUBLIC_ECPAY_MERCHANT_ID;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TrackFormData>({
    resolver: zodResolver(TrackFormSchema),
  });

  // Load tracks
  const loadTracks = async () => {
    try {
      setLoading(true);
      const result = await getUserTracks();
      setTracks(result);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '載入失敗';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEasyStoreUserId(data.user?.id ?? null);

      // 查 DB 確認是否已連結 EasyStore
      if (data.user?.id) {
        supabase
          .from('easystore_integrations')
          .select('shop')
          .eq('user_id', data.user.id)
          .maybeSingle()
          .then(({ data: integration }) => {
            if (integration?.shop) {
              setEasyStoreConnected(true);
              setEasyStoreShop(integration.shop);
            }
          });
      }
    });
    const params = new URLSearchParams(window.location.search);
    if (params.get('easystore') === 'connected') setEasyStoreConnected(true);
  }, []);

  const handleEasyStoreVerify = async () => {
    setEasyStoreVerifying(true);
    setEasyStoreVerifyOk(null);
    setEasyStoreVerifyMessage(null);
    try {
      const res = await fetch('/api/easystore/verify-token');
      const data = await res.json();
      if (data.ok) {
        setEasyStoreVerifyOk(true);
        setEasyStoreVerifyMessage('Connected');
      } else {
        setEasyStoreVerifyOk(false);
        setEasyStoreVerifyMessage(typeof data.error === 'string' ? data.error : 'Token 無效，請重新授權');
      }
    } catch {
      setEasyStoreVerifyOk(false);
      setEasyStoreVerifyMessage('網路錯誤');
    } finally {
      setEasyStoreVerifying(false);
    }
  };

  const handleEasyStoreConnect = () => {
    if (!easyStoreUserId) {
      toast.error('請先登入');
      return;
    }
    const clientId =
      process.env.NEXT_PUBLIC_EASYSTORE_CLIENT_ID || process.env.EASYSTORE_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    if (!clientId) {
      toast.error('缺少 NEXT_PUBLIC_EASYSTORE_CLIENT_ID');
      return;
    }
    const redirectUri = encodeURIComponent(`${appUrl}/api/easystore/callback`);
    const scopes = 'read_orders,read_customers,read_products,write_products';
    window.location.href = `https://admin.easystore.co/oauth/authorize?app_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${easyStoreUserId}`;
  };

  // Add new track
  const onSubmit = async (data: TrackFormData) => {
    try {
      setSubmitting(true);
      const result = await addTrack(
        data.trackPrefix,
        data.yearMonth,
        data.startNumber,
        data.endNumber
      );

      toast.success('字軌已新增');
      reset();
      loadTracks();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '新增失敗';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle track status
  const handleToggleStatus = async (trackId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await deactivateTrack(trackId);
        toast.success('字軌已停用');
      } else {
        await activateTrack(trackId);
        toast.success('字軌已啟用');
      }
      loadTracks();
    } catch (error) {
      const msg = error instanceof Error ? error.message : '操作失敗';
      toast.error(msg);
    }
  };

  const calculateProgress = (track: InvoiceTrack): number => {
    const used = track.current_number - track.start_number + 1;
    const total = track.end_number - track.start_number + 1;
    return Math.max(0, Math.min(100, (used / total) * 100));
  };

  const getRemainingCount = (track: InvoiceTrack): number => {
    return Math.max(0, track.end_number - track.current_number);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">POS 設定</h1>
        <p className="text-muted-foreground mt-2">管理發票字軌和支付設定</p>
      </div>

      {/* EasyStore Connect */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            EasyStore 串接
          </CardTitle>
        </CardHeader>
        <CardContent>
          {easyStoreConnected ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-green-700">已連結 EasyStore</p>
                  {easyStoreShop && (
                    <p className="text-xs text-muted-foreground">{easyStoreShop}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={handleEasyStoreConnect}>
                  重新授權
                </Button>
                <Button variant="secondary" size="sm" onClick={handleEasyStoreVerify} disabled={easyStoreVerifying}>
                  {easyStoreVerifying ? '驗證中…' : '驗證連線'}
                </Button>
              </div>
              {easyStoreVerifyOk === true && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {easyStoreVerifyMessage ?? '連線正常'}
                </p>
              )}
              {easyStoreVerifyOk === false && easyStoreVerifyMessage && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {easyStoreVerifyMessage}
                </p>
              )}
            </div>
          ) : (
            <div>
              <Button variant="outline" onClick={handleEasyStoreConnect}>
                連結 EasyStore 商店
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                授權後會回到本系統並顯示已連結狀態。
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ECPay Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {ecpayConfigured ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            )}
            ECPay 電子發票設定
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground">連接狀態</Label>
              <div className="flex items-center gap-2">
                <Badge
                  variant={ecpayConfigured ? 'success' : 'warning'}
                >
                  {ecpayConfigured ? '已設定' : '尚未設定'}
                </Badge>
                {!ecpayConfigured && (
                  <span className="text-xs text-muted-foreground">
                    請設定環境變數: ECPAY_MERCHANT_ID, ECPAY_HASH_KEY, ECPAY_HASH_IV
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">商家 ID</Label>
              <div className="font-mono text-sm p-2 bg-muted rounded-md">
                {process.env.NEXT_PUBLIC_ECPAY_MERCHANT_ID || 'N/A'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add New Track Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            新增發票字軌
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Prefix */}
              <div className="space-y-2">
                <Label htmlFor="track-prefix">
                  字軌前綴 *
                  {errors.trackPrefix && (
                    <span className="ml-2 text-destructive text-xs">
                      {errors.trackPrefix.message}
                    </span>
                  )}
                </Label>
                <Input
                  id="track-prefix"
                  type="text"
                  placeholder="AB"
                  maxLength={2}
                  {...register('trackPrefix')}
                />
              </div>

              {/* Year Month */}
              <div className="space-y-2">
                <Label htmlFor="year-month">
                  期別 *
                  {errors.yearMonth && (
                    <span className="ml-2 text-destructive text-xs">
                      {errors.yearMonth.message}
                    </span>
                  )}
                </Label>
                <Input
                  id="year-month"
                  type="text"
                  placeholder="11502"
                  maxLength={5}
                  {...register('yearMonth')}
                />
                <p className="text-xs text-muted-foreground">
                  格式: YYMM (例: 11502 = 114年1-2月)
                </p>
              </div>

              {/* Start Number */}
              <div className="space-y-2">
                <Label htmlFor="start-number">
                  起始號碼 *
                  {errors.startNumber && (
                    <span className="ml-2 text-destructive text-xs">
                      {errors.startNumber.message}
                    </span>
                  )}
                </Label>
                <Input
                  id="start-number"
                  type="number"
                  placeholder="1"
                  {...register('startNumber')}
                />
              </div>

              {/* End Number */}
              <div className="space-y-2">
                <Label htmlFor="end-number">
                  結束號碼 *
                  {errors.endNumber && (
                    <span className="ml-2 text-destructive text-xs">
                      {errors.endNumber.message}
                    </span>
                  )}
                </Label>
                <Input
                  id="end-number"
                  type="number"
                  placeholder="100000000"
                  {...register('endNumber')}
                />
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? '新增中...' : '新增字軌'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Existing Tracks */}
      <Card>
        <CardHeader>
          <CardTitle>已配置的字軌</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center text-muted-foreground py-8">
              載入中...
            </div>
          ) : tracks.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              尚無字軌，請先新增
            </div>
          ) : (
            <div className="space-y-4">
              {tracks.map((track) => {
                const progress = calculateProgress(track);
                const remaining = getRemainingCount(track);
                const total = track.end_number - track.start_number + 1;

                return (
                  <div
                    key={track.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">
                          {track.track_prefix} 字軌 ({track.year_month})
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          號碼範圍: {track.start_number.toLocaleString()} ~ {track.end_number.toLocaleString()}
                        </p>
                      </div>

                      <Badge
                        variant={track.is_active ? 'success' : 'outline'}
                      >
                        {track.is_active ? '使用中' : '已停用'}
                      </Badge>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>已用號碼</span>
                        <span>
                          {track.current_number - track.start_number + 1} / {total}
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-primary h-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        剩餘 {remaining.toLocaleString()} 個號碼
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStatus(track.id, track.is_active)}
                      >
                        <PowerOff className="h-4 w-4 mr-2" />
                        {track.is_active ? '停用' : '啟用'}
                      </Button>

                      {remaining < 1000 && track.is_active && (
                        <Badge variant="warning" className="ml-auto">
                          號碼將盡，請準備新字軌
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">電子發票說明</h3>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• 字軌前綴由財政部核配，通常為 2 個大寫英文字母</li>
            <li>• 期別格式為 YYMM (例: 11502 = 114年1-2月)</li>
            <li>• 每個字軌可配置一個號碼範圍，建議配置 1-100000000</li>
            <li>• 發票開立時自動遞增號碼，每次開立會使用一個號碼</li>
            <li>• 當剩餘號碼少於 1000 時，建議提早申請新字軌</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
