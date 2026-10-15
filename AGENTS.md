# 导航 / 小白个人全景导航与站群索引中心 (nav.21212121.xyz)

## 1. 项目概述
本目录为小白个人全景导航站与站群索引总中心（官方主域名：`https://nav.21212121.xyz`，兼容域名：`https://a.21212121.xyz`）。
- **定位**：全站核心入口与微服务聚合门户，基于 Anthropic Claude Code 官方文学极简与沉静典雅设计系统，全原生超链接 Bento 网格架构。
- **技术栈**：HTML5 / CSS3 / 原生 Vanilla JS、Claude Design Tokens、PHP 8.5 访客分析、又拍云 CDN 加速。
- **自适应体系**：全面支持 Mobile / Tablet / Desktop 响应式视口适配，全站站群一键直达。

## 2. 核心架构与文件规范
- `/index.html`：全景主导航总门户（Anthropic Claude 官方文学极简风格，Bento 矩阵全原生超链接）。
- `/links.html`：站群矩阵与友链互联中心。
- `/assets/`：样式、字体、脚本、图片、数据与视频素材。
- `/api/`：访客 IP 地理位置与访问统计（ip2region + visitor.php）。
- `.github/workflows/deploy.yml`：基于 GitHub Actions 的生产服务器自动化持续部署。

## 3. 生产域名与服务器部署架构
- **核心二级域名**：`https://nav.21212121.xyz`
- **兼容二级域名**：`https://a.21212121.xyz`（双向解析与兼容运行）
- **服务器物理目录**：`/www/wwwroot/nav.21212121.xyz`
- **SSL 状态**：通配符证书 `*.21212121.xyz` · HTTP/2 · 强制 HTTPS (HSTS 开启)
- **CI/CD 契约**：代码 push 至 `main` 分支后，GitHub Actions 自动通过 Rsync 增量部署至腾讯云上海生产服务器，并自动处理 `.user.ini` 与目录访问权限。

## 4. 本地运行与调试
- **纯前端调试**：
  ```bash
  python -m http.server 8080
  ```
- **带访客统计 API 调试**：
  ```bash
  php -S 127.0.0.1:8080
  ```

## 5. 相关文档
- [README.md](./README.md)
