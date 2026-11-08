# 水鱼（Diving-Fish）OAuth 接入指南

> 整理时间：2026-11-09
> 来源：官方开发者文档 <https://maimai.diving-fish.com/manual/docs/developer/>
> 用途：日后需要读取用户完整成绩 / 写操作时查阅，**当前项目尚未接入**

---

## 一、现状与时间线

- **Developer-Token 已停止签发**
- 以下端点于 **2027-01-01 00:00（UTC+8）停止服务**，届时一律返回 `410 Gone`：

  ```
  /dev/player/records
  /dev/player/record
  /query/plate
  /channel_to_qq
  ```

- **`/query/player`（本项目 B50 查分在用）不在废弃列表**。文档明确：查询用户基本信息（含 B50、rating）无需验证信息即可访问，能否查到取决于用户隐私设置。

结论：现有查分功能不需要迁移。真正需要 OAuth 的是「读取完整成绩」和「写成绩」。

---

## 二、授权服务器与端点

根地址：`https://auth.diving-fish.com`

> 只硬编码根地址，其余端点一律从发现文档读取，以便日后调整时无需改代码。

| 发现文档 | 说明 |
|----------|------|
| `/.well-known/openid-configuration` | OpenID Connect Discovery |
| `/.well-known/oauth-authorization-server` | RFC 8414，内容与上者相同 |
| `/.well-known/jwks.json` | 验签公钥集合，建议缓存 5 分钟 |

标准 OIDC 客户端库（`authlib`、`oidc-client-ts`、`openid-client`）只需提供发现文档地址即可自动完成配置。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/oauth/authorize` | GET / POST | 授权端点 |
| `/oauth/token` | POST | 令牌端点 |
| `/oauth/device_authorization` | POST | 设备码 |
| `/oauth/userinfo` | GET / POST | 用户信息 |
| `/oauth/revoke` | POST | 撤销 |
| `/oauth/logout` | GET / POST | 登出 |

用户页面：

- 开发者控制台 `https://auth.diving-fish.com/console` — 登记应用、生成 client_secret
- 设备码绑定页 `https://auth.diving-fish.com/device` — 用户输入用户码确认授权

---

## 三、登记应用

1. 用**水鱼账号**登录控制台 → 「登记新应用」
2. 填写：应用名称（≤20 字）、描述（≤100 字）、主页（可留空，填则须可公开访问）、接入方式、部署形态、所需权限
3. **只读权限自动审核**，结果立即显示；**含写入权限转人工审核**，通过前写入权限不生效
4. 若是机密客户端，登记完成后还需**单独生成 client_secret**（登记与生成是两个动作，只做前者会导致所有请求 401）
5. `client_secret` **只在生成时显示一次**，服务端只存哈希

---

## 四、部署形态与接入方式

### 4.1 部署形态（判断标准只有一条：client_secret 能否只留在自己手上）

| 场景 | 客户端类型 | 凭据 |
|------|-----------|------|
| 自己运行的 bot / 网站 / 后端服务 | 机密客户端 | 有 client_secret |
| 插件、桌面程序、开源后由用户自行搭建 | 公开客户端 | 无 client_secret，靠 PKCE + refresh token |

### 4.2 接入方式

| 应用形态 | 接入方式 |
|----------|----------|
| 网站、桌面客户端、移动应用（有可登记的回调地址） | 授权码 + PKCE |
| 自己运行的 QQ 机器人、CLI、脚本（无浏览器、无公网回调） | 设备码绑定 + 换票 |
| 分发给用户各自部署、且开不了回调地址 | 设备码绑定 + refresh token |

补充：

- 三种方式不互斥，但一个应用通常只需要一种
- 桌面/移动应用填 `http://127.0.0.1/callback` 一类的本机回环地址即可走「授权码 + PKCE」，
  端口不参与比对
- 方式二与方式三绑定阶段完全相同，区别只在取令牌：机密客户端凭 client_secret 随时换票，
  公开客户端为每位用户各存一把 refresh token

---

## 五、Scope 清单

| Scope | 说明 |
|-------|------|
| `openid` | OIDC 基础 |
| `profile` | 用户基本资料 |
| `prober.profile.read` | 读查分器玩家资料 |
| `prober.records.read` | 读成绩 |
| `prober.records.write` | 写成绩（需人工审核） |

---

## 六、安全要点

- **PKCE 强制**，机密客户端也不例外；`code_challenge_method` 只接受 `S256`，
  缺少 `code_challenge` 的授权请求直接返回 400
- `client_secret` 只在生成时显示一次，切勿写入前端代码或公开仓库
- **认证方式严格比对**：机密客户端少传 `client_secret`、或公开客户端多传，都会得到
  `401 invalid_client`
- 必须校验 `state` 与 `nonce`

---

## 七、新旧体系差异（Developer-Token vs OAuth）

| 对比项 | Developer-Token | 水鱼账号 OAuth |
|--------|----------------|----------------|
| 应用凭据 | 一个长期 Token | client_id + client_secret 换取 5~15 分钟的 access token |
| 查询对象 | 请求中的 `qq` / `username` 参数 | **由 access token 本身决定**，新端点不再接受参数 |
| 用户许可 | 无，持有 Token + QQ 号即可读任意用户 | 必须由用户逐个授权，可随时在账号设置中撤销 |
| 权限范围 | 全部只读接口 | 按 scope 逐项申请、逐项审核 |
| 写成绩 | 不支持 | 支持，需人工审核 |
| 频率限制 | 按小时计的整体请求数 | 按应用 + 按用户分别计算的每日配额 |

端点对照：

| 已废弃 | 替代端点 | 所需 scope |
|--------|----------|-----------|
| `GET /dev/player/records?qq=` | `GET /player/records` | `prober.records.read` |
| `POST /dev/player/record` | `POST /player/record` | `prober.records.read` |
| `POST /query/plate` | `POST /player/plate` | `prober.records.read` |

---

## 八、对本项目的评估

### 8.1 架构现状

纯前端 SPA（Vite + IndexedDB），**没有后端**。

### 8.2 若要接入 OAuth

- 部署形态只能算「分发给用户各自部署」→ **公开客户端**（无 client_secret，用 PKCE）
- 公开客户端需要为每位用户保存 refresh token，而浏览器 `localStorage` 是明文可读的
- 两条路：
  - **A. 接受风险**：refresh token 只够读该用户自己的成绩，泄露影响有限
  - **B. 引入轻量后端代理**：把令牌保存在服务端，前端只拿短期 access token

### 8.3 现阶段结论：不需要接入

当前所有功能都不依赖 OAuth：

| 功能 | 使用的接口 | 是否需要 OAuth |
|------|-----------|---------------|
| 曲库 | `music_data` | 否（公开） |
| 全服统计 | `chart_stats` | 否（公开） |
| B50 查分 | `query/player` | 否（未废弃，受用户隐私设置约束） |
| 探索推荐 | `vote_result` | 否（公开，但未文档化，见下） |
| 导入成绩 | 登录 + Import-Token | 否（走的是旧流程，未在废弃列表） |

> 注：`vote_result` 未写入官方文档，属公开但未承诺的接口，已在探索功能中做 24h 缓存与失败降级。

### 8.4 触发接入的条件（出现任一才动手）

1. 需要用 `/player/records` 读取用户**完整成绩**（`/dev/player/records` 停服后）
2. 需要做**成绩上传**等写操作
3. 需要做依赖用户级授权的个性化功能（如跨设备同步）
