export function normalizeNoteDate(input: string): string {
  let date = input === "" || input === "yyyy-mm-dd" ? "0000-00-00" : input
  date = date.replace(/-mm(?=-|$)/, "-00").replace(/-dd$/, "-00")
  if (/^\d{4}$/.test(date)) date += "-00-00"
  else if (/^\d{4}-\d{2}$/.test(date)) date += "-00"

  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!parts) throw new Error(`Invalid DATE: ${input}`)
  const [year, month, day] = parts.slice(1).map(Number)
  if (
    (year === 0 && (month !== 0 || day !== 0)) ||
    month > 12 ||
    (month === 0 && day !== 0) ||
    day > 31
  ) throw new Error(`Invalid DATE: ${input}`)
  if (month && day) {
    const actual = new Date(`${date}T00:00:00`)
    if (
      !Number.isFinite(actual.getTime()) ||
      actual.getFullYear() !== year ||
      actual.getMonth() + 1 !== month ||
      actual.getDate() !== day
    ) throw new Error(`Invalid DATE: ${input}`)
  }
  return date
}

class BackfillDate extends Date {
  private readonly label: string

  constructor(timestamp: number, label: string) {
    super(timestamp)
    this.label = label
  }

  override toLocaleDateString(): string {
    return this.label
  }
}

export function backfillDate(path: string): Date | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})-.+\.md$/.exec(path.split("/").at(-1) ?? "")
  if (!match) return
  const date = normalizeNoteDate(match[1])
  const [year, month, day] = date.split("-").map(Number)
  if (month && day) return

  // ponytail: Quartz only sorts full Dates; use proxy timestamps until it supports partial dates.
  const first = `${date.slice(0, 4)}-${month ? date.slice(5, 7) : "01"}-${day ? date.slice(8) : "01"}`
  const start = year ? new Date(`${first}T00:00:00`) : new Date("0001-01-01T00:00:00Z")
  const label = !year ? "" : !month ? String(year) : `${start.toLocaleString("en-US", { month: "short" })}, ${year}`
  const timestamp = year
    ? start.getTime() - (month ? 1 : 2)
    : start.getTime()
  return new BackfillDate(timestamp, label)
}

if (process.argv[1]?.endsWith("note-date.ts")) console.log(normalizeNoteDate(process.argv[2] ?? ""))
