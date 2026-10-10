import test from "node:test"
import assert from "node:assert/strict"
import { backfillDate, normalizeNoteDate } from "./note-date.ts"

test("note dates accept known, partial, and unknown dates", () => {
  for (const [input, filenameDate] of [
    ["2026-01-03", "2026-01-03"],
    ["2024-02-29", "2024-02-29"],
    ["2026-01", "2026-01-00"],
    ["2026-01-dd", "2026-01-00"],
    ["2026", "2026-00-00"],
    ["2026-mm-dd", "2026-00-00"],
    ["", "0000-00-00"],
    ["yyyy-mm-dd", "0000-00-00"],
  ]) assert.equal(normalizeNoteDate(input), filenameDate)

  for (const input of [
    "2026-02-29", "2026-13-01", "2026-00-01", "0000-01-01", "2026-01-32", "2026-1-1",
  ])
    assert.throws(() => normalizeNoteDate(input), /Invalid DATE/)
})

test("unknown parts sort after known dates at each precision", () => {
  const day = new Date("2026-01-01T00:00:00").getTime()
  const previousYear = new Date("2025-12-31T00:00:00").getTime()
  const month = backfillDate("2026-01-00-month.md")!
  const february = backfillDate("2026-02-00-february.md")!
  const year = backfillDate("2026-00-00-year.md")!
  const unknown = backfillDate("0000-00-00-unknown.md")!

  assert(day > month.getTime() && month.getTime() > year.getTime())
  assert(new Date("2026-02-01T00:00:00").getTime() > february.getTime())
  assert(february.getTime() > new Date("2026-01-31T00:00:00").getTime())
  assert(year.getTime() > previousYear && previousYear > unknown.getTime())
  assert.equal(month.toLocaleDateString("en-US"), "Jan, 2026")
  assert.equal(backfillDate("2022-11-00-note.md")!.toLocaleDateString("en-US"), "Nov, 2022")
  assert.equal(year.toLocaleDateString("en-US"), "2026")
  assert.equal(unknown.toLocaleDateString("en-US"), "")
  assert.equal(backfillDate("2026-01-03-known.md"), undefined)
})
