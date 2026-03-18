# 飞书桌面端适配器

通过 macOS AppleScript 在终端中控制 **飞书桌面应用**。

> **注意：** 飞书使用自研 `Lark Framework`（内嵌 Chromium v131），但不暴露 CDP。因此使用 AppleScript + 剪贴板方式。

## 命令

| 命令 | 说明 |
|------|------|
| `feishu status` | 检查飞书是否在运行 |
| `feishu send "消息"` | 在当前对话窗口发送消息 |
| `feishu new` | 开始新对话（Cmd+N） |
| `feishu search "关键词"` | 打开全局搜索（Cmd+K） |
| `feishu read` | 复制当前对话的聊天记录 |

## 前置条件

- 仅 macOS（使用 AppleScript）
- 需要为终端应用开启**辅助功能权限**
- 飞书必须打开且有对话窗口
