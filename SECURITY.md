# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.0   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in waha-tui, please report it responsibly:

1. **DO NOT** create a public GitHub issue for security vulnerabilities
2. Email security concerns to: info[at]muhammedaksam.com.tr
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Resolution Target**: Within 30 days for critical issues

## Security Best Practices for Users

### Configuration Security

waha-tui stores configuration in `$XDG_CONFIG_HOME/waha-tui/` (defaults to `~/.config/waha-tui/`):

- **`.env`** - Contains secrets (WAHA_URL, WAHA_API_KEY)
- **`config.json`** - Contains metadata (version, timestamps)

Always:

- Never commit config files to version control
- Set restrictive file permissions:

  ```bash
  chmod 600 ~/.config/waha-tui/.env
  chmod 600 ~/.config/waha-tui/config.json
  ```

- Use strong API keys for your WAHA server
- Regularly rotate API keys and credentials

### WAHA Server Security

- Run WAHA behind a reverse proxy with HTTPS
- Enable API key authentication on your WAHA server
- Keep your WAHA server updated
- Consider using firewall rules to restrict access

### Debug Logs

Debug logs may contain sensitive information:

- Debug logs are saved to `$XDG_CONFIG_HOME/waha-tui/debug.log`
- Review logs before sharing for troubleshooting
- Clear debug logs periodically: `rm ~/.config/waha-tui/debug.log`

## Scope

This security policy applies to:

- The waha-tui npm package (@muhammedaksam/waha-tui)
- Configuration files in `$XDG_CONFIG_HOME/waha-tui/`
- The waha-tui TUI application

## Out of Scope

- WAHA server vulnerabilities (report to [WAHA project](https://github.com/devlikeapro/waha))
- WhatsApp platform security
- Bun runtime vulnerabilities
- User misconfiguration
