import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { componentRegistry } from "./quartz/components/registry"
import { External } from "./quartz/components/external"
import Flex from "./quartz/components/Flex"
import type { QuartzComponent } from "./quartz/components/types"
import { registerCondition } from "./quartz/plugins/loader/conditions"
import { PageTypeDispatcher } from "./quartz/plugins/pageTypes/dispatcher"
import { write } from "./quartz/plugins/emitters/helpers"
import type { FullSlug } from "./quartz/util/path"
import type { Root } from "hast"
import { visit } from "unist-util-visit"
import { h } from "preact"
import { backfillDate } from "./note-date"

const googleSiteVerification = "XFvvt8qqt1wgNZzBP9oxykccqi4W81Zkd9STqHnhFcI"

registerCondition("tag-index", ({ fileData }) => fileData.slug === "tags/index")

componentRegistry.setOptionOverrides("@quartz-community/recent-notes", {
  filter: (page: { slug?: string }) => page.slug !== "404",
})

const config = await loadQuartzConfig()
const pageDispatcherIndex = config.plugins.emitters.findIndex(
  (emitter) => emitter.name === "PageTypeDispatcher",
)
if (pageDispatcherIndex < 0) throw new Error("PageTypeDispatcher is required")

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
          node.properties.ariaLabel = "Footnote"
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
        dangerouslySetInnerHTML: {
          __html: `(() => {
            const root = document.documentElement
            root.style.visibility = "hidden"
            addEventListener("DOMContentLoaded", () => {
              let done = false
              const finish = (ready) => {
                if (done) return
                done = true
                clearTimeout(timeout)
                if (!ready) {
                  for (const child of document.body.children) child.style.display = "none"
                  const error = document.createElement("p")
                  error.textContent = "Unable to load the font. Please reload the page."
                  document.body.append(error)
                }
                root.style.visibility = ""
              }
              const timeout = setTimeout(() => finish(false), 10000)
              document.fonts.ready.then(() => {
                const noto = [...document.fonts].filter((font) => font.family === "Noto Sans JP" && font.status !== "unloaded")
                finish(noto.length > 0 && noto.every((font) => font.status === "loaded"))
              }, () => finish(false))
            }, { once: true })
          })()`,
        },
      }),
      h("link", { rel: "preconnect", href: "https://fonts.googleapis.com" }),
      h("link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" }),
      h("link", {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto%20Sans%20JP%3Awght%40300%3B400%3B500%3B600&family=IBM%20Plex%20Mono%3Awght%40400%3B600&display=block",
      }),
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
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Redirecting to the latest article</title><meta name="google-site-verification" content="${googleSiteVerification}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${url}"></head><body style="font-family:system-ui,sans-serif"><p>If you are not redirected automatically, <a href="${url}">click here</a>.</p></body></html>`
    yield await write({ ctx, slug: "index" as FullSlug, ext: ".html", content: html })
  },
})
export const layout = await loadQuartzLayout()
const TagsLink: QuartzComponent = () =>
  h(
    "a",
    { class: "tags-button", href: "/tags", "aria-label": "タグ一覧", title: "タグ一覧" },
    h(
      "svg",
      {
        width: 20,
        height: 20,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true",
      },
      h("path", {
        d: "M20.59 13.41 13.41 20.59a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z",
      }),
      h("circle", { cx: 7, cy: 7, r: 1 }),
    ),
  )
const titlebar = Flex({
  components: [
    { Component: External("ArticleTitle"), grow: true },
    { Component: External("Search", { enablePreview: false }) },
    { Component: TagsLink },
    { Component: External("Darkmode") },
  ],
  gap: "0.5rem",
})
for (const pageLayout of [layout.defaults, ...Object.values(layout.byPageType)]) {
  // The priority-10 titlebar group is first in each non-empty beforeBody layout.
  if (pageLayout.beforeBody?.length) pageLayout.beforeBody[0] = titlebar
}
const pageDispatcher = PageTypeDispatcher(layout)
delete pageDispatcher.partialEmit
config.plugins.emitters[pageDispatcherIndex] = pageDispatcher
export default config
