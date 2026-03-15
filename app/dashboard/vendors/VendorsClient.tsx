'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Edit, Trash2 } from 'lucide-react'
import { VendorDialog } from '@/components/vendors/VendorDialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { deleteVendor } from '@/app/actions/vendors'
import { toast } from '@/components/ui/toast'

interface VendorsClientProps {
  initialVendors: any[]
  total: number
  page: number
  pageSize: number
}

export function VendorsClient({ initialVendors, total, page, pageSize }: VendorsClientProps) {
  const [vendors, setVendors] = useState(initialVendors)
  const [searchTerm, setSearchTerm] = useState('')
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false)
  const [editingVendorId, setEditingVendorId] = useState<string>()
  const [deleteVendorId, setDeleteVendorId] = useState<string>()
  const [isDeleting, setIsDeleting] = useState(false)
  
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    setVendors(initialVendors)
  }, [initialVendors])

  const handleSearch = () => {
    const params = new URLSearchParams(searchParams.toString())
    if (searchTerm) {
      params.set('search', searchTerm)
    } else {
      params.delete('search')
    }
    params.delete('page')
    router.push(`/dashboard/vendors?${params.toString()}`)
  }

  const handleEdit = (vendorId: string) => {
    setEditingVendorId(vendorId)
    setIsVendorDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteVendorId) return
    
    setIsDeleting(true)
    try {
      const result = await deleteVendor(deleteVendorId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('廠商刪除成功')
        // 重新載入頁面或更新列表
        router.refresh()
      }
    } catch (error) {
      toast.error('刪除失敗')
    } finally {
      setIsDeleting(false)
      setDeleteVendorId(undefined)
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`/dashboard/vendors?${params.toString()}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">廠商管理</h1>
        <Button onClick={() => setIsVendorDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          新增廠商
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Input
              placeholder="搜尋廠商代碼或名稱..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="max-w-sm"
            />
            <Button onClick={handleSearch} variant="outline">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <EmptyState
              title="尚無廠商資料"
              description="開始新增您的第一個廠商吧"
              action={
                <Button onClick={() => setIsVendorDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  新增廠商
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {vendors.map((vendor) => (
                  <Card key={vendor.id}>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{vendor.vendor_name}</h3>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(vendor.id)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteVendorId(vendor.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          代碼: {vendor.vendor_code}
                        </p>
                        {vendor.uniform_num && (
                          <p className="text-sm text-muted-foreground">
                            統編: {vendor.uniform_num}
                          </p>
                        )}
                        {vendor.phone && (
                          <p className="text-sm text-muted-foreground">
                            電話: {vendor.phone}
                          </p>
                        )}
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary">{vendor.currency || '台幣'}</Badge>
                          <Badge variant="outline">
                            稅率: {((vendor.taxrate || 0.05) * 100).toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                  >
                    上一頁
                  </Button>
                  <span className="text-sm">
                    第 {page} 頁，共 {totalPages} 頁
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                  >
                    下一頁
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <VendorDialog
        open={isVendorDialogOpen}
        onOpenChange={(open) => {
          setIsVendorDialogOpen(open)
          if (!open) {
            setEditingVendorId(undefined)
          }
        }}
        vendorId={editingVendorId}
      />

      <ConfirmDialog
        open={!!deleteVendorId}
        onOpenChange={(open) => !open && setDeleteVendorId(undefined)}
        title="確認刪除"
        description="確定要刪除此廠商嗎？此操作無法復原。"
        onConfirm={handleDelete}
        loading={isDeleting}
      />
    </div>
  )
}