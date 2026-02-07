/**
 * Landing Page
 * 
 * 現代化的 SaaS Landing Page
 */

import Link from 'next/link';
import { getCurrentUser } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Move, 
  Shield, 
  ArrowRight, 
  Check,
  Zap
} from 'lucide-react';
import { FREE_DAILY_LIMIT } from '@/lib/config/subscription';

export default async function HomePage() {
  const user = await getCurrentUser();
  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-slate-900">Skills SaaS</span>
            </Link>

            {/* Navigation */}
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                  <Link href="/dashboard/categories">
                    進入後台
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <div className="flex items-center space-x-3">
                  <Button asChild variant="ghost" className="text-slate-700 hover:text-slate-900">
                    <Link href="/login">登入</Link>
                  </Button>
                  <Button asChild variant="default" className="bg-indigo-600 hover:bg-indigo-700">
                    <Link href="/login">註冊</Link>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-800 bg-clip-text text-transparent">
              AI 驅動的智能分類管理系統
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
            告別雜亂無章。讓人工智慧為您自動建立、組織並優化您的產品與知識分類。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              asChild
              size="lg" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-6 text-lg shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Link href={isLoggedIn ? "/dashboard/categories" : "/login"}>
                免費開始使用
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="border-2 border-slate-300 hover:border-slate-400 px-8 py-6 text-lg"
            >
              了解更多
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            為什麼選擇 Skills SaaS？
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            強大的功能，簡單的操作，讓分類管理變得輕鬆愉快
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="bg-white rounded-xl p-8 border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              AI 智能生成
            </h3>
            <p className="text-slate-600 leading-relaxed">
              一鍵生成完整分類樹，讓 AI 為您自動建立結構化的分類系統，節省大量時間與精力。
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white rounded-xl p-8 border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <Move className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              拖拽排序
            </h3>
            <p className="text-slate-600 leading-relaxed">
              直觀的層級管理，透過簡單的拖拽操作即可重新組織分類結構，無需複雜設定。
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-white rounded-xl p-8 border border-slate-200 hover:border-indigo-300 hover:shadow-lg transition-all duration-200">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-indigo-600" />
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-3">
              權限控管
            </h3>
            <p className="text-slate-600 leading-relaxed">
              企業級的安全性與 RLS（Row Level Security），確保您的資料安全無虞。
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-slate-50">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            選擇適合您的方案
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            從免費開始，隨時升級到專業版享受更多功能
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free Plan */}
          <div className="bg-white rounded-xl p-8 border-2 border-slate-200 hover:border-indigo-300 transition-all duration-200">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Free</h3>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-600 ml-2">/月</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">每日 {FREE_DAILY_LIMIT} 次 AI 生成</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">基礎分類管理</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">無限分類數量</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-slate-700">拖拽排序功能</span>
              </li>
            </ul>

            <Button 
              asChild
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
              size="lg"
            >
              <Link href={isLoggedIn ? "/dashboard/categories" : "/login"}>
                免費開始
              </Link>
            </Button>
          </div>

          {/* Pro Plan */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-xl p-8 border-2 border-indigo-600 shadow-xl relative">
            <div className="absolute top-4 right-4">
              <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">
                推薦
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="flex items-baseline">
                <span className="text-4xl font-bold text-white">$19</span>
                <span className="text-indigo-200 ml-2">/月</span>
              </div>
            </div>

            <ul className="space-y-4 mb-8">
              <li className="flex items-start">
                <Check className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-white">無限 AI 生成</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-white">所有 Free 功能</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-white">優先技術支援</span>
              </li>
              <li className="flex items-start">
                <Check className="w-5 h-5 text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <span className="text-white">進階分析報表</span>
              </li>
            </ul>

            <Button 
              className="w-full bg-white text-indigo-600 hover:bg-indigo-50"
              size="lg"
              disabled
            >
              Coming Soon
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-slate-600">
            <p>© 2026 Skills SaaS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
