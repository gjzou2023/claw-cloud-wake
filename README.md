# OpenClaw 一键唤醒服务 - Claw Cloud 版本

在 Claw Cloud 上部署的 Telegram Bot，用于一键唤醒 GitHub Codespace 中的 OpenClaw。

## 功能

- `/wake` - 一键唤醒 OpenClaw（自动启动 Codespace + OpenClaw）
- `/status` - 查看 Codespace 和 OpenClaw 状态
- `/stop` - 停止 Codespace 节省资源
- `/help` - 显示帮助信息

## 部署步骤

### 1. 配置环境变量

在 Claw Cloud 控制台设置以下环境变量：

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | ✅ |
| `GH_TOKEN` | GitHub Personal Access Token | ✅ |
| `CODESPACE_NAME` | Codespace 名称 | ✅ |
| `ALLOWED_USERS` | 允许的用户ID（逗号分隔） | ❌ |

### 2. GitHub Token 权限

Token 需要以下权限：
- ✅ `codespace` - 管理 Codespaces
- ✅ `repo` - 访问仓库

### 3. 部署

1. 在 Claw Cloud 创建新服务
2. 连接此 GitHub 仓库
3. 选择 Dockerfile 构建
4. 配置环境变量
5. 部署

## 定时唤醒

在 Claw Cloud 控制台添加 Cron Job：
- **Schedule**: `0 */4 * * *`（每4小时）
- **Command**: `node cron-wake.js`

## 注意事项

部署此服务后，**请停止腾讯云服务器上的 Bot**，避免 409 Conflict 冲突。
