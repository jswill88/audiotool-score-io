#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

label="com.audiotool-score-io.a1-capacity-hunter"
uid="$(id -u)"
source_script="$script_dir/a1-capacity-hunter.sh"
source_config="$script_dir/a1-capacity-hunter.env"
install_bin="$HOME/.local/bin"
install_config="$HOME/.config/audiotool-score-io"
install_logs="$HOME/Library/Logs/audiotool-score-io"
installed_script="$install_bin/a1-capacity-hunter.sh"
installed_config="$install_config/a1-capacity-hunter.env"
plist="$HOME/Library/LaunchAgents/$label.plist"

die() {
  printf 'Error: %s\n' "$*" >&2
  exit 1
}

[[ -f "$source_script" ]] || die "Missing $source_script"
[[ -f "$source_config" ]] || die "Missing $source_config. Copy a1-capacity-hunter.env.example and fill it in first."

mkdir -p "$install_bin" "$install_config" "$install_logs" "$HOME/Library/LaunchAgents"

launchctl bootout "gui/$uid/$label" >/dev/null 2>&1 || true

install -m 700 "$source_script" "$installed_script"
install -m 600 "$source_config" "$installed_config"

tmp_config="$(mktemp)"
awk -v log_dir="$install_logs" '
  BEGIN { wrote_log_dir = 0 }
  /^OCI_LOG_DIR=/ {
    print "OCI_LOG_DIR=" log_dir
    wrote_log_dir = 1
    next
  }
  { print }
  END {
    if (!wrote_log_dir) {
      print "OCI_LOG_DIR=" log_dir
    }
  }
' "$installed_config" > "$tmp_config"
mv "$tmp_config" "$installed_config"
chmod 600 "$installed_config"

rm -f "$plist"
plutil -create xml1 "$plist"
/usr/libexec/PlistBuddy -c "Add :Label string $label" "$plist"
/usr/libexec/PlistBuddy -c "Add :ProgramArguments array" "$plist"
/usr/libexec/PlistBuddy -c "Add :ProgramArguments:0 string $installed_script" "$plist"
/usr/libexec/PlistBuddy -c "Add :ProgramArguments:1 string $installed_config" "$plist"
/usr/libexec/PlistBuddy -c "Add :RunAtLoad bool true" "$plist"
/usr/libexec/PlistBuddy -c "Add :WorkingDirectory string $HOME" "$plist"
/usr/libexec/PlistBuddy -c "Add :EnvironmentVariables dict" "$plist"
/usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:PATH string /usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin" "$plist"
/usr/libexec/PlistBuddy -c "Add :StandardOutPath string $install_logs/a1-capacity-hunter.launchd.out.log" "$plist"
/usr/libexec/PlistBuddy -c "Add :StandardErrorPath string $install_logs/a1-capacity-hunter.launchd.err.log" "$plist"
plutil -lint "$plist" >/dev/null

: > "$install_logs/a1-capacity-hunter.launchd.out.log"
: > "$install_logs/a1-capacity-hunter.launchd.err.log"

launchctl bootstrap "gui/$uid" "$plist"
launchctl kickstart -k "gui/$uid/$label"

printf 'Installed and started %s\n' "$label"
printf 'Script: %s\n' "$installed_script"
printf 'Config: %s\n' "$installed_config"
printf 'Logs: %s\n' "$install_logs"
printf 'Repo: %s\n' "$repo_root"
