---
name: 🐛 Bug Report
about: Create a report to help us improve WAHA-TUI
title: "[BUG] "
labels: "bug"
assignees: ""
---

## Describe the bug

A clear and concise description of what the bug is.

## To Reproduce

Steps to reproduce the behavior:

1. Run `waha-tui` with `--debug` option as `waha-tui --debug`.
2. Perform action '...'
3. See error

## Expected behavior

A clear and concise description of what you expected to happen.

## Environment

- **WAHA-TUI Version:** [e.g. 1.6.3]
- **Bun Version:** [e.g. 1.1.0]
- **OS:** [e.g. Ubuntu 22.04, macOS Sonoma, Windows 11 (WSL2)]
- **Terminal Emulator:** [e.g. Kitty, iTerm2, Windows Terminal]
- **WAHA Engine:** [e.g. WEBJS, NOWEB, GOWS]

## WAHA Configuration

- [ ] I am using the latest version of WAHA-TUI.
- [ ] I have a running WAHA server accessible at the configured URL.
- [ ] I have enabled `tagsEventsOn` if using WEBJS engine (if applicable).

## Debug Logs

Please run the application with debug mode enabled and provide the relevant logs.

```bash
waha-tui --debug
# or
bun dev --debug
```

Logs are usually located at `~/.config/waha-tui/debug.log`. Please **sanitize any sensitive information** (phone numbers, API keys) before pasting here.

<details>
<summary>Click to expand debug logs</summary>

```text
# Paste logs here
```

</details>

### Additional context

Add any other context about the problem here (e.g., screenshots of the TUI layout issues).
