/**
 * Terms of Service Page
 *
 * 服務條款頁面 — Stripe Live Mode 必備
 */

import Link from 'next/link';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: '服務條款 - Skills SaaS',
  description: 'Skills SaaS 服務條款',
};

export default function TermsOfServicePage() {
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
        <h1 className="text-4xl font-bold text-slate-900 mb-2">服務條款</h1>
        <p className="text-slate-500 mb-12">最後更新日期：2026 年 2 月 9 日</p>

        <div className="prose prose-slate max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. 服務說明</h2>
            <p className="text-slate-600 leading-relaxed">
              Skills SaaS（以下簡稱「本服務」）是一個 AI 驅動的分類管理系統，提供智能分類生成、拖拽排序、層級管理等功能。本服務由 Skills SaaS 團隊（以下簡稱「我們」）營運和提供。使用本服務即表示您同意遵守以下條款。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. 帳戶註冊與安全</h2>
            <div className="text-slate-600 leading-relaxed space-y-3">
              <p>使用本服務需要註冊帳戶。您在註冊時必須提供真實、準確的資訊。</p>
              <p>您有責任維護帳戶的安全性，包括保管好您的密碼。任何透過您帳戶進行的活動，均視為您本人的行為。</p>
              <p>如果您發現帳戶有任何未經授權的使用情況，請立即通知我們。</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. 訂閱方案與付款</h2>

            <div className="bg-slate-50 rounded-lg p-6 space-y-4 mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Free 方案</h3>
                <p className="text-slate-600">免費使用，每日 AI 生成次數有限制，包含基礎分類管理功能。</p>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Pro 方案</h3>
                <p className="text-slate-600">月費訂閱制，享有無限 AI 生成、進階功能和優先技術支援。</p>
              </div>
            </div>

            <div className="text-slate-600 leading-relaxed space-y-3">
              <p>Pro 方案採用自動續訂的月費制度，透過 Stripe 進行安全付款處理。</p>
              <p>所有價格均以美元 (USD) 計價，並可能因稅務規定而需加收稅金。</p>
              <p>我們保留在提前通知的情況下調整定價的權利。價格變更將在您下一個計費週期開始時生效。</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. 取消與退款</h2>
            <div className="text-slate-600 leading-relaxed space-y-3">
              <p>您可以隨時透過 Stripe Customer Portal 取消 Pro 訂閱。取消後，您的 Pro 功能將持續到當前計費週期結束。</p>
              <p>計費週期結束後，您的帳戶將自動降級為 Free 方案，您的資料將被保留。</p>
              <p>由於本服務提供數位內容，一般情況下不提供退款。如有特殊情況，請聯絡我們的客服團隊。</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. 使用規範</h2>
            <p className="text-slate-600 leading-relaxed mb-4">使用本服務時，您同意不會：</p>
            <ul className="list-disc list-inside text-slate-600 space-y-2 ml-4">
              <li>違反任何適用的法律或法規</li>
              <li>上傳包含惡意軟體、病毒或有害內容的資料</li>
              <li>嘗試未經授權地存取其他用戶的帳戶或資料</li>
              <li>濫用 AI 生成功能（例如：自動化大量請求以繞過配額限制）</li>
              <li>使用本服務進行任何非法、欺詐或有害的活動</li>
              <li>干擾或破壞本服務的正常運作</li>
              <li>將本服務轉售或轉讓給第三方</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. 智慧財產權</h2>
            <div className="text-slate-600 leading-relaxed space-y-3">
              <p>本服務的軟體、設計、商標和相關內容均受智慧財產權法保護，屬於 Skills SaaS 團隊所有。</p>
              <p>您在本服務中建立的分類資料歸您所有。我們不會主張對您的內容擁有所有權。</p>
              <p>透過 AI 功能生成的分類建議可由您自由使用和修改。</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. AI 服務免責聲明</h2>
            <p className="text-slate-600 leading-relaxed">
              本服務使用 Google Gemini AI 技術生成分類建議。AI 生成的內容僅供參考，不構成專業建議。我們不保證 AI 生成內容的準確性、完整性或適用性。您有責任審查和驗證所有 AI 生成的內容，並自行決定是否採用。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. 服務可用性</h2>
            <div className="text-slate-600 leading-relaxed space-y-3">
              <p>我們致力於提供穩定可靠的服務，但不保證服務將不間斷或無錯誤地運行。</p>
              <p>我們可能會因維護、更新或不可抗力因素暫時中斷服務。我們將盡力提前通知計劃性維護。</p>
              <p>我們保留在任何時候修改、暫停或終止本服務（或其任何部分）的權利。</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. 責任限制</h2>
            <p className="text-slate-600 leading-relaxed">
              在法律允許的最大範圍內，本服務按「現狀」和「現有」基礎提供，不附帶任何明示或暗示的保證。我們不對因使用或無法使用本服務而產生的任何間接、附帶、特殊、後果性或懲罰性損害承擔責任。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. 帳戶終止</h2>
            <div className="text-slate-600 leading-relaxed space-y-3">
              <p>如果您違反本條款，我們保留暫停或終止您帳戶的權利。</p>
              <p>您可以隨時要求刪除您的帳戶。帳戶刪除後，您的資料將根據我們的隱私權政策進行處理。</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. 條款變更</h2>
            <p className="text-slate-600 leading-relaxed">
              我們保留隨時修改本服務條款的權利。任何變更將在本頁面上公佈。繼續使用本服務即表示您接受修改後的條款。重大變更將透過電子郵件或服務內通知告知您。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. 準據法</h2>
            <p className="text-slate-600 leading-relaxed">
              本條款受中華民國（臺灣）法律管轄並依其解釋。因本條款引起的任何爭議，雙方同意以臺灣臺北地方法院為第一審管轄法院。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">13. 聯絡我們</h2>
            <p className="text-slate-600 leading-relaxed">
              如果您對本服務條款有任何疑問，請透過以下方式聯絡我們：
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
