FROM node:20-alpine

# 安装 GitHub CLI 和必要依赖
RUN apk add --no-cache \
    curl \
    git \
    bash \
    openssh-client

# 安装 GitHub CLI
RUN curl -fsSL https://github.com/cli/cli/releases/download/v2.42.0/gh_2.42.0_linux_amd64.tar.gz -o gh.tar.gz && \
    tar -xzf gh.tar.gz && \
    mv gh_2.42.0_linux_amd64/bin/gh /usr/local/bin/ && \
    rm -rf gh.tar.gz gh_2.42.0_linux_amd64

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm install

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "bot.js"]
