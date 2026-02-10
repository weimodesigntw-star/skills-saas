# 🚨 故障排除指南

## 問題：ERR_CONNECTION_REFUSED

### 症狀
- 瀏覽器顯示「無法連上這個網站」
- 錯誤碼：`ERR_CONNECTION_REFUSED`
- localhost:3000 拒絕連線

### 原因
開發伺服器未運行或啟動失敗

### 解決方案

#### 方案 1: 手動啟動開發伺服器

```bash
# 在專案根目錄執行
npm run dev
```

**預期輸出**：
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
✓ Ready in X seconds
```

#### 方案 2: 檢查端口衝突

```bash
# 檢查端口 3000 是否被佔用
lsof -ti:3000

# 如果被佔用，可以：
# 1. 停止佔用端口的進程
kill -9 $(lsof -ti:3000)

# 2. 或使用其他端口
PORT=3001 npm run dev
```

#### 方案 3: 檢查環境變數

確認 `.env.local` 已正確設置：

```bash
# 檢查文件內容
cat .env.local

# 確認包含：
# NEXT_PUBLIC_SUPABASE_URL=https://...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

**重要**：修改環境變數後，**必須重啟開發伺服器**！

#### 方案 4: 檢查 Node.js 版本

```bash
# 檢查版本
node --version
# 應該 >= 18.0.0

npm --version
# 應該 >= 9.0.0
```

#### 方案 5: 清除緩存重新安裝

```bash
# 清除 Next.js 緩存
rm -rf .next

# 重新安裝依賴（如果需要）
npm install

# 重新啟動
npm run dev
```

---

## 常見錯誤與解決方案

### 錯誤 1: "Cannot find module"

**解決方案**：
```bash
npm install
```

### 錯誤 2: "Port 3000 is already in use"

**解決方案**：
```bash
# 停止佔用端口的進程
kill -9 $(lsof -ti:3000)

# 或使用其他端口
PORT=3001 npm run dev
```

### 錯誤 3: "Supabase URL not found"

**解決方案**：
1. 確認 `.env.local` 存在且已設置
2. **重啟開發伺服器**（Ctrl+C 然後 `npm run dev`）
3. 確認變數名稱正確（`NEXT_PUBLIC_` 前綴）

### 錯誤 4: 編譯錯誤

**解決方案**：
1. 檢查終端機的錯誤訊息
2. 確認所有依賴已安裝
3. 檢查 TypeScript 類型錯誤

---

## 驗證步驟

### 1. 確認伺服器運行

```bash
# 檢查端口
lsof -ti:3000

# 測試連接
curl http://localhost:3000
```

### 2. 確認環境變數

```bash
# 檢查文件
cat .env.local

# 在代碼中驗證（臨時）
# 在 app/layout.tsx 或任何組件中添加：
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL);
```

### 3. 檢查瀏覽器控制台

- 打開開發者工具（F12）
- 查看 Console 標籤的錯誤訊息
- 查看 Network 標籤的請求狀態

---

## 快速診斷命令

```bash
# 完整診斷腳本
cd /Users/weimodesign/SynologyDrive/維摩設計/skills

echo "1. 檢查 Node.js..."
node --version

echo "2. 檢查端口 3000..."
lsof -ti:3000 && echo "端口被佔用" || echo "端口空閒"

echo "3. 檢查環境變數..."
test -f .env.local && echo "✅ .env.local 存在" || echo "❌ .env.local 不存在"

echo "4. 檢查依賴..."
test -d node_modules && echo "✅ node_modules 存在" || echo "❌ 需要執行 npm install"

echo "5. 測試連接..."
curl -s http://localhost:3000 > /dev/null && echo "✅ 伺服器運行中" || echo "❌ 伺服器未運行"
```

---

## 需要幫助？

如果以上方法都無法解決，請提供：
1. 終端機的完整錯誤訊息
2. 瀏覽器控制台的錯誤訊息
3. `npm run dev` 的輸出

---

**祝您順利解決問題！🛠️**
