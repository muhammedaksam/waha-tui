/**
 * Phone Number Validation Utility
 * Validates and checks if a phone number exists on WhatsApp via WAHA API
 */

import { getClient } from "../client"
import { debugLog } from "./debug"

/**
 * Check if a string looks like a phone number
 * Simple heuristic: contains mostly digits, maybe starts with +, length > 7
 */
export function looksLikePhoneNumber(query: string): boolean {
  // Remove spaces, dashes, parentheses
  const clean = query.replace(/[\s\-()]/g, "")

  // Must be at least 7 digits (shortest valid numbers)
  if (clean.length < 7) return false

  // Must consist only of digits and optional leading plus
  if (!/^\+?\d+$/.test(clean)) return false

  return true
}

/**
 * Check if a number is registered on WhatsApp
 * @param phone Phone number
 * @param session Session name
 * @returns Formatted chat ID (e.g. 12345678@c.us) or null if invalid
 */
// Interface for the check-exists response data
interface WANumberExistResult {
  numberExists: boolean
  chatId?: string | { _serialized: string; [key: string]: unknown }
  [key: string]: unknown
}

export async function validateWhatsAppNumber(
  phone: string,
  session: string
): Promise<string | null> {
  try {
    const client = getClient()

    // Check using WAHA API
    // Use the modern contacts check-exists endpoint
    const response = await client.contacts.contactsControllerCheckExists({
      phone,
      session,
    })

    // Response format: WANumberExistResult
    const result = response.data as unknown as WANumberExistResult
    debugLog("PhoneValidation", `Check status for ${phone}: ${JSON.stringify(result)}`)

    if (result && result.numberExists && result.chatId) {
      const chatId = result.chatId
      if (typeof chatId === "string") {
        return chatId
      }
      return chatId._serialized
    }

    return null
  } catch (error) {
    debugLog("PhoneValidation", `Validation failed for ${phone}: ${error}`)
    return null
  }
}
