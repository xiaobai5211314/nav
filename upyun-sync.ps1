<#
.SYNOPSIS
    小白数字空间 · 又拍云存储 (Upyun CDN) 静态资产一键同步脚本
.DESCRIPTION
    将当前工程下的 assets/ 目录（包含 heavy vendor JS、音频、高清壁纸等）同步至又拍云存储空间，
    使线上站点直接通过 https://guzhicdn.21212121.xyz/ 高速加载，避免占用服务器小带宽。
#>

param(
    [string]$Service = "xiaobai5211314",    # 又拍云服务名 (Bucket)
    [string]$Operator = "dabai521",         # 又拍云操作员账号
    [string]$Password = "",                 # 又拍云操作员密码
    [string]$RemoteDir = "/asite/assets/"   # 又拍云远端目标目录
)

$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " ☁️ 又拍云存储静态资产同步助手 (Upyun CDN Sync Tool)" -ForegroundColor Green
Write-Host " 绑定加速域名: https://tc1.21212121.xyz" -ForegroundColor Yellow
Write-Host " 目标同步路径: $RemoteDir" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$assetsDir = Join-Path $PSScriptRoot "assets"

if (-not (Test-Path $assetsDir)) {
    Write-Host "❌ 错误: 未找到本地 assets 目录: $assetsDir" -ForegroundColor Red
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

# 2. 定位 upx CLI 工具
$localUpx = Join-Path $PSScriptRoot "tools\upx.exe"
$upxCmd = ""

if (Test-Path $localUpx) {
    $upxCmd = $localUpx
    Write-Host "✨ 找到项目内置又拍云 CLI: $upxCmd" -ForegroundColor Green
} else {
    $found = Get-Command "upx" -ErrorAction SilentlyContinue
    if ($found) {
        $upxCmd = $found.Source
        Write-Host "✨ 找到系统 PATH 中的又拍云 CLI: $upxCmd" -ForegroundColor Green
    }
}

if (-not $upxCmd) {
    Write-Host "❌ 错误: 未找到 upx.exe！正在自动下载..." -ForegroundColor Yellow
    $toolsDir = Join-Path $PSScriptRoot "tools"
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir | Out-Null }
    $zipUrl = "https://github.com/upyun/upx/releases/download/v0.4.9/upx_0.4.9_windows_amd64.zip"
    $destZip = Join-Path $HOME "upx_tmp.zip"
    Invoke-WebRequest -Uri $zipUrl -OutFile $destZip -TimeoutSec 30
    Expand-Archive -Path $destZip -DestinationPath $toolsDir -Force
    Remove-Item $destZip -Force
    $upxCmd = Join-Path $toolsDir "upx.exe"
}

# 3. 检查登录凭据
$upxCfg = Join-Path $HOME ".upx.cfg"
$needsLogin = $true

if (Test-Path $upxCfg) {
    # 检查是否已有活跃会话
    try {
        $infoOut = & "$upxCmd" info 2>&1
        if ($LASTEXITCODE -eq 0 -and $infoOut -match "Bucket:") {
            Write-Host "🔑 已检测到历史又拍云登录会话: $infoOut" -ForegroundColor Green
            $needsLogin = $false
        }
    } catch {
        $needsLogin = $true
    }
}

if ($needsLogin) {
    if ([string]::IsNullOrWhiteSpace($Operator) -or [string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "🔔 请输入又拍云凭据以完成自动化同步:" -ForegroundColor Yellow
        if ([string]::IsNullOrWhiteSpace($Service)) {
            $Service = Read-Host "请输入又拍云服务名 (Bucket) [默认: guzhicdn]"
            if ([string]::IsNullOrWhiteSpace($Service)) { $Service = "guzhicdn" }
        }
        $Operator = Read-Host "请输入又拍云操作员账号 (Operator)"
        $Password = Read-Host "请输入又拍云操作员密码 (Password)"
    }

    if ([string]::IsNullOrWhiteSpace($Operator) -or [string]::IsNullOrWhiteSpace($Password)) {
        Write-Host "❌ 操作员账号或密码不能为空，退出同步。" -ForegroundColor Red
        exit 1
    }

    Write-Host "🔐 正在登录又拍云 (服务名: $Service, 操作员: $Operator)..." -ForegroundColor Cyan
    & "$upxCmd" login $Service $Operator $Password
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ 登录失败，请检查服务名、操作员账号和密码是否正确！" -ForegroundColor Red
        exit 1
    }
    Write-Host "✅ 又拍云登录成功！" -ForegroundColor Green
}

# 4. 执行同步上传
Write-Host ""
Write-Host "🚀 开始同步静态资产到又拍云..." -ForegroundColor Cyan
Write-Host "   本地路径: $assetsDir" -ForegroundColor Gray
Write-Host "   远端路径: $RemoteDir" -ForegroundColor Gray

& "$upxCmd" sync "$assetsDir" "$RemoteDir" --delete

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 静态资产同步成功！" -ForegroundColor Green
    
    # 5. 校验远端文件
    Write-Host ""
    Write-Host "🔍 正在抽样校验 CDN 可用性..." -ForegroundColor Cyan
    $testUrl = "https://guzhicdn.21212121.xyz/asite/assets/js/cdn-config.js"
    try {
        $res = Invoke-WebRequest -Uri $testUrl -Method Head -TimeoutSec 10 -ErrorAction Stop
        Write-Host "🎉 验证成功！CDN 资源响应正常 (HTTP $($res.StatusCode)): $testUrl" -ForegroundColor Green
    } catch {
        Write-Host "⚠️ CDN 抽样请求返回: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "💡 提示: 又拍云首次创建目录或 CDN 缓存可能需几秒刷新，可在控制台刷新缓存。" -ForegroundColor Gray
    }
} else {
    Write-Host "❌ 同步过程中发生错误，错误代码: $LASTEXITCODE" -ForegroundColor Red
}

Write-Host "==========================================================" -ForegroundColor Cyan
