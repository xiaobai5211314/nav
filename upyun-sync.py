#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
小白数字空间 · 又拍云存储 (Upyun CDN) 静态资产一键同步脚本 (Python 版)
支持：
1. 自动调用内置 tools/upx.exe
2. 原生 Python HTTP REST API 上传（无需第三方库）
3. 自动同步 assets/ 目录下所有 JS、CSS、音视频、图片资源至 /asite/assets/
"""

import os
import sys
import time
import hashlib
import mimetypes
import subprocess
from pathlib import Path
import urllib.request
import urllib.error
from datetime import datetime, timezone

PROJECT_ROOT = Path(__file__).resolve().parent
ASSETS_DIR = PROJECT_ROOT / "assets"
TOOLS_UPX = PROJECT_ROOT / "tools" / "upx.exe"

DEFAULT_SERVICE = "guzhicdn"
REMOTE_PREFIX = "asite/assets"


def get_upx_path():
    if TOOLS_UPX.is_file():
        return str(TOOLS_UPX)
    from shutil import which
    sys_upx = which("upx")
    if sys_upx:
        return sys_upx
    return None


def run_upx_sync(service, operator, password, remote_dir="/asite/assets/"):
    upx_bin = get_upx_path()
    if not upx_bin:
        print("[-] 未找到 upx.exe，将使用原生 REST API 上传模式。")
        return False

    print(f"[*] 使用 Upyun CLI: {upx_bin}")
    
    # 尝试登录
    login_cmd = [upx_bin, "login", service, operator, password]
    res = subprocess.run(login_cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"[-] upx 登录失败: {res.stderr or res.stdout}")
        return False
    print("[+] upx 登录成功！")

    # 执行同步
    sync_cmd = [upx_bin, "sync", str(ASSETS_DIR), remote_dir, "--delete"]
    print(f"[*] 正在同步: {ASSETS_DIR} -> {remote_dir}")
    sync_res = subprocess.run(sync_cmd)
    return sync_res.returncode == 0


def upload_via_rest_api(service, operator, password, remote_prefix="asite/assets"):
    print("[*] 正在通过又拍云官方 REST API 进行文件同步...")
    pwd_md5 = hashlib.md5(password.encode("utf-8")).hexdigest()
    
    files = [p for p in ASSETS_DIR.rglob("*") if p.is_file()]
    total_files = len(files)
    print(f"[*] 待上传文件总数: {total_files}")

    success_count = 0
    fail_count = 0

    for idx, fpath in enumerate(files, 1):
        rel_path = fpath.relative_to(ASSETS_DIR).as_posix()
        remote_path = f"/{service}/{remote_prefix}/{rel_path}"
        remote_url_path = f"/{remote_prefix}/{rel_path}"
        
        file_bytes = fpath.read_bytes()
        content_len = len(file_bytes)
        
        # GMT 日期
        now_gmt = datetime.now(timezone.utc).strftime("%a, %d %b %Y %H:%M:%S GMT")
        
        # 签名: PUT&<URI>&<DATE>&<CONTENT_LENGTH>&<PASSWORD_MD5>
        sign_str = f"PUT&{remote_path}&{now_gmt}&{content_len}&{pwd_md5}"
        signature = hashlib.md5(sign_str.encode("utf-8")).hexdigest()
        auth_header = f"UpYun {operator}:{signature}"

        url = f"http://v0.api.upyun.com{remote_path}"
        headers = {
            "Authorization": auth_header,
            "Date": now_gmt,
            "Content-Length": str(content_len),
            "mkdir": "true"
        }
        
        mime, _ = mimetypes.guess_type(str(fpath))
        if mime:
            headers["Content-Type"] = mime

        req = urllib.request.Request(url, data=file_bytes, headers=headers, method="PUT")
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                if resp.status in (200, 201):
                    print(f"[{idx}/{total_files}] OK: {rel_path} ({content_len / 1024:.1f} KB)")
                    success_count += 1
                else:
                    print(f"[{idx}/{total_files}] HTTP {resp.status}: {rel_path}")
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode("utf-8", errors="ignore")
            print(f"[{idx}/{total_files}] 失败: {rel_path} - HTTP {e.code} ({err_msg})")
            fail_count += 1
        except Exception as e:
            print(f"[{idx}/{total_files}] 异常: {rel_path} - {e}")
            fail_count += 1

    print(f"\n[+] 同步结束: 成功 {success_count} 个, 失败 {fail_count} 个")
    return fail_count == 0


def main():
    print("=" * 60)
    print(" ☁️  小白数字空间 · 又拍云存储 (Upyun CDN) 资产上传工具")
    print(" 绑定域名: https://guzhicdn.21212121.xyz/asite/assets/")
    print("=" * 60)

    if not ASSETS_DIR.exists():
        print(f"[-] 未找到本地 assets 目录: {ASSETS_DIR}")
        sys.exit(1)

    import argparse
    parser = argparse.ArgumentParser(description="又拍云 CDN 资产同步工具")
    parser.add_argument("--service", "-s", default=DEFAULT_SERVICE, help="又拍云服务名 (Bucket)")
    parser.add_argument("--operator", "-u", default=os.environ.get("UPYUN_OPERATOR", ""), help="又拍云操作员账号")
    parser.add_argument("--password", "-p", default=os.environ.get("UPYUN_PASSWORD", ""), help="又拍云操作员密码")
    parser.add_argument("--remote-dir", "-r", default="/asite/assets/", help="又拍云目标存储路径")

    args = parser.parse_args()

    service = args.service
    operator = args.operator
    password = args.password

    if not operator:
        operator = input("请输入又拍云操作员账号 (Operator): ").strip()
    if not password:
        import getpass
        try:
            password = getpass.getpass("请输入又拍云操作员密码 (Password): ").strip()
        except Exception:
            password = input("请输入又拍云操作员密码 (Password): ").strip()

    if not operator or not password:
        print("[-] 账号或密码为空，退出。")
        sys.exit(1)

    # 优先使用 upx
    success = run_upx_sync(service, operator, password, args.remote_dir)
    if not success:
        print("[!] 切换至 REST API 模式重试...")
        clean_remote = args.remote_dir.strip("/")
        success = upload_via_rest_api(service, operator, password, clean_remote)

    if success:
        print("\n[+] 静态资产已全部同步至又拍云！")
        print(f"[+] 加速访问验证链接: https://guzhicdn.21212121.xyz/{args.remote_dir.strip('/')}/js/cdn-config.js")
    else:
        print("\n[-] 同步过程中有部分失败，请检查账号权限或重试。")


if __name__ == "__main__":
    main()
