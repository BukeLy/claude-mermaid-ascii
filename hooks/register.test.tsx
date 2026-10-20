import { expect, test } from 'claude-code/testing'

type Run = { exitCode: number; stdout?: string; stderr?: string }
type Call = { argv: readonly string[]; stdin?: string }

const reply = (text: string, columns: number) => ({
  plugin: 'mermaid-ascii',
  component: 'AssistantMessage',
  requestId: 'msg-1',
  props: { text, isFirstOfReply: true },
  viewport: { columns, rows: 50 },
} as const)

// Stands in for the engine: draws the text, and answers each host command
// from `answers`, keyed by the executable.
const setup = (on: any, answers: Record<string, Run>) => {
  const calls: Call[] = []
  on('ui.render', ($: any, e: any) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{e.props.text}</Text>
  })
  on('process.run', (_: unknown, e: any) => {
    calls.push({ argv: e.argv, stdin: e.init?.stdin })
    const run = answers[e.argv[0]] ?? { exitCode: 127 }

    return {
      value: {
        stdout: '',
        stderr: '',
        ...run,
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }
  })

  return calls
}

const drawnOn = async ($: any, text: string, surface = 'terminal', columns = 80) => {
  const ui = await $.ui.mount({ ...reply(text, columns), surface })
  const drawn = (await ui.find({ type: 'Text', text: /\S/ }))?.text as string
  await ui.unmount()

  return drawn
}

const FLOW = 'Before\n```mermaid\ngraph TD\n  A --> B\n```\nAfter'
const BOX = '┌───┐\n│ A │\n└───┘\n'

test('boxmaid draws a mermaid block within the terminal width, in the terminal only', async ($, on) => {
  const calls = setup(on, { boxmaid: { exitCode: 0, stdout: BOX } })

  expect(await drawnOn($, FLOW)).toBe('Before\n```\n┌───┐\n│ A │\n└───┘\n```\nAfter')
  expect(calls[0]?.argv).toEqual(['boxmaid', '-color', 'never', '-w', '76', '-require-fit', '-'])
  expect(calls[0]?.stdin).toBe('graph TD\n  A --> B')

  expect(await drawnOn($, FLOW, 'desktop')).toBe(FLOW)
  expect(calls.length).toBe(1)
})

test('a drawing is cached per source and width', async ($, on) => {
  const calls = setup(on, { boxmaid: { exitCode: 0, stdout: BOX } })

  await drawnOn($, FLOW)
  await drawnOn($, FLOW)
  expect(calls.length).toBe(1)

  await drawnOn($, FLOW, 'terminal', 120)
  expect(calls.length).toBe(2)
})

test('a diagram boxmaid cannot fit stays as source without trying merman', async ($, on) => {
  const calls = setup(on, { boxmaid: { exitCode: 3, stderr: 'diagram is 90 columns; budget is 76' } })

  expect(await drawnOn($, FLOW)).toBe(FLOW)
  expect(calls.map(call => call.argv[0])).toEqual(['boxmaid'])
})

test('merman draws what boxmaid refuses, if it fits', async ($, on) => {
  const er = 'x\n```mermaid\nerDiagram\n  用户 ||--o{ 文档 : 上传\n```'
  const calls = setup(on, {
    boxmaid: { exitCode: 1, stderr: 'boxmaid: -: the diagram is empty' },
    'merman-cli': { exitCode: 0, stdout: '┌──────┐\n│ 用户 │\n└──────┘\n' },
  })

  expect(await drawnOn($, er)).toBe('x\n```\n┌──────┐\n│ 用户 │\n└──────┘\n```')
  expect(calls.map(call => call.argv[0])).toEqual(['boxmaid', 'merman-cli'])

  // Ten columns leave six after the margin, too few for the eight-column box.
  expect(await drawnOn($, er, 'terminal', 10)).toBe(er)
})

test('a block neither tool can draw stays as source and is tried again on the next draw', async ($, on) => {
  const calls = setup(on, {
    boxmaid: { exitCode: 1, stderr: 'boxmaid: parse error' },
    'merman-cli': { exitCode: 1, stderr: 'Diagram parse error' },
  })
  const broken = 'x\n```mermaid\nnot a diagram ][\n```'

  expect(await drawnOn($, broken)).toBe(broken)
  expect(await drawnOn($, broken)).toBe(broken)
  expect(calls.length).toBe(4)
})
