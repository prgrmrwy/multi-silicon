# 01：CLI 作为 Protocol Layer

## 问题

不同人类、Agent 和自动化如何通过稳定、可脚本化的接口使用同一套能力。

## 架构边界

- `ms` 是统一入口，不直接暴露内部目录和供应商细节。
- 一级命令只保存跨能力操作，增长型功能进入能力域。
- 人类输出清晰可读，Agent 和脚本接口最终应支持稳定结构化输出。

## 当前切片

已交付 `ms init [path]`、`ms status [path]` 与 `ms doctor [path]`，建立 `.multi-silicon/` 项目实例；`ms memory` 提供 Memex 存储协议，`ms lifecycle` 提供 Agent Recall/Retro 状态协议。

## 状态

Project Instance 与 Memory 首个闭环已实现；版本协商、稳定 JSON 输出和升级协议待实现。
