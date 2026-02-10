# 🚀 启动开发服务器并修复认证问题

## ⚠️ 当前问题

1. **开发服务器未运行** - 浏览器显示 `ERR_CONNECTION_REFUSED`
2. **Supabase 认证失败** - 401 Unauthorized（ANON KEY 不正确）

---

## 🔧 修复步骤

### Step 1: 启动开发服务器

在终端机执行：

```bash
npm run dev
```

**预期输出**：
```
▲ Next.js 14.x.x
- Local:        http://localhost:3000
✓ Ready in X seconds
```

**如果看到错误**：
- 检查端口 3000 是否被占用
- 确保 `.env.local` 文件存在

---

### Step 2: 从 Supabase Dashboard 获取正确的 ANON KEY

1. **打开 Supabase Dashboard**
   - 访问：https://app.supabase.com
   - 登录并选择项目

2. **进入 API 设置**
   - 点击左下角 **Settings** (⚙️ 齿轮图标)
   - 点击 **API**

3. **复制正确的 Key**
   - 找到 **Project API keys** 区块
   - 复制 **anon public** key（完整的 key）
   - **不要复制 service_role key！**

4. **确认 Project URL**
   - 应该是：`https://ucwcavjnqalnxnisiuha.supabase.co`
   - 确认 Project ID 匹配

---

### Step 3: 更新 .env.local

打开 `.env.local` 文件，更新 `NEXT_PUBLIC_SUPABASE_ANON_KEY`：

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://ucwcavjnqalnxnisiuha.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=从_Supabase_Dashboard_复制的完整_key
```

**重要注意事项**：
- ✅ 确保 key 完整（没有被截断）
- ✅ 不要有多余的空格
- ✅ 保存文件

---

### Step 4: 重启开发服务器

**必须执行**：修改 `.env.local` 后必须重启服务器！

```bash
# 1. 停止当前服务器（在终端机按 Ctrl + C）

# 2. 重新启动
npm run dev
```

---

### Step 5: 验证配置

在新的终端窗口执行：

```bash
npx tsx scripts/verify-env.ts
```

**预期输出**：
```
✅ Supabase 連接成功！
```

**如果还是失败**：
- 再次确认从 Supabase Dashboard 复制的 key
- 确保复制的是 **anon public** key
- 检查 key 是否完整

---

### Step 6: 清除浏览器 Cookies

**必须执行**：旧的 Cookie 是用错误的 Key 创建的！

1. **打开开发者工具**
   - 按 `F12` 或 `Cmd + Option + I` (Mac)

2. **清除网站数据**
   - 切换到 **Application** 标签
   - 左侧菜单选择 **Storage**
   - 点击 **Clear site data**
   - 确认清除

---

### Step 7: 测试登录

1. **访问登录页面**
   - http://localhost:3000/login

2. **输入账号密码登录**

3. **观察终端机日志**
   - ✅ 应该看到：`[Middleware] Has User? true`
   - ❌ 不应该看到：`Auth session missing!`

4. **确认跳转成功**
   - ✅ 自动跳转到 `/dashboard/categories`
   - ❌ 不应该出现无限循环

---

## ✅ 完成检查清单

- [ ] 开发服务器正在运行（`npm run dev`）
- [ ] 从 Supabase Dashboard 复制了正确的 anon public key
- [ ] 更新了 `.env.local` 文件
- [ ] 重启了开发服务器
- [ ] 验证脚本显示「连接成功」
- [ ] 清除了浏览器 Cookies
- [ ] 登录后终端机显示 `Has User? true`
- [ ] 登录后成功跳转，没有无限循环

---

## 🆘 常见问题

### Q: 端口 3000 被占用怎么办？

```bash
# 查找占用端口的进程
lsof -ti:3000

# 或者使用其他端口
PORT=3001 npm run dev
```

### Q: 验证脚本还是显示 401？

1. 确认从 Supabase Dashboard 复制的 key 是正确的
2. 确认复制的是 **anon public** key，不是 service_role
3. 检查 key 是否完整（没有截断）
4. 确认 Project URL 中的 Project ID 正确

### Q: 如何确认 Project ID？

- Cookie 名称是 `sb-ucwcavjn...`
- 所以 Project ID 应该是 `ucwcavjnqalnxnisiuha`
- URL 应该是：`https://ucwcavjnqalnxnisiuha.supabase.co`

---

## 📝 快速参考

**启动服务器**：
```bash
npm run dev
```

**验证配置**：
```bash
npx tsx scripts/verify-env.ts
```

**Supabase Dashboard**：
```
Settings (左下角⚙️) > API > Project API keys > anon public
```

**清除 Cookies**：
```
F12 > Application > Storage > Clear site data
```
