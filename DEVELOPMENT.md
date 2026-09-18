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
| `bun build`            | Build production bundle                    |
| `bun start`            | Run production entry point                 |
| `bun test`             | Run all tests                              |
| `bun test:watch`       | Run tests in watch mode                    |
| `bun test:coverage`    | Run tests with coverage                    |
| `bun check`            | Run typecheck + lint + format check + test |
| `bun fix`              | Auto-fix lint and formatting issues        |
| `bun typecheck`        | TypeScript type checking                   |
| `bun lint`             | Run ESLint and Markdownlint                |
| `bun lint:fix`         | Auto-fix ESLint and Markdownlint issues    |
| `bun lint:md`          | Run Markdownlint on all markdown files     |
| `bun format`           | Format code with Prettier                  |
| `bun format:check`     | Check code formatting with Prettier        |
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
│   │   ├── messageActions.ts       # Message operations (send, star, react, pin, bulk)
│   │   ├── sessionActions.ts       # Session, contact & chat loading
│   │   ├── presenceActions.ts      # Presence & activity management
│   │   └── index.ts                # Barrel exports
│   ├── components/                 # Reusable UI primitives & recipes (@tuiparts)
│   │   ├── ui/                     # Tuiparts primitive foundations & renderables
│   │   │   ├── dialog/             # Dialog container, backdrop, themes, and manager
│   │   │   ├── toast/              # Toaster container, toast renderables, state, themes
│   │   │   └── utils.ts            # Border, spacing, and styling helpers
│   │   ├── Accordion.ts            # Collapsible accordion item recipe
│   │   ├── Badge.ts                # Colored badge recipe
│   │   ├── Button.ts               # Focusable styled button recipe
│   │   ├── ChatPickerDialog.ts     # Multi-chat picker modal
│   │   ├── Checkbox.ts             # Checkbox toggle primitive
│   │   ├── CheckboxGroup.ts        # Checkbox group manager
│   │   ├── Collapsible.ts          # Collapsible panel recipe
│   │   ├── ContextMenu.ts          # Right-click style context menus
│   │   ├── Dialog.ts               # Dialog and prompt wrapper
│   │   ├── EmojiPicker.ts          # Emoji selection modal
│   │   ├── Footer.ts               # Status bar with keyboard hints
│   │   ├── Input.ts                # Single-line text input recipe
│   │   ├── Logo.ts                 # ASCII logo
│   │   ├── Modal.ts                # Dialog / confirmation modals
│   │   ├── NumberField.ts          # Numeric stepper component
│   │   ├── RadioGroup.ts           # Radio button group primitive
│   │   ├── Slider.ts               # Numeric range slider primitive
│   │   ├── StatusBar.ts            # Status bar component
│   │   ├── Switch.ts               # Toggle switch primitive
│   │   ├── Tabs.ts                 # Tab list & roving tab focus primitive
│   │   ├── Textarea.ts             # Multi-line text edit recipe
│   │   ├── Toast.ts                # Toast notification trigger wrapper
│   │   ├── Toggle.ts               # Pressable toggle button primitive
│   │   └── ToggleGroup.ts          # Toggle button group primitive
│   ├── config/                     # Configuration management
│   │   ├── manager.ts              # Config load / save / settings persistence
│   │   ├── schema.ts               # Config types, defaults & validation
│   │   ├── theme.ts                # Theme engine & terminal palette sync
│   │   └── version.ts              # Version info from package.json
│   ├── handlers/                   # Action & event handlers
│   │   ├── ContextMenuActions.ts   # Context menu action execution
│   │   ├── keyboardHandler.ts      # Fallback diagnostic logger for unhandled keys
│   │   ├── settingsHandler.ts      # Settings loading & persistence
│   │   └── index.ts                # Barrel exports
│   ├── services/                   # Background services & coordination
│   │   ├── CacheService.ts         # Generic TTL-based caching
│   │   ├── ErrorService.ts         # Centralized error handling
│   │   ├── Errors.ts               # Error types & classification
│   │   ├── KeymapService.ts        # Declarative keymap layers & commands (@opentui/keymap)
│   │   ├── NetworkService.ts       # Network connectivity monitoring
│   │   ├── RetryService.ts         # Retry with exponential backoff
│   │   └── WebSocketService.ts     # Real-time WebSocket updates
│   ├── state/                      # Global state management
│   │   ├── AppState.ts             # Central application state
│   │   ├── RendererContext.ts      # Renderer singleton context
│   │   └── slices/                 # State slice modules
│   │       ├── AuthSlice.ts        # Authentication & pairing state
│   │       ├── ChatSlice.ts        # Chat list state
│   │       ├── ContactSlice.ts     # Contact state
│   │       ├── MessageSlice.ts     # Message & selection state
│   │       ├── ModalSlice.ts       # Modal / dialog state
│   │       ├── NavigationSlice.ts  # Navigation state
│   │       ├── SessionSlice.ts     # Session state
│   │       ├── SettingsSlice.ts    # Settings & theme state
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
│   │   ├── mediaLabels.ts          # Media description and size formatting
│   │   ├── migrations.ts           # Migration runner
│   │   ├── migrations/             # Individual migration files
│   │   ├── notifications.ts        # Desktop notification helpers
│   │   ├── pairing.ts              # QR / phone pairing utilities
│   │   ├── phoneValidation.ts      # Phone number validation
│   │   └── update-checker.ts       # Version update checker
│   ├── views/                      # Main application views
│   │   ├── ChatListManager.ts      # Virtualized chat list rendering & click alignment
│   │   ├── ChatsView.ts            # Chat list view with search
│   │   ├── ConfigView.ts           # First-run configuration wizard
│   │   ├── ConversationView.ts     # Message conversation view (with EditBuffer lifecycle guards)
│   │   ├── IconSidebar.ts          # Icon sidebar navigation
│   │   ├── LoadingView.ts          # Loading spinner view
│   │   ├── MainLayout.ts           # Main layout (sidebar + content)
│   │   ├── QRCodeView.ts           # QR code / phone pairing (@opentui/qrcode QRCodeRenderable)
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

## Architecture & Key Subsystems

### Declarative Keymaps (`@opentui/keymap`)

All keyboard events, view-specific shortcuts, and modal interactions are managed declaratively through `KeymapService.ts` via `@opentui/keymap`. Input routing is divided into hierarchical priority layers:

1. **Global Layer (Priority 0)**: Application quit (`Ctrl+C`), top-level view navigation (`1` for Sessions, `2` for Chats), and global sequence detection.
2. **View Layers (Priority 10)**: View-scoped actions for `sessions`, `chats`, `conversation`, `settings`, and `qr` views.
3. **Dialog Layer (Priority 50)**: Focus trapping for active prompts and dialogs. Supports button navigation via `Tab`/`Shift+Tab` and `Left`/`Right`, activation via `Enter`/`Space`, and dismissal via `Esc`. Prevents underlying view handlers from capturing keys while a modal is displayed.
4. **ContextMenu Layer (Priority 60)**: Traps arrow/vim navigation (`j`/`k`/`h`/`l`), selection, and cancellation whenever a context menu is open.

`keyboardHandler.ts` serves as a fallback diagnostic logger for unhandled key events.

### UI Primitives & Recipes (`@tuiparts/core`)

The UI architecture adopts [@tuiparts/core](https://github.com/tuiparts/tuiparts/tree/main/packages/core) primitives and recipes:

- Headless store management and state tracking (e.g. `CheckedStore`, roving tab focus) are managed through `@tuiparts/core` (kept in `devDependencies`).
- Recipes are copied and adapted in `src/components/`, integrating directly with OpenTUI's native properties and flexbox layout engine.
- Primitives provide consistent activation, keyboard focus rings, and styling for buttons, switches, dialogs, toasts, tabs, accordions, and selection controls.

### Dynamic Terminal Palette & Theming

The theming subsystem (`src/config/theme.ts`) supports adaptive palette synchronization:

- **`useSystemTheme` (enabled by default)**: Dynamically extracts colors from the user's terminal emulator (including ANSI 16-color palette, default foreground, and default background), adjusting luminance and contrast to ensure readability across dark and light terminals.
- **Theme Modes**: Configurable as `"system"`, `"dark"`, or `"light"`.
- Settings are persisted to `$XDG_CONFIG_HOME/waha-tui/config.json`.

### Native EditBuffer Lifecycle Safety

OpenTUI's native `EditBuffer` manages low-level text input for the conversation composer. Because asynchronous WebSocket events (such as message acks and status changes) can trigger root re-render sweeps that destroy native buffers:

- `ConversationView.ts` enforces `isDestroyed` checks before and after async calls (`onSubmit`, `onContentChange`, scroll operations).
- This prevents `EditBuffer is destroyed` use-after-free exceptions when re-renders coincide with active typing.

### Native QR Code Rendering (`@opentui/qrcode`)

The authentication view (`src/views/QRCodeView.ts`) renders QR codes directly via `@opentui/qrcode`'s `QRCodeRenderable`. This replaces external ASCII canvas libraries with clean, fast terminal renderables matching the OpenTUI node hierarchy.

## Testing

Tests are written using Bun's built-in test runner.

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage

# Run a specific test suite
bun test src/components/Dialog.test.ts
```

### Test Suites

| File                             | Coverage                                       |
| -------------------------------- | ---------------------------------------------- |
| `client/chatActions.test.ts`     | Chat action API calls                          |
| `components/Accordion.test.ts`   | Accordion expand/collapse behavior             |
| `components/Button.test.ts`      | Button focus, press, and click handlers        |
| `components/Checkbox.test.ts`    | Checkbox checked state and toggling            |
| `components/Collapsible.test.ts` | Collapsible panel open/close state             |
| `components/Dialog.test.ts`      | Dialog container, prompts, and focus bounds    |
| `components/NumberField.test.ts` | NumberField increment, decrement, and limits   |
| `components/RadioGroup.test.ts`  | RadioGroup single selection and roving focus   |
| `components/Slider.test.ts`      | Slider step increments and range bounds        |
| `components/Switch.test.ts`      | Switch checked store and toggle actions        |
| `components/Tabs.test.ts`        | Tabs selection and roving tab navigation       |
| `config/theme.test.ts`           | Terminal palette sync and color modes          |
| `services/ErrorService.test.ts`  | Error classification and retry notifications   |
| `services/KeymapService.test.ts` | Declarative keymap layers and priority routing |
| `services/RetryService.test.ts`  | Exponential backoff retry execution            |
| `state/AppState.test.ts`         | Application state management and slices        |
| `utils/filterChats.test.ts`      | Chat filtering, search, and unread counts      |
| `utils/formatters.test.ts`       | Text truncation, phone and status formatting   |
| `utils/mediaLabels.test.ts`      | Media type extraction and byte size formatting |
| `views/ChatListManager.test.ts`  | Click coordinate alignment on chat reordering  |
| `views/QRCodeView.test.ts`       | Native QR code rendering and auth mode toggle  |

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

Pre-commit hooks run automatically via Husky and lint-staged:

- ESLint for TypeScript/JavaScript quality
- Markdownlint for documentation
- Prettier for consistent formatting

Manual checks:

```bash
bun check      # Run typecheck, lint, format check, and tests
bun typecheck  # TypeScript type checking
bun lint       # ESLint + markdownlint
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
