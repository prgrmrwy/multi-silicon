# Change: Add project-scoped Memory lifecycle

## Why

`ms init` 已经能创建项目实例，但项目还不能通过稳定的 Multi-Silicon 协议完成 Recall、Retro 和 Memex 健康检查。若用户必须自己拼接路径、环境变量和原生命令，Methodology Home 就没有真正提供可消费的 Memory 切片。

## What Changes

- 将 `.multi-silicon/memory` 固定为项目级 `MEMEX_HOME`。
- 由 `ms memory` 委托 Memex 的搜索、读取、链接和健康检查。
- 由 Agent Skill 承担 Recall 与 Retro 的语义判断，不伪装成 Memex 原生命令。
- 增加跨平台检测、错误报告和端到端验证。

## User Value

用户可以在实际项目中启用 Memory，而不需要理解 Memex 的安装路径或手工维护环境变量；项目数据仍然完全留在项目实例中。

## Non-goals

- 不自研卡片存储引擎。
- 不实现语义搜索、远程同步或多工作区路由。
- 不自动把项目卡片晋升到公共仓库。

## Impact

- Affected specs: `memory-lifecycle`（新增）
- Affected code: `ms memory`、项目模板、Memory Skill、诊断与测试
