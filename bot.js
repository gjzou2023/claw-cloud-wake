const TelegramBot = require('node-telegram-bot-api');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

// ==================== 配置读取 ====================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GH_TOKEN = process.env.GH_TOKEN;
const ALLOWED_USERS = process.env.ALLOWED_USERS?.split(',').map(Number) || [];

// 验证必要的环境变量
if (!TOKEN || !CODESPACE_NAME || !GH_TOKEN) {
    console.error('❌ 缺少必要的环境变量！请检查：');
    console.error('  - TELEGRAM_BOT_TOKEN');
    console.error('  - CODESPACE_NAME');
    console.error('  - GH_TOKEN');
    process.exit(1);
}

// 设置 GitHub CLI 环境变量
process.env.GITHUB_TOKEN = GH_TOKEN;

// ==================== Bot 初始化 ====================
// 使用 polling 模式（Claw Cloud 支持）
const bot = new TelegramBot(TOKEN, { polling: true });

// ==================== 辅助函数 ====================

/**
 * 执行 GitHub CLI 命令
 */
async function runGhCommand(command) {
    const fullCommand = `GH_TOKEN=${GH_TOKEN} ${command}`;
    try {
        const { stdout, stderr } = await execPromise(fullCommand);
        return { success: true, output: stdout.trim(), error: stderr };
    } catch (error) {
        return { success: false, output: '', error: error.message };
    }
}

/**
 * 获取 Codespace 状态
 */
async function getCodespaceStatus() {
    const result = await runGhCommand(
        `gh codespace list --json name,state -q ".[] | select(.name==\\"${CODESPACE_NAME}\\") | .state"`
    );
    return result.success ? result.output : 'unknown';
}

/**
 * 启动 Codespace
 */
async function startCodespace() {
    return await runGhCommand(`gh codespace start -c ${CODESPACE_NAME}`);
}

/**
 * 检查 OpenClaw 是否在运行
 */
async function checkOpenClawStatus() {
    const result = await runGhCommand(
        `gh codespace ssh -c ${CODESPACE_NAME} -- "pgrep -f 'openclaw gateway' > /dev/null && echo 'running' || echo 'stopped'"`
    );
    return result.success ? result.output : 'unknown';
}

/**
 * 启动 OpenClaw
 */
async function startOpenClaw() {
    return await runGhCommand(
        `gh codespace ssh -c ${CODESPACE_NAME} -- "cd ~ && source ~/.openclaw/.env && nohup openclaw gateway run > ~/.openclaw/gateway.log 2>&1 &"`
    );
}

/**
 * 停止 Codespace
 */
async function stopCodespace() {
    return await runGhCommand(`gh codespace stop -c ${CODESPACE_NAME}`);
}

// ==================== Bot 命令处理 ====================

// 检查用户权限
function checkPermission(msg) {
    if (ALLOWED_USERS.length === 0) return true;
    return ALLOWED_USERS.includes(msg.from.id);
}

// /start 命令
bot.onText(/\/start/, (msg) => {
    if (!checkPermission(msg)) {
        return bot.sendMessage(msg.chat.id, '❌ 无权访问');
    }
    bot.sendMessage(msg.chat.id, 
        `🤖 OpenClaw 唤醒助手\n\n` +
        `可用命令：\n` +
        `/wake - 唤醒 OpenClaw\n` +
        `/status - 查看状态\n` +
        `/stop - 停止 Codespace\n` +
        `/help - 帮助信息`
    );
});

// /wake 命令 - 一键唤醒
bot.onText(/\/wake/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!checkPermission(msg)) {
        return bot.sendMessage(chatId, '❌ 无权访问');
    }
    
    const statusMsg = await bot.sendMessage(chatId, '⏳ 正在检查 Codespace 状态...');
    
    try {
        const status = await getCodespaceStatus();
        
        if (status === 'Shutdown' || status === 'Stopped') {
            await bot.editMessageText('📡 Codespace 已停止，正在启动...', {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
            
            const startResult = await startCodespace();
            if (!startResult.success) {
                return bot.editMessageText('❌ Codespace 启动失败: ' + startResult.error, {
                    chat_id: chatId,
                    message_id: statusMsg.message_id
                });
            }
            
            // 等待 15 秒让 Codespace 完全启动
            await new Promise(resolve => setTimeout(resolve, 15000));
        }
        
        await bot.editMessageText('✅ Codespace 运行中，正在检查 OpenClaw...', {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
        
        const openclawStatus = await checkOpenClawStatus();
        
        if (openclawStatus === 'running') {
            return bot.editMessageText('✅ OpenClaw 已在运行中！', {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
        }
        
        await bot.editMessageText('🚀 正在启动 OpenClaw...', {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
        
        const result = await startOpenClaw();
        
        if (result.success) {
            bot.editMessageText('✅ OpenClaw 启动成功！', {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
        } else {
            bot.editMessageText('❌ OpenClaw 启动失败: ' + result.error, {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
        }
        
    } catch (error) {
        bot.editMessageText('❌ 操作失败: ' + error.message, {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
    }
});

// /status 命令 - 查看状态
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!checkPermission(msg)) {
        return bot.sendMessage(chatId, '❌ 无权访问');
    }
    
    const statusMsg = await bot.sendMessage(chatId, '⏳ 正在查询状态...');
    
    try {
        const codespaceStatus = await getCodespaceStatus();
        let openclawStatus = 'unknown';
        
        if (codespaceStatus === 'Available') {
            openclawStatus = await checkOpenClawStatus();
        }
        
        const statusText = 
            `📊 当前状态\n\n` +
            `Codespace: ${codespaceStatus}\n` +
            `OpenClaw: ${openclawStatus}`;
        
        bot.editMessageText(statusText, {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
        
    } catch (error) {
        bot.editMessageText('❌ 查询失败: ' + error.message, {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
    }
});

// /stop 命令 - 停止 Codespace
bot.onText(/\/stop/, async (msg) => {
    const chatId = msg.chat.id;
    
    if (!checkPermission(msg)) {
        return bot.sendMessage(chatId, '❌ 无权访问');
    }
    
    const statusMsg = await bot.sendMessage(chatId, '⏳ 正在停止 Codespace...');
    
    try {
        const result = await stopCodespace();
        
        if (result.success) {
            bot.editMessageText('✅ Codespace 已停止', {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
        } else {
            bot.editMessageText('❌ 停止失败: ' + result.error, {
                chat_id: chatId,
                message_id: statusMsg.message_id
            });
        }
        
    } catch (error) {
        bot.editMessageText('❌ 操作失败: ' + error.message, {
            chat_id: chatId,
            message_id: statusMsg.message_id
        });
    }
});

// /help 命令
bot.onText(/\/help/, (msg) => {
    if (!checkPermission(msg)) {
        return bot.sendMessage(msg.chat.id, '❌ 无权访问');
    }
    
    bot.sendMessage(msg.chat.id,
        `📖 帮助信息\n\n` +
        `/wake - 一键唤醒 OpenClaw\n` +
        `  如果 Codespace 已停止，会先启动 Codespace\n` +
        `  然后自动启动 OpenClaw Gateway\n\n` +
        `/status - 查看当前状态\n` +
        `  显示 Codespace 和 OpenClaw 的运行状态\n\n` +
        `/stop - 停止 Codespace\n` +
        `  停止 Codespace 以节省资源\n\n` +
        `/help - 显示此帮助信息`
    );
});

// 错误处理
bot.on('error', (error) => {
    console.error('Bot 错误:', error);
});

bot.on('polling_error', (error) => {
    console.error('Polling 错误:', error);
});

console.log('🤖 Telegram Bot 已启动...');
console.log('📡 Codespace:', CODESPACE_NAME);
console.log('👥 允许用户:', ALLOWED_USERS.length > 0 ? ALLOWED_USERS : '所有用户');
