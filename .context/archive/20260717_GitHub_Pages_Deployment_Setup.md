# ACTIVE_TASK

Status: COMPLETED on 2026-07-17

## Goal

通过 GitHub Actions 为 Vite 静态应用建立可自动发布到仓库 GitHub Pages 项目站点的部署链路。

## Issue Reference

- 无关联 GitHub Issue。
- 对应 `ROADMAP.md` 中 “Deploy to GitHub Pages” 里程碑的部署准备工作。

## Implementation Details

- 目标站点采用 GitHub Pages 项目仓库地址：`https://akashisensei.github.io/PromptSketch/`。
- 新增 Vite 配置，将资源基路径设置为 `/PromptSketch/`，避免 Pages 子路径下的 JavaScript 和 CSS 资源返回 404。
- 新增 Pages 专用 GitHub Actions workflow：在 `main` 推送时自动运行，并支持 `workflow_dispatch` 手动重跑。
- workflow 使用 npm lockfile 的可复现安装与现有构建命令：`npm ci`、`npm run build`。
- workflow 仅上传 `dist/` 作为 Pages artifact，不提交生成目录或维护 `gh-pages` 分支。
- workflow 使用固定提交版本的 GitHub 官方 Pages actions，授予最小权限 `contents: read`、`pages: write`、`id-token: write`，绑定 `github-pages` environment，并通过 concurrency 避免旧部署覆盖新部署。
- 已通过 GitHub API 创建 PromptSketch Pages 站点，将 Source 设置为 GitHub Actions，并启用 HTTPS。
- 当前应用没有后端、远端存储或客户端路由，不需要额外的服务端能力或 SPA 404 fallback。
- 当前方案假设继续使用仓库项目地址；若以后改用自定义域名，需同步将 Vite `base` 调整为 `/` 并配置 Pages custom domain。
- 包含本任务的提交推送到 `main` 后，首次 workflow 成功完成，项目站点及其 JavaScript、CSS 资源均已通过公网访问验证。

## Test Plan

- Build：`npm ci` 与 `npm run build` 均通过，TypeScript 检查和 Vite 构建成功。
- Artifact：已确认 `dist/index.html` 的资源 URL 带有 `/PromptSketch/` 基路径，且 `dist/` 保持 Git 忽略。
- Workflow：YAML 解析通过；触发分支、最小权限、Pages environment、artifact、deploy 与 concurrency 配置已核对。
- Actions：workflow 中五个固定的官方 Action 提交均已通过 GitHub API 确认存在。
- Local：开发服务器会从 `/` 跳转到 `/PromptSketch/`，项目页面和入口模块返回 200。
- Preview：生产预览的页面、JavaScript 与 CSS 均在 `/PromptSketch/` 下返回 200。
- GitHub：Pages 配置返回 `build_type: workflow`、HTTPS 已启用；Actions run `29564074283` 成功，目标页面、JavaScript 与 CSS 均通过公网 200 响应验证。

## Focusing Files

- `vite.config.ts`
- `.github/workflows/deploy-pages.yml`
- `.context/ROADMAP.md`
- `.context/archive/20260717_GitHub_Pages_Deployment_Setup.md`

## Technical Context

- 技术栈是 TypeScript + Vite，无前端框架。
- 产品方向明确为 local-first 静态应用：无账号、无后端、无远端项目存储。
- GitHub Pages 已被 SPEC 选为静态托管方案，ROADMAP 也已列出部署里程碑。
- 剪贴板图片写入依赖 HTTPS、安全上下文、浏览器支持、权限和用户手势；后续功能变更仍应保留真实浏览器回归。
- GitHub Pages 适合当前静态架构，但不能承载未来可能新增的后端行为。

## Task Checklist

- [x] 新增 Vite 配置，为 GitHub Pages 项目站点设置 `/PromptSketch/` 基路径。
- [x] 新增 `main` push + 手动触发的 GitHub Pages deployment workflow。
- [x] 使用 lockfile 安装依赖、执行现有构建，并上传 `dist/` Pages artifact。
- [x] 配置 Pages deployment 所需的最小权限、environment 与 concurrency。
- [x] 本地执行干净安装和生产构建，验证生成资源路径。
- [x] 验证本地开发服务器和生产预览的项目子路径。
- [x] 确认固定的 GitHub Actions 提交引用有效。
- [x] 将仓库 Pages Source 设置为 GitHub Actions 并启用 HTTPS。
- [x] 审查最终 diff，确保不提交 `dist/`、凭据或无关改动。
- [x] 完成首次 Actions 部署、公网页面和静态资源验证，并勾选 ROADMAP 部署里程碑。
