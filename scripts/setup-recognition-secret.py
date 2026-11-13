#!/usr/bin/env python3
"""Configure only UsFirst's server-side OpenRouter secret; never persist plaintext."""
import getpass
import pathlib
import re
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1]
key = getpass.getpass('请粘贴新的 OpenRouter 密钥（输入隐藏，回车提交）：').strip()
if not re.fullmatch(r'sk-or-v1-[a-fA-F0-9]{32,128}', key):
    print('密钥格式不正确，未保存。')
    sys.exit(1)
result = subprocess.run(
    ['node', str(root / 'node_modules/wrangler/bin/wrangler.js'), 'secret', 'put', 'OPENROUTER_API_KEY', '--config', str(root / 'wrangler.jsonc')],
    input=key + '\n', text=True, cwd=root,
)
key = ''
if result.returncode:
    print('配置未成功，请检查上方 Cloudflare 提示。')
    sys.exit(result.returncode)
print('UsFirst 图片识别密钥已保存到 Cloudflare；刷新应用即可使用。')
