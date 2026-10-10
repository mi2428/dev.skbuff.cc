import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"
import { write } from "./quartz/plugins/emitters/helpers"
import type { FullSlug } from "./quartz/util/path"
import type { Root } from "hast"
import { visit } from "unist-util-visit"
import { h } from "preact"
import { backfillDate } from "./note-date"

const googleSiteVerification = "XFvvt8qqt1wgNZzBP9oxykccqi4W81Zkd9STqHnhFcI"

componentRegistry.setOptionOverrides("@quartz-community/recent-notes", {
  filter: (page: { slug?: string }) => page.slug !== "404",
})

const config = await loadQuartzConfig()
const pageDispatcher = config.plugins.emitters.find((emitter) => emitter.name === "PageTypeDispatcher")
if (!pageDispatcher) throw new Error("PageTypeDispatcher is required")
delete pageDispatcher.partialEmit

config.plugins.transformers.push({
  name: "SiteMarkupAndDates",
  markdownPlugins: () => [
    () => (_tree, file) => {
      const date = backfillDate(file.data.relativePath ?? "")
      if (date && file.data.dates) file.data.dates.created = date
    },
  ],
  htmlPlugins: () => [
    () => (tree: Root) => {
      visit(tree, "element", (node) => {
        if (
          node.tagName === "blockquote" &&
          Array.isArray(node.properties.className) &&
          node.properties.className.includes("twitter-tweet")
        ) {
          node.properties.dataAlign ??= "center"
        }
        if (/^h[1-6]$/.test(node.tagName)) {
          node.children = node.children.filter(
            (child) =>
              child.type !== "element" || child.tagName !== "a" || child.properties.role !== "anchor",
          )
        }
        if (node.tagName === "section" && "dataFootnotes" in node.properties) {
          node.properties.ariaLabel = "脚注"
          node.children = node.children.filter(
            (child) => child.type !== "element" || child.properties.id !== "footnote-label",
          )
        }
        if (node.tagName === "a" && "dataFootnoteRef" in node.properties) {
          delete node.properties.ariaDescribedBy
        }
        if (node.tagName === "p") {
          node.children = node.children.filter(
            (child) => child.type !== "element" || !("dataFootnoteBackref" in child.properties),
          )
        }
      })
    },
  ],
  externalResources: () => ({
    additionalHead: [
      h("meta", { name: "google-site-verification", content: googleSiteVerification }),
      h("script", {
        src: "https://platform.twitter.com/widgets.js",
        async: true,
        "data-persist": true,
      }),
    ],
    js: [
      {
        loadTime: "afterDOMReady",
        contentType: "inline",
        script: 'document.addEventListener("nav", () => window.twttr?.widgets?.load())',
      },
    ],
  }),
})
config.plugins.emitters.push({
  name: "LatestArticleRedirect",
  async *emit(ctx, content) {
    const articles = content
      .map(([, file]) => file.data)
      .filter((data) => data.slug && /^\d{4}-\d{2}-\d{2}-.+\.md$/.test(data.relativePath?.split("/").pop() ?? ""))

    const timestamp = (data: (typeof articles)[number]) => {
      const value = data.dates?.created?.getTime()
      if (value === undefined || !Number.isFinite(value)) {
        throw new Error(`Invalid creation date for ${data.slug}`)
      }
      return value
    }

    articles.sort((a, b) => timestamp(b) - timestamp(a) || b.slug!.localeCompare(a.slug!))
    const latest = articles[0]?.slug
    if (!latest) throw new Error("No dated articles found")

    const url = `/${latest.split("/").map(encodeURIComponent).join("/")}`
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="google-site-verification" content="${googleSiteVerification}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${url}"></head><body><a href="${url}">Read the latest note</a></body></html>`
    yield await write({ ctx, slug: "index" as FullSlug, ext: ".html", content: html })
  },
})
export default config
export const layout = await loadQuartzLayout()
