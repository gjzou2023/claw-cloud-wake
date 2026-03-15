const axios = require('axios');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

// 配置
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GH_TOKEN = process.env.GH_TOKEN;
const ALLOWED_USERS = (process.env.ALLOWED_USERS || '').split(',').map(Number);

// 发送 Telegram 消息
async function sendMessage(chatId, text) {
    try {
        await axios.post(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
    } catch (error) {
        console.error('发送消息失败:', error.message);
    }
}

// GitHub API 调用
async function githubAPI(method, path, data = null) {
    return axios({
        method,
        url: `https://api.github.com${path}`,
        headers: {
            'Authorization': `Bearer ${GH_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        },
        data
    });
}

// 检查并启动 Codespace
async function checkAndStartCodespace(chatId) {
    try {
        // 获取 Codespace 列表
        const listRes = await githubAPI('GET', '/user/codespaces');
        const codespace = listRes.data.codespaces.find(c => c.name === CODESPACE_NAME);
        
        if (!codespace) {
            await sendMessage(chatId, '❌ <b>错误</b>\n找不到 Codespace，请检查 CODESPACE_NAME 配置');
            return;
        }
        
        const state = codespace.state;
        
        if (state === 'Available') {
            await sendMessage(chatId, '✅ <b>Codespace 运行中</b>\n正在检查 OpenClaw 状态...');
            await checkAndStartOpenClaw(chatId);
        } else if (state === 'Shutdown' || state === 'Stopped') {
            await sendMessage(chatId, '📡 <b>Codespace 已停止</b>\n正在发送启动指令...');
            
            // 启动 Codespace
            await githubAPI('POST', `/user/codespaces/${CODESPACE_NAME}/start`);
            
            await sendMessage(chatId, 
                '✅ <b>启动指令已发送</b>\n' +
                'Codespace 正在启动，约需 30-60 秒...\n' +
                '请等待 1 分钟后再次发送 /wake 检查状态'
            );
        } else {
            await sendMessage(chatId, `⏳ <b>Codespace 状态</b>: ${state}\n请稍后重试`);
        }
    } catch (error) {
        console.error('检查 Codespace 错误:', error.response?.data || error.message);
        await sendMessage(chatId, `❌ <b>错误</b>: ${error.response?.data?.message || error.message}`);
    }
}

// 检查并启动 OpenClaw
async function checkAndStartOpenClaw(chatId) {
    try {
        // 使用 gh CLI 检查 OpenClaw 状态
        const checkCmd = `gh codespace ssh -c ${CODESPACE_NAME} -- "pgrep -f 'openclaw gateway' > /dev/null && echo 'running' || echo 'stopped'"`;
        
        const { stdout } = await execAsync(checkCmd, {
            env: { ...process.env, GH_TOKEN }
        });
        
        const status = stdout.trim();
        
        if (status === 'running') {
            await sendMessage(chatId, 
                '✅ <b>OpenClaw 已在运行</b>\n' +
                `Codespace: <code>${CODESPACE_NAME}</code>\n` +
                '可以使用 /status 查看详细状态'
            );
        } else {
            await sendMessage(chatId, '🚀 <b>正在启动 OpenClaw...</b>');
            
            // 启动 OpenClaw
            const startCmd = `gh codespace ssh -c ${CODESPACE_NAME} -- "cd ~ && source ~/.openclaw/.env 2>/dev/null; nohup openclaw gateway run > ~/.openclaw/gateway.log 2>&1 &"`;
            
            await execAsync(startCmd, {
                env: { ...process.env, GH_TOKEN }
            });
            
            await sendMessage(chatId, 
                '✅ <b>OpenClaw 启动指令已发送</b>\n' +
                '约需 10-20 秒完全启动\n' +
                '请稍后使用 /status 检查状态'
            );
        }
    } catch (error) {
        console.error('启动 OpenClaw 错误:', error.message);
        await sendMessage(chatId, `❌ <b>OpenClaw 启动失败</b>: ${error.message}`);
    }
}

// 获取状态
async function getStatus(chatId) {
    try {
        const listRes = await githubAPI('GET', '/user/codespaces');
        const codespace = listRes.data.codespaces.find(c => c.name === CODESPACE_NAME);
        
        if (!codespace) {
            await sendMessage(chatId, '❌ 找不到 Codespace');
            return;
        }
        
        let statusText = `<b>📊 状态报告</b>\n\n`;
        statusText += `<b>Codespace</b>: <code>${CODESPACE_NAME}</code>\n`;
        statusText += `<b>状态</b>: ${codespace.state}\n`;
        statusText += `<b>仓库</b>: ${codespace.repository.full_name}\n`;
        statusText += `<b>分支</b>: ${codespace.git_status?.ref || 'main'}\n`;
        
        if (codespace.state === 'Available') {
            statusText += `\n✅ Codespace 运行中，可以正常使用`;
        } else {
            statusText += `\n⚠️ Codespace 未运行，发送 /wake 唤醒`;
        }
        
        await sendMessage(chatId, statusText);
    } catch (error) {
        await sendMessage(chatId, `❌ 获取状态失败: ${error.message}`);
    }
}

// 主处理函数
module.exports = async (req, res) => {
    // 设置 CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(200).json({ 
            status: 'ok', 
            message: 'OpenClaw Wake Bot is running',
            timestamp: new Date().toISOString()
        });
    }
    
    const { message } = req.body;
    if (!message || !message.text) {
        return res.status(200).send('OK');
    }
    
    const chatId = message.chat.id;
    const text = message.text.trim();
    const userId = message.from.id;
    
    // 只处理以 / 开头的命令
    if (!text.startsWith('/')) {
        return res.status(200).send('OK');
    }
    
    // 权限检查
    if (!ALLOWED_USERS.includes(userId)) {
        await sendMessage(chatId, '❌ <b>无权访问</b>\n您的用户 ID 不在白名单中');
        return res.status(200).send('OK');
    }
    
    // 处理命令
    const command = text.split(' ')[0].toLowerCase();
    
    switch (command) {
        case '/start':
            await sendMessage(chatId, 
                '<b>🤖 OpenClaw 唤醒 Bot</b>\n\n' +
                '可用命令:\n' +
                '/wake - 唤醒 Codespace 和 OpenClaw\n' +
                '/status - 查看当前状态\n' +
                '/help - 显示帮助'
            );
            break;
            
        case '/wake':
            // 立即返回响应，异步执行
            res.status(200).send('OK');
            await checkAndStartCodespace(chatId);
            return; // 已发送响应
            
        case '/status':
            // 立即返回响应，异步执行
            res.status(200).send('OK');
            await getStatus(chatId);
            return; // 已发送响应
            
        case '/help':
            await sendMessage(chatId,
                '<b>📖 使用帮助</b>\n\n' +
                '<b>/wake</b> - 一键唤醒\n' +
                '  如果 Codespace 已停止，会启动它\n' +
                '  如果 OpenClaw 未运行，会启动它\n\n' +
                '<b>/status</b> - 查看状态\n' +
                '  显示 Codespace 和 OpenClaw 的运行状态\n\n' +
                '⚠️ <b>注意</b>:\n' +
                '唤醒过程约需 30-60 秒，请耐心等待'
            );
            break;
            
        default:
            await sendMessage(chatId, '❓ 未知命令，发送 /help 查看帮助');
    }
    
    res.status(200).send('OK');
};
