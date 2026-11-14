import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test"

import * as core from "~/client/core"
import { loadContacts } from "~/client/sessionActions"
import { errorService } from "~/services/ErrorService"
import { appState } from "~/state/AppState"

const mockContactsController = {
  contactsControllerGetAll: mock(() => Promise.resolve({ data: [] })),
}

const mockClient = {
  contacts: mockContactsController,
}

describe("sessionActions > loadContacts", () => {
  beforeEach(() => {
    appState.reset()
    mockContactsController.contactsControllerGetAll.mockClear()

    spyOn(core, "getClient").mockReturnValue(
      mockClient as unknown as ReturnType<typeof core.getClient>
    )
    spyOn(core, "getSession").mockReturnValue("test-session")
  })

  it("should skip loading if contacts are already cached and forceReload is false", async () => {
    appState.setContactsCache(new Map([["1@c.us", "Alice"]]))

    await loadContacts()

    expect(mockContactsController.contactsControllerGetAll).not.toHaveBeenCalled()
  })

  it("should reload contacts if forceReload is true even when cache is populated", async () => {
    appState.setContactsCache(new Map([["1@c.us", "Alice"]]))
    mockContactsController.contactsControllerGetAll.mockResolvedValueOnce({
      data: [{ id: "2@c.us", name: "Bob" }],
    } as unknown as Awaited<ReturnType<typeof mockContactsController.contactsControllerGetAll>>)

    await loadContacts(true)

    expect(mockContactsController.contactsControllerGetAll).toHaveBeenCalledWith({
      session: "test-session",
      limit: 5000,
      offset: 0,
    })
    expect(appState.getState().contactsCache.get("2@c.us")).toBe("Bob")
  })

  it("should separate saved contacts into contactsCache and pushnames with no name into pushNamesCache", async () => {
    mockContactsController.contactsControllerGetAll.mockResolvedValueOnce({
      data: [
        { id: "1@c.us", name: "Alice" },
        { id: "2@c.us", pushname: "Bob" },
        { id: "3@c.us", name: "Charlie", pushname: "Chuck" },
        { id: "4@c.us", pushName: "Diana" },
        { id: "5@c.us", name: "   ", pushname: "Eve" },
      ],
    } as unknown as Awaited<ReturnType<typeof mockContactsController.contactsControllerGetAll>>)

    await loadContacts()

    const state = appState.getState()
    expect(state.contactsCache.get("1@c.us")).toBe("Alice")
    expect(state.contactsCache.get("3@c.us")).toBe("Charlie")
    expect(state.contactsCache.has("2@c.us")).toBe(false)
    expect(state.contactsCache.has("4@c.us")).toBe(false)

    expect(state.pushNamesCache.get("2@c.us")).toBe("Bob")
    expect(state.pushNamesCache.get("4@c.us")).toBe("Diana")
    expect(state.pushNamesCache.get("5@c.us")).toBe("Eve")
    expect(state.pushNamesCache.has("3@c.us")).toBe(false)
  })

  it("should paginate when page length equals limit", async () => {
    const page1 = Array.from({ length: 5000 }, (_, i) => ({
      id: `${i}@c.us`,
      name: `User ${i}`,
    }))
    const page2 = [
      { id: "5000@c.us", name: "User 5000" },
      { id: "5001@c.us", pushname: "Push 5001" },
    ]

    mockContactsController.contactsControllerGetAll
      .mockResolvedValueOnce({ data: page1 } as unknown as Awaited<
        ReturnType<typeof mockContactsController.contactsControllerGetAll>
      >)
      .mockResolvedValueOnce({ data: page2 } as unknown as Awaited<
        ReturnType<typeof mockContactsController.contactsControllerGetAll>
      >)

    await loadContacts()

    expect(mockContactsController.contactsControllerGetAll).toHaveBeenCalledTimes(2)
    expect(mockContactsController.contactsControllerGetAll).toHaveBeenNthCalledWith(1, {
      session: "test-session",
      limit: 5000,
      offset: 0,
    })
    expect(mockContactsController.contactsControllerGetAll).toHaveBeenNthCalledWith(2, {
      session: "test-session",
      limit: 5000,
      offset: 5000,
    })

    const state = appState.getState()
    expect(state.contactsCache.size).toBe(5001)
    expect(state.pushNamesCache.size).toBe(1)
    expect(state.pushNamesCache.get("5001@c.us")).toBe("Push 5001")
  })

  it("should handle API errors via errorService", async () => {
    const spy = spyOn(errorService, "handle")
    mockContactsController.contactsControllerGetAll.mockRejectedValueOnce(
      new Error("Network failed")
    )

    await loadContacts()

    expect(spy).toHaveBeenCalled()
  })
})
