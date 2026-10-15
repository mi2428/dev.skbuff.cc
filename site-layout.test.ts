import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

// Run `make build` before this test.
const page = (slug: string) =>
  readFileSync(new URL(`./public/${slug}.html`, import.meta.url), "utf8")

test("tag navigation and graph are scoped to the tag index", () => {
  const article = page("2026-10-15-uuoc")
  const tags = page("tags/index")
  const tag = page("tags/arts")

  for (const html of [article, tags, tag]) {
    const search = html.indexOf('class="search"')
    const link = html.indexOf('href="/tags"', search)
    const darkmode = html.indexOf('class="darkmode"', link)
    assert.ok(search >= 0 && link > search && darkmode > link)
    assert.match(html, /<a class="tags-button"[^>]*aria-label="タグ一覧"[^>]*><svg\b[\s\S]*?<\/svg><\/a>/)
  }

  assert.match(tags, /class="graph"/)
  assert.match(tags, /class="graph-container" data-cfg="\{[^\"]*&quot;depth&quot;:-1/)
  assert.ok(tags.indexOf('class="graph"') > tags.lastIndexOf('class="page-listing"'))
  assert.ok(tags.indexOf('class="graph"') > tags.indexOf('class="page-footer"'))
  assert.doesNotMatch(article, /class="graph"/)
  assert.doesNotMatch(tag, /class="graph"/)
})
