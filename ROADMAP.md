# Multi-Silicon 路线图

路线图遵循“先完整骨架，再逐步实现纵向切片”。每一阶段都必须在真实项目中产生可观察价值，后续阶段不能假装已经完成。

| 阶段 | 目标 | 当前状态 |
|---|---|---|
| 0. 架构骨架 | 建立八章能力地图、公共边界与项目消费协议 | 进行中 |
| 1. Project Instance | 交付 `ms init/status/doctor` 与 `.multi-silicon/` | 首个切片 |
| 2. Memory Protocol | 接入 Memex，跑通 Recall → Work → Retro → Verify | 首个闭环 |
| 3. Harness | 完成条件、机械门禁和独立审查接口 | 待实现 |
| 4. Multi-Agent | 显式角色、委派、隔离、交接与汇总 | 待实现 |
| 5. Autonomous Run | 有预算、停止条件和人类升级机制的运行 tick | 待实现 |
| 6. Reliability | fail-loud、恢复、诊断、审计与可观测性 | 待实现 |
| 7. Learning System | 项目卡片晋升为模式、Skill、Harness 和公共知识 | 待实现 |

## 当前里程碑：可消费的公共 Home

完成标准：

1. 公共仓库历史不含具体业务项目信息；
2. `ms init <path>` 能创建本地 `.multi-silicon/`；
3. `ms status` 和 `ms doctor` 能识别并检查项目实例；
4. 八章都有边界、接口和最小切片说明；
5. 后续具体变更可以由 OpenSpec 管理。

下一里程碑完成标准是：项目 Agent 能自动发现 Memory Skill 与 Memex MCP；SessionStart 能注入 Recall/Retro 协议；Stop 能对遗漏的生命周期决策补漏一次；所有项目数据与运行状态保持在本地实例边界内。
