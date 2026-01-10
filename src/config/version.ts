import packageJson from "~/../package.json" with { type: "json" }

export const VersionInfo = {
  version: packageJson.version,
  name: packageJson.name,
  description: packageJson.description,
  author: packageJson.author,
}

export const getVersion = () => `v${VersionInfo.version}`
