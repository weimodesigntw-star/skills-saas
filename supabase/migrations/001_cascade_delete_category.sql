-- 級聯刪除分類的 RPC 函數
-- 使用 PostgreSQL 事務確保原子性操作

CREATE OR REPLACE FUNCTION delete_category_cascade(
  category_id UUID,
  user_id_param UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  child_count INTEGER;
BEGIN
  -- 檢查權限
  IF NOT EXISTS (
    SELECT 1 FROM categories 
    WHERE id = category_id 
    AND (user_id = user_id_param OR user_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Category not found or unauthorized';
  END IF;

  -- 遞迴刪除所有子節點（PostgreSQL 的 CASCADE 會自動處理，但我們手動遞迴確保順序）
  -- 使用 CTE 遞迴查詢所有子節點
  WITH RECURSIVE category_tree AS (
    -- 起始節點
    SELECT id, parent_id
    FROM categories
    WHERE parent_id = category_id
      AND (user_id = user_id_param OR user_id IS NULL)
    
    UNION ALL
    
    -- 遞迴查詢子節點
    SELECT c.id, c.parent_id
    FROM categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.id
    WHERE (c.user_id = user_id_param OR c.user_id IS NULL)
  )
  DELETE FROM categories
  WHERE id IN (SELECT id FROM category_tree);
  
  -- 刪除當前節點
  DELETE FROM categories
  WHERE id = category_id
    AND (user_id = user_id_param OR user_id IS NULL);
  
  -- 如果沒有刪除任何行，拋出異常
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to delete category';
  END IF;
END;
$$;

-- 授予執行權限給 authenticated 用戶
GRANT EXECUTE ON FUNCTION delete_category_cascade(UUID, UUID) TO authenticated;
