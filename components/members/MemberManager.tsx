'use client';

import React, { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Crown,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { toggleMemberActive, type Member, type MemberStats } from '@/app/actions/members';

interface MemberManagerProps {
  initialMembers: Member[];
  stats: MemberStats;
}

export function MemberManager({ initialMembers, stats }: MemberManagerProps) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchEmail = m.email?.toLowerCase().includes(q);
        const matchName = m.full_name?.toLowerCase().includes(q);
        const matchPhone = m.phone?.toLowerCase().includes(q);
        if (!matchEmail && !matchName && !matchPhone) return false;
      }
      if (filterTier !== 'all' && m.tier !== filterTier) return false;
      if (filterStatus === 'active' && !m.is_active) return false;
      if (filterStatus === 'inactive' && m.is_active) return false;
      return true;
    });
  }, [members, searchQuery, filterTier, filterStatus]);

  function handleToggleActive(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(async () => {
      try {
        const result = await toggleMemberActive(id);
        setMembers((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, is_active: result.is_active } : m
          )
        );
      } catch (error: any) {
        alert(error.message || '操作失敗');
      }
    });
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }

  function getInitials(name: string | null, email: string | null): string {
    if (name) return name.charAt(0).toUpperCase();
    if (email) return email.charAt(0).toUpperCase();
    return '?';
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">會員管理</h1>
            <p className="text-muted-foreground mt-1">
              共 {stats.total} 位會員
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">總會員</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">啟用中</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pro}</p>
                <p className="text-xs text-muted-foreground">Pro 會員</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <UserX className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.inactive}</p>
                <p className="text-xs text-muted-foreground">已停用</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜尋 Email / 姓名 / 電話..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全部方案</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">全部狀態</option>
            <option value="active">啟用中</option>
            <option value="inactive">已停用</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      {filteredMembers.length === 0 ? (
        members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="還沒有會員"
            description="會員將在註冊後自動出現"
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              找不到符合條件的會員
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-4 font-semibold text-sm">會員</th>
                    <th className="text-left p-4 font-semibold text-sm">方案</th>
                    <th className="text-left p-4 font-semibold text-sm">角色</th>
                    <th className="text-left p-4 font-semibold text-sm">狀態</th>
                    <th className="text-left p-4 font-semibold text-sm">AI 用量</th>
                    <th className="text-left p-4 font-semibold text-sm">加入日期</th>
                    <th className="text-left p-4 font-semibold text-sm">最近登入</th>
                    <th className="text-right p-4 font-semibold text-sm">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/members/${member.id}`)}
                    >
                      {/* Avatar + Name + Email */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                              {getInitials(member.full_name, member.email)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[200px]">
                              {member.full_name || '(未設定姓名)'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* Tier */}
                      <td className="p-4">
                        {member.tier === 'pro' ? (
                          <Badge className="bg-amber-500 text-white hover:bg-amber-500">
                            <Crown className="h-3 w-3 mr-1" />
                            Pro
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Free</Badge>
                        )}
                      </td>
                      {/* Role */}
                      <td className="p-4 text-sm">
                        {member.role === 'admin' ? (
                          <Badge variant="outline" className="text-blue-600 border-blue-300">
                            <Shield className="h-3 w-3 mr-1" />
                            管理員
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">會員</span>
                        )}
                      </td>
                      {/* Status */}
                      <td className="p-4">
                        {member.is_active ? (
                          <Badge variant="default" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            啟用
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-500 border-red-300">
                            停用
                          </Badge>
                        )}
                      </td>
                      {/* AI Usage */}
                      <td className="p-4 text-sm">
                        {member.ai_usage_count}
                      </td>
                      {/* Join Date */}
                      <td className="p-4 text-sm whitespace-nowrap">
                        {formatDate(member.joined_date)}
                      </td>
                      {/* Last Login */}
                      <td className="p-4 text-sm whitespace-nowrap">
                        {formatDate(member.last_login)}
                      </td>
                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 text-xs ${
                              member.is_active
                                ? 'text-red-500 hover:bg-red-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            onClick={(e) => handleToggleActive(member.id, e)}
                            disabled={isPending}
                          >
                            {member.is_active ? (
                              <>
                                <UserX className="h-3.5 w-3.5 mr-1" />
                                停用
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5 mr-1" />
                                啟用
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
