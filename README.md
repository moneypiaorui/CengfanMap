# 合肥一中2023届35班蹭饭地图

保留原站整屏白蓝地图、顶部校名、两侧校徽与班徽、右侧悬浮导航和居中弹窗。React 19、TypeScript、Vite 负责界面；Vercel Function 从 Neon PostgreSQL 读取同学和教师信息，地图边界继续使用静态 GeoJSON。

## 数据流

`浏览器 → GET /api/directory → Neon PostgreSQL`

- 同学、教师信息从接口加载，前端构建不再包含初始同学录或教师名单。
- 公开同学录接口只允许 GET/HEAD；填报和审核通过独立接口处理，均要求已验证邮箱。数据库连接变量只供服务端使用。
- 响应不缓存，刷新页面会重新读取数据库。数据库中修改学校、专业、昵称或顺序无需重新部署前端。
- 加载失败会提示重试，不会用初始文件冒充数据库返回结果。
- 教师照片保留为本地图片，数据库保存文件名；图片上传和后台编辑功能不在本次迁移范围内。

## 后续升学与就业去向

- 右侧“更新去向”进入填报，使用邮箱验证码登录；每次填报按年份追加，支持本科 / 硕士 / 博士毕业阶段以及继续升学 / 就业 / 其他去向。
- 原本科录取信息独立保留。审核通过后，公开“后续去向”记录；地图的“最新去向”按年份、审核时间选取每位同学最近一站，未更新者继续使用本科位置。境外去向在列表显示。
- 每个已验证账户每小时最多提交 6 次，同一同学只允许该账户保留一条待审核记录；请求 ID 防止网络重试重复写入。
- “我的提交”仅返回当前账户的记录。邮箱、私人备注、退回原因不进入公开接口。
- `/#review` 是审核入口，服务器验证签名、签发方、受众、过期时间和邮箱验证状态，再与 `ADMIN_EMAIL` 精确匹配。页面隐藏按钮不能替代服务端权限检查。
- 管理员可通过或退回，退回必须填写原因；每条记录只能从待审核状态处理一次，并保留审核人和审核时间。

### 登录与发布配置

登录使用 Neon Managed Better Auth，应用通过官方 SDK 的同源 `/api/auth/*` 代理管理 HttpOnly 会话 Cookie，浏览器不依赖第三方 Cookie。提交和审核请求携带 SDK 返回的短期 JWT；退出结束浏览器会话，已签发 JWT 在到期前仍可能有效。

服务端环境变量：`NEON_AUTH_BASE_URL`（对应数据库分支的 Auth URL）、`NEON_AUTH_COOKIE_SECRET`（至少 32 字符的随机值）、`ADMIN_EMAIL`。不要加 `VITE_` 前缀，也不要提交 `.env.local`。

预览使用独立 Neon `work` 分支。**正式启用前需要在正式数据库分支开启 Auth、配置专用 SMTP、添加正式域名并关闭 localhost，然后运行迁移、配置正式环境变量、部署。** 测试分支的默认共享邮件通道只用于开发验证。参见 [Neon Auth 正式发布要求](https://neon.com/docs/auth/production-checklist)。

`@neon/auth` 0.8.2 的固定 fetch 类型与当前 Better Auth 补丁版本存在上游类型冲突。验证码请求统一通过 SDK 的公开 `$fetch` 接口封装，JWT 从其 `getSession().data.session.token` 获取；没有额外安装 Auth 插件或替换托管认证逻辑。

## 已连接的环境

- Neon 免费项目：`cengfan-map-db`（`odd-surf-25070693`），区域 `aws-us-east-1`，PostgreSQL 17，数据库 `cengfan`。
- `production` 分支服务正式站点，`work` 分支用于开发和迁移验证；两者分别保存数据，修改不会自动同步。
- 正式库已导入 49 条同学、6 条教师记录，Vercel Production 的 `DATABASE_URL` 使用服务端连接池地址，并按敏感变量保存。
- 正式站点：[cengfan-map-six.vercel.app](https://cengfan-map-six.vercel.app/)。后续改数据直接操作对应数据库分支，改结构使用新迁移。

## 首次连接与迁移

1. 在 Vercel 项目的 Storage 中创建或连接 Neon 数据库，选择 Free 方案，区域可选与函数接近的 iad1。
2. 将数据库连接到 `cengfan-map` 的 Production 环境，确认注入 `DATABASE_URL` 或 `POSTGRES_URL`。
3. 执行以下任一导入方式，完成后再发布包含接口的源码。

### 方式一：Neon SQL Editor

先安装依赖，再生成 SQL 文件：

```bash
npm ci
npm run db:export
```

将生成的 `db/import-initial.sql` 完整内容放入该数据库的 SQL Editor 执行。文件包含事务、建表、49 条同学记录、6 位教师记录和导入标记。不要只执行选中的部分语句。导出无需数据库连接，生成文件不提交到 Git；SQL 与命令行导入共用同一份迁移计划，避免快照重复维护。

### 方式二：命令行

使用 Node.js 24。安装依赖，将 `.env.example` 的变量配置到本地 `.env.local`，保留已有本地设置，随后执行：

```bash
npm ci
npm run db:migrate
```

命令会报告本次插入数、当前总数，以及初始数据是否已导入。无需把连接值写入代码、命令参数或聊天。

### 导入规则

- 使用独立的 `cengfan` schema，保留 `students`、`teachers`、`seed_migrations`，并以 `schema_migrations` 记录后续结构迁移。`002_destinations.sql` 新增去向提交表和查询索引。
- 保留所有原始记录和显示顺序，每条记录使用稳定 UUID。
- 建表与导入位于同一事务；任一约束失败都会回滚。事务锁避免并行导入冲突。
- 后续 `db/migrations/*.sql` 按文件名顺序应用并记录校验值；再次运行会跳过，修改已应用文件会拒绝执行，应新建迁移。
- 初始快照只导入一次。再次执行不会覆盖数据库中的修改、制造重复记录，或恢复已主动删除的记录。
- `db/seed/*.json` 仅是初始导入快照；后续更新应编辑数据库。结构升级应另建迁移，避免修改已应用的初始快照。

可在 SQL Editor 核对首次导入结果：

```sql
SELECT count(*) FROM cengfan.students; -- 首次应为 49
SELECT count(*) FROM cengfan.teachers; -- 首次应为 6
SELECT version, imported_at FROM cengfan.seed_migrations;
```

## 本地开发

```bash
npm ci
npm run dev
```

开发服务默认使用 5173 端口，开发与生产预览均提供同路径 `/api/directory` 接口。未配置数据库时，接口返回 503，界面展示重试状态；构建本身无需连接数据库。

```bash
npm run typecheck   # 前端、服务端、迁移、测试和配置的类型检查
npm run check       # 类型检查、生产构建和单元/数据库测试
npm run build       # 类型检查 + 生产构建
npm run preview     # 预览生产前端与本地接口
npm test            # 数据过滤、PostgreSQL 迁移及接口测试
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

其他环境可先通过 `npx playwright install chromium` 安装浏览器。

数据库测试使用本地 PostgreSQL 引擎 PGlite，验证完整导入、SQL 导出、幂等、保留修改与删除，以及失败回滚。接口测试验证修改数据库后返回新记录、禁止写入和错误响应不包含连接信息。

浏览器测试会先构建，再在独立的本地 4180 端口启动生产预览，不复用已有服务。使用接口夹具，覆盖桌面与手机的异步加载、错误重试、地图下钻、搜索筛选、教师弹窗、快速开关、动画取消、减少动态效果、键盘焦点与表格滚动。夹具只用于测试；真实 Neon 连接仍须在部署时验证。

## 部署

`vercel.json` 配置 Vite 构建、`dist/` 输出和 `api/directory.ts` Node.js Function。首次发布前须完成数据库连接与导入。

**部署完整源码，包含 `api/`、`server/`、`shared/` 和前端文件。仅上传 `dist/` 不会部署数据库读取接口。** 静态 GitHub Pages 等托管方式需要另外提供后端接口。

`.vercelignore` 为 CLI 部署排除本地依赖、浏览器测试、GitHub 工作流和生成产物。单元测试、迁移文件与初始快照保留给构建检查使用，线上接口仅追踪实际运行依赖。数据库迁移需在部署前单独执行。TypeScript 保留 `.ts` 源码导入，并在服务端打包时转换为 `.js`，确保 Node.js 能解析模块。

生产数据库连接只配置到对应的 Vercel 环境；预览环境应使用独立测试库或 Neon 分支，不复用生产写入权限。环境变量及 `.vercel/` 已排除出 Git。

本地或云工作区的修改需要先提交并推送到 GitHub，才能触发 Vercel 的 Git 自动部署。Vercel 不会反向把云工作区源码保存到 GitHub。

## GitHub 与自动部署

Vercel 项目 `cengfan-map` 已绑定 `moneypiaorui/CengfanMap`。推送 `work` 自动生成 Preview；正式发布使用 `main` 分支。稳定开发预览地址为 [cengfan-map-git-work-moneypiaoruis-projects.vercel.app](https://cengfan-map-git-work-moneypiaoruis-projects.vercel.app/)。

- 暂不配置 GitHub Actions CI 工作流。类型检查、单元/数据库测试和浏览器测试命令保留，可按需在本地运行。
- GitHub Actions 的 `Sync Vercel deployments` 仅接收官方 Vercel App 为本项目发送的 `repository_dispatch` 部署事件，将实际结果登记到 GitHub Deployments。正式环境显示为 `Production`，预览环境按分支显示为 `Preview / 分支名`。工作流不检出代码、不安装依赖、不构建或测试，也不再次发布；仅使用 GitHub 自动提供的短期 `GITHUB_TOKEN` 和 `deployments: write` 权限，无需另配 Vercel Token。
- Vercel Git 集成负责自动部署。Vercel 构建执行 `npm run check`，类型、构建或单元测试失败会阻止本次部署就绪。
- `work` 的 Preview 环境使用独立 Neon 测试分支及其 Auth；Production 环境使用正式分支。经审核的代码合入 `main` 后发布。
- 数据结构迁移与发布分开执行，部署构建不运行 `db:migrate`。

## 目录

```text
api/directory.ts           公开名单和已审核去向
api/submissions.ts         本人提交与提交记录
api/review.ts              管理员审核
api/auth/[...path].ts      官方 Neon Auth 同源代理
server/                    数据库读取、HTTP 响应和本地中间件
shared/directory.ts        接口类型与数据验证
db/
  migrations/              初始建表与后续结构迁移
  seed/                    初始同学、教师快照
  plan.ts                  事务化导入计划与 SQL 渲染
  migrate.ts               数据库迁移与 SQL 导出的统一入口
src/
  App.tsx                  原站布局、地图选择和弹窗状态
  hooks/useDirectoryData.ts 接口加载、取消、超时和重试
  components/              地图、教师、录取表格及可访问弹窗
  data/maps/               全国与省市 GeoJSON
  lib/students.ts          同学搜索与地区筛选逻辑
  lib/map.ts               投影与人数色阶
  styles.css               原站框架、现代细节及动效
public/images/             校名、徽章与教师照片
tests/app.spec.ts          桌面和手机浏览器回归
```

类型和接口校验统一放在 `shared/directory.ts`，组件直接导入类型，不通过数据目录转发。地图资源继续按需加载；全国索引引用的省市地图和数据库引用的教师图片均保留。

## 界面维护

优先保留现有整体框架，细化字体层级、图标、圆角、阴影、手机适配与交互反馈。弹窗支持动画退出与取消、Esc/按钮/背景关闭、焦点约束与恢复；地图按需加载并缓存省份，支持键盘操作和减少动态效果。

## 地图来源

沿用原仓库边界数据，转换为 GeoJSON，保留原版权和来源元数据（Jianshu Technology 等）。地图由 SVG 绘制，不再加载旧 Highcharts、Nunjucks 或全局脚本；边界未重新测绘。
