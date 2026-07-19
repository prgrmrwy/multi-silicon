# memory-lifecycle Specification

## Purpose
定义项目级 Memex 数据边界、Agent Recall/Retro 生命周期，以及 Codex 与 Claude 通过本地侧挂实例消费 Memory 的发现与补漏协议。
## Requirements
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

### Requirement: Local Agent discovery

Multi-Silicon SHALL 将项目级 MCP、Skill 与 Agent 要求的规范内容保存在 `.multi-silicon`，并 SHALL 只通过本地 Git 排除的薄桥接接入 Agent 宿主。

#### Scenario: Initialize an unconfigured project

- **WHEN** 用户在没有冲突发现路径的 Git 项目执行 `ms init`
- **THEN** Codex 与 Claude 能发现项目级 Memex MCP、Memory Skill 与生命周期 Hook
- **AND** `git status` 不显示实例或桥接内容

#### Scenario: Discovery path belongs to the project

- **WHEN** 所需桥接路径已被 Git 跟踪、其父路径不是目录或包含不同本地内容
- **THEN** 初始化明确报告冲突；必需 MCP/Hook 冲突失败，可选 Skill 冲突退化为 Hook 注入
- **AND** 不覆盖目标项目的文件

### Requirement: Observable lifecycle completion

Multi-Silicon SHALL 为 Agent 会话记录 Recall 与 Retro 决策，并 SHOULD 在首次 Stop 遗漏时要求 Agent 继续完成生命周期。

#### Scenario: Continue an existing Agent session

- **WHEN** 用户在同一 Agent 会话提交下一回合任务
- **THEN** 系统清空上一回合的 Recall/Retro 完成状态
- **AND** 新回合必须独立完成生命周期决策

#### Scenario: Agent omits Retro

- **WHEN** Agent 首次尝试结束会话且尚未记录 Retro
- **THEN** Stop Hook 返回具体的补漏提示
- **AND** Agent 可以记录创建、更新或跳过后正常结束

#### Scenario: Agent repeatedly omits lifecycle decisions

- **WHEN** Stop Hook 已经提示一次但决策仍然缺失
- **THEN** 系统告警并放行
- **AND** 不形成无限 Hook 循环
