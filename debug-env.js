// Debug environment detection
const { PlatformUtils } = require('./dist/shared/platform-utils');

console.log('=== Environment Debug ===');
console.log('VS Code PID:', process.env.VSCODE_PID);
console.log('TERM:', process.env.TERM);
console.log('Process title:', process.title);
console.log('Parent process:', process.ppid);
console.log('Claude Code detection:', PlatformUtils.isRunningInClaudeCode());
console.log('Platform info:', PlatformUtils.getPlatformInfo());

console.log('\n=== All Environment Variables (filtered) ===');
Object.keys(process.env)
  .filter(key => key.includes('CODE') || key.includes('TERM') || key.includes('SHELL') || key.includes('VSCODE'))
  .forEach(key => console.log(`${key}: ${process.env[key]}`));