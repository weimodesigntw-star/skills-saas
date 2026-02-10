/**
 * Privacy Policy Page
 *
 * 隱私權政策頁面 — Stripe Live Mode 必備
 */

import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '隱私權政策 - Skills SaaS',
  description: 'Skills SaaS 隱私權政策',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              <span className="text-xl font-bold text-slate-900">Skills SaaS</span>
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回首頁
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-2">隱私權政策</h1>
        <p className="text-slate-500 mb-12">最後更新日期：2026 年 2 月 9 日</p>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. 概述</h2>
            <p className="text-slate-600 leading-relaxed">
              Skills SaaS（以下簡稱「本服務」）重視您的隱私權。本隱私權政策說明我們如何收集、使用、儲存及保護您的個人資訊。使用本服務即表示您同意本政策所述之資料處理方式。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. 我們收集的資訊</h2>
            <p className="text-slate-600 leading-relaxed mb-4">當您使用本服務時，我們可能會收集以下類型的資訊：</p>
            <div className="bg-slate-50 rounded-lg p-6 space-y-3">
              <div>
                <h3 className="font-semibold text-slate-800">帳戶資訊</h3>
                <p className="text-slate-600">您在註冊時提供的電子郵件地址和密碼。</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">付款資訊</h3>
                <p className="text-slate-600">透過 Stripe 處理的付款資訊（信用卡號碼等）。我們不會直接儲存您的完整付款資訊，所有付款資料由 Stripe 安全處理。</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">使用資料</h3>
                <p className="text-slate-600">您在服務中建立的分類資料、AI 生成紀錄、使用頻率和功能偏好。</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">技術資料</h3>
                <p className="text-slate-600">IP 位址、瀏覽器類型、裝置資訊以及 Cookies 等技術性資料。</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. 資訊的使用方式</h2>
            <p className="text-slate-600 leading-relaxed mb-4">我們使用收集到的資訊來：</p>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
              <li>提供、維護和改善本服務</li>
              <li>處理您的訂閱和付款交易</li>
              <li>提供 AI 分類生成功能</li>
              <li>發送服務相關通知和更新</li>
              <li>偵測、預防和處理技術問題或安全威脅</li>
              <li>遵守法律義務</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. 資訊的分享與揭露</h2>
            <p className="text-slate-600 leading-relaxed mb-4">我們不會出售您的個人資訊。我們僅在以下情況下分享您的資訊：</p>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
              <li><strong>Stripe：</strong>用於處理付款交易</li>
              <li><strong>Supabase：</strong>用於安全的資料儲存和身份驗證</li>
              <li><strong>Google AI (Gemini)：</strong>用於處理您的 AI 分類生成請求</li>
              <li><strong>Vercel：</strong>用於網站託管和部署</li>
              <li><strong>法律要求：</strong>當法律要求或為保護我們的合法權益時</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. 資料安全</h2>
            <p className="text-slate-600 leading-relaxed">
              我們採用業界標準的安全措施來保護您的資訊，包括 SSL/TLS 加密傳輸、Row Level Security (RLS) 資料庫存取控制，以及安全的認證機制。然而，沒有任何網路傳輸或電子儲存方式是 100% 安全的，我們無法保證資訊的絕對安全性。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Cookies</h2>
            <p className="text-slate-600 leading-relaxed">
              本服務使用 Cookies 來維持您的登入狀態和改善使用體驗。這些 Cookies 對於服務的正常運作是必要的。您可以透過瀏覽器設定管理 Cookies，但停用某些 Cookies 可能會影響服務功能。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. 您的權利</h2>
            <p className="text-slate-600 leading-relaxed mb-4">您有權：</p>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
              <li>存取和查閱我們持有的您的個人資料</li>
              <li>要求更正不準確的個人資料</li>
              <li>要求刪除您的帳戶和相關資料</li>
              <li>撤回您的同意（不影響撤回前基於同意的處理之合法性）</li>
              <li>隨時取消訂閱，透過 Stripe Customer Portal 管理</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. 資料保留</h2>
            <p className="text-slate-600 leading-relaxed">
              我們會在您的帳戶存續期間保留您的個人資料。當您刪除帳戶時，我們會在合理的時間內刪除您的個人資料，除非法律要求我們保留更長時間。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. 兒童隱私</h2>
            <p className="text-slate-600 leading-relaxed">
              本服務不面向 16 歲以下的兒童。我們不會故意收集 16 歲以下兒童的個人資訊。如果我們發現已收集此類資訊，將立即採取措施刪除。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. 政策變更</h2>
            <p className="text-slate-600 leading-relaxed">
              我們可能會不時更新本隱私權政策。任何變更將在本頁面上公佈，並更新「最後更新日期」。重大變更將透過電子郵件或服務內通知告知您。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. 聯絡我們</h2>
            <p className="text-slate-600 leading-relaxed">
              如果您對本隱私權政策有任何疑問或要求，請透過以下方式聯絡我們：
            </p>
            <div className="bg-slate-50 rounded-lg p-6 mt-4">
              <p className="text-slate-700">
                電子郵件：<a href="mailto:weimodesigntw@gmail.com" className="text-indigo-600 hover:text-indigo-800">weimodesigntw@gmail.com</a>
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center space-x-6 text-sm text-slate-500">
            <Link href="/privacy" className="hover:text-indigo-600">隱私權政策</Link>
            <span>|</span>
            <Link href="/terms" className="hover:text-indigo-600">服務條款</Link>
            <span>|</span>
            <Link href="/" className="hover:text-indigo-600">首頁</Link>
          </div>
          <p className="text-center text-slate-500 text-sm mt-4">
            © 2026 Skills SaaS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
