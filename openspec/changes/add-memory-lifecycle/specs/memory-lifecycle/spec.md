# Memory Lifecycle Delta

## ADDED Requirements

### Requirement: Project-scoped Memory Home

Multi-Silicon SHALL 使用当前项目实例中的 `.multi-silicon/memory` 作为唯一 `MEMEX_HOME`，且 SHALL NOT 将项目卡片写入 Methodology Home。

#### Scenario: Run from a project subdirectory

- **WHEN** Agent 或用户从项目中的任意子目录调用 Memory 能力
- **THEN** 系统向上发现最近的 `.multi-silicon/config.yaml`
- **AND** 将该实例的 `memory` 目录传给 Memex

### Requirement: Memex provider delegation

Multi-Silicon SHALL 委托 Memex 执行卡片搜索、读取、写入、链接分析和健康检查，而不是重新实现这些存储原语。

#### Scenario: Execute a native Memory operation

- **WHEN** 用户执行受支持的 `ms memory` 存储命令
- **THEN** CLI 使用项目级 `MEMEX_HOME` 调用 Memex
- **AND** 保留 Memex 的输出与退出状态

#### Scenario: Memex is unavailable

- **WHEN** 当前环境无法执行兼容的 Memex
- **THEN** CLI 明确报告 provider 不可用及修复方向
- **AND** 不静默跳过 Memory 操作

### Requirement: Agent-owned Recall and Retro

Recall 与 Retro SHALL 由 Agent 根据 Memory Skill 执行语义判断，且 SHALL NOT 被表示为原生 Memex 子命令。

#### Scenario: Recall before relevant work

- **WHEN** 历史知识可能改变当前任务的处理方式
- **THEN** Agent 使用聚焦查询召回有限候选
- **AND** 使用当前源码、测试和实时证据重新验证卡片内容

#### Scenario: Retro after substantive work

- **WHEN** 一项实质工作完成
- **THEN** Agent 对每条候选洞见选择创建、更新或跳过
- **AND** 对任何写入执行回读验证
