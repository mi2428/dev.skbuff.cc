import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"
import type { QuartzComponent } from "./quartz/components/types"

componentRegistry.setOptionOverrides("@quartz-community/recent-notes", {
  filter: (page: { slug?: string }) => page.slug !== "404",
})

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()
const lightDefault = (() => null) as QuartzComponent
lightDefault.beforeDOMLoaded = 'if (localStorage.getItem("theme") === null) localStorage.setItem("theme", "light")'
const resources = config.plugins.emitters[0]
if (resources.name !== "ComponentResources") throw new Error("ComponentResources is unavailable")
resources.getQuartzComponents = () => [lightDefault]
