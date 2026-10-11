import type { ActivityKind, AgentState } from '../types'

// Small deterministic hash so each agent keeps the same look across redraws.
export function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const INK = '#1d1d1f'

const BODIES = [
  // round blob
  '<rect x="8" y="14" width="40" height="34" rx="17" />',
  // boxy bot
  '<rect x="9" y="15" width="38" height="32" rx="8" />',
  // ghosty
  '<path d="M10 32 a18 18 0 0 1 36 0 v14 l-6 -4 l-6 4 l-6 -4 l-6 4 l-6 -4 l-6 4 z" />',
]

// Hats are picked per agent, so a crowd is easier to tell apart.
const HATS = [
  '',
  // beanie with pompom
  '<path d="M15 19 q13 -14 26 0 z" fill="#ff6b6b"/><rect x="14" y="17" width="28" height="4" rx="2" fill="#e04848"/><circle cx="28" cy="7" r="3" fill="#fff"/>',
  // propeller cap
  '<path d="M17 18 q11 -10 22 0 z" fill="#5e5ce6"/><g class="prop"><ellipse cx="28" cy="8" rx="8" ry="1.6" fill="#ffd60a"/></g><line x1="28" y1="9" x2="28" y2="12" stroke="#5e5ce6" stroke-width="1.5"/>',
  // tiny crown
  '<path d="M19 18 l2 -8 l4 5 l3 -7 l3 7 l4 -5 l2 8 z" fill="#ffd60a" stroke="#d4a106" stroke-width="1"/>',
  // headphones
  '<path d="M12 28 q16 -26 32 0" fill="none" stroke="#3a3a3c" stroke-width="2.5"/><rect x="8" y="25" width="6" height="10" rx="3" fill="#3a3a3c"/><rect x="42" y="25" width="6" height="10" rx="3" fill="#3a3a3c"/>',
]

function eyes(state: AgentState, kind: ActivityKind): string {
  if (state === 'done') {
    return `<path d="M19 30 q3 -4 6 0 M31 30 q3 -4 6 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
  }
  if (state === 'failed' || state === 'stopped') {
    return `<path d="M19 27 l5 5 M24 27 l-5 5 M32 27 l5 5 M37 27 l-5 5" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
  }
  if (state === 'waiting') {
    return `<path d="M19 30 h6 M31 30 h6" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`
  }
  // Pupils glance at whatever the agent is doing.
  const look =
    kind === 'thinking' ? { x: 1, y: -1.5 }
    : kind === 'reading' || kind === 'writing' ? { x: 1, y: 1.5 }
    : kind === 'starting' ? { x: 0, y: 0 }
    : { x: 1.6, y: 0 }
  return `<g class="eyes"><ellipse cx="22" cy="30" rx="3.4" ry="4" fill="#fff"/><ellipse cx="34" cy="30" rx="3.4" ry="4" fill="#fff"/>
    <g class="look"><circle cx="${22 + look.x}" cy="${30 + look.y}" r="2.2" fill="${INK}"/><circle cx="${34 + look.x}" cy="${30 + look.y}" r="2.2" fill="${INK}"/>
    <circle cx="${22.8 + look.x}" cy="${29 + look.y}" r=".8" fill="#fff"/><circle cx="${34.8 + look.x}" cy="${29 + look.y}" r=".8" fill="#fff"/></g></g>`
}

function mouth(state: AgentState, kind: ActivityKind): string {
  if (state === 'done') return `<path d="M23 37 q5 6 10 0 z" fill="${INK}"/><path d="M25 39.5 q3 2 6 0" fill="#ff6b8b"/>`
  if (state === 'failed' || state === 'stopped') return `<path d="M24 41 q4 -3 8 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
  if (state === 'waiting') return `<ellipse cx="28" cy="39" rx="2" ry="1.4" fill="${INK}"/>`
  if (kind === 'thinking') return `<path d="M25 39 q3 -2 6 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
  if (kind === 'running' || kind === 'tooling') return `<path d="M24 38 h8" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M30 38 q2 2 3 0" fill="none" stroke="${INK}" stroke-width="1.5"/>`
  return `<path d="M24 38 q4 3 8 0" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`
}

// Each prop is drawn in the space to the creature's right (x 52-84).
const PROPS: Record<ActivityKind, string> = {
  starting: `<g class="sparkle"><path d="M66 18 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 z" fill="#ffd60a"/></g>
    <g class="sparkle s2"><path d="M76 40 l1.2 3.6 l3.6 1.2 l-3.6 1.2 l-1.2 3.6 l-1.2 -3.6 l-3.6 -1.2 l3.6 -1.2 z" fill="#ffd60a"/></g>`,
  thinking: `<circle cx="56" cy="20" r="2" fill="#fff" stroke="#c7c7cc"/><circle cx="61" cy="14" r="3" fill="#fff" stroke="#c7c7cc"/>
    <ellipse cx="72" cy="8" rx="11" ry="7" fill="#fff" stroke="#c7c7cc"/>
    <circle class="dot d1" cx="66" cy="8" r="1.8" fill="#8e8e93"/><circle class="dot d2" cx="72" cy="8" r="1.8" fill="#8e8e93"/><circle class="dot d3" cx="78" cy="8" r="1.8" fill="#8e8e93"/>`,
  reading: `<g class="page"><path d="M50 46 q8 -4 15 0 v12 q-7 -4 -15 0 z" fill="#fff" stroke="#8e8e93"/>
    <path d="M65 46 q7 -4 15 0 v12 q-8 -4 -15 0 z" fill="#f2f2f7" stroke="#8e8e93"/>
    <path d="M53 49 h9 M53 52 h9 M68 49 h9 M68 52 h7" stroke="#c7c7cc" stroke-width="1"/></g>`,
  writing: `<path class="scribble" d="M54 60 q4 -4 8 0 t8 0 t8 0" fill="none" stroke="#0a84ff" stroke-width="1.6" stroke-linecap="round"/>
    <g class="pencil"><g transform="rotate(30 65 41)"><rect x="62" y="30" width="6" height="20" rx="1" fill="#ffcc00" stroke="#c79a00"/>
    <path d="M62 50 l3 6 l3 -6 z" fill="#f4d3a1" stroke="#c79a00" stroke-width=".8"/><path d="M64.2 54.4 l.8 1.6 l.8 -1.6 z" fill="${INK}"/>
    <rect x="62" y="27" width="6" height="4" rx="1" fill="#ff6b8b"/></g></g>`,
  running: `<g class="hammer"><rect x="64" y="22" width="4" height="26" rx="1.5" fill="#a0522d"/>
    <rect x="56" y="16" width="20" height="9" rx="2" fill="#8e8e93" stroke="#636366"/></g>
    <g class="spark"><path d="M56 56 l-4 -2 M58 52 l-3 -4 M62 54 l1 -4" stroke="#ff9f0a" stroke-width="1.6" stroke-linecap="round"/></g>`,
  searching: `<g class="magnify"><circle cx="66" cy="30" r="8" fill="#e5f1ff" fill-opacity=".7" stroke="#636366" stroke-width="3"/>
    <path d="M72 36 l8 8" stroke="#636366" stroke-width="4" stroke-linecap="round"/></g>`,
  browsing: `<circle cx="68" cy="34" r="12" fill="#64d2ff" stroke="#0a84ff" stroke-width="1.5"/>
    <g class="globe"><ellipse cx="68" cy="34" rx="5" ry="12" fill="none" stroke="#0a84ff" stroke-width="1.2"/></g>
    <path d="M56 34 h24 M58 27 h20 M58 41 h20" stroke="#0a84ff" stroke-width="1.2"/>`,
  delegating: `<g class="mini m1"><rect x="56" y="38" width="12" height="11" rx="5" fill="#ffd60a" stroke="#d4a106"/><circle cx="60" cy="43" r="1" fill="${INK}"/><circle cx="64" cy="43" r="1" fill="${INK}"/></g>
    <g class="mini m2"><rect x="70" y="40" width="12" height="11" rx="5" fill="#bf5af2" stroke="#9a3fd0"/><circle cx="74" cy="45" r="1" fill="${INK}"/><circle cx="78" cy="45" r="1" fill="${INK}"/></g>`,
  planning: `<rect x="58" y="24" width="20" height="26" rx="2" fill="#fff" stroke="#8e8e93"/><rect x="64" y="21" width="8" height="5" rx="1.5" fill="#8e8e93"/>
    <path d="M61 32 l2 2 l3 -4 M61 39 l2 2 l3 -4" fill="none" stroke="#34c759" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M68 32 h7 M68 39 h7 M61 46 h14" stroke="#c7c7cc" stroke-width="1.4"/>
    <rect class="tick" x="60.5" y="44.5" width="4" height="4" fill="none" stroke="#0a84ff" stroke-width="1.2"/>`,
  tooling: `<g class="wrench"><path d="M60 50 l12 -12" stroke="#8e8e93" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 30 a7 7 0 1 0 8 8 l-4 -1 l-3 -3 l-1 -4 z" fill="#8e8e93" stroke="#636366"/></g>
    <g class="cog"><circle cx="58" cy="22" r="5" fill="none" stroke="#636366" stroke-width="3" stroke-dasharray="2.5 1.5"/><circle cx="58" cy="22" r="1.6" fill="#636366"/></g>`,
}

const END_PROPS = {
  done: `<rect x="58" y="12" width="3" height="3" fill="#ff9f0a" transform="rotate(20 59 13)"/><rect x="70" y="20" width="3" height="3" fill="#34c759" transform="rotate(-25 71 21)"/>
    <rect x="62" y="30" width="3" height="3" fill="#0a84ff" transform="rotate(40 63 31)"/><circle cx="76" cy="10" r="1.6" fill="#bf5af2"/><circle cx="66" cy="24" r="1.4" fill="#ff375f"/>
    <circle cx="74" cy="56" r="8" fill="#34c759" stroke="#fff" stroke-width="1.5"/><path d="M70 56 l3 3 l5 -6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`,
  failed: `<circle cx="74" cy="56" r="8" fill="#ff3b30" stroke="#fff" stroke-width="1.5"/><path d="M71 53 l6 6 M77 53 l-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`,
  stopped: `<circle cx="74" cy="56" r="8" fill="#8e8e93" stroke="#fff" stroke-width="1.5"/><rect x="71" y="53" width="6" height="6" rx="1" fill="#fff"/>`,
  waiting: `<text class="z z1" x="60" y="30" font-size="10" font-family="system-ui" font-weight="700" fill="#ff9f0a">z</text>
    <text class="z z2" x="68" y="22" font-size="13" font-family="system-ui" font-weight="700" fill="#ff9f0a">Z</text>`,
}

const CSS = `<style>
  .bob { animation: bob var(--speed) ease-in-out var(--delay) infinite; transform-origin: 34px 56px; }
  .shadow { animation: squish var(--speed) ease-in-out var(--delay) infinite; transform-origin: 34px 64px; }
  .eyes { animation: blink 4s step-end var(--delay) infinite; transform-origin: 34px 38px; }
  .ant { animation: wiggle 0.6s ease-in-out infinite alternate; transform-origin: 34px 22px; }
  .prop { animation: propel .3s linear infinite; transform-origin: 34px 16px; }
  .hammer { animation: hammer .6s cubic-bezier(.5,0,.6,1) infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  .spark { animation: flash .6s steps(1) infinite; }
  .pencil { animation: scribble .5s ease-in-out infinite alternate; }
  .scribble { stroke-dasharray: 40; animation: draw 1.6s linear infinite; }
  .magnify { animation: sweep 2.2s ease-in-out infinite; }
  .globe { animation: globe 2s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
  .page { animation: flip 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }
  .dot { animation: pulse 1.2s ease-in-out infinite; } .d2 { animation-delay: .2s } .d3 { animation-delay: .4s }
  .mini { animation: hop .7s ease-in-out infinite alternate; } .m2 { animation-delay: .35s }
  .wrench { animation: turn 1s ease-in-out infinite alternate; transform-box: fill-box; transform-origin: 20% 85%; }
  .cog { animation: spin 2s linear infinite; transform-box: fill-box; transform-origin: 50% 50%; }
  .sparkle { animation: twinkle 1.2s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 50%; } .s2 { animation-delay: .6s; }
  .tick { animation: pulse 1s ease-in-out infinite; }
  .z { animation: float 2.4s ease-in-out infinite; } .z2 { animation-delay: .8s }
  .float { animation: bob 1.6s ease-in-out infinite; }
  @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
  @keyframes squish { 0%,100% { transform: scaleX(1); opacity: .22 } 50% { transform: scaleX(.75); opacity: .1 } }
  @keyframes blink { 0%,92%,100% { transform: scaleY(1) } 95% { transform: scaleY(.1) } }
  @keyframes wiggle { from { transform: rotate(-12deg) } to { transform: rotate(12deg) } }
  @keyframes propel { 0%,100% { transform: scaleX(1) } 50% { transform: scaleX(.15) } }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes hammer { 0%,100% { transform: rotate(-35deg) } 55% { transform: rotate(25deg) } 65% { transform: rotate(18deg) } }
  @keyframes flash { 0%,50% { opacity: 0 } 55%,75% { opacity: 1 } }
  @keyframes scribble { from { transform: translate(-6px,0) } to { transform: translate(6px,1px) } }
  @keyframes draw { from { stroke-dashoffset: 40 } to { stroke-dashoffset: 0 } }
  @keyframes sweep { 0%,100% { transform: translate(0,0) } 25% { transform: translate(4px,-3px) } 50% { transform: translate(0,-5px) } 75% { transform: translate(-4px,-2px) } }
  @keyframes globe { 0% { transform: scaleX(1) } 50% { transform: scaleX(.1) } 100% { transform: scaleX(1) } }
  @keyframes flip { 0%,70%,100% { transform: scaleY(1) } 80% { transform: scaleY(.85) } }
  @keyframes pulse { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
  @keyframes hop { from { transform: translateY(0) } to { transform: translateY(-5px) } }
  @keyframes turn { from { transform: rotate(-20deg) } to { transform: rotate(20deg) } }
  @keyframes twinkle { 0%,100% { transform: scale(.6); opacity: .4 } 50% { transform: scale(1.1); opacity: 1 } }
  @keyframes float { 0% { transform: translate(0,4px); opacity: 0 } 40% { opacity: 1 } 100% { transform: translate(4px,-6px); opacity: 0 } }
</style>`

/**
 * An avatar is two pictures side by side: the creature, and the prop it's
 * using, so swapping the prop never restarts the creature's animation.
 */
export type Mood = 'awake' | 'sleepy' | 'happy' | 'down'
export type PropKey = ActivityKind | keyof typeof END_PROPS


export const CREATURE_WIDTH = 56
export const PROP_WIDTH = 34
export const AVATAR_HEIGHT = 70

export function moodOf(state: AgentState): Mood {
  if (state === 'done') return 'happy'
  if (state === 'failed' || state === 'stopped') return 'down'
  if (state === 'waiting') return 'sleepy'
  return 'awake'
}

export function propOf(state: AgentState, pose: ActivityKind): PropKey {
  return state === 'running' ? pose : state
}

const STATE_OF_MOOD: Record<Mood, AgentState> = { awake: 'running', sleepy: 'waiting', happy: 'done', down: 'failed' }

export function creatureSvg(id: string, mood: Mood, isMain = false): string {
  // The main agent is always the same coral blob with a crown.
  const h = isMain ? 0 : hash(id)
  const state = STATE_OF_MOOD[mood]
  const isGrey = mood === 'down'
  const hue = isMain ? 15 : h % 360
  const fill = isGrey ? '#a1a1a6' : `hsl(${hue} 75% 66%)`
  const shade = isGrey ? '#8e8e93' : `hsl(${hue} 60% 50%)`
  const belly = isGrey ? '#c7c7cc' : `hsl(${hue} 80% 80%)`
  const body = BODIES[h % BODIES.length]
  const partyHat = '<path d="M22 14 l6 -14 l6 14 z" fill="#ff375f" stroke="#c71f43" stroke-width="1"/><circle cx="28" cy="0" r="2" fill="#ffd60a"/>'
  const hat = mood === 'happy' ? partyHat : isMain ? HATS[3] : HATS[(h >>> 3) % HATS.length]
  const delay = -((h >>> 8) % 1000) / 1000
  const speed = mood === 'sleepy' ? 2.6 : 1 + ((h >>> 4) % 5) / 10
  const isMoving = mood === 'awake' || mood === 'sleepy'
  const antenna = hat
    ? ''
    : `<g class="ant"><line x1="28" y1="14" x2="28" y2="6" stroke="${shade}" stroke-width="2.5" stroke-linecap="round"/><circle cx="28" cy="5" r="3" fill="${mood === 'awake' ? '#ffd60a' : shade}"/></g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CREATURE_WIDTH} ${AVATAR_HEIGHT}" width="${CREATURE_WIDTH}" height="${AVATAR_HEIGHT}" style="--speed:${speed}s;--delay:${delay}s;overflow:visible">${isMoving ? CSS : ''}
    <ellipse class="shadow" cx="34" cy="65" rx="15" ry="2.6" fill="#000" opacity=".2"/>
    <g class="bob"><g transform="translate(6 8)">
      ${antenna}
      <g fill="${fill}" stroke="${shade}" stroke-width="2">${body}</g>
      <ellipse cx="28" cy="42" rx="9" ry="4" fill="${belly}" opacity=".7"/>
      <circle cx="15.5" cy="36" r="2.8" fill="#ff6b8b" opacity=".45"/><circle cx="40.5" cy="36" r="2.8" fill="#ff6b8b" opacity=".45"/>
      ${eyes(state, 'searching')}${mouth(state, 'searching')}${hat}
      <path d="M9 38 q-4 4 -2 8 M47 38 q3 4 1 8" fill="none" stroke="${shade}" stroke-width="3" stroke-linecap="round"/>
    </g></g>
  </svg>`
}

export function propSvg(prop: PropKey): string {
  const art = prop in PROPS ? PROPS[prop as ActivityKind] : END_PROPS[prop as keyof typeof END_PROPS]
  const isStill = prop === 'done' || prop === 'failed' || prop === 'stopped'
  // Drawn in the scene's x 50-84, shifted so it sits in its own 34-wide frame.
  // Its animations pivot on their own shapes (fill-box), so the shift is safe.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PROP_WIDTH} ${AVATAR_HEIGHT}" width="${PROP_WIDTH}" height="${AVATAR_HEIGHT}">${isStill ? '' : CSS}
    <g transform="translate(-50 0)">${art}</g>
  </svg>`
}

const KIND_GLYPH: Record<ActivityKind, string> = {
  starting: '✨',
  thinking: '💭',
  reading: '📖',
  writing: '✏️',
  running: '🔨',
  searching: '🔍',
  browsing: '🌐',
  delegating: '👥',
  planning: '📋',
  tooling: '🔧',
}

export function kindGlyph(kind: ActivityKind): string {
  return KIND_GLYPH[kind]
}

/** The terminal has no SVG: a tiny face and a prop instead. */
export function avatarText(id: string, state: AgentState, kind: ActivityKind, isMain = false): string {
  if (isMain) return state === 'running' ? `♛(•ᴗ•)${KIND_GLYPH[kind]}` : '♛(-.-)zZ'
  if (state === 'done') return '(^‿^)🎉'
  if (state === 'failed') return '(x_x)💥'
  if (state === 'stopped') return '(x_x)'
  if (state === 'waiting') return '(-.-)zZ'
  const faces = ['(•ᴗ•)', '[•_•]', '(o.o)', '{•‿•}']
  return `${faces[hash(id) % faces.length] ?? '(•ᴗ•)'}${KIND_GLYPH[kind]}`
}
