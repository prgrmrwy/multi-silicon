# 07：从记忆到可传播知识

## 问题

如何让真实工作经验产生复利，而不是永远停留在聊天历史或孤立卡片中。

## 架构边界

- 项目事实和经验留在项目 `.multi-silicon/memory`。
- 单次观察不能直接晋升为强制规则。
- 反复验证的经验依次晋升为模式、Skill、Harness 和公共知识。
- 所有公共晋升必须脱敏、泛化并通过人工或独立审查。

## 最小切片

以 Memex 跑通 Recall → Work → Retro → Verify，并记录召回价值与写入质量。

## 状态

Memory MVP 已收口：项目实例能够发现 Memex MCP 与 Memory Skill，宿主 Hook 能在任务前后注入 Recall/Retro 约束并提供一次 Retro 补漏，项目数据保持在本地边界。召回价值度量与“卡片 → 模式 → Skill → Harness → 公共知识”的晋升机制待后续真实任务积累证据后实现。
