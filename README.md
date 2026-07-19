# Multi-Silicon

Multi-Silicon 是一套面向真实软件工作的渐进式 Silicon Team 工作模式。

项目以 Silicon Team 系列文章为第一轮架构骨架，但目标不是复刻文章中的某个工具，而是持续生长出一套能够被实际项目消费、验证和改进的方法论与运行能力。

## 两个独立空间

- **Methodology Home**：本仓库，保存通用架构、Protocol、Skill、Harness 模板与 `ms` CLI。
- **Project Instance**：实际项目中的 `.multi-silicon/`，保存项目配置、Memory、运行状态与本地扩展。

具体项目的名称、源码事实、卡片和运行数据不得进入本公共仓库。

## 当前可用切片

```powershell
npm install
npm link
ms init <project-path>
ms status <project-path>
ms doctor <project-path>
ms memory <memex-command>
```

`ms init` 默认采用本地侧挂模式：在目标项目创建 `.multi-silicon/`，并为 Codex 与 Claude 生成项目级 MCP、Skill 和生命周期 Hook 的薄桥接。实例与桥接只写入目标 Git 仓库的本地 exclude，不修改团队共享的 `.gitignore` 或已跟踪的 Agent 配置。

Memory 第一阶段直接采用 [Memex](https://github.com/touchskyer/memex)，Multi-Silicon 不自研卡片存储引擎。

会话开始及每个用户回合提交时，Hook 会向 Agent 注入 Recall/Retro 协议；任务收尾时，Stop Hook 会提供一次 Retro 补漏机会。Memory/Protocol 阶段不要求 Agent 通过 shell 提交机械凭证；Hook 可以被宿主禁用或绕过，因此它是工作模式约束，不是权限安全边界。不可跳过的凭证与合规门禁属于后续 Harness。

当前能力进度与跨机器接续说明见 [PROGRESS](PROGRESS.md)。

## 能力地图

完整架构从八个主题渐进展开：团队目标、CLI Protocol、Harness、多 Agent 协作、有边界自治、治理、运行可靠性与知识晋升。各主题入口见 [章节地图](docs/chapters/README.md)，实施顺序见 [路线图](ROADMAP.md)。

具体变更使用 OpenSpec 管理；长期经验使用 Memex 管理。二者都服务于 Multi-Silicon，而不取代它的总体架构。

## 数据边界

公共仓库只接受无法识别具体业务项目的通用内容。真实项目经验只有经过验证、脱敏和泛化后，才能晋升为公共 Protocol、Skill 或 Harness。

详细说明见 [总体架构](docs/architecture.md) 与 [项目集成](docs/integration/project-instance.md)。

## 参考文章

以下 Silicon Team 系列文章构成 Multi-Silicon 的第一轮架构输入：

1. [前言：从一个人到一支团队](https://mp.weixin.qq.com/s/SRgzqNkNpFgeHPOVyyrBmA)
2. [01：协议层：CLI 作为 Protocol Layer](https://mp.weixin.qq.com/s/dL5BksjfdTHlaKuMdsOfxA)
3. [02：Harness-Native Engineering](https://mp.weixin.qq.com/s/kXVn37aS86TxWU1cdoVtWQ)
4. [03：多硅基协作](https://mp.weixin.qq.com/s/UxqKV2-T5M5paMtmYnVhyQ)
5. [04：自主运行](https://mp.weixin.qq.com/s/F6hq3GpKyyc9XxMb2gXZ8w)
6. [05：Agent 时代的商业逻辑](https://mp.weixin.qq.com/s/0bjLTWnvZfdAcQGGubknNg)
7. [06：工程手札](https://mp.weixin.qq.com/s/x88nu-GflPrYGhwcTv_vLw)
8. [07：从记忆到书](https://mp.weixin.qq.com/s/QvxM1aOkFEYwoCpqJZJ16Q)

文章用于定义问题域和能力顺序；具体设计仍通过真实项目的使用反馈持续验证和调整。
