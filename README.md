# UsFirst · 一起花

两个人的极简消费审批：注册 → 邀请码连接 → 发起申请 → 对方审批 → 获批后标记购买。

## 已实现

- 注册、登录与退出；账号名、昵称、密码。密码加盐 PBKDF2，HttpOnly 会话 Cookie。
- 一次性 24 小时邀请码，每个账号只能连接一位伙伴；并发连接在 D1 事务内处理。
- 申请、同意、拒绝、撤回和购买标记。服务端校验双人隔离、角色权限及原状态。
- 名称、人民币整数分金额、网购／外卖／其他、选填理由和最多三张照片。
- 照片经客户端压缩后存入私有 D1；读取需登录且为同一对成员，无公开照片地址。
- 图片直开、放大；主页拒绝只进入一次简短确认，不再绕申请详情。
- C3 莓粉 × 青柠、实底按压按钮、主屏幕 manifest 与 iPhone safe-area。
- 同源 Worker 图片识别 API，使用 OpenRouter Qwen3.7 Flash，字段证据校验、超时和限流。需要单独配置服务端密钥。
- 正式主页没有演示身份、示例申请和重复导航。旧设计源码保留，但生产不注册设计演示路由。

## 部署状态

已发布到独立 Cloudflare Worker： https://usfirst.pardus-team-william.workers.dev 。本次 OpenRouter 凭据已配置为服务端 Secret，不在源码和构建产物中。前后端类型及构建通过；42项本地接口回归通过；新 Worker 识别入口已真实调用成功（约4.8秒，无价格毛衣照片金额保持空白）。真实两台 iPhone 端到端验收尚未完成。

## 本地运行

```sh
npm ci
npm run build
npm run db:local
npm run dev:api
```

使用 Wrangler 终端返回地址（本项目端口 28789）。前后端同源，避免开发代理 Origin 差异。

```sh
npm run lint
npm run typecheck:worker
npm run test:api
node scripts/test-recognition.mjs --self-test
```

接口回归只允许 localhost，使用随机测试账号，不写入线上。默认照片路径来自本地独立演示；也可设 `TEST_PHOTO` 指向一张 JPEG。

## Cloudflare

`wrangler.jsonc` 绑定独立 `usfirst` Worker 和 `usfirst-db` 数据库，不复用其他应用。

```sh
npm run db:remote
npm run deploy
```

图片识别密钥只通过以下交互式命令输入，不写入源码、VITE 变量或 public：

```sh
npx wrangler secret put OPENROUTER_API_KEY
```

此前在聊天中出现的密钥应撤销更换。配置后页面会读取服务可用状态，选择照片经 Worker 发给模型；结果由本人核对，不自动提交或审批。

## 实际边界

- 登录账号为自选用户名，不是邮箱；目前无邮箱验证、密码找回、解除连接、账号删除或推送通知。
- 前台约 8 秒更新，切回页面也更新；没有后台推送或离线审批。
- 当前最多返回最近 300 笔申请；照片适合本双人轻量使用，大规模使用应迁移专用私有对象存储和分页。
- 邀请码请私下传给对方，持有邀请码的已注册用户可以连接。
- 网页只记录审批与购买状态，不能拦截淘宝或其他平台实际付款。
- 尚未完成真实两台 iPhone 的相机、主屏幕安装和长时间会话验收。
