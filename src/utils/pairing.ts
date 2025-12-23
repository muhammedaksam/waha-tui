/**
 * Phone Number Pairing utilities
 * Alternative authentication method using pairing codes
 */

import { getClient } from "../client"
import { debugLog } from "./debug"

export interface PairingResult {
  success: boolean
  code?: string
  error?: string
}

/**
 * Request a pairing code for phone number authentication
 * This is an alternative to QR code scanning
 *
 * @param sessionName - The session to authenticate
 * @param phoneNumber - Phone number in international format (e.g., "12132132130")
 * @returns PairingResult with code on success or error message on failure
 */
export async function requestPairingCode(
  sessionName: string,
  phoneNumber: string
): Promise<PairingResult> {
  try {
    // Strip non-digits from phone number
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, "")

    if (!cleanNumber || cleanNumber.length < 10) {
      return {
        success: false,
        error: "Invalid phone number. Use international format without + (e.g., 12132132130)",
      }
    }

    debugLog("Pairing", `Requesting code for: ${cleanNumber}`)
    const client = getClient()

    const { data } = await client.auth.authControllerRequestCode(sessionName, {
      phoneNumber: cleanNumber,
      method: undefined, // undefined = web pairing (not SMS/voice)
    })

    // The response should include a code property
    const responseData = data as { code?: string } | undefined

    if (responseData?.code) {
      debugLog("Pairing", `Code received: ${responseData.code}`)
      return { success: true, code: responseData.code }
    }

    return { success: false, error: "No pairing code returned from server" }
  } catch (error: unknown) {
    const axiosError = error as {
      response?: {
        data?: { message?: string; error?: string; statusCode?: number } | string
        status?: number
      }
      message?: string
    }

    // Try to extract detailed error message
    let msg = "Unknown error"
    if (axiosError?.response?.data) {
      const data = axiosError.response.data
      if (typeof data === "string") {
        msg = data
      } else if (data.message) {
        msg = data.message
      } else if (data.error) {
        msg = data.error
      }
    } else if (axiosError?.message) {
      msg = axiosError.message
    }

    // Add status code context
    const status = axiosError?.response?.status
    if (status === 500) {
      msg = `Server error: ${msg}. Make sure the session is showing QR code.`
    } else if (status === 422) {
      msg = `Invalid request: ${msg}`
    }

    debugLog("Pairing", `Request failed: ${msg}`)
    return { success: false, error: msg }
  }
}
