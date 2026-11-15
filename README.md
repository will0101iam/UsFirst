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
- 同源 Worker 图片识别 API，使用 OpenRouter Qwen3.7 Flash，字段证据校验、超时和限流。识别现价、规格价、明确券后价、实付／应付中的最低购买价，支持区间下限与起价，排除划线原价、优惠券金额、分期每期金额、运费和定金；无可信价格留空。最低价仍需核对规格、优惠条件及运费。需要单独配置服务端密钥。
- 关闭未提交申请后丢弃本次填写、照片和识别状态；再次发起为全新申请。返回图片选择仍保留本次填写；旧异步照片处理和识别结果不会回填新表单。
- 正式主页没有演示身份、示例申请和重复导航。旧设计源码保留，但生产不注册设计演示路由。
- 主屏幕启动借鉴 MOJI 的外壳优先：成功安装后从缓存启动完整页面资源，后台检查更新，更新文件必须全部成功且配套才启用；保留前一版供旧标签继续加载，仅清理 UsFirst 自己的缓存。账号、申请 API、照片和所有 POST 不缓存、不离线提交。
- HTML 有独立启动提示与重试，申请／详情弹窗按需加载；普通读取 25 秒超时、写操作 20 秒、识别 45 秒，不自动重发。恢复网络、返回前台自动重新读取服务器。
- 启动合并为 `/api/bootstrap` 一次请求；已连接用户由两次索引 SQL 读取返回登录、配对、最近申请及照片元数据，无需先 session 再 requests。后台更新用 revision，未变化不重传完整列表；revision 不作为鉴权凭据，数据只在本页内存，退出即清空。
- 页面脚本下载同时开始启动预取，React 只消费一次；预取完整响应后立即解除超时计时，主脚本迟到不丢弃已完成结果；响应体未完成仍有等待上限。完成首次读取 6 秒后才检查缓存更新，预下载串行避免竞争。成功提交／审批在服务器确认后立即更新界面，后台刷新不阻塞关闭反馈；旧刷新不得覆盖新状态。样式构建仅扫描正式界面，去除设计页与未用模板类。

## 部署状态

主要访问入口： https://usfirst.sopia.work/ （自定义域名，连接现有 UsFirst Worker 与原数据库）。原默认入口 https://usfirst.pardus-team-william.workers.dev 继续保留。自定义域名已通过本机 Chrome 登录页面渲染验证；用户手机访问待确认。本次 OpenRouter 凭据已配置为服务端 Secret，不在源码和构建产物中。前后端类型及构建通过；42项本地接口回归通过；新 Worker 识别入口已真实调用成功（约4.8秒，无价格毛衣照片金额保持空白）。真实两台 iPhone 端到端验收尚未完成。

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
npm run test:minimum-price
npm run test:request-form
npm run test:recognition-errors
npm run test:network-recovery
npm run build && npm run test:shell-cache
npm run test:bootstrap
npm run test:startup-scheduling
npm run test:home-performance
```

接口回归只允许 localhost，使用随机测试账号，不写入线上。默认使用仓库内的小尺寸测试照片；也可设 `TEST_PHOTO` 指向一张 JPEG。

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
