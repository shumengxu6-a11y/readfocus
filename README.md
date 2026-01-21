# ReadFocus - 微信读书笔记专注阅读器

ReadFocus 是一个基于 Next.js 开发的个人项目，旨在提供一个沉浸、极简的环境，帮助用户专注于回顾和阅读微信读书（WeRead）中的高亮笔记与心得。

这是一个展示 Next.js 全栈开发能力的项目，集成了第三方 API 代理、本地数据缓存以及现代化的前端交互设计。

## ✨ 主要功能 (Features)

*   **📚 微信读书同步**: 通过 CookieCloud 自动同步微信读书的笔记和高亮，打破原来的封闭生态。
*   **🧘 沉浸式阅读**: 摒弃干扰元素，提供专注的阅读界面，支持暗色模式。
*   **💾 智能缓存策略**: 实现本地文件缓存系统，大幅提升二次加载速度，减少 API 请求。
*   **🎲 随机回顾机制**: 首页支持随机展示历史笔记，帮助“温故知新”。

## 🛠️ 技术栈 (Tech Stack)

*   **核心框架**: [Next.js 15 (App Router)](https://nextjs.org/)
*   **编程语言**: TypeScript
*   **样式方案**: Tailwind CSS
*   **数据集成**: Axios, CookieCloud, Custom WeRead API
*   **部署支持**: GitHub Actions / Vercel

## 🚀 本地运行 (Getting Started)

如果你想在本地查看或运行此项目，请按以下步骤操作：

### 1. 环境准备
确保你的电脑上安装了 Node.js (v18+) 和 npm/yarn。

### 2. 获取代码
```bash
git clone https://github.com/your-username/readfocus.git
cd readfocus
```

### 3. 安装依赖
```bash
npm install
# 或 yarn install
```

### 4. 配置环境变量
项目运行依赖 CookieCloud 服务来获取数据（或者直接配置 Cookie）。
复制示例配置文件：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件，填入你的配置：
*   `COOKIECLOUD_HOST`: 你的 CookieCloud 服务器地址 (例如 http://127.0.0.1:8088)
*   `COOKIECLOUD_UUID`: 你的 UUID
*   `COOKIECLOUD_PASSWORD`: 你的密码

### 5. 启动项目
```bash
npm run dev
```
打开浏览器访问 [http://localhost:3000](http://localhost:3000) 即可看到运行效果。

---

## 📦 部署说明

本项目已配置 GitHub Actions，支持推送到 GitHub 时自动构建。但由于项目依赖特定的 CookieCloud 数据源：
1.  **推荐本地运行**：直接使用 `npm run dev` 演示，体验最佳且无需复杂的服务器配置。
2.  **静态部署 (GitHub Pages)**：可以部署，但需注意 API 路由（数据同步功能）在纯静态环境下不可用。

---
*Created by [xushumeng]*
