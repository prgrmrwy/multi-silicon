# 项目实例与 `ms init`

## 目录布局

```text
actual-project/
└── .multi-silicon/
    ├── config.yaml
    ├── memory/
    │   ├── .memexrc
    │   ├── cards/
    │   └── archive/
    ├── skills/
    ├── harness/
    ├── runs/
    └── state/
```

## 默认本地模式

`ms init [path]` 默认执行以下操作：

1. 创建缺失目录与初始配置；
2. 如果目标处于 Git 仓库中，将实例路径写入本地 `.git/info/exclude`；
3. 不修改团队共享 `.gitignore`；
4. 不配置远程同步；
5. 不覆盖已经存在的项目实例文件。

## 数据规则

- `memory/` 可以包含项目事实和经验，因此服从目标项目的数据治理规则。
- `runs/` 和 `state/` 是运行时状态，默认不版本化。
- `skills/` 与 `harness/` 是项目局部扩展，是否共享由项目自己决定。
- 项目内容不会自动发送或同步到 Methodology Home。

## 框架升级

项目配置记录 schema 与 framework version。未来 `ms upgrade` 只升级公共模板和兼容结构，不覆盖项目 Memory 或本地扩展。
