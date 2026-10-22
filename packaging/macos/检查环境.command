#!/bin/zsh
set -u
task_dir="${0:A:h}"
task_report="$HOME/Desktop/ResearchBridge-Mac-$(/bin/date +%Y%m%d-%H%M%S).json"
print '研桥 macOS 环境检查：仅检查安装、程序版本与登录状态，不发送模型请求。'
if [[ "$(/usr/bin/uname -s)" != Darwin ]]; then
  print '此检查工具只能在 macOS 上运行。'
  exit 1
fi
if /usr/bin/osascript -l JavaScript "$task_dir/check-environment.js" "$@" > "$task_report"; then
  /bin/cat "$task_report"
  print "\n报告已保存：$task_report"
else
  print '检查脚本执行失败，请将终端中的错误信息提供给开发者。'
fi
print '\n按回车关闭。'
read -r task_reply
