# `@contextgo/context-engine`

`@contextgo/context-engine` 是 AionUi / ContextGo 内部的独立上下文引擎模块骨架。

当前阶段它还不是完整实现，而是一个为后续记忆引擎、local-first 存储、空间同步和多人协作预留的 monorepo package。

## 定位

- 在产品内实现，不先拆成外部服务
- 在架构上独立，不把上下文能力散落到 conversation / channel / connector 代码中
- 以 `Space` 为产品级边界，以 memory engine 为底层能力子系统
- 优先支持单机 local-first，再逐步演进到多设备与多人协作

## 当前内容

- package 边界与 placeholder 入口
- 面向 local-first 与协作演进的设计文档

## 文档索引

- [docs/charter.md](./docs/charter.md)
- [docs/domain-model.md](./docs/domain-model.md)
- [docs/local-first-sync.md](./docs/local-first-sync.md)
- [docs/implementation-phases.md](./docs/implementation-phases.md)

## 设计原则

- 产品域对象由主产品定义，不由记忆引擎反向定义
- 引擎能力通过稳定接口暴露，例如 `ingest`, `retrieve`, `assemble`, `sync`
- 运行形态先内嵌，边界按可抽离方式设计
- 本地优先，云端同步是增量能力，不是前置依赖
