# Undo, Redo, and Shortcuts

Status: COMPLETED on 2026-07-17

## Goal

为 PromptSketch 增加可靠的标注撤销/重做，并为所有绘制工具与颜色槽提供可发现、无输入冲突的键盘快捷键。

## Issue Reference

- 无关联 Issue；需求来自当前任务对话。

## Implementation Details

- 在 `PromptCanvas` 的保留式标注模型上增加有上限的内存历史（建议最多 100 个已提交操作），不保存到 `localStorage`，也不把像素画布作为历史源。
- 历史操作以用户意图为事务边界：一条完整画笔笔画、一个已完成形状、一次从按下到抬起的连续擦除手势，以及一次“清空标注”分别只产生一个撤销步骤。
- 擦除事务需要保留被删除标注及其原始顺序；撤销后必须精确恢复，重做后再次删除。无命中的擦除和空画布上的清空不创建历史项。
- 新操作提交后清空重做栈；撤销/重做后重放标注并同步按钮可用状态。撤销、重做和工具切换不得留下半完成手势或损坏 pointer capture。
- “新建画布”和“粘贴/替换底图”建立新的历史边界并清空撤销/重做栈。本任务不保留跨画布的旧位图、尺寸或视图状态，避免扩大为项目文档历史。
- 在侧栏加入紧凑的 Undo / Redo 控件，提供禁用状态、平台化快捷键提示和可访问标签；快捷键为 `Cmd/Ctrl+Z` 撤销、`Cmd/Ctrl+Shift+Z` 重做，并兼容 `Ctrl+Y`。
- 集中定义默认工具/颜色快捷键，避免事件处理和 UI 提示各自维护映射：`B` 画笔、`E` 橡皮、`R` 矩形、`O` 椭圆、`U` 圆角矩形，`1`–`5` 按当前槽位顺序选择 Black/White、Red、Blue、Green、Yellow。
- 形状快捷键直接切换到 Shape 工具并选择对应形状；颜色快捷键在当前为橡皮时仍更新“下一次绘制使用的颜色”，但保持颜色控件的禁用视觉语义。
- 在工具按钮、形状选项或相邻提示以及各颜色 swatch 上显示键位，使快捷键可发现；使用统一的快捷键路由更新现有 UI 状态，而不是模拟按钮点击。
- 侧栏折叠后在窄轨道内持续展示当前工具快捷键徽标与当前颜色圆点；形状显示具体 `R/O/U`，橡皮状态仍保留下一次绘制颜色。桌面纵向排列，移动端横向排列且不遮挡 Show 控件。
- 折叠轨道提供带 tooltip/ARIA 标签的 New canvas 与 Clear annotations 图标按钮，复用展开侧栏的原动作函数；Clear 继续作为可撤销历史操作，并以危险色与 New canvas 区分。
- 展开侧栏与折叠轨道的 Clear 统一经过确认对话框；仅在存在标注时弹出，说明底图不受影响且操作可撤销，并支持 Cancel、点击遮罩和 Escape 关闭。
- New canvas 对话框提供 Fit workspace 按钮，按侧栏当前展开/折叠后的真实绘图区计算能以 100% 完整展示的自定义宽高；计算与 Reset view 共用响应式留白规则，只回填尺寸并保留 Create 作为最终确认。
- 为画布级动作增加集中定义且可发现的快捷键：`0` 重置视图、`Cmd/Ctrl+N` 打开 New canvas、`Shift+Backspace` 请求清空标注；清空仍需确认，输入保护、对话框保护和按键重复保护与现有快捷键一致。
- 所有无修饰工具/颜色键只在无打开对话框、未进行文字输入且未使用 `Cmd/Ctrl/Alt` 时生效；`select`、range、color 等非文字输入控件即使保留焦点也允许全局工具/颜色快捷键，同时未绑定按键继续交给控件原生处理。重复按键不应生成重复历史或副作用。
- 本轮先交付稳定默认绑定，不增加快捷键编辑器或持久化自定义映射；集中定义的数据结构应允许后续完成 ROADMAP 中的“configurable shortcuts”。

## Test Plan

- Build：运行 `npm run build`，确保 TypeScript 与 Vite 构建通过。
- History：分别绘制单点/长笔画、三类形状，逐步撤销和重做，验证顺序、颜色、压感、形状样式均保持一致。
- Transaction：一次连续擦除多个标注只占一个历史步骤；撤销恢复原顺序，重做再次删除；无命中擦除不改变历史。
- Branching：撤销若干步后进行新绘制，确认重做栈被清空且 Undo/Redo 按钮状态同步。
- Clear/boundary：清空标注可单步撤销；新建画布与粘贴新底图后历史为空，旧画布内容不会被撤销回来。
- Shortcut：在 macOS 与 Ctrl 映射下验证 Undo/Redo；逐一验证 `B/E/R/O/U` 和 `1`–`5`，确认工具、形状、颜色、pressed/selected 状态与键位提示同步。
- Conflict：焦点在 shape select 时验证方向键等未绑定按键仍由控件处理，而 `B/E/R/O/U` 与 `1`–`5` 继续生效；焦点在文字/数字输入、对话框打开、组合键按下或文本被选择时不抢占输入；现有 `Cmd/Ctrl+C/V/S` 行为保持不变。
- Pointer regression：鼠标/触控笔的 pointer up、cancel、lost capture、工具中途切换，以及触控板平移/缩放和 Option-scroll 调整尺寸继续稳定工作。
- Visual/accessibility：检查窄屏和桌面侧栏布局、按钮禁用态、焦点态、`aria-pressed`/`aria-disabled` 与快捷键标签可读性。
- Collapsed rail：折叠侧栏后逐一切换工具、形状、颜色和主题，确认徽标、颜色圆点、tooltip/ARIA 文案同步；在桌面与 390 px 移动视口确认轨道布局不遮挡 Show 控件。
- Quick actions：从折叠轨道打开 New canvas 对话框并取消/创建；绘制后通过折叠态 Clear 清空并撤销恢复；在 320/390 px 视口确认两个操作按钮可点击且不与状态或 Show 控件重叠。
- Clear confirmation：空画布点击 Clear 不弹框；有标注时分别验证 Cancel、遮罩、Escape 不改变历史，确认后清空且可撤销；展开与折叠入口行为一致。
- Fit workspace：在侧栏展开、折叠两种状态下验证按钮切换至 Custom 并回填对应绘图区尺寸；创建后画布以 100% 比例居中且完整显示，窄屏尺寸仍遵守 320–4096 的边界。
- Canvas action shortcuts：验证 `0` 重置平移/缩放、`Cmd/Ctrl+N` 打开 New canvas、`Shift+Backspace` 在有标注时打开 Clear 确认框；确认按钮、折叠轨道 tooltip/ARIA 显示绑定，并确保输入框、打开的对话框和长按不会触发动作。

## Focusing Files

- `src/canvas.ts` — 标注事务、历史栈、Undo/Redo API、历史状态回调与历史边界。
- `src/main.ts` — History 控件、统一快捷键路由、工具/形状/颜色状态同步。
- `src/shortcuts.ts`（新增）— 默认键位、动作类型和展示标签的单一来源。
- `src/styles.css` — History 控件、键位提示及 swatch/tool 快捷键标记样式。

## Technical Context

- 项目使用 TypeScript + Vite，不使用前端框架，部署目标为静态 GitHub Pages。
- `PromptCanvas` 已将底图与 `Annotation[]` 标注模型分层；标注是可重放的 stroke/shape 对象，适合作为历史源，像素只是派生输出。
- 橡皮通过过滤保留式标注实现整笔/整形状删除，不能触碰粘贴图片、主题背景或网格。
- Web 应用不能可靠覆盖所有浏览器/系统快捷键；现有 I/O 快捷键已对编辑控件、选中文本与模态对话框做保护。
- 产品不保存绘图项目；`localStorage` 仅用于颜色等轻量偏好，撤销历史只存在于当前页面会话。

## Task Checklist

- [x] 定义集中式快捷键动作与默认映射，并为平台修饰键生成一致的展示文本。
- [x] 为 `PromptCanvas` 增加有限历史栈、可用状态回调和 `undo()` / `redo()` 公共 API。
- [x] 将笔画、形状、连续擦除与清空纳入准确的事务边界，处理 cancel/lost capture/工具切换。
- [x] 在新建画布和替换底图时重置历史，确保 base layer 生命周期与历史边界一致。
- [x] 增加 Undo/Redo 控件及其 disabled、ARIA、快捷键提示同步。
- [x] 接入 `Cmd/Ctrl+Z`、`Cmd/Ctrl+Shift+Z`、`Ctrl+Y`，同时保留原有 I/O 与原生编辑保护。
- [x] 接入 `B/E/R/O/U` 工具快捷键和 `1`–`5` 颜色快捷键，复用明确的状态更新函数。
- [x] 在工具与颜色 UI 上展示键位，并完成桌面/窄屏视觉与键盘可达性检查。
- [x] 在折叠侧栏中展示并同步当前工具与颜色，完成桌面/移动端布局检查。
- [x] 在折叠轨道中加入 New canvas 与可撤销 Clear 快捷按钮，并验证最窄移动布局。
- [x] 为所有 Clear 入口增加仅在有标注时出现的确认对话框，并验证取消、确认与撤销路径。
- [x] 在 New canvas 对话框加入 Fit workspace，并验证展开/折叠侧栏下的尺寸与 100% 初始视图。
- [x] 为 Reset view、New canvas 与 Clear 增加集中式快捷键、可发现提示和冲突保护。
- [x] 运行构建及完整手工回归，记录任何浏览器级快捷键限制。
