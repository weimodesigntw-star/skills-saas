# TAGS-001｜product_tags 多對多（App 層）

## 前提

- Migration **049** 已執行：`product_tags`、`product_tag_map`、RLS 就緒。
- 種子 **TAGS-002** 已執行（每位 user 33 筆預設標籤）— 可選，未種子則僅無預設標籤。

## 資料表

- `product_tags`：`user_id`, `name`, `color`（HEX）, `dimension`（品項／工藝／染色／素材／系列）, `sort_order`
- `product_tag_map`：`product_id`, `tag_id`（多對多）

## 必做：Server Actions

建議檔案：`app/actions/product-tags.ts`（或併入既有 products actions，但請保持職責清楚）。

| 函式 | 行為 |
|------|------|
| `listProductTags()` | 目前登入使用者之全部標籤，`order('dimension')` + `sort_order`（或先 dimension 再 sort_order） |
| `getProductTagIds(productId: string)` | 查 `product_tag_map` 得 `tag_id[]` |
| `getProductTagsForProduct(productId)` | 同上但 join `product_tags` 回傳完整 `ProductTag[]`（含 color、dimension） |
| `setProductTags(productId, tagIds: string[])` | 刪除該 `product_id` 在 map 中的列，再批量 INSERT 新組合；僅允許操作 `products.user_id === auth.uid()` 且每個 `tag_id` 屬於同 user |
| `revalidatePath` | 商品列表、商品編輯頁（與 `/dashboard/products/[id]` 等實際路徑一致） |

## 型別

- `ProductTag`：`id`, `name`, `color`, `dimension`, `sort_order`

## 必做：商品編輯頁 UI

- 多選標籤（checkbox / toggle chip）。
- **依 `dimension` 分組**（五個區塊標題）。
- 每個標籤顯示 **色塊**（`backgroundColor: tag.color` 或 border ＋ 小圓點）。
- 可選：頂部搜尋框篩選標籤名稱。
- 儲存時呼叫 `setProductTags`。

## 選做

- 商品列表／卡片：顯示已套用標籤的 chips。
- `ensureDefaultProductTags`：後續再做即可。

## 驗收示例（川流枕套）

商品套用 5 個標籤：`寢具`、`手捻手織`、`藍染`、`純棉`、`川流` → `product_tag_map` 五筆。

## 驗收

- `npm run build` 通過。
- 無跨租戶讀寫（RLS + actions 雙重檢查）。
