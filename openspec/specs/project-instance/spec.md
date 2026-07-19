# Project Instance Specification

## Purpose

定义实际项目如何创建和检查本地 `.multi-silicon/` 实例，同时保持 Methodology Home 与项目数据隔离。

## Requirements

### Requirement: Local project initialization

`ms init [path]` SHALL 在目标目录创建缺失的 `.multi-silicon/` 项目实例文件，并 SHALL NOT 覆盖已经存在的项目配置或 Memory。

#### Scenario: Initialize a new project

- **WHEN** 用户对一个尚未初始化的目录执行 `ms init`
- **THEN** CLI 创建配置、Memory、Skill、Harness、Run 和 State 的基础目录
- **AND** 返回创建成功及实例位置

#### Scenario: Initialize an existing instance again

- **WHEN** 用户对已有 `.multi-silicon/` 的项目再次执行 `ms init`
- **THEN** CLI 保留现有内容并成功返回

### Requirement: Local Git isolation

默认本地模式 SHALL 将项目实例加入目标 Git 仓库的本地 exclude，且 SHALL NOT 修改团队共享的 `.gitignore`。

#### Scenario: Initialize inside a Git repository

- **WHEN** 目标目录位于 Git 仓库中
- **THEN** CLI 将该实例的仓库相对路径写入 `.git/info/exclude`

#### Scenario: Initialize outside a Git repository

- **WHEN** 目标目录不在 Git 仓库中
- **THEN** CLI 创建项目实例并明确报告跳过 Git exclude

### Requirement: Instance discovery and diagnostics

`ms status` 与 `ms doctor` SHALL 从给定路径向上发现最近的项目实例。

#### Scenario: Discover from a nested directory

- **WHEN** 用户从项目实例下方的任意子目录运行 `ms status`
- **THEN** CLI 报告项目根目录、实例目录和 Memory Home

#### Scenario: Diagnose required files

- **WHEN** 用户运行 `ms doctor`
- **THEN** CLI 检查配置、Memex 配置和卡片目录是否存在
- **AND** 报告 Memex 是否可用
