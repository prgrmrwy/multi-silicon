# 项目实例与 `ms init`

## 目录布局

```text
actual-project/
├── .multi-silicon/                 # 唯一规范内容源
│   ├── config.yaml
│   ├── memory/
│   │   ├── .memexrc
│   │   ├── cards/
│   │   └── archive/
│   ├── integrations/
│   │   ├── agents/
│   │   ├── codex/
│   │   ├── claude/
│   │   └── skills/
│   ├── harness/
│   ├── runs/
│   └── state/
├── .codex/config.toml              # 本地 Codex 桥接
├── .agents/skills/...              # 指向规范 Skill
├── .claude/settings.local.json     # 本地 Claude Hook 桥接
├── .claude/skills/...              # 指向规范 Skill
└── .mcp.json                       # 本地 Claude MCP 桥接
```

## 默认本地模式

`ms init [path]` 默认执行以下操作：

1. 创建缺失目录与初始配置；
2. 生成 Codex 与 Claude 需要的 MCP、Skill、SessionStart 和 Stop Hook 桥接；
3. 如果目标处于 Git 仓库中，将实例和桥接路径写入本地 `.git/info/exclude`；
4. 若 MCP/Hook 必需桥接已被项目跟踪或包含其他本地内容，明确失败且不覆盖；可选 Skill 目录冲突时告警并继续使用 Hook 注入规则；
5. 不修改团队共享 `.gitignore`、`AGENTS.md`、`CLAUDE.md` 或已有 Hook；
6. 不配置远程同步；
7. 不覆盖 Memory 卡片或项目局部扩展。

## Agent 生命周期

SessionStart Hook 在每个会话开始或恢复时注入项目级 Memory 协议，UserPromptSubmit Hook 在每个用户回合重新打开 Recall/Retro 状态。Agent 需要：

1. 在实质工作前判断是否 Recall，并记录 `performed` 或 `skipped`；
2. 使用当前源码、测试与实时证据校验记忆；
3. 收尾时对候选洞见记录 `create`、`update` 或 `skip`；
4. 创建或更新卡片后回读验证，才能记录 `--verified`；
5. 在最终回复中报告简短的记忆决策。

Stop Hook 会在首次遗漏 Recall/Retro 记录时要求 Agent 继续处理。为防止无限循环，第二次仍遗漏时只告警并放行。宿主还可能禁用 Hook、拒绝信任项目配置或直接绕过协议，因此这套机制是强工作流约束，不是不可绕过的安全控制。真正的强制治理应在后续 Harness 阶段由机械门禁承担。

Codex Stop 使用宿主要求的 JSON continuation 协议（`decision: block`）；Claude Stop 使用退出码 2 与 stderr。两个适配共享同一生命周期状态，但保持各自宿主的 Hook 输出格式。

首次在 Codex 或 Claude 打开项目时，需要人工审阅并信任项目配置与命令 Hook。`ms init` 不会替用户修改全局信任列表；未信任时，实例仍存在，但宿主不会自动加载这些本地约束。

## 数据规则

- `memory/` 可以包含项目事实和经验，因此服从目标项目的数据治理规则。
- `runs/` 和 `state/` 是运行时状态，默认不版本化。
- `integrations/skills/` 与 `harness/` 是项目局部扩展，是否共享由项目自己决定。
- 项目内容不会自动发送或同步到 Methodology Home。

## 框架升级

项目配置记录 schema 与 framework version。未来 `ms upgrade` 只升级公共模板和兼容结构，不覆盖项目 Memory 或本地扩展。
