import { redirect } from 'next/navigation'

export default function HomePage() {
  // 重定向到分類管理頁面
  redirect('/dashboard/categories')
}
