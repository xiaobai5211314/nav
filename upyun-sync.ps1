<#
.SYNOPSIS
    小白数字空间 · 又拍云存储 (Upyun CDN) 静态资产一键同步脚本
.DESCRIPTION
    将当前工程下的 assets/ 目录（包含 heavy vendor JS、音频、高清壁纸等）同步至又拍云存储空间，
    使线上站点直接通过 https://guzhicdn.21212121.xyz/ 高速加载，避免占用服务器小带宽。
#>

param(
    [string]$Service = "guzhicdn",          # 又拍云服务名 (Bucket)
    [string]$Operator = "",                 # 又拍云操作员账号
    [string]$Password = ""                  # 又拍云操作员密码
)

$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ☁️ 又拍云存储静态资产同步助手 (Upyun CDN Sync Tool)" -ForegroundColor Green
Write-Host " 绑定加速域名: https://guzhicdn.21212121.xyz" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$assetsDir = Join-Path $PSScriptRoot "assets"

if (-not (Test-Path $assetsDir)) {
    Write-Host "❌ 错误: 未找到 assets 目录！" -ForegroundColor Red
    exit 1
}

# 1. 扫描待同步资产清单
$files = Get-ChildItem -Path $assetsDir -Recurse -File
$totalSizeMB = [math]::Round(($files | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host "📦 待同步本地资产统计:" -ForegroundColor White
Write-Host "   - 文件总数: $($files.Count) 个" -ForegroundColor Gray
Write-Host "   - 资产体积: $totalSizeMB MB" -ForegroundColor Gray
Write-Host "   - 涵盖模块: Vendor JS (Three.js/MediaPipe), Audio (520.mp3), Images, Data" -ForegroundColor Gray
Write-Host ""

# 2. 检查是否有本地 upx 工具
$upxCmd = Get-Command "upx" -ErrorAction SilentlyContinue

if ($upxCmd) {
    Write-Host "✨ 检测到本地已安装又拍云官方 CLI: upx" -ForegroundColor Green
    if ([string]::IsNullOrWhiteSpace($Operator) -or [string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "💡 提示: 请直接运行以下命令完成登录并同步:" -ForegroundColor Yellow
        Write-Host "   upx login <你的服务名> <操作员> <密码>" -ForegroundColor White
        Write-Host "   upx sync $assetsDir /asite/" -ForegroundColor White
    } else {
        Write-Host "🚀 正在通过 upx 执行同步..." -ForegroundColor Cyan
        & upx login $Service $Operator $Password
        & upx sync $assetsDir /asite/
        Write-Host "✅ 又拍云同步完成！" -ForegroundColor Green
    }
} else {
    Write-Host "📋 【又拍云同步与配置指南】" -ForegroundColor Cyan
    Write-Host "方式 1（推荐 · 极简网页端）：" -ForegroundColor Yellow
    Write-Host "  1. 打开又拍云控制台：https://console.upyun.com/" -ForegroundColor White
    Write-Host "  2. 进入您的云存储服务（绑定 guzhicdn.21212121.xyz 的空间）" -ForegroundColor White
    Write-Host "  3. 在根目录下新建目录【asite】，将本地的 [assets] 文件夹拖入上传" -ForegroundColor White
    Write-Host ""
    Write-Host "方式 2（GitHub Actions 自动化，参考同目录的小白养基项目）：" -ForegroundColor Yellow
    Write-Host "  使用 upx CLI 在流水线中自动执行:" -ForegroundColor White
    Write-Host "    upx put assets/ /asite/" -ForegroundColor Gray
}

Write-Host ""
Write-Host "💡 提示：本站原生集成了自动 Fallback 机制！" -ForegroundColor Green
Write-Host "即使尚未上传到又拍云，页面也会自动降级加载本地 assets/ 目录，保证 100% 正常运行！" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan
