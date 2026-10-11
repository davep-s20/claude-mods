export type AgentState = 'running' | 'waiting' | 'done' | 'failed' | 'stopped'

/** What the agent is busy with right now: picks the prop its avatar holds. */
export type ActivityKind =
  | 'starting'
  | 'thinking'
  | 'reading'
  | 'writing'
  | 'running'
  | 'searching'
  | 'browsing'
  | 'delegating'
  | 'planning'
  | 'tooling'

export type Tokens = {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type ActivityEntry = { kind: ActivityKind; text: string; at: number }

export type AgentCard = {
  id: string
  name: string
  type: string
  state: AgentState
  kind: ActivityKind
  /** The prop the avatar shows: trails `kind`, held a moment so it doesn't strobe. */
  pose: ActivityKind
  poseAt: number
  activity: string
  tools: number
  toolCounts: Record<string, number>
  tokens: Tokens
  /** Prompt size of the latest model request: how full its context is. */
  context: number
  steps: number
  model?: string
  recent: ActivityEntry[]
  startedAt: number
  endedAt?: number
  report?: string
  /** Main agent only: what the person last asked, and how many turns so far. */
  prompt?: string
  turns?: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-parade': { agents: AgentCard[]; main: AgentCard | null; expanded: string[] }
  }
}
