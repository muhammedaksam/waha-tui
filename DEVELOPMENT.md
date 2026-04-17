# Development Guide

## Quick Start

```bash
# Install dependencies
bun install

# Run in development mode
bun dev

# Run with debug logging
bun dev:debug
```

## Scripts

| Command                | Description                                |
| ---------------------- | ------------------------------------------ |
| `bun dev`              | Run with hot reload                        |
| `bun dev:debug`        | Run with debug logging enabled             |
| `bun start`            | Run production entry point                 |
| `bun test`             | Run all tests                              |
| `bun test:watch`       | Run tests in watch mode                    |
| `bun test:coverage`    | Run tests with coverage                    |
| `bun check`            | Run typecheck + lint + format check + test |
| `bun fix`              | Auto-fix lint and formatting issues        |
| `bun typecheck`        | TypeScript type checking                   |
| `bun lint`             | Run ESLint                                 |
| `bun format`           | Format code with Prettier                  |
| `bun link:waha-node`   | Link local waha-node for development       |
| `bun unlink:waha-node` | Unlink local waha-node                     |
| `bun migration:create` | Create a new config migration              |

## Project Structure

```bash
waha-tui/
├── src/
│   ├── client/                     # WAHA API client (domain-split modules)
│   │   ├── core.ts                 # Client initialization & utilities
│   │   ├── chatActions.ts          # Chat operations (archive, delete, etc.)
│   │   ├── messageActions.ts       # Message operations (send, star, react, pin)
│   │   ├── sessionActions.ts       # Session, contact & chat loading
│   │   ├── presenceActions.ts      # Presence & activity management
│   │   └── index.ts                # Barrel exports
│   ├── components/                 # Reusable UI components
│   │   ├── ContextMenu.ts          # Right-click style context menus
│   │   ├── Footer.ts               # Status bar with keyboard hints
│   │   ├── Logo.ts                 # ASCII logo
│   │   ├── Modal.ts                # Dialog / confirmation modals
│   │   ├── StatusBar.ts            # Status bar component
│   │   └── Toast.ts                # Toast notification component
│   ├── config/                     # Configuration management
│   │   ├── manager.ts              # Config load / save / settings
│   │   ├── schema.ts               # Config types & validation
│   │   ├── theme.ts                # WhatsApp-inspired color theme
│   │   └── version.ts              # Version info from package.json
│   ├── handlers/                   # Action handlers
│   │   ├── keyboardHandler.ts      # Centralized keyboard handling
│   │   ├── ContextMenuActions.ts   # Context menu action execution
│   │   ├── settingsHandler.ts      # Settings loading & persistence
│   │   └── index.ts                # Barrel exports
│   ├── services/                   # Background services
│   │   ├── CacheService.ts         # Generic TTL-based caching
│   │   ├── ErrorService.ts         # Centralized error handling
│   │   ├── Errors.ts               # Error types & classification
│   │   ├── NetworkService.ts       # Network connectivity monitoring
│   │   ├── RetryService.ts         # Retry with exponential backoff
│   │   └── WebSocketService.ts     # Real-time WebSocket updates
│   ├── state/                      # Global state management
│   │   ├── AppState.ts             # Central application state
│   │   ├── RendererContext.ts      # Renderer singleton context
│   │   └── slices/                 # State slice modules
│   │       ├── AuthSlice.ts        # Authentication state
│   │       ├── ChatSlice.ts        # Chat list state
│   │       ├── ContactSlice.ts     # Contact state
│   │       ├── MessageSlice.ts     # Message state
│   │       ├── ModalSlice.ts       # Modal / dialog state
│   │       ├── NavigationSlice.ts  # Navigation state
│   │       ├── SessionSlice.ts     # Session state
│   │       ├── SettingsSlice.ts    # Settings state
│   │       ├── UISlice.ts          # UI state
│   │       └── index.ts            # Barrel exports
│   ├── types/                      # TypeScript type definitions
│   │   ├── WAMessageExtended.ts    # Extended message types
│   │   └── common.ts               # Shared types
│   ├── utils/                      # Utility functions
│   │   ├── chatListScroll.ts       # Chat list scroll offset calculation
│   │   ├── createChat.ts           # New chat creation helpers
│   │   ├── debug.ts                # Debug logging
│   │   ├── enhancedSearch.ts       # Fuzzy / enhanced search
│   │   ├── filterChats.ts          # Chat filtering logic
│   │   ├── formatters.ts           # Formatting utilities
│   │   ├── migrations.ts           # Migration runner
│   │   ├── migrations/             # Individual migration files
│   │   ├── notifications.ts        # Desktop notification helpers
│   │   ├── pairing.ts              # QR / phone pairing utilities
│   │   ├── phoneValidation.ts      # Phone number validation
│   │   └── update-checker.ts       # Version update checker
│   ├── views/                      # Main application views
│   │   ├── ChatListManager.ts      # Virtualized chat list rendering
│   │   ├── ChatsView.ts            # Chat list view with search
│   │   ├── ConfigView.ts           # First-run configuration wizard
│   │   ├── ConversationView.ts     # Message conversation view
│   │   ├── IconSidebar.ts          # Icon sidebar navigation
│   │   ├── LoadingView.ts          # Loading spinner view
│   │   ├── MainLayout.ts           # Main layout (sidebar + content)
│   │   ├── QRCodeView.ts           # QR code / phone pairing view
│   │   ├── SessionCreate.ts        # Session creation
│   │   ├── SessionsView.ts         # Session list view
│   │   ├── SettingsView.ts         # Settings interface
│   │   ├── WelcomeView.ts          # Welcome screen
│   │   └── conversation/           # Conversation view modules
│   │       ├── MessageHelpers.ts   # Sender colors, date formatting
│   │       ├── MessageRenderer.ts  # Message bubble rendering
│   │       ├── ReplyContext.ts     # Reply/quote rendering
│   │       └── index.ts
│   ├── router.ts                   # View routing & rendering logic
│   ├── constants.ts                # Application-wide constants
│   └── index.ts                    # Main entry point
├── scripts/
│   ├── create-migration.ts         # Migration scaffolding script
│   ├── link-waha-node.sh           # Link local waha-node
│   └── unlink-waha-node.sh         # Unlink local waha-node
├── .github/
│   ├── workflows/                  # CI/CD workflows
│   ├── actions/                    # Reusable actions
│   └── media/                      # Screenshots & videos
└── package.json
```

## Testing

Tests are written using Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage

# Run specific test file
bun test src/utils/formatters.test.ts
```

### Test Files

| File                            | Coverage                     |
| ------------------------------- | ---------------------------- |
| `utils/formatters.test.ts`      | Formatting utilities         |
| `utils/filterChats.test.ts`     | Chat filtering logic         |
| `services/ErrorService.test.ts` | Error classification         |
| `services/RetryService.test.ts` | Retry logic                  |
| `state/AppState.test.ts`        | Application state management |
| `client/chatActions.test.ts`    | Chat action functions        |

## Error Handling

The application uses a centralized error handling service:

```typescript
import { errorService } from "./services/ErrorService"

try {
  await someApiCall()
} catch (error) {
  const appError = errorService.handle(error, {
    log: true,
    notify: true,
    context: { action: "someAction" },
  })

  // Get user-friendly message
  const message = errorService.getUserMessage(appError)
}
```

### Retry API Calls

```typescript
import { RetryPresets, withRetry } from "./services/RetryService"

// With defaults (3 retries, exponential backoff)
const result = await withRetry(() => apiCall())

// With preset configuration
const result = await withRetry(() => apiCall(), RetryPresets.aggressive)
```

## Code Quality

Pre-commit hooks run automatically:

- ESLint for code quality
- Prettier for formatting

Manual checks:

```bash
bun typecheck  # TypeScript type checking
bun lint       # ESLint
bun format     # Prettier formatting
```

## Debug Mode

Enable debug logging with the `--debug` flag:

```bash
bun dev --debug
```

Debug logs are written to `~/.config/waha-tui/debug.log`.

## Configuration

Configuration is stored in XDG-compliant locations:

- **Config**: `~/.config/waha-tui/config.json`
- **Env**: `~/.config/waha-tui/.env`
- **Logs**: `~/.config/waha-tui/debug.log`
