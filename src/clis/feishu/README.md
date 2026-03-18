# Feishu (飞书/Lark) Desktop Adapter

Control the **Feishu Desktop App** from the terminal via macOS AppleScript automation.

> **Note:** Feishu/Lark uses a custom `Lark Framework` (Chromium v131 embedded) but does **not** expose CDP. This adapter uses AppleScript + clipboard instead.

## Commands

| Command | Description |
|---------|-------------|
| `feishu status` | Check if Feishu is running |
| `feishu send "message"` | Send a message in the active conversation |
| `feishu new` | Start a new chat (Cmd+N) |
| `feishu search "query"` | Open global search (Cmd+K) |
| `feishu read` | Copy recent messages from the active chat |

## Requirements

- macOS only (uses AppleScript)
- **Accessibility permissions** must be granted to your terminal app
- Feishu must be running with a conversation window open
