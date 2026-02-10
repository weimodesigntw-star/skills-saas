# AI 分類生成器設置指南

## 問題診斷

如果 AI 生成功能卡住或顯示錯誤，通常是因為缺少 Google AI API Key。

## 設置步驟

### 1. 獲取 Google AI Studio API Key

1. 前往 [Google AI Studio](https://aistudio.google.com/)
2. 使用您的 Google 帳號登入
3. 點擊左側選單的 "Get API key"
4. 選擇或創建一個 Google Cloud 專案
5. 點擊 "Create API key"
6. 複製生成的 API Key（格式：`AIza...`）

> 💡 **提示**：Google AI Studio 提供免費額度，非常適合開發和測試！

### 2. 設置環境變數

#### 本地開發環境

在專案根目錄的 `.env.local` 檔案中添加：

```env
GOOGLE_GENERATIVE_AI_API_KEY=AIza-your-api-key-here
```

#### Vercel 部署環境

1. 前往 Vercel 專案設定
2. 進入 "Environment Variables" 頁面
3. 添加新的環境變數：
   - **Key**: `GOOGLE_GENERATIVE_AI_API_KEY`
   - **Value**: 您的 Google AI API Key
   - **Environment**: Production, Preview, Development（全部勾選）
4. 點擊 "Save"
5. 重新部署專案

### 3. 可選：自訂模型

預設使用 `gemini-1.5-pro`，您可以在 `.env.local` 中設定其他模型：

```env
GOOGLE_AI_MODEL=gemini-pro
```

支援的模型：
- `gemini-1.5-pro`（推薦，品質最佳，支援更長的上下文）
- `gemini-pro`（較快，適合簡單任務）

### 4. 重啟開發伺服器

設置完成後，請重啟開發伺服器：

```bash
# 停止當前伺服器（Ctrl + C）
# 然後重新啟動
npm run dev
```

## 驗證設置

1. 打開瀏覽器開發者工具（F12）
2. 前往 Console 標籤
3. 嘗試生成分類
4. 如果看到 `[AI Generate] Stream started successfully`，表示設置成功

## 常見錯誤

### 錯誤：`Google AI API Key 未設定`

**原因**：環境變數未正確設置

**解決方法**：
1. 確認 `.env.local` 檔案存在於專案根目錄
2. 確認 `GOOGLE_GENERATIVE_AI_API_KEY` 格式正確（以 `AIza` 開頭）
3. 重啟開發伺服器

### 錯誤：`401 Unauthorized`

**原因**：API Key 無效或已過期

**解決方法**：
1. 前往 [Google AI Studio](https://aistudio.google.com/) 檢查 API Key 狀態
2. 確認 API Key 已啟用
3. 重新生成新的 API Key

### 錯誤：`429 Too Many Requests`

**原因**：API 請求次數超過限制

**解決方法**：
1. 等待一段時間後重試
2. 檢查 Google AI Studio 的 Rate Limits
3. 確認免費額度是否已用完

## 費用說明

### Google AI Studio 免費額度

Google AI Studio 提供**免費額度**：
- **免費層級**：每月 60 次請求/分鐘
- **免費額度**：足夠用於開發和測試

### 付費方案

如果需要更多額度，可以升級到付費方案：
- 按使用量計費，價格相對較低
- 詳細價格請參考 [Google AI Studio 定價](https://ai.google.dev/pricing)

每次生成分類約消耗 500-2000 tokens，在免費額度內通常足夠使用。

## 安全提醒

⚠️ **重要**：請勿將 `.env.local` 檔案提交到 Git 倉庫！

`.env.local` 已加入 `.gitignore`，但請確認：
- 不要在任何公開的地方分享您的 API Key
- 不要在客戶端代碼中使用 API Key（應只在伺服器端使用）
- 定期輪換 API Key
- 在 Google AI Studio 中可以設定 API Key 的使用限制和 IP 白名單

## Google AI Studio 優勢

✅ **免費額度**：提供足夠的免費額度用於開發和測試  
✅ **簡單易用**：無需信用卡即可開始使用  
✅ **高品質模型**：Gemini 1.5 Pro 提供優秀的生成品質  
✅ **中文支援**：對繁體中文有良好的支援  

## 需要幫助？

如果問題持續存在，請檢查：
1. 終端機的錯誤日誌（查找 `[AI Generate]` 開頭的日誌）
2. 瀏覽器 Console 的錯誤訊息
3. 確認網路連線正常
4. 確認 Google AI Studio 服務狀態：https://status.cloud.google.com/
5. 檢查 API Key 是否在 Google AI Studio 中正確啟用
