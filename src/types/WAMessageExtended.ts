import type { WAMessage } from "@muhammedaksam/waha-node"

export type WAMessageExtended = Omit<WAMessage, "participant" | "_data" | "replyTo"> & {
  participant?: string
  isForwarded?: boolean
  _data?: {
    notifyName?: string
    pushName?: string
    quotedParticipant?: {
      _serialized?: string
      user?: string
    }
    hasReaction?: boolean
    reactions?: Array<{
      id: string
      aggregateEmoji: string
      hasReactionByMe: boolean
      senders: Array<{
        id: string
        timestamp: number
      }>
    }>
    isForwarded?: boolean
  }
  replyTo?: {
    id: string
    participant?: string
    body?: string
    _data?: {
      notifyName?: string
      pushName?: string
      from?: string
      author?: string
    }
  }
  // Our internal normalized reactions
  reactions?: Array<{
    text: string
    id: string
    from?: string
  }>
}
