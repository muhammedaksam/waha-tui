/**
 * Cache Service
 * Simple in-memory cache with TTL support for API responses
 */

import { TIME_MS } from "~/constants"
import { debugLog } from "~/utils/debug"

/**
 * Cache entry with expiration time
 */
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

/**
 * Cache options
 */
interface CacheOptions {
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttlMs?: number
}

/**
 * Simple in-memory cache service
 * Provides TTL-based caching for API responses
 */
class CacheService {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private readonly maxEntries = 100

  /**
   * Get a cached value by key
   * @param key - Cache key
   * @returns Cached value or undefined if not found/expired
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      debugLog("Cache", `Expired: ${key}`)
      return undefined
    }

    debugLog("Cache", `Hit: ${key}`)
    return entry.data as T
  }

  /**
   * Set a cached value with optional TTL
   * @param key - Cache key
   * @param data - Data to cache
   * @param options - Cache options (TTL)
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttlMs = options.ttlMs ?? TIME_MS.CACHE_DEFAULT_TTL

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
        debugLog("Cache", `Evicted oldest: ${oldestKey}`)
      }
    }

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })

    debugLog("Cache", `Set: ${key} (TTL: ${ttlMs}ms)`)
  }

  /**
   * Check if a key exists and is not expired
   * @param key - Cache key
   * @returns True if key exists and is valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  /**
   * Delete a cached entry
   * @param key - Cache key
   */
  delete(key: string): void {
    this.cache.delete(key)
    debugLog("Cache", `Deleted: ${key}`)
  }

  /**
   * Clear all entries matching a prefix
   * @param prefix - Key prefix to match
   */
  clearPrefix(prefix: string): void {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        count++
      }
    }
    if (count > 0) {
      debugLog("Cache", `Cleared ${count} entries with prefix: ${prefix}`)
    }
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    debugLog("Cache", `Cleared all ${size} entries`)
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
    }
  }
}

/**
 * Singleton cache service instance
 */
export const cacheService = new CacheService()

/**
 * Cache key generators for common patterns
 */
export const CacheKeys = {
  contacts: (session: string) => `contacts:${session}`,
  chats: (session: string) => `chats:${session}`,
  messages: (session: string, chatId: string) => `messages:${session}:${chatId}`,
  profile: (session: string) => `profile:${session}`,
}
