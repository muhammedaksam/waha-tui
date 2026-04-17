# Contributing to waha-tui

Thank you for your interest in contributing to waha-tui! 🎉

## Quick Start

```bash
# Clone the repo
git clone https://github.com/muhammedaksam/waha-tui.git
cd waha-tui

# Install dependencies
bun install

# Run in development mode
bun dev
```

## Development Commands

| Command                       | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| `bun dev`                     | Start in development mode                      |
| `bun build`                   | Build for production                           |
| `bun check`                   | Run all checks (typecheck, lint, format, test) |
| `bun test`                    | Run tests                                      |
| `bun lint`                    | Run ESLint                                     |
| `bun format`                  | Format code with Prettier                      |
| `bun migration:create <name>` | Create a new migration                         |

## Migrations

WAHA TUI uses a Sequelize-style migration system for config changes. Migrations run automatically on startup.

```bash
# Create a new migration
bun run migration:create my_migration_name
```

This creates `src/utils/migrations/{timestamp}_my_migration_name.ts` and registers it automatically.

## Pull Request Process

1. **Fork** the repository
2. **Create** a feature branch from `develop` (`git checkout -b feature/amazing-feature develop`)
3. **Make** your changes
4. **Run** `bun check` to ensure all tests pass
5. **Commit** using [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` New features
   - `fix:` Bug fixes
   - `docs:` Documentation changes
   - `style:` Code style (formatting, semicolons, etc.)
   - `refactor:` Code refactoring
   - `perf:` Performance improvements
   - `test:` Adding or updating tests
   - `build:` Build system changes
   - `ci:` CI configuration changes
   - `chore:` Maintenance tasks (deps, configs)
   - `revert:` Revert previous commit
6. **Push** to your fork
7. **Open** a Pull Request **targeting the `develop` branch**

## Code Style

- TypeScript with strict mode
- Prettier for formatting
- ESLint for linting
- No `any` types - use `unknown` instead

## Security

If you discover a security vulnerability, please report it via the process outlined in [SECURITY.md](SECURITY.md). Do not open public issues for security concerns.

## Questions?

Open a [GitHub Discussion](https://github.com/muhammedaksam/waha-tui/discussions) or reach out in issues.
