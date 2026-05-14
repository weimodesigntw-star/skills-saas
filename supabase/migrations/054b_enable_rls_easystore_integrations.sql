-- ============================================================================
-- Migration 054b: 啟用 easystore_integrations 的 RLS
-- ============================================================================
-- 背景：053 已替換 policy 為 workspace 規則，但這張表原本 RLS 是 disabled，
--      不啟用的話 policy 不生效，任何登入用戶仍可讀寫所有 row。
-- ============================================================================
ALTER TABLE public.easystore_integrations ENABLE ROW LEVEL SECURITY;
