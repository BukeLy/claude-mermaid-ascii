import type { Register } from 'claude-code'

const FENCE = /```mermaid[^\n]*\n([\s\S]*?)\n```/g
// ponytail: approximate East Asian Wide ranges; emoji and rarer wide blocks still count as one column
const WIDE =
  /[ᄀ-ᅟ⺀-〾ぁ-㏿㐀-䶿一-鿿ꀀ-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/g
// The transcript indents a reply by two columns; keep a little slack for the fence.
const MARGIN = 4
// boxmaid's exit code when the diagram cannot be laid out within -w columns.
const CANNOT_FIT = 3
// boxmaid draws every kind and fits the width itself; merman-cli covers what it
// refuses, such as an erDiagram with CJK entity names.
const boxmaid = (columns: number) =>
  ['boxmaid', '-color', 'never', '-w', String(columns), '-require-fit', '-']
const MERMAN = ['merman-cli', 'render', '-q', '-f', 'unicode', '-o', '-', '-']

const fence = (drawn: string) => '```\n' + drawn + '\n```'

const width = (drawn: string) =>
  Math.max(
    ...drawn.split('\n').map(line => line.trimEnd().length + (line.match(WIDE)?.length ?? 0)),
  )

const firstLine = (text: string) => text.trim().split('\n')[0]

export const register: Register = on => {
  // ponytail: unbounded per-session cache; a session draws a handful of diagrams
  const drawings = new Map<string, Promise<string | null>>()

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || !e.props.text.includes('```mermaid')) {
      return next(e)
    }

    // 0 tells boxmaid the width is unlimited.
    const columns = e.viewport ? Math.max(1, e.viewport.columns - MARGIN) : 0
    const run = (argv: string[], source: string) =>
      $.process.run(argv, { stdin: source, timeoutMs: 5000 })

    const render = async (source: string) => {
      const box = await run(boxmaid(columns), source)

      if (box.exitCode === 0) {
        return box.stdout.trimEnd()
      }

      if (box.exitCode === CANNOT_FIT) {
        return null
      }

      const merman = await run(MERMAN, source)

      if (merman.exitCode !== 0) {
        throw new Error(`boxmaid: ${firstLine(box.stderr)}; merman-cli: ${firstLine(merman.stderr)}`)
      }

      const drawn = merman.stdout.trimEnd()

      return columns === 0 || width(drawn) <= columns ? drawn : null
    }

    const draw = async (source: string) => {
      const key = `${columns}\n${source}`

      if (!drawings.has(key)) {
        drawings.set(key, render(source))
      }

      const drawn = await drawings.get(key)!.catch(error => {
        drawings.delete(key)
        $.ui.status(`mermaid-ascii: ${error}`)

        return null
      })

      return drawn === null ? null : fence(drawn)
    }

    const drawn = await Promise.all(
      [...e.props.text.matchAll(FENCE)].map(([, source]) => draw(source ?? '')),
    )
    let i = 0
    const text = e.props.text.replace(FENCE, block => drawn[i++] ?? block)

    return next({ ...e, props: { ...e.props, text } })
  })
}
