FROM node:20-alpine

# ========== 版本 v2.0 - 2026-03-15 ==========
LABEL version="2.0"
LABEL description="OpenClaw Wake Bot - Fixed codespace start command"

# 安装 GitHub CLI
RUN apk add --no-cache curl git bash jq

# 安装 GitHub CLI (gh)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg 2>/dev/null || true && \
    echo "@github https://cli.github.com/packages stable main" >> /etc/apk/repositories && \
    apk add --no-cache gh

WORKDIR /app

# 复制 package.json
COPY package*.json ./
RUN npm install

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["node", "bot.js"]
