const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');

// ========== 版本标识 v2.0 - 2026-03-15 ==========
// 修复: 使用 REST API 启动 Codespace (gh codespace start 命令不存在)
console.log('📦 Bot 版本: v2.0 (2026-03-15)');

// 从环境变量读取配置
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GH_TOKEN = process.env.GH_TOKEN;
const ALLOWED_USERS = process.env.ALLOWED_USERS?.split(',').map(Number) || [];

// 设置 GitHub CLI Token
process.env.GITHUB_TOKEN = GH_TOKEN;

const bot = new TelegramBot(TOKEN, { polling: true });

// 一键唤醒
bot.onText(/\/wake/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    console.log(`[${new Date().toISOString()}] 收到唤醒请求 - 用户: ${userId}`);
    
    // 权限检查
    if (!ALLOWED_USERS.includes(userId)) {
        console.log(`[${new Date().toISOString()}] 用户 ${userId} 无权访问`);
        return bot.sendMessage(chatId, '❌ 无权访问');
    }
    
    bot.sendMessage(chatId, '⏳ 正在检查 Codespace 状态...');
    
    // 检查 Codespace 状态
    const listCmd = `GH_TOKEN=${GH_TOKEN} gh codespace list --json name,state -q ".[] | select(.name==\\"${CODESPACE_NAME}\\") | .state"`;
    
    exec(listCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${new Date().toISOString()}] 检查状态失败:`, stderr);
            return bot.sendMessage(chatId, `❌ 检查状态失败: ${stderr || error.message}`);
        }
        
        const status = stdout.trim();
        console.log(`[${new Date().toISOString()}] Codespace 状态: ${status}`);
        
        if (status === 'Shutdown' || status === 'Stopped') {
            bot.sendMessage(chatId, '📡 Codespace 已停止，正在启动...');
            
            // ✅ 修复：使用 REST API 启动（gh codespace start 命令不存在）
            const startCmd = `GH_TOKEN=${GH_TOKEN} gh api --method POST "/user/codespaces/${CODESPACE_NAME}/start"`;
            
            console.log(`[${new Date().toISOString()}] 执行启动命令...`);
            
            exec(startCmd, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[${new Date().toISOString()}] 启动失败:`, stderr);
                    return bot.sendMessage(chatId, `❌ Codespace 启动失败: ${stderr || err.message}`);
                }
                
                console.log(`[${new Date().toISOString()}] 启动命令已发送`);
                bot.sendMessage(chatId, '✅ 启动指令已发送，等待 15 秒...');
                
                // 等待 Codespace 启动完成
                setTimeout(() => startOpenClaw(chatId), 15000);
            });
            
        } else if (status === 'Available') {
            bot.sendMessage(chatId, '✅ Codespace 运行中，检查 OpenClaw...');
            startOpenClaw(chatId);
        } else if (status === '') {
            bot.sendMessage(chatId, '⚠️ 未找到 Codespace，请检查 CODESPACE_NAME 配置');
        } else {
            bot.sendMessage(chatId, `⚠️ Codespace 状态: ${status}，尝试连接...`);
            startOpenClaw(chatId);
        }
    });
});

// 启动 OpenClaw
function startOpenClaw(chatId) {
    console.log(`[${new Date().toISOString()}] 检查 OpenClaw 状态...`);
    
    // 检查 OpenClaw 是否已在运行
    const checkCmd = `GH_TOKEN=${GH_TOKEN} gh codespace ssh -c ${CODESPACE_NAME} -- "pgrep -f 'openclaw gateway' > /dev/null && echo 'running' || echo 'stopped'"`;
    
    exec(checkCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`[${new Date().toISOString()}] SSH 连接失败:`, stderr);
            return bot.sendMessage(chatId, `❌ 无法连接到 Codespace: ${stderr || error.message}`);
        }
        
        const status = stdout.trim();
        console.log(`[${new Date().toISOString()}] OpenClaw 状态: ${status}`);
        
        if (status === 'running') {
            return bot.sendMessage(chatId, '✅ OpenClaw 已在运行');
        }
        
        bot.sendMessage(chatId, '🚀 正在启动 OpenClaw...');
        
        // 启动 OpenClaw Gateway
        const startOpenClawCmd = `GH_TOKEN=${GH_TOKEN} gh codespace ssh -c ${CODESPACE_NAME} -- "cd ~ && source ~/.openclaw/.env 2>/dev/null; nohup openclaw gateway run > ~/.openclaw/gateway.log 2>&1 &"`;
        
        exec(startOpenClawCmd, (err, stdout, stderr) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] OpenClaw 启动失败:`, stderr);
                return bot.sendMessage(chatId, `❌ OpenClaw 启动失败: ${stderr || err.message}`);
            }
            
            console.log(`[${new Date().toISOString()}] OpenClaw 启动命令已发送`);
            bot.sendMessage(chatId, '✅ OpenClaw 启动成功！');
        });
    });
}

// 健康检查命令
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!ALLOWED_USERS.includes(userId)) {
        return bot.sendMessage(chatId, '❌ 无权访问');
    }
    
    const listCmd = `GH_TOKEN=${GH_TOKEN} gh codespace list --json name,state -q ".[] | select(.name==\\"${CODESPACE_NAME}\\") | .state"`;
    
    exec(listCmd, (error, stdout) => {
        if (error) {
            return bot.sendMessage(chatId, '❌ 无法获取状态');
        }
        
        const status = stdout.trim() || '未找到';
        bot.sendMessage(chatId, `📊 Codespace 状态: ${status}`);
    });
});

// 启动消息
console.log('🤖 Wakeup Bot 已启动...');
console.log(`📡 监控 Codespace: ${CODESPACE_NAME}`);
console.log(`👥 授权用户: ${ALLOWED_USERS.join(', ')}`);
