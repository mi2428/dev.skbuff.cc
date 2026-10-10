import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"
import { write } from "./quartz/plugins/emitters/helpers"
import type { FullSlug } from "./quartz/util/path"
import type { Root } from "hast"
import { visit } from "unist-util-visit"

componentRegistry.setOptionOverrides("@quartz-community/recent-notes", {
  filter: (page: { slug?: string }) => page.slug !== "404",
})

const config = await loadQuartzConfig()
config.plugins.transformers.push({
  name: "RemoveHeadingLinks",
  htmlPlugins: () => [
    () => (tree: Root) => {
      visit(tree, "element", (heading) => {
        if (!/^h[1-6]$/.test(heading.tagName)) return
        heading.children = heading.children.filter(
          (child) =>
            child.type !== "element" || child.tagName !== "a" || child.properties.role !== "anchor",
        )
      })
    },
  ],
})
config.plugins.emitters.push({
  name: "LatestArticleRedirect",
  async *emit(ctx, content) {
    const articles = content
      .map(([, file]) => file.data)
      .filter((data) => data.slug && /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(data.relativePath?.split("/").pop() ?? ""))

    const timestamp = (data: (typeof articles)[number]) => {
      const date = data.frontmatter?.created ?? data.frontmatter?.date ?? data.relativePath?.split("/").pop()?.slice(0, 10)
      const value = Date.parse(String(date))
      if (!Number.isFinite(value)) throw new Error(`Invalid creation date for ${data.slug}`)
      return value
    }

    articles.sort((a, b) => timestamp(b) - timestamp(a) || b.slug!.localeCompare(a.slug!))
    const latest = articles[0]?.slug
    if (!latest) throw new Error("No dated articles found")

    const url = `/${latest.split("/").map(encodeURIComponent).join("/")}`
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${url}"></head><body><a href="${url}">Read the latest note</a></body></html>`
    yield await write({ ctx, slug: "index" as FullSlug, ext: ".html", content: html })
  },
})
export default config
export const layout = await loadQuartzLayout()
