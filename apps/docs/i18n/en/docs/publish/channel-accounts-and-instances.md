---
title: Channel Accounts And Instances
slug: /publish/channel-accounts-and-instances
description: A channel account is the real ingress boundary that receives messages and exposes published agent capabilities.
---

# Channel Accounts And Instances

When you publish an agent into a channel, the key object is not just a platform name.

It is a real ingress boundary:

- which account receives messages
- which instance belongs to which platform
- which instance is healthy
- which published capability it exposes

![ContextGo multi-instance channel account detail](/brand/product/multi-channel-account.png)

Under one platform, the real object is usually not one abstract connected state but multiple concrete instances with their own lifecycle.

## Related Docs

- [Channels](/publish/channels)
- [Audiences, Threads, Groups](/publish/audiences-threads-groups)
