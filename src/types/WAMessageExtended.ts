import type { WAMessage } from "@muhammedaksam/waha-node"

export type WAMessageExtended = Omit<WAMessage, "participant" | "_data" | "replyTo"> & {
  participant?: string
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
    // Media metadata (from WAHA message payload)
    type?: string
    mimetype?: string
    filename?: string
    size?: number
    fileSizeBytes?: number
    caption?: string
    body?: string
    mediaData?: {
      filename?: string
      mimetype?: string
    }
    // Location data
    lat?: number
    lng?: number
    loc?: string
    // vCard data
    vcardFormattedName?: string
    vcardList?: unknown[]
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
