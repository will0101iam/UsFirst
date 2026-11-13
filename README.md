# UsFirst · 一起花

两个人的极简消费审批网页：申请一笔 → 对方决定 → 同意后购买。

## 当前状态

这是 **C3 前端原型和图片识别接入准备代码**，不是已完成的 Cloudflare 全栈产品。

已实现：
- 莓粉 × 青柠 UI、单笔聚焦和实体按压按钮。
- 图片优先申请抽屉：拍照／上传 → 确认名称、金额、类别 → 提交。
- 当前浏览器内的申请、批准、拒绝、撤回和已购买记录。
- 主屏幕 manifest 和 Apple 元信息。
- Qwen3.7 Flash 的短提示词、字段校验和命令行真实识别测试工具。

尚未实现：
- 两个固定账号的真实登录、服务端权限、双手机同步。
- 私有云照片存储。
- 申请页中的真实 LLM 调用：主页面没有注入 recognizer。
- Cloudflare 专用构建、Worker 后端、绑定和部署。

**演示身份切换不是登录，数据只存在当前浏览器。** 网页不会拦截购物平台付款或代下单。

## 本地运行

```bash
npm ci
npm run dev -- --host 127.0.0.1 --port 28371
```

打开终端输出的本地地址。这不是 iPhone 可访问的正式 HTTPS 地址。

```bash
npm run lint
node scripts/test-recognition.mjs --self-test
```

## 图片识别

默认模型为 `qwen/qwen3.7-flash`。

- `src/lib/recognition-config.ts`：模型、短提示词和参数。
- `src/lib/image-recognition-contract.ts`：字段级校验；未知、无证据或不一致的金额清空。
- `scripts/test-recognition.mjs`：命令行测试，支持 1–3 张 JPEG／PNG／WebP。
- `src/lib/backend-contract.ts`：尚未接通的后端接口契约。

用安全方式设置当前终端的 `OPENROUTER_API_KEY` 环境变量后，可执行：

```bash
node scripts/test-recognition.mjs /absolute/path/to/image.png
```

密钥不得提交到 GitHub，不能放进 HTML、`VITE_*` 或 public 目录。网页识别必须经有认证和限流的服务端代理。用户需核对结果后提交，不自动审批。

## Cloudflare 部署前的必要迁移

当前 `npm run build` 将产物拆成 `dist/output` 与 `dist/output_resource`，不是 CF 单目录构建，不可只上传其中一层。

部署前需完成统一前端输出与 SPA/API 路由、固定账号会话与审批权限、D1 共享申请、R2 私有图片、Worker Secrets 及真实识别 API，并在两台 iPhone 上验收。

当前没有 Wrangler 配置或正式线上地址。仓库是开发起点，不是完整产品已上线的证明。

## 设计与本地资料

C3 为本项目选定方向。部分移动端操作范式参考 https://github.com/will0101iam/moji-journal 。设计比较页位于 `/designs` 与 `/designs/focus`，是开发演示而非正式产品入口。

备份、参考原件、密钥和个人测试资料不随仓库上传。独立图片交互 HTML 示例和开发交接留在本地项目总目录；独立示例的图片直开和简短拒绝流程尚未同步到主工程。
