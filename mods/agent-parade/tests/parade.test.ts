import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'agent-parade',
  props: { title: 'Agent parade', isFocused: false, bodyColumns: 48, placement: 'dock' } as never,
} as const

test('the pane invites subagents before any arrive', async ($, on) => {
  mock.clock(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agent-parade', surface, ...PANE })
    expect(await ui.find({ text: /None yet/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a spawned subagent marches into the pane', async ($, on) => {
  mock.clock(on)
  // Stand in for the engine: every spawn starts agent "a1".
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }))
  const opened: string[] = []
  on('ui.open', (_$, e) => (opened.push(e.id), { value: { isPlaced: true } }))

  await $.agent.spawn({ prompt: 'look around', description: 'Scout the repo', subagentType: 'Explore' } as never)

  expect(opened).toEqual(['agent-parade'])

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agent-parade', surface, ...PANE })
    expect(await ui.find({ text: /Scout the repo/ })).toBeDefined()
    expect(await ui.find({ text: /1 working/ })).toBeDefined()
    await ui.unmount()
  }

  // An avatar is two plain-image pictures (creature + prop), never frames,
  // since a frame blanks whenever the surface redraws it.
  const desktop = await $.ui.mount({ plugin: 'agent-parade', surface: 'desktop', ...PANE })
  const pictures = await desktop.findAll({ type: 'Svg' })
  expect(pictures.length).toBe(2)
  expect(pictures.every(one => one.props.isInteractive !== true)).toBe(true)
  // Each picture is addressed by what it shows, so a new pose is a new image.
  expect(await desktop.find({ key: 'prop-box-a1-starting' })).toBeDefined()
  expect(await desktop.find({ key: 'creature-box-a1-awake' })).toBeDefined()
  await desktop.unmount()

  // Cards start collapsed; Details opens the stats.
  for (const surface of ['desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'agent-parade', surface, ...PANE })
    expect(await ui.find({ text: /Tokens in/ })).toBeUndefined()
    await ui.press({ key: 'details-a1' })
    expect(await ui.find({ text: /Tokens in/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a new spawn keeps the agents still working', async ($, on) => {
  mock.clock(on)
  let n = 0
  on('agent.spawn', () => ({ model: 'haiku', agentId: `b${++n}` }))
  on('ui.open', () => ({ value: { isPlaced: true } }))

  await $.agent.spawn({ prompt: 'one', description: 'First helper', subagentType: 'Explore' } as never)
  await $.agent.spawn({ prompt: 'two', description: 'Second helper', subagentType: 'Explore' } as never)

  const ui = await $.ui.mount({ plugin: 'agent-parade', surface: 'desktop', ...PANE })
  expect(await ui.find({ text: /First helper/ })).toBeDefined()
  expect(await ui.find({ text: /Second helper/ })).toBeDefined()
  expect(await ui.find({ text: /2 working/ })).toBeDefined()
  await ui.unmount()
})
