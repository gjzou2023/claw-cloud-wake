const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

const CODESPACE_NAME = process.env.CODESPACE_NAME;
const GH_TOKEN = process.env.GH_TOKEN;

if (!CODESPACE_NAME || !GH_TOKEN) {
  console.error('❌ 缺少必要的环境变量！');
  process.exit(1);
}

process.env.GITHUB_TOKEN = GH_TOKEN;

async function runGhCommand(command) {
  const fullCommand = `GH_TOKEN=${GH_TOKEN} ${command}`;
  try {
    const { stdout } = await execPromise(fullCommand);
    return { success: true, output: stdout.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`[${new Date().toISOString()}] 执行定时唤醒检查...`);
  
  const result = await runGhCommand(
    `gh codespace list --json name,state -q ".[] | select(.name==\\"${CODESPACE_NAME}\\") | .state"`
  );
  
  const status = result.success ? result.output : 'unknown';
  console.log(`Codespace 状态: ${status}`);
  
  if (status === 'Shutdown' || status === 'Stopped') {
    console.log('Codespace 已停止，执行唤醒...');
    
    // FIX: 使用 GitHub REST API 代替不存在的 gh codespace start 命令
    const startResult = await runGhCommand(`gh api --method POST "/user/codespaces/${CODESPACE_NAME}/start"`);
    
    if (startResult.success) {
      console.log('✅ 唤醒成功');
      process.exit(0);
    } else {
      console.error('❌ 唤醒失败:', startResult.error);
      process.exit(1);
    }
  } else {
    console.log(`Codespace 状态正常: ${status}`);
    process.exit(0);
  }
}

main();
