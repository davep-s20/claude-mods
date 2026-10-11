import { atom, read, update } from 'claude-code'
import type { AgentInfo, AgentStatus, Register, TurnUsage } from 'claude-code'

import type { ActivityKind, AgentCard, AgentState, Tokens } from '../types'
import {
  AVATAR_HEIGHT,
  CREATURE_WIDTH,
  PROP_WIDTH,
  avatarText,
  creatureSvg,
  kindGlyph,
  moodOf,
  propOf,
  propSvg,
} from './avatar'

const PANE = 'agent-parade'
const TITLE = 'Agent parade'
const MAX_AGENTS = 60
const REPORT_CHARS = 6000
const RECENT = 5
const POSE_MS = 900

const agents = atom({ plugin: 'agent-parade', key: 'agents' } as const, [])
const main = atom({ plugin: 'agent-parade', key: 'main' } as const, null)
const expanded = atom({ plugin: 'agent-parade', key: 'expanded' } as const, [])

const MAIN_ID = 'main'
const MAIN_COLOR = '#e8704f'

const NO_TOKENS: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

function stateOf(status: AgentStatus): AgentState {
  switch (status) {
    case 'completed':
    case 'idle':
      return 'done'
    case 'failed':
      return 'failed'
    case 'killed':
      return 'stopped'
    case 'waiting':
      return 'waiting'
    default:
      return 'running'
  }
}

function isLiveStatus(status: AgentStatus): boolean {
  return status === 'pending' || status === 'running' || status === 'waiting'
}

const isLive = (card: AgentCard) => card.state === 'running' || card.state === 'waiting'

/** Cards kept by an older version of this mod lack the newer fields. */
function normalize(card: AgentCard): AgentCard {
  return {
    ...card,
    kind: card.kind ?? 'thinking',
    pose: card.pose ?? card.kind ?? 'thinking',
    poseAt: card.poseAt ?? 0,
    toolCounts: card.toolCounts ?? {},
    tokens: card.tokens ?? NO_TOKENS,
    context: card.context ?? 0,
    steps: card.steps ?? 0,
    recent: card.recent ?? [],
  }
}

function newCard(id: string, name: string, type: string, now: number): AgentCard {
  return {
    id,
    name,
    type,
    state: 'running',
    kind: 'starting',
    pose: 'starting',
    poseAt: now,
    activity: 'Warming up…',
    tools: 0,
    toolCounts: {},
    tokens: NO_TOKENS,
    context: 0,
    steps: 0,
    recent: [],
    startedAt: now,
  }
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function lastSegment(path: string): string {
  return clip(path.split('/').filter(Boolean).pop() ?? path, 40)
}

/** Shortens any absolute paths in a line to their last two parts. */
function tidyPaths(text: string): string {
  return text.replace(/(?:~|\/)[^\s'"`]*\/([^\s'"`/]+\/[^\s'"`/]+)/g, '…/$1')
}

function shortTool(tool: string): string {
  return tool.replace(/^mcp__[^_]+__/, '')
}

/** A shell command's prop, by the program it starts with (after any `cd … &&`). */
function shellKind(command: string): ActivityKind {
  const program = command.replace(/^\s*(?:cd\s+\S+\s*&&\s*)+/, '').trim().split(/\s+/)[0] ?? ''
  if (/^(grep|rg|ag|find|fd|locate|which)$/.test(program)) return 'searching'
  if (/^(cat|head|tail|less|more|ls|tree|wc|stat|file|du)$/.test(program)) return 'reading'
  if (/^(curl|wget|http|ping|dig)$/.test(program)) return 'browsing'
  if (/^(sed|awk|tee|touch|mkdir|cp|mv|patch)$/.test(program)) return 'writing'
  return 'running'
}

/** What the agent is doing, as a prop to hold and a short friendly line. */
function describeCall(tool: string, input: Record<string, unknown>): { kind: ActivityKind; text: string } {
  const str = (key: string) => (typeof input[key] === 'string' ? (input[key] as string) : undefined)
  switch (tool) {
    case 'Read':
      return { kind: 'reading', text: `Reading ${lastSegment(str('file_path') ?? 'a file')}` }
    case 'Write':
      return { kind: 'writing', text: `Writing ${lastSegment(str('file_path') ?? 'a file')}` }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { kind: 'writing', text: `Editing ${lastSegment(str('file_path') ?? str('notebook_path') ?? 'a file')}` }
    case 'Bash': {
      const text = `Running ${clip(tidyPaths(str('description') ?? str('command') ?? 'a command'), 60)}`
      return { kind: shellKind(str('command') ?? ''), text }
    }
    case 'Grep':
      return { kind: 'searching', text: `Searching for “${clip(str('pattern') ?? '', 40)}”${str('path') ? ` in ${lastSegment(str('path') ?? '')}` : ''}` }
    case 'Glob':
      return { kind: 'searching', text: `Looking for ${clip(tidyPaths(str('pattern') ?? 'files'), 40)}` }
    case 'WebFetch':
      return { kind: 'browsing', text: `Fetching ${clip(str('url') ?? 'a page', 50)}` }
    case 'WebSearch':
      return { kind: 'browsing', text: `Searching the web: ${clip(str('query') ?? '', 40)}` }
    case 'Agent':
    case 'Task':
      return { kind: 'delegating', text: `Spawning a helper: ${clip(str('description') ?? '', 40)}` }
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return { kind: 'planning', text: 'Updating its to-do list' }
    default:
      return { kind: 'tooling', text: `Using ${shortTool(tool)}` }
  }
}

/** A model request starts: the agent is thinking. */
function thinking(card: AgentCard, model: string, at: number): AgentCard {
  if (!isLive(card)) return card
  return withKind({ ...normalize(card), state: 'running', activity: 'Thinking…', model }, 'thinking', at)
}

/**
 * Sets what the agent is doing. The avatar's pose follows only once the
 * current pose has been held for POSE_MS; the timer catches up the rest, so
 * a burst of quick steps doesn't make the avatar flicker between props.
 */
function withKind(card: AgentCard, kind: ActivityKind, at: number): AgentCard {
  const was = normalize(card)
  if (was.pose === kind || at - was.poseAt >= POSE_MS) return { ...was, kind, pose: kind, poseAt: was.pose === kind ? was.poseAt : at }
  return { ...was, kind }
}

/** Catches the pose up with what the agent is doing, once it's been held long enough. */
function settlePose(card: AgentCard, at: number): AgentCard {
  const was = normalize(card)
  if (was.pose === was.kind || at - was.poseAt < POSE_MS || !isLive(was)) return card
  return { ...was, pose: was.kind, poseAt: at }
}

const needsSettle = (card: AgentCard, at: number) => {
  const was = normalize(card)
  return isLive(was) && was.pose !== was.kind && at - was.poseAt >= POSE_MS
}

/** A model request answered: add what it cost. */
function withUsage(card: AgentCard, usage: TurnUsage): AgentCard {
  const was = normalize(card)
  return {
    ...was,
    steps: was.steps + 1,
    model: usage.model || was.model,
    context: usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
    tokens: {
      input: was.tokens.input + usage.input_tokens,
      output: was.tokens.output + usage.output_tokens,
      cacheRead: was.tokens.cacheRead + usage.cache_read_input_tokens,
      cacheWrite: was.tokens.cacheWrite + usage.cache_creation_input_tokens,
    },
  }
}

/** A tool call starts: pick up the matching prop and log it. */
function withToolCall(card: AgentCard, tool: string, what: { kind: ActivityKind; text: string }, at: number): AgentCard {
  const was = withKind(card, what.kind, at)
  return {
    ...was,
    state: was.state === 'waiting' ? 'running' : was.state,
    activity: what.text,
    tools: was.tools + 1,
    toolCounts: { ...was.toolCounts, [tool]: (was.toolCounts[tool] ?? 0) + 1 },
    recent: [...was.recent, { kind: what.kind, text: what.text, at }].slice(-RECENT),
  }
}

function elapsed(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`
}

function count(n: number): string {
  if (n < 1000) return String(n)
  if (n < 100_000) return `${(n / 1000).toFixed(1)}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}

const totalIn = (t: Tokens) => t.input + t.cacheRead + t.cacheWrite

function shortModel(model: string | undefined): string | undefined {
  if (!model) return undefined
  const m = model.match(/(opus|sonnet|haiku|fable)[-_ ]?(\d+(?:[-.]\d+)?)?/i)
  if (!m || !m[1]) return model
  const family = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()
  return m[2] ? `${family} ${m[2].replace('-', '.')}` : family
}

const STATE_LABEL: Record<AgentState, string> = {
  running: 'working',
  waiting: 'waiting',
  done: 'finished',
  failed: 'failed',
  stopped: 'stopped',
}

const STATE_COLOR: Record<AgentState, string> = {
  running: '#0a84ff',
  waiting: '#ff9f0a',
  done: '#34c759',
  failed: '#ff3b30',
  stopped: '#8e8e93',
}

const KIND_LABEL: Record<ActivityKind, string> = {
  starting: 'warming up',
  thinking: 'thinking',
  reading: 'reading',
  writing: 'writing',
  running: 'hammering away',
  searching: 'searching',
  browsing: 'browsing',
  delegating: 'delegating',
  planning: 'planning',
  tooling: 'tinkering',
}

export const register: Register = on => {
  const fromInfo = (info: AgentInfo, now: number): AgentCard => {
    const card = newCard(info.id, info.name ?? info.description ?? info.type, info.type, now)
    if (isLiveStatus(info.status)) return { ...card, kind: 'thinking', activity: 'Working…' }
    return { ...card, state: stateOf(info.status), activity: 'Finished', endedAt: now }
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'parade',
      description: 'Open the agent parade: a side panel of the main agent and every subagent in this session',
    })

    // Pick up agents that were already running (e.g. after a hot reload).
    const now = await $.clock.now()
    const known = await read($, agents)
    const listed = await $.agent.list()
    const fresh = listed.filter(info => !known.some(card => card.id === info.id))
    if (fresh.length > 0) {
      await update($, agents, list => [...list.map(normalize), ...fresh.map(info => fromInfo(info, now))])
    }

    // Reconcile with the engine's own view, which catches background agents
    // finishing, being killed or failing without a turn.complete we saw.
    $.clock.every(2000, () => {
      void (async () => {
        const list = await read($, agents)
        if (!list.some(isLive)) return
        const infos = await $.agent.list()
        const at = await $.clock.now()
        const changes = list.filter(card => {
          const info = infos.find(one => one.id === card.id)
          return info && isLive(card) && !isLiveStatus(info.status)
        })
        if (changes.length === 0) return
        await update($, agents, cards =>
          cards.map(card => {
            const info = infos.find(one => one.id === card.id)
            if (!info || !isLive(card) || isLiveStatus(info.status)) return card
            const state = stateOf(info.status)
            return { ...card, state, endedAt: card.endedAt ?? at, activity: STATE_LABEL[state] }
          }),
        )
      })().catch(() => undefined)
    })

    // Let held poses catch up with what each agent is actually doing.
    $.clock.every(500, () => {
      void (async () => {
        const at = await $.clock.now()
        if ((await read($, agents)).some(card => needsSettle(card, at))) {
          await update($, agents, cards => cards.map(card => settlePose(card, at)))
        }
        const lead = await read($, main)
        if (lead && needsSettle(lead, at)) {
          await update($, main, card => (card ? settlePose(card, at) : card))
        }
      })().catch(() => undefined)
    })

    return next(e)
  })

  on('command.run', { command: 'parade' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: 'Agent parade opened.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined || !started.agentId) return started

    const now = await $.clock.now()
    const card: AgentCard = {
      ...newCard(started.agentId, e.name ?? e.description ?? e.subagentType, e.subagentType, now),
      model: started.model,
    }
    // A new subagent clears out the finished ones, so the panel shows the
    // current batch; agents still working stay where they are.
    const kept = (await read($, agents)).filter(one => one.id !== card.id && isLive(one)).map(one => one.id)
    await update($, agents, list =>
      [...list.filter(one => one.id !== card.id && isLive(one)), card].slice(-MAX_AGENTS),
    )
    await update($, expanded, ids => ids.filter(id => id === MAIN_ID || kept.includes(id)))
    // Pop the panel open the first time an agent shows up.
    $.ui.open({ id: PANE, title: TITLE }).catch(() => undefined)

    return started
  }).catch(($, e, next) => next(e))

  // The main agent's turn begins: the person just asked for something.
  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, main, (was): AgentCard => {
      const card = was ? normalize(was) : newCard(MAIN_ID, 'Main agent', 'main', now)
      return {
        ...withKind(card, 'thinking', now),
        state: 'running',
        activity: 'Reading your message…',
        prompt: clip(e.text, 200),
        turns: (card.turns ?? 0) + 1,
        startedAt: now,
        endedAt: undefined,
      }
    })
    return next(e)
  })

  // Every model request: the agent is thinking, and it costs tokens.
  on('turn.step', async function* ($, e, next) {
    const id = e.agentId
    const list = id === undefined ? [] : await read($, agents)
    const isSub = list.some(card => card.id === id)
    const isMain = id === undefined && (await read($, main)) !== null
    const at = isSub || isMain ? await $.clock.now() : 0

    if (isSub) {
      await update($, agents, cards => cards.map(card => (card.id === id ? thinking(card, e.model, at) : card)))
    } else if (isMain) {
      await update($, main, card => (card ? thinking(card, e.model, at) : card))
    }

    const response = yield* next(e)

    const usage = response.usage
    if (usage && isSub) {
      await update($, agents, cards => cards.map(card => (card.id === id ? withUsage(card, usage) : card)))
    } else if (usage && isMain) {
      await update($, main, card => (card ? withUsage(card, usage) : card))
    }

    return response
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    const what = describeCall(String(e.tool), e as unknown as Record<string, unknown>)
    const tool = shortTool(String(e.tool))
    const at = await $.clock.now()

    if (id === undefined) {
      await update($, main, card => (card ? withToolCall(card, tool, what, at) : card))
    } else if ((await read($, agents)).some(card => card.id === id)) {
      await update($, agents, cards =>
        cards.map(card => (card.id === id ? withToolCall(card, tool, what, at) : card)),
      )
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    const now = await $.clock.now()
    const report = e.answer.trim()

    if (id === undefined) {
      // The main agent hands back to the person.
      await update($, main, (card): AgentCard | null =>
        card
          ? {
              ...normalize(card),
              state: 'waiting',
              kind: 'thinking',
              endedAt: now,
              activity: e.isAborted ? 'Interrupted. Waiting for you' : 'Waiting for you',
              report: report ? report.slice(0, REPORT_CHARS) : card.report,
            }
          : card,
      )
    } else if ((await read($, agents)).some(card => card.id === id)) {
      const state: AgentState = e.isAborted ? 'stopped' : e.reason === 'error' || e.reason === 'refusal' ? 'failed' : 'done'
      await update($, agents, cards =>
        cards.map(card =>
          card.id === id
            ? {
                ...normalize(card),
                state,
                endedAt: now,
                activity: state === 'done' ? (report ? clip(report, 120) : 'All done!') : STATE_LABEL[state],
                report: report ? report.slice(0, REPORT_CHARS) : card.report,
              }
            : card,
        ),
      )
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = (await read($, agents)).map(normalize)
    const lead = await read($, main)
    const boss = lead ? normalize(lead) : null
    const open = await read($, expanded)
    const now = await $.clock.now()
    const live = list.filter(isLive).length
    const finished = list.length - live
    const everyone = boss ? [boss, ...list] : list
    const allIn = everyone.reduce((sum, card) => sum + totalIn(card.tokens), 0)
    const allOut = everyone.reduce((sum, card) => sum + card.tokens.output, 0)
    const allTools = everyone.reduce((sum, card) => sum + card.tools, 0)

    const toggle = (id: string) =>
      update($, expanded, ids => (ids.includes(id) ? ids.filter(one => one !== id) : [...ids, id]))
    const clearFinished = () => update($, agents, cards => cards.filter(isLive))

    // Newest first, in a fixed order: re-sorting as states change would move
    // cards around, and a moved avatar reloads its animation (a flicker).
    const ordered = [...list].reverse()

    const subSummary =
      list.length === 0
        ? 'None yet. Spawned subagents will march in here.'
        : `${live} working · ${finished} finished`
    const totals = everyone.length === 0 ? '' : `Session: ${count(allIn)} tokens in · ${count(allOut)} out · ${allTools} tool calls`

    const isMain = (card: AgentCard) => card.id === MAIN_ID
    const statusOf = (card: AgentCard) =>
      card.state === 'running' ? KIND_LABEL[card.kind]
      : isMain(card) && card.state === 'waiting' ? 'waiting for you'
      : STATE_LABEL[card.state]
    const subtitle = (card: AgentCard) =>
      [isMain(card) ? 'lead' : card.type, shortModel(card.model), isMain(card) && card.turns ? `turn ${card.turns}` : undefined]
        .filter(Boolean)
        .join(' · ')
    if (e.surface === 'terminal') {
      const { Box, Text, Button } = $.ui.resolve(e)
      const width = e.props.bodyColumns ?? 40
      const row = (card: AgentCard) => (
        <Box key={card.id} flexDirection="column" marginTop={1}>
          <Text>
            <Text color={isMain(card) ? MAIN_COLOR : STATE_COLOR[card.state]}>
              {avatarText(card.id, card.state, card.pose, isMain(card))}
            </Text>{' '}
            <Text bold>{clip(card.name, width - 12)}</Text>
          </Text>
          <Text dimColor wrap="truncate-end">
            {subtitle(card)} · {statusOf(card)} · {elapsed((card.endedAt ?? now) - card.startedAt)}
          </Text>
          <Text wrap="truncate-end">{card.activity}</Text>
        </Box>
      )
      return (
        <Box flexDirection="column">
          {totals && <Text dimColor>{totals}</Text>}
          {boss && row(boss)}
          <Box marginTop={1}>
            <Text bold>Subagents </Text>
            <Text dimColor>{subSummary}</Text>
          </Box>
          {ordered.map(row)}
          {finished > 0 && (
            <Box marginTop={1}>
              <Button key="clear" label="Clear finished" onPress={clearFinished} />
            </Box>
          )}
        </Box>
      )
    }

    const table = $.ui.resolve(e)
    const { Box, Text, Button, Markdown } = table
    const Svg = 'Svg' in table ? table.Svg : undefined

    const stat = (key: string, label: string, value: string) => (
      <Box key={key} flexDirection="column" paddingX={1} borderStyle="round" borderDimColor>
        <Text dimColor>{label}</Text>
        <Text bold>{value}</Text>
      </Box>
    )

    // Avatars are plain images, never `isInteractive`: a sandboxed frame
    // blanks and reloads whenever the surface redraws it (a flicker), while
    // an image redraws in place and its CSS animations keep playing. A plain
    // image keeps the picture it was first drawn with, though, so each one is
    // keyed by what it shows: a new mood or prop is a new image. The creature
    // and its prop are two pictures, so a prop swap leaves the creature be.
    const avatar = (card: AgentCard, lead: boolean) => {
      if (!Svg) return undefined
      const mood = moodOf(card.state)
      const prop = propOf(card.state, card.pose)
      return (
        <Box key={`avatar-${card.id}`} flexDirection="row" flexShrink={0} alignItems="center">
          <Box key={`creature-box-${card.id}-${mood}`}>
            <Svg
              key={`creature-${card.id}-${mood}`}
              source={creatureSvg(card.id, mood, lead)}
              alt={`${card.name} is ${statusOf(card)}`}
              width={CREATURE_WIDTH}
              height={AVATAR_HEIGHT}
            />
          </Box>
          <Box key={`prop-box-${card.id}-${prop}`}>
            <Svg
              key={`prop-${card.id}-${prop}`}
              source={propSvg(prop)}
              alt=""
              width={PROP_WIDTH}
              height={AVATAR_HEIGHT}
            />
          </Box>
        </Box>
      )
    }

    const cardView = (card: AgentCard) => {
      const lead = isMain(card)
      const isOpen = open.includes(card.id)
      const tools = Object.entries(card.toolCounts).sort((a, b) => b[1] - a[1])
      const earlier = [...card.recent].reverse().slice(1)
      const isBusy = card.state === 'running'
      return (
        <Box
          key={card.id}
          flexDirection="column"
          gap={1}
          paddingX={1}
          overflow="hidden"
          borderStyle={lead ? 'double' : 'round'}
          borderColor={lead ? MAIN_COLOR : isLive(card) ? STATE_COLOR[card.state] : undefined}
          borderDimColor={!lead && !isLive(card)}
        >
          {/* Always shown: the avatar and what's to the right of it. */}
          <Box flexDirection="row" gap={1} alignItems="center">
            {Svg ? (
              avatar(card, lead)
            ) : (
              <Text>{avatarText(card.id, card.state, card.pose, lead)}</Text>
            )}
            <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
              <Text bold wrap="truncate-end">{card.name}</Text>
              <Text dimColor wrap="truncate-end">{subtitle(card)}</Text>
              <Text color={lead && !isBusy ? MAIN_COLOR : STATE_COLOR[card.state]} bold wrap="truncate-end">
                ● {statusOf(card)}
                <Text dimColor> · {elapsed((card.endedAt ?? now) - card.startedAt)}</Text>
              </Text>
              <Text italic={!isBusy} wrap="truncate-end">
                {isBusy ? `${kindGlyph(card.kind)} ` : ''}{card.activity}
              </Text>
              <Button
                key={`details-${card.id}`}
                plain
                label={isOpen ? '▾ Hide details' : '▸ Details'}
                onPress={() => toggle(card.id)}
              />
            </Box>
          </Box>

          {/* Collapsed by default. */}
          {isOpen && (
            <Box flexDirection="column" gap={1} paddingBottom={1} minWidth={0} overflow="hidden">
              {lead && card.prompt && (
                <Text dimColor wrap="wrap">
                  You asked: “{card.prompt}”
                </Text>
              )}

              <Box flexDirection="row" flexWrap="wrap" gap={1}>
                {stat('in', 'Tokens in', count(totalIn(card.tokens)))}
                {stat('out', 'Tokens out', count(card.tokens.output))}
                {stat('cache', 'Cached', count(card.tokens.cacheRead))}
                {stat('ctx', 'Context', count(card.context))}
                {stat('steps', 'Model calls', String(card.steps))}
                {stat('tools', 'Tool calls', String(card.tools))}
              </Box>

              {tools.length > 0 && (
                <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                  {tools.map(([name, n]) => (
                    <Text key={`tool-${name}`} inverse>
                      {` ${name} ×${n} `}
                    </Text>
                  ))}
                </Box>
              )}

              {earlier.length > 0 && (
                <Box flexDirection="column">
                  <Text dimColor bold>Earlier</Text>
                  {earlier.map((entry, i) => (
                    <Text key={`recent-${i}`} dimColor wrap="truncate-end">
                      {kindGlyph(entry.kind)} {entry.text} · {elapsed(now - entry.at)} ago
                    </Text>
                  ))}
                </Box>
              )}

              {card.report && (
                <Box flexDirection="column">
                  <Text dimColor bold>{lead ? 'Last reply' : 'Report'}</Text>
                  <Markdown text={card.report} />
                </Box>
              )}
            </Box>
          )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1} paddingX={1}>
        {totals && <Text dimColor>{totals}</Text>}
        {boss && cardView(boss)}
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Box flexDirection="column">
            <Text bold>Subagents</Text>
            <Text dimColor>{subSummary}</Text>
          </Box>
          {finished > 0 && <Button key="clear" label="Clear finished" onPress={clearFinished} />}
        </Box>
        {ordered.map(cardView)}
      </Box>
    )
  })
}
