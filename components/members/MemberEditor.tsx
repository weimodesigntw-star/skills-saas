'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Crown,
  Shield,
  UserCheck,
  UserX,
  Calendar,
  Clock,
  Zap,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { updateMember, toggleMemberActive, type Member } from '@/app/actions/members';

interface MemberEditorProps {
  member: Member;
}

export function MemberEditor({ member: initialMember }: MemberEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [member, setMember] = useState<Member>(initialMember);
  const [isSaved, setIsSaved] = useState(false);

  // Form state
  const [fullName, setFullName] = useState(member.full_name || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [tier, setTier] = useState(member.tier);
  const [role, setRole] = useState(member.role);
  const [notes, setNotes] = useState(member.notes || '');

  function handleSave() {
    startTransition(async () => {
      try {
        await updateMember(member.id, {
          full_name: fullName || undefined,
          phone: phone || undefined,
          tier,
          role,
          notes: notes || undefined,
        });
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
      } catch (error: any) {
        alert(error.message || '儲存失敗');
      }
    });
  }

  function handleToggleActive() {
    if (!confirm(member.is_active ? '確定要停用此會員嗎？' : '確定要啟用此會員嗎？')) return;

    startTransition(async () => {
      try {
        const result = await toggleMemberActive(member.id);
        setMember((prev) => ({ ...prev, is_active: result.is_active }));
      } catch (error: any) {
        alert(error.message || '操作失敗');
      }
    });
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getInitials(name: string | null, email: string | null): string {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back link */}
      <Link
        href="/dashboard/members"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        返回會員列表
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
              {getInitials(member.full_name, member.email)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">
              {member.full_name || member.email || '未知會員'}
            </h1>
            <p className="text-muted-foreground">{member.email}</p>
            <div className="flex items-center gap-2 mt-1">
              {member.tier === 'pro' ? (
                <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                  <Crown className="h-3 w-3 mr-1" />
                  Pro
                </Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
              {member.role === 'admin' && (
                <Badge variant="outline" className="text-blue-600 border-blue-300">
                  <Shield className="h-3 w-3 mr-1" />
                  管理員
                </Badge>
              )}
              {member.is_active ? (
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  啟用
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-500 border-red-300">
                  停用
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleToggleActive}
            disabled={isPending}
            className={member.is_active ? 'text-red-500 hover:bg-red-50' : 'text-emerald-600 hover:bg-emerald-50'}
          >
            {member.is_active ? (
              <>
                <UserX className="h-4 w-4 mr-2" />
                停用會員
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                啟用會員
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            <Save className="h-4 w-4 mr-2" />
            {isSaved ? '已儲存' : '儲存'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Editable Fields */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">基本資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input value={member.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground mt-1">Email 無法修改</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">姓名</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="輸入會員姓名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">電話</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="輸入電話號碼"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">方案</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">角色</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="member">會員</option>
                    <option value="admin">管理員</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">管理備註</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="輸入管理備註（僅管理員可見）..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Read-only Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">會員資訊</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">加入日期</p>
                  <p className="text-sm">{formatDate(member.joined_date)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">最近登入</p>
                  <p className="text-sm">{formatDate(member.last_login)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">AI 使用次數</p>
                  <p className="text-sm">{member.ai_usage_count} 次</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {(member.stripe_customer_id || member.stripe_subscription_id) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Stripe 資訊</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {member.stripe_customer_id && (
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Customer ID</p>
                      <p className="text-xs font-mono truncate">{member.stripe_customer_id}</p>
                    </div>
                  </div>
                )}
                {member.stripe_subscription_id && (
                  <div className="flex items-start gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Subscription ID</p>
                      <p className="text-xs font-mono truncate">{member.stripe_subscription_id}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
