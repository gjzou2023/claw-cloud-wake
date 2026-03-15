# OpenClaw Wake Bot (Vercel)

Telegram Bot 用于唤醒 GitHub Codespace 上的 OpenClaw。

## 部署步骤

### 1. 安装 Vercel CLI

```bash
npm i -g vercel
```

### 2. 登录 Vercel

```bash
vercel login
```

### 3. 配置环境变量

```bash
# 替换为您的实际值
vercel env add TELEGRAM_BOT_TOKEN
# 输入: 您的 Bot Token (从 @BotFather 获取)

vercel env add CODESPACE_NAME
# 输入: 您的 Codespace 名称 (如: crispy-journey-qwj7x6jg77934wr4)

vercel env add GH_TOKEN
# 输入: GitHub Personal Access Token (需要 codespace 权限)

vercel env add ALLOWED_USERS
# 输入: 允许使用的 Telegram 用户 ID，多个用逗号分隔 (如: 123456789,987654321)
```

### 4. 部署

```bash
vercel --prod
```

部署成功后会显示类似 `https://openclaw-wake-bot-xxx.vercel.app` 的 URL。

### 5. 设置 Telegram Webhook

```bash
# 将 URL 替换为您的实际域名
curl -X POST "https://api.telegram.org/bot<您的BotToken>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://openclaw-wake-bot-xxx.vercel.app/api/webhook"}'
```

成功后会返回：
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

### 6. 测试

在 Telegram 中向您的 Bot 发送：
- `/start` - 开始
- `/wake` - 唤醒 Codespace
- `/status` - 查看状态
- `/help` - 帮助

## 获取必要信息

### Telegram Bot Token
1. 在 Telegram 搜索 @BotFather
2. 发送 `/newbot` 创建新 Bot
3. 按提示设置名称和用户名
4. 获得 Token (格式: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Telegram User ID
1. 搜索 @userinfobot
2. 发送任意消息
3. 获得您的 User ID

### GitHub Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选权限:
   - ✅ `codespace` (Full control)
   - ✅ `repo` (Full control)
4. 生成并复制 Token

### Codespace Name
```bash
# 在本地执行
gh codespace list
# 找到 name 字段
```

## 注意事项

1. **Vercel 免费版限制**: 函数最大执行时间 30 秒（已配置）
2. **唤醒流程**: 
   - `/wake` 会发送启动指令
   - 需要等待 30-60 秒让 Codespace 启动
   - 再次发送 `/wake` 完成 OpenClaw 启动
3. **日志查看**: 在 Vercel Dashboard 中查看 Functions 日志

## 故障排查

### Bot 不响应
```bash
# 检查 Webhook 是否设置成功
curl "https://api.telegram.org/bot<Token>/getWebhookInfo"
```

### 环境变量错误
```bash
# 重新设置环境变量
vercel env rm TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_BOT_TOKEN
vercel --prod
```

### 查看日志
在 Vercel Dashboard → Project → Functions → 选择时间范围查看日志
