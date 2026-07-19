---
name: multi-silicon-memory
description: 使用项目 `.multi-silicon/memory` 中的 Memex 执行 Recall、Work、Retro 与 Verify 生命周期。
---

# Multi-Silicon Memory

Memex 是 Memory 提供者，Agent 负责语义判断。不得自行实现新的卡片存储层。

## 定位项目实例

从当前目录向上查找 `.multi-silicon/config.yaml`。Memory Home 是该实例中的 `.multi-silicon/memory`。

优先使用 Memex MCP；需要命令行时，通过 `ms memory <memex-command>` 调用，或显式设置 `MEMEX_HOME` 后使用原生 `memex`。

## Recall

1. 仅在历史知识可能改变处理方式时召回。
2. 使用 1—3 个聚焦的中英文查询。
3. 先关键词搜索，只阅读有希望的卡片。
4. 仅沿正文已解释关系的 wikilink 继续阅读。
5. 当前源码、测试、项目规则和实时证据优先于卡片。

## Retro

对每条候选洞见选择且只选择一个动作：

- 创建：新的、经过验证且会改变未来行为的持久洞见；
- 更新：既有卡片已表达同一洞见，新证据带来实质改善；
- 跳过：临时、重复、未经验证、显而易见或不会影响未来行为。

写入前搜索候选卡片并预览变更。每张卡片只表达一条洞见；写入后回读，链接变化时检查断链。

## 数据边界

项目卡片可以记录当前项目允许保存的经验，但必须遵循项目数据政策。卡片不会自动同步到 Methodology Home。公共晋升必须经过验证、脱敏、泛化和审查。
