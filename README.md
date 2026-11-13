# UsFirst · 一起花

两个人的极简消费审批网页：申请一笔 → 对方决定 → 同意后购买。

## 当前状态

当前为 C3 前端原型和图片识别接入准备代码，不是已完成的 Cloudflare 全栈产品。

已实现莓粉 × 青柠 UI、单笔聚焦和实体按压按钮、图片优先申请抽屉、本浏览器内的审批状态记录、主屏幕 manifest，以及 Qwen3.7 Flash 的短提示词、返回校验和命令行测试工具。

尚未实现真实固定账号登录、服务端审批权限、双手机同步、私有云照片、申请页中的真实 LLM 调用、Cloudflare 专用构建与 Worker 后端。

演示身份切换不是登录，数据只存在当前浏览器。网页不会拦截购物平台付款或代下单。

## 本地运行

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 28371
```

## 检查

```bash
npm run lint
node scripts/test-recognition.mjs --self-test
```

## 密钥安全

密钥不得进入 HTML、VITE_*、public、GitHub 或日志。正式网页识别必须由有认证和限流的服务端代理调用。识别字段需要用户核对，不自动提交或审批。

## Cloudflare

现有前端模板将构建产物拆到 dist/output 与 dist/output_resource，不可只上传其中一层。正式部署前需完成统一前端输出、API 路由、会话权限、D1 共享数据、R2 私有图片及 Worker Secrets。

本仓库尚无正式部署地址。
