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

## Failure behavior

- 未发现项目实例时 fail loud；
- Memex 未安装或版本不可用时给出明确诊断；
- 原生命令失败时保留退出码；
- 任何写入后都由 Agent 回读验证。

## Deferred

结构化 JSON 输出、版本自动安装、远程同步和知识晋升自动化留待后续变更。
