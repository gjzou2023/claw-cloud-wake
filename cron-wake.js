const { exec } = require('child_process');

const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GH_TOKEN = process.env.GH_TOKEN;

console.log(`[${new Date().toISOString()}] 执行定时唤醒检查...`);
console.log(`[${new Date().toISOString()}] Codespace: ${CODESPACE_NAME}`);

// 检查 Codespace 状态
const listCmd = `GH_TOKEN=${GH_TOKEN} gh codespace list --json name,state -q ".[] | select(.name==\\"${CODESPACE_NAME}\\") | .state"`;

exec(listCmd, (error, stdout, stderr) => {
    if (error) {
        console.error(`[${new Date().toISOString()}] 检查状态失败:`, stderr);
        process.exit(1);
    }
    
    const status = stdout.trim();
    console.log(`[${new Date().toISOString()}] Codespace 状态: ${status}`);
    
    if (status === 'Shutdown' || status === 'Stopped') {
        console.log(`[${new Date().toISOString()}] Codespace 已停止，执行唤醒...`);
        
        // 使用 REST API 启动
        const startCmd = `GH_TOKEN=${GH_TOKEN} gh api --method POST "/user/codespaces/${CODESPACE_NAME}/start"`;
        
        exec(startCmd, (err, stdout, stderr) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] 唤醒失败:`, stderr);
                process.exit(1);
            }
            
            console.log(`[${new Date().toISOString()}] 唤醒成功`);
            process.exit(0);
        });
    } else {
        console.log(`[${new Date().toISOString()}] Codespace 状态正常: ${status}`);
        process.exit(0);
    }
});
