import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"

// Get migration name from args
const args = process.argv.slice(2)
if (args.length === 0) {
  console.error("Please provide a migration name")
  console.error("Usage: bun run migration:create <name>")
  process.exit(1)
}

const name = args.join("_").toLowerCase()
const timestamp = Math.floor(Date.now() / 1000).toString()
const filename = `${timestamp}_${name}`

// Ensure directory exists
const migrationsDir = join(process.cwd(), "src", "utils", "migrations")
if (!existsSync(migrationsDir)) {
  mkdirSync(migrationsDir, { recursive: true })
}

// 1. Create migration file
const filePath = join(migrationsDir, `${filename}.ts`)
const template = `/**
 * Migration: ${name.replace(/_/g, " ")}
 */

import { debugLog } from "../debug"

export const name = "${name}"

export function up(): boolean {
  debugLog("Migrations", "Running migration: ${name}")
  // TODO: Implement migration logic
  return true
}

export function down(): boolean {
  debugLog("Migrations", "Reverting migration: ${name}")
  // TODO: Implement revert logic
  return true
}
`

writeFileSync(filePath, template)
console.log(`Created migration: src/utils/migrations/${filename}.ts`)

// 2. Register in src/utils/migrations.ts
const registryPath = join(process.cwd(), "src", "utils", "migrations.ts")
if (existsSync(registryPath)) {
  let content = readFileSync(registryPath, "utf-8")

  // Create the registration code block
  const registrationCode = `
  try {
    const m${timestamp} = await import("./migrations/${filename}")
    migrations.push({
      timestamp: "${timestamp}",
      name: m${timestamp}.name,
      up: m${timestamp}.up,
      down: m${timestamp}.down,
    })
  } catch (e) {
    debugLog("Migrations", \`Failed to load migration: \${e}\`)
  }
`

  // Insert before the "Add future migrations here" comment
  const keyComment = "// Add future migrations here:"
  if (content.includes(keyComment)) {
    content = content.replace(keyComment, `${registrationCode}\n  ${keyComment}`)
    writeFileSync(registryPath, content)
    console.log(`Registered in src/utils/migrations.ts`)
  } else {
    console.warn("Could not find registration point in src/utils/migrations.ts")
  }
}
