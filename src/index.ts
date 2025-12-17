import { ASCIIFont, Box, createCliRenderer, Text, TextAttributes } from "@opentui/core"

const renderer = await createCliRenderer({ exitOnCtrlC: true })

renderer.root.add(
  Box(
    { alignItems: "center", justifyContent: "center", flexGrow: 1 },
    Box(
      { justifyContent: "center", alignItems: "flex-end" },
      ASCIIFont({ font: "tiny", text: "OpenTUI" }),
      Text({ content: "What will you build?", attributes: TextAttributes.DIM })
    )
  )
)
