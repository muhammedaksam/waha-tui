/**
 * Easter Egg Modal Component
 * Retro Arcade Snake Mini-Game unlocked via the Konami Code (30 Lives)
 */

import type { RenderContext, TextChunk } from "@opentui/core"

import {
  BoxRenderable,
  parseColor,
  StyledText,
  TextAttributes,
  TextRenderable,
} from "@opentui/core"

import { createButton } from "~/components/Button"
import { WDSColors, WhatsAppTheme } from "~/config/theme"
import { getDialogManager } from "~/router"
import { setSnakeGameHandler } from "~/services/KeymapService"

const GRID_WIDTH = 20
const GRID_HEIGHT = 9
const INITIAL_LIVES = 30
const BASE_SPEED_MS = 110
const MIN_SPEED_MS = 60

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT"
type Point = { x: number; y: number }
type GameState = "ready" | "playing" | "paused" | "gameover"

let persistentHighScore = 0

/**
 * Display the Konami Code retro arcade Snake mini-game modal
 */
export function showEasterEggModal(): void {
  // Play terminal bell audio cue
  try {
    process.stdout.write("\x07")
  } catch {
    // Ignore audio cue errors in headless environments
  }

  const dialogManager = getDialogManager()

  let activeCleanup: (() => void) | null = null

  dialogManager.show({
    size: "medium",
    closeOnEscape: true,
    onClose: () => {
      activeCleanup?.()
    },
    content: (ctx: RenderContext) => {
      // Game state variables
      let snake: Point[] = [
        { x: 5, y: 4 },
        { x: 4, y: 4 },
        { x: 3, y: 4 },
      ]
      let direction: Direction = "RIGHT"
      let nextDirection: Direction = "RIGHT"
      let food: Point = { x: 14, y: 4 }
      let goldenFood: Point | null = null
      let goldenFoodTimer = 0
      let lives = INITIAL_LIVES
      let score = 0
      let applesCount = 0
      let gameState: GameState = "ready"
      let gameInterval: ReturnType<typeof setInterval> | null = null
      let bannerText = "PRESS [SPACE] TO START"
      let bannerFg: string = WDSColors.yellow[400]
      let isCleanedUp = false

      const cleanup = () => {
        if (isCleanedUp) return
        isCleanedUp = true
        if (gameInterval) {
          clearInterval(gameInterval)
          gameInterval = null
        }
        setSnakeGameHandler(null)
      }
      activeCleanup = cleanup

      const calculateSpeed = () => {
        return Math.max(MIN_SPEED_MS, BASE_SPEED_MS - Math.floor(score / 30) * 5)
      }

      const spawnFood = () => {
        let attempts = 0
        while (attempts < 200) {
          const rx = Math.floor(Math.random() * GRID_WIDTH)
          const ry = Math.floor(Math.random() * GRID_HEIGHT)
          const onSnake = snake.some((seg) => seg.x === rx && seg.y === ry)
          const onGolden = goldenFood && goldenFood.x === rx && goldenFood.y === ry
          if (!onSnake && !onGolden) {
            food = { x: rx, y: ry }
            break
          }
          attempts++
        }

        // 25% chance to spawn golden food if not already active
        if (!goldenFood && Math.random() < 0.25) {
          let gAttempts = 0
          while (gAttempts < 100) {
            const gx = Math.floor(Math.random() * GRID_WIDTH)
            const gy = Math.floor(Math.random() * GRID_HEIGHT)
            const onSnake = snake.some((seg) => seg.x === gx && seg.y === gy)
            const onFood = food.x === gx && food.y === gy
            if (!onSnake && !onFood) {
              goldenFood = { x: gx, y: gy }
              goldenFoodTimer = 35
              break
            }
            gAttempts++
          }
        }
      }

      // Root dialog container
      const container = new BoxRenderable(ctx, {
        flexDirection: "column",
        alignItems: "center",
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 0,
        paddingBottom: 0,
      })

      // Header title banner
      const headerBox = new BoxRenderable(ctx, {
        flexDirection: "column",
        alignItems: "center",
      })

      headerBox.add(
        new TextRenderable(ctx, {
          content: "🕹️  W A H A   S N A K E   •   3 0   L I V E S  🕹️",
          fg: WDSColors.green[400],
          attributes: TextAttributes.BOLD,
        })
      )

      container.add(headerBox)

      // HUD Text Renderable
      const hudText = new TextRenderable(ctx, {
        content: buildHudText(),
        marginTop: 1,
        height: 1,
      })
      container.add(hudText)

      // Board Text Renderable with explicit dimensions for Yoga layout
      const boardText = new TextRenderable(ctx, {
        content: buildBoardStyledText(),
        width: GRID_WIDTH * 2 + 2,
        height: GRID_HEIGHT + 2,
        wrapMode: "none",
      })
      container.add(boardText)

      // Status / Message Banner
      const bannerRenderable = new TextRenderable(ctx, {
        content: bannerText,
        fg: parseColor(bannerFg),
        attributes: TextAttributes.BOLD,
        height: 1,
      })
      container.add(bannerRenderable)

      // Instructions / Controls Hint
      const hintText = new TextRenderable(ctx, {
        content: "[Arrows / WASD] Move  •  [Space] Pause  •  [R] Restart  •  [Esc] Exit",
        fg: WhatsAppTheme.textSecondary,
        height: 1,
      })
      container.add(hintText)

      // Action buttons row
      const buttonRow = new BoxRenderable(ctx, {
        flexDirection: "row",
        justifyContent: "center",
        width: "100%",
        marginTop: 1,
        height: 1,
      })

      const exitBtn = createButton(ctx, {
        label: "✕ Exit",
        variant: "secondary",
        marginRight: 2,
        onPress: () => {
          cleanup()
          dialogManager.close()
        },
      })
      buttonRow.add(exitBtn)

      const playBtn = createButton(ctx, {
        label: "🎮 Play Again",
        variant: "primary",
        onPress: () => {
          restartGame()
        },
      })
      buttonRow.add(playBtn)

      container.add(buttonRow)

      function buildHudText(): StyledText {
        const chunks: TextChunk[] = [
          {
            __isChunk: true,
            text: `❤️ ${lives} Lives`,
            fg: parseColor(WDSColors.red[400]),
            attributes: TextAttributes.BOLD,
          },
          { __isChunk: true, text: "  │  ", fg: parseColor(WhatsAppTheme.textSecondary) },
          {
            __isChunk: true,
            text: `🏆 Score: ${score}`,
            fg: parseColor(WhatsAppTheme.white),
            attributes: TextAttributes.BOLD,
          },
          { __isChunk: true, text: "  │  ", fg: parseColor(WhatsAppTheme.textSecondary) },
          {
            __isChunk: true,
            text: `🍎 Apples: ${applesCount}`,
            fg: parseColor(WDSColors.green[400]),
          },
          { __isChunk: true, text: "  │  ", fg: parseColor(WhatsAppTheme.textSecondary) },
          {
            __isChunk: true,
            text: `⭐ Best: ${persistentHighScore}`,
            fg: parseColor(WDSColors.yellow[400]),
            attributes: TextAttributes.BOLD,
          },
        ]
        return new StyledText(chunks)
      }

      function buildBoardStyledText(): StyledText {
        const chunks: TextChunk[] = []
        const borderColor = parseColor(WDSColors.green[600])
        const emptyDotColor = parseColor("#333333")
        const headColor = parseColor(WDSColors.yellow[300])
        const bodyColor = parseColor(WDSColors.green[400])
        const goldenColor = parseColor(WDSColors.yellow[400])
        const appleColor = parseColor(WDSColors.red[400])

        // Top border (22 cells * 2 chars = 44 columns + corners)
        chunks.push({ __isChunk: true, text: `┌${"─".repeat(GRID_WIDTH * 2)}┐\n`, fg: borderColor })

        for (let y = 0; y < GRID_HEIGHT; y++) {
          chunks.push({ __isChunk: true, text: "│", fg: borderColor })

          for (let x = 0; x < GRID_WIDTH; x++) {
            const head = snake[0]
            if (head && head.x === x && head.y === y) {
              let headChar = "► "
              if (direction === "UP") headChar = "▲ "
              else if (direction === "DOWN") headChar = "▼ "
              else if (direction === "LEFT") headChar = "◄ "

              chunks.push({
                __isChunk: true,
                text: headChar,
                fg: headColor,
                attributes: TextAttributes.BOLD,
              })
            } else if (snake.some((seg) => seg.x === x && seg.y === y)) {
              chunks.push({
                __isChunk: true,
                text: "■ ",
                fg: bodyColor,
              })
            } else if (goldenFood && goldenFood.x === x && goldenFood.y === y) {
              chunks.push({
                __isChunk: true,
                text: "★ ",
                fg: goldenColor,
                attributes: TextAttributes.BOLD,
              })
            } else if (food.x === x && food.y === y) {
              chunks.push({
                __isChunk: true,
                text: "🍎",
                fg: appleColor,
              })
            } else {
              chunks.push({
                __isChunk: true,
                text: "· ",
                fg: emptyDotColor,
              })
            }
          }

          chunks.push({ __isChunk: true, text: "│\n", fg: borderColor })
        }

        // Bottom border
        chunks.push({ __isChunk: true, text: `└${"─".repeat(GRID_WIDTH * 2)}┘`, fg: borderColor })

        return new StyledText(chunks)
      }

      function updateUI(): void {
        hudText.content = buildHudText()
        boardText.content = buildBoardStyledText()
        bannerRenderable.content = bannerText
        bannerRenderable.fg = parseColor(bannerFg)
        ctx.requestRender()
      }

      function gameTick(): void {
        if (gameState !== "playing") return

        direction = nextDirection
        const head = snake[0]!
        let nx = head.x
        let ny = head.y

        switch (direction) {
          case "UP":
            ny--
            break
          case "DOWN":
            ny++
            break
          case "LEFT":
            nx--
            break
          case "RIGHT":
            nx++
            break
        }

        // Wall collision check
        const wallCollision = nx < 0 || nx >= GRID_WIDTH || ny < 0 || ny >= GRID_HEIGHT
        // Self collision check
        const selfCollision = snake.some((seg) => seg.x === nx && seg.y === ny)

        if (wallCollision || selfCollision) {
          try {
            process.stdout.write("\x07")
          } catch {
            // ignore
          }

          if (lives > 1) {
            lives--
            bannerText = `💥 CRASH! ${lives} LIVES LEFT (Konami Shield Active)`
            bannerFg = WDSColors.red[400]
            // Respawn in center
            snake = [
              { x: 5, y: 4 },
              { x: 4, y: 4 },
              { x: 3, y: 4 },
            ]
            direction = "RIGHT"
            nextDirection = "RIGHT"
            updateUI()
            return
          } else {
            lives = 0
            gameState = "gameover"
            if (gameInterval) {
              clearInterval(gameInterval)
              gameInterval = null
            }
            if (score > persistentHighScore) {
              persistentHighScore = score
            }
            bannerText = `💀 GAME OVER! Final Score: ${score}  •  Press [R] to Play Again`
            bannerFg = WDSColors.red[500]
            updateUI()
            return
          }
        }

        // Move snake
        const newHead = { x: nx, y: ny }
        snake.unshift(newHead)

        // Check apple eating
        if (nx === food.x && ny === food.y) {
          score += 10
          applesCount++
          if (score > persistentHighScore) {
            persistentHighScore = score
          }
          bannerText = `🍎 YUM! +10 PTS  (Score: ${score})`
          bannerFg = WDSColors.green[400]
          spawnFood()

          // Speed up slightly as score increases
          if (gameInterval) {
            clearInterval(gameInterval)
            gameInterval = setInterval(gameTick, calculateSpeed())
          }
        } else if (goldenFood && nx === goldenFood.x && ny === goldenFood.y) {
          score += 50
          applesCount++
          goldenFood = null
          if (score > persistentHighScore) {
            persistentHighScore = score
          }
          bannerText = `🌟 GOLDEN STAR! +50 BONUS PTS!`
          bannerFg = WDSColors.yellow[300]
        } else {
          snake.pop()
        }

        // Decay golden food
        if (goldenFood) {
          goldenFoodTimer--
          if (goldenFoodTimer <= 0) {
            goldenFood = null
          }
        }

        updateUI()
      }

      function startGame(): void {
        gameState = "playing"
        bannerText = "⚡ SLITHERING! Use Arrows or WASD to Steer"
        bannerFg = WDSColors.green[400]
        if (gameInterval) {
          clearInterval(gameInterval)
        }
        gameInterval = setInterval(gameTick, calculateSpeed())
        updateUI()
      }

      function pauseGame(): void {
        gameState = "paused"
        if (gameInterval) {
          clearInterval(gameInterval)
          gameInterval = null
        }
        bannerText = "⏸️  PAUSED - Press [SPACE] to Resume"
        bannerFg = WDSColors.yellow[400]
        updateUI()
      }

      function resumeGame(): void {
        gameState = "playing"
        bannerText = "⚡ RESUMED! Steer with Arrows / WASD"
        bannerFg = WDSColors.green[400]
        if (gameInterval) {
          clearInterval(gameInterval)
        }
        gameInterval = setInterval(gameTick, calculateSpeed())
        updateUI()
      }

      function restartGame(): void {
        snake = [
          { x: 5, y: 4 },
          { x: 4, y: 4 },
          { x: 3, y: 4 },
        ]
        direction = "RIGHT"
        nextDirection = "RIGHT"
        food = { x: 14, y: 4 }
        goldenFood = null
        lives = INITIAL_LIVES
        score = 0
        applesCount = 0
        startGame()
      }

      // Register the snake game input interceptor
      setSnakeGameHandler((key: string): boolean => {
        const k = key.toLowerCase()

        if (gameState === "ready") {
          if (k === "space") {
            startGame()
            return true
          }
          // Allow Left, Right, Tab, Shift+Tab, Return, Enter to fall through to dialog buttons
          return false
        }

        if (gameState === "playing") {
          if (k === "up" || k === "w" || k === "k") {
            if (direction !== "DOWN") nextDirection = "UP"
            return true
          }
          if (k === "down" || k === "s" || k === "j") {
            if (direction !== "UP") nextDirection = "DOWN"
            return true
          }
          if (k === "left" || k === "a" || k === "h") {
            if (direction !== "RIGHT") nextDirection = "LEFT"
            return true
          }
          if (k === "right" || k === "d" || k === "l") {
            if (direction !== "LEFT") nextDirection = "RIGHT"
            return true
          }
          if (k === "space" || k === "p") {
            pauseGame()
            return true
          }
          if (k === "r") {
            restartGame()
            return true
          }
          // Tab, Shift+Tab, Esc can fall through
          return false
        }

        if (gameState === "paused") {
          if (k === "space" || k === "p") {
            resumeGame()
            return true
          }
          if (k === "r") {
            restartGame()
            return true
          }
          // Allow Left, Right, Tab, Shift+Tab, Return, Enter to fall through to dialog buttons
          return false
        }

        if (gameState === "gameover") {
          if (k === "r") {
            restartGame()
            return true
          }
          // Allow Left, Right, Tab, Shift+Tab, Return, Enter to fall through to dialog buttons
          return false
        }

        return false
      })

      // Clean up on unmount / destroy
      container.on("destroy", () => {
        cleanup()
      })

      return container
    },
  })
}
