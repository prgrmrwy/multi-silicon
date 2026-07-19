# Multi-Silicon 当前进度

更新时间：2026-07-20

## 已完成

- 建立八章能力地图、Methodology Home 与 Project Instance 边界。
- 交付 `ms init/status/doctor`，通过 `.multi-silicon/` 提供本地项目实例，并用 Git 本地 exclude 隔离项目数据与桥接。
- 使用 Memex 作为项目级 Memory provider，不复制卡片存储能力。
- 为 Codex 与 Claude 生成项目级 MCP、Skill 与生命周期 Hook 桥接。
- 完成 Hook-first Memory MVP：任务前注入 Recall，任务结束时提供一次 Retro 补漏，第二次 Stop 放行以避免无限循环。
- 完成 Codex 正常开发 sandbox 的宿主验证：Hook 自动加载、Retro reminder 生效、会话自然结束，目标项目 Git 状态保持不变。
- 明确强制凭证边界：Memory/Protocol 不要求 Agent-side shell receipt；不可跳过的完成凭证、审计率和合规指标属于 Harness。

## 已知边界

- 项目同时拥有受版本控制的 `hooks.json` 与本地 `config.toml` Hook 时，Codex 会同时加载并提示使用单一表示；非侵入模式下保留项目自有 Hook，该提示不影响两侧各自运行。
- Codex 已完成真实宿主验证；Claude 当前完成配置与协议测试，仍需要独立的真实宿主验证。
- Project Instance、Memory 卡片与运行状态默认只存在于消费项目本机，不随公共方法论仓库同步。
- `ms upgrade`、结构化 JSON 输出、版本协商和恢复协议尚未实现。

## 本轮审计基线

- Node 测试 11 项通过，OpenSpec 严格校验 2 项通过。
- 公开内容检查覆盖 48 个受 Git 跟踪文件，未发现绝对路径、私钥或常见凭据赋值。
- 完整 Git 历史共 5 个提交，未发现已知公司项目标识或本机绝对路径。
- Git 未跟踪任何 Methodology Home 的 `cards/`、`archive/` 或业务 `.multi-silicon/` 存储。
- npm 发布包已包含运行代码、模板、Skill、架构章节、路线与本交接文档。

## 下一步方向

下一里程碑是 Harness 首个纵向切片：

1. 在实际项目中盘点已有测试、CI、Hook、Skill、独立审查和工程度量；
2. 找出“任务看似完成但缺少证据”的一个真实重复缺口；
3. 定义最小完成条件、检查结果和失败输出协议；
4. 将确定性规则机械化，需要判断的部分交给独立审查 Agent；
5. 验证该切片带来增量价值后，再考虑多 Agent 执行。

暂不建设 lifecycle MCP、通用任务编排、自治循环、远程同步或语义搜索基础设施。

## 换机接续

在另一台机器继续 Methodology Home：

```powershell
git clone git@github.com:prgrmrwy/multi-silicon.git
cd multi-silicon
npm install
npm link
npm test
ms help
```

在新的业务工作区消费时，需要在该机器单独安装兼容的 Memex，并重新执行：

```powershell
npm install --global @touchskyer/memex@0.4.0
ms init <project-path>
ms doctor <project-path>
```

随后由 Codex 或 Claude 审阅并信任该机器上的项目级配置与 Hook。公共仓库不携带另一台机器的业务 Memory、运行 state 或信任记录。
