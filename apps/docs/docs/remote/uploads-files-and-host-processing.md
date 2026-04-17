---
title: Uploads, Files, And Host Processing
slug: /remote/uploads-files-and-host-processing
description: Files picked on web or mobile still end up on the host runtime, where real processing continues.
---

# Uploads, Files, And Host Processing

在 ContextGo 的远程模型里，一个很重要的边界是：

- 文件可以从网页或手机端选
- 但真正的处理仍然发生在主机上

## 为什么这件事重要

因为这会直接影响用户预期：

- 手机不是完整执行宿主
- 上传后，文件会进入主机侧工作系统
- 后续处理依然围绕主机 copy 继续

## Related Docs

- [Mobile Shells](./mobile-shells)
- [Desktop Host](./desktop-host)
