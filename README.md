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
- 主屏幕启动借鉴 MOJI 的外壳优先：成功安装后从缓存启动，后台检查更新；仅 HTML 与首屏依赖必须配套完整才启用，非首屏弹窗不再阻塞安装，首次打开后按需缓存合法静态资源。保留前一版供旧标签继续加载，仅清理 UsFirst 自己的缓存。账号、申请 API、照片和所有 POST 不进入 Service Worker 缓存、不离线提交。
- HTML 有独立启动提示与重试，申请／详情弹窗按需加载；普通读取 25 秒超时、写操作 20 秒、识别 45 秒，不自动重发。恢复网络、返回前台自动重新读取服务器。
- 启动合并为 `/api/bootstrap` 一次请求；已连接用户由两次索引 SQL 读取返回登录、配对、最近申请及照片元数据，无需先 session 再 requests。后台更新用 revision，未变化不重传完整列表；revision 不作为鉴权凭据。另有设备本地只读快照，见下条。
- 页面脚本下载同时开始启动预取，React 只消费一次；预取完整响应后立即解除超时计时，主脚本迟到不丢弃已完成结果；响应体未完成仍有等待上限。完成首次读取 6 秒后才检查缓存更新，预下载串行避免竞争。成功提交／审批在服务器确认后立即更新界面，后台刷新不阻塞关闭反馈；旧刷新不得覆盖新状态。样式构建仅扫描正式界面，去除设计页与未用模板类。

- 构建将小启动脚本和关键 CSS 内联，减少两个启动请求；脚本使用自动生成的精确 SHA-256 CSP 授权，不开放任意内联脚本。静态资源由 Cloudflare Assets 直接分发，只有 `/api/*` 先运行 Worker，安全头由同一构建同步生成。单生产页面不再携带完整路由库，首页私有照片使用原生加载，首屏 JS 315→249KB（Vite gzip约100→78KB）；C3视觉保持。

- 再次打开时同步读取本设备上次服务器确认的首页快照（有效期24小时），先显示申请文字与金额，后台重新鉴权与同步。快照不保存密码、Cookie、密钥或图片，仅保留白名单字段；旧状态标为上次记录，不表示当前可购买。未确认、网络失败、断网、返回前台时只读；已有本次表单不因相册/拍照返回时的同步而清空，提交前仍需完成同步。创建、审批、撤回、购买标记的按钮及回调均受守卫。切换账号、服务器确认失效、退出或成功写入先删除旧快照；退出即使网络失败也删除本机快照且禁止自动恢复登录，但会提示服务器退出未确认。跨标签退出/账号变化通过generation拒绝旧响应和旧写回调。快照属于该设备浏览器，Safari与主屏幕模式是否共享由iOS决定；首次无快照仍需联网。

- Web Push 消息通知：设置里主动开启；新申请提醒审批人，approve/reject 后提醒申请人。锁屏仅通用提醒，不含昵称、商品、金额或图片；点击通知重新鉴权并读取对应申请，不能从通知直接审批。通知配置与模块按需加载，不加入启动请求。
- 通知订阅绑定本设备登录会话（每账号最多5个订阅），退出时服务器移除、设备取消订阅；过期会话不会推送。消息在申请/审批成功落库后通过 Worker waitUntil 后台加密发送，推送失败不改变原提交结果，404/410 移除失效订阅；无自动重发，不保证即时或必达。支持主屏幕 iPhone、Chrome/Firefox 标准推送，实际 iPhone 弹通知仍待设备授权验收。

- iPhone 主屏幕布局使用稳定高度外壳，内容独立滚动、导航独立底部行，不跟随申请高度或同步提示收缩；底部至少预留34px横条区域，安全区读值短暂归零不再让按钮下落。普通浏览器仍使用原固定导航。`scripts/layout-browser-fixture.py` 的 `/?standalone=1`只在本地激活生产standalone CSS进行长快照→同步与安全区0/34px对照，不是iPhone实机模拟；实际iOS启动/键盘仍待手机确认。

- 独立启动页移到React根节点之外，内联小boot读取白名单快照即刻显示最多30条只读文字记录，不等主脚本。只有可见应用渲染成功才隐藏；组件异常恢复独立启动页和重新加载入口，不展示原始错误。缓存读取失败继续网络，网络与缓存都不可用时SW返回无需JS的恢复页面；不缓存恢复页、API或照片。构建保留精确上一版静态chunks以兼容旧标签；需要指定上一版独立构建目录时用 `USFIRST_PREVIOUS_DIST`，路径仅构建期使用、不进入浏览器。主脚本失败时也后台检查SW更新，而不是等待业务接口成功。手动重新加载使用一次性参数优先获取新HTML，网络失败保留可用旧壳，不删除账号、快照、推送订阅或全局缓存。

- HTML先输出小启动样式、独立正文和快照boot，再输出完整CSS与主模块；正文前4KB、boot前12KB的构建回归防止慢网卡在head导致空白。SW导航网络响应流式返回，不等完整HTML下载；脚本/安装仍完整校验。`/recover.html`是同源新版恢复入口，绕过仅拦截首页的旧SW，载入后替换回首页路径，不换域、不清登录/推送权限。真实本地流式测试在document仍loading、主模块未运行时已显示快照，非iPhone网络实测。

## 性能验证与选择依据

- 选择缩短启动关键路径、核心外壳缓存与静态直出，而不是继续延长业务等待或把私有审批结果离线缓存。
- 官方依据：https://web.dev/articles/optimize-lcp 、https://web.dev/articles/service-worker-caching-and-http-caching 、https://developers.cloudflare.com/workers/static-assets/routing/worker-script/ 、https://developers.cloudflare.com/workers/static-assets/headers/ 。
- 基线 `7de43b0`；本机真实浏览器受控匿名静态传输对照（每请求800ms延迟、50KB/s、HTTP/SW缓存不参与），三次界面可见时间旧版8391/8408/8354ms，新版7041/7011/7045ms，中位数8391→7041ms，约16%。这是实验室条件，不等于iPhone日本VPN线路结果。
- `scripts/benchmark-transport.py` 默认读取 `_backup/performance-baseline-7de43b0` 的旧版dist（本机已保留，Git忽略）和当前dist；在真实浏览器分别打开32917/32918后用 `performance.getEntriesByName('bench-ready')` 读取。没有旧版dist时需在独立目录检出基线并构建，不能把新版当基线。

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
npm run test:critical-startup
npm run test:snapshot-store
npm run test:snapshot-home
npm run test:push
npm run test:push-client
npm run test:boot-recovery
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

推送密钥为独立 Secret `WEB_PUSH_KEYS`（JSON 中的 publicKey / privateKey），仅服务端存私钥。`node scripts/setup-push-secret.mjs` 从内存生成 P-256 密钥并通过 stdin 配置，不写源码或文件；已有密钥时拒绝覆盖，避免使已订阅设备失效。数据库只增加 `0002_push_subscriptions.sql` 表/索引，不迁移或更改原申请数据。iPhone 从主屏幕打开 → 昵称 → 开启通知 → 允许；两人分别在各自设备开启。系统权限拒绝后需在 iPhone 通知设置中调整。

## 实际边界

- 登录账号为自选用户名，不是邮箱；目前无邮箱验证、密码找回、解除连接或账号删除。
- 前台约 8 秒更新，切回页面也更新；后台通知为尽力送达，没有离线审批。
- 当前最多返回最近 300 笔申请；照片适合本双人轻量使用，大规模使用应迁移专用私有对象存储和分页。
- 邀请码请私下传给对方，持有邀请码的已注册用户可以连接。
- 网页只记录审批与购买状态，不能拦截淘宝或其他平台实际付款。
- 尚未完成真实两台 iPhone 的相机、主屏幕安装和长时间会话验收。
