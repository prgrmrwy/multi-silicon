# Design: Project-scoped Memory lifecycle

## Context

Multi-Silicon 需要一个稳定的 Memory 能力域，同时避免复制 Memex 已有的卡片存储能力。项目实例已经提供 `.multi-silicon/memory`，因此集成重点是边界适配和生命周期语义，而不是新建数据库。

## Decisions

### Memex remains the provider

`ms memory search/read/links/doctor` 等存储原语 SHALL 委托原生 Memex，并将 `MEMEX_HOME` 指向当前项目实例。

### Recall and Retro remain Agent semantics

Recall 包含查询选择、候选阅读和当前证据复核；Retro 包含创建、更新或跳过的语义判断。二者由 Memory Skill 定义，不能降级成简单 CLI 别名。

### Project instance is the data boundary

所有卡片、归档和运行状态保存在 `.multi-silicon/memory`。Methodology Home 不读取、同步或收集项目内容。

### Canonical sidecar with local discovery bridges

项目级 MCP、Skill 与 Agent 要求的规范内容保存在 `.multi-silicon/integrations`。Codex 与 Claude 仍要求约定发现路径，因此 `ms init` 生成 `.codex/config.toml`、`.agents/skills`、`.claude/settings.local.json`、`.claude/skills` 与 `.mcp.json` 薄桥接，并把它们加入 `.git/info/exclude`。

桥接只解决宿主发现，不成为第二份业务知识。若 MCP/Hook 必需路径已被目标项目跟踪或包含不同内容，初始化 fail loud；可选 Skill 目录冲突时保留项目文件并退化为 SessionStart 注入，不自动合并或覆盖。

### Lifecycle state makes omission observable

SessionStart Hook 使用宿主会话 ID 创建本地生命周期状态并注入 Recall/Retro 命令；UserPromptSubmit 在同一会话的每个用户回合重置状态，避免复用上一回合的 Retro。Agent 必须记录 Recall 的 `performed|skipped` 与 Retro 的 `create|update|skip`；创建或更新必须声明已经完成回读验证。

首次 Stop 检测到缺失状态时返回继续提示。第二次仍缺失时只告警并放行，以避免无限循环。Hook 可能被宿主禁用、未信任或绕过，因此此能力属于工作流约束；不可绕过的机械门禁留给 Harness。

宿主信任必须由用户首次审阅确认。`ms init` 不修改 Codex 或 Claude 的全局信任配置。

## Failure behavior

- 未发现项目实例时 fail loud；
- Memex 未安装或版本不可用时给出明确诊断；
- 原生命令失败时保留退出码；
- 任何写入后都由 Agent 回读验证；
- 发现桥接与项目已有文件冲突时不得覆盖；
- Stop 补漏不得形成无限循环。

## Deferred

结构化 JSON 输出、版本自动安装、远程同步和知识晋升自动化留待后续变更。
