#!/bin/bash

# 推送到 GitHub 的辅助脚本

echo "🚀 准备推送到 GitHub..."
echo ""
echo "仓库：weimodesigntw-star/skills-saas"
echo ""

# 检查远程仓库
if ! git remote get-url origin &>/dev/null; then
    echo "❌ 远程仓库未设置"
    echo "执行：git remote add origin https://github.com/weimodesigntw-star/skills-saas.git"
    exit 1
fi

echo "✅ 远程仓库已设置"
echo ""

# 检查是否有待推送的提交
if git rev-parse --verify origin/main &>/dev/null; then
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse origin/main)
    BASE=$(git merge-base @ origin/main)
    
    if [ $LOCAL = $REMOTE ]; then
        echo "✅ 本地和远程已同步，无需推送"
        exit 0
    fi
fi

echo "📤 开始推送..."
echo ""
echo "⚠️  提示："
echo "   如果提示输入用户名：weimodesigntw-star"
echo "   如果提示输入密码：使用 Personal Access Token（不是 GitHub 密码）"
echo ""
echo "获取 Token：https://github.com/settings/tokens"
echo ""

# 执行推送
git push -u origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 推送成功！"
    echo "查看仓库：https://github.com/weimodesigntw-star/skills-saas"
else
    echo ""
    echo "❌ 推送失败"
    echo ""
    echo "可能的原因："
    echo "1. 认证失败 - 请使用 Personal Access Token"
    echo "2. 网络问题 - 请检查网络连接"
    echo "3. 权限问题 - 确认您有推送权限"
    echo ""
    echo "获取 Token：https://github.com/settings/tokens"
fi
