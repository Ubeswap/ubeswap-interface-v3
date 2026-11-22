/**
 * Reads the UbeAgent contracts: the factory's pool universe and references, token prices at the references, the
 * user's agents and each agent's state and trades. All reads go through `agentProvider()`.
 */
import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { JsonRpcProvider } from '@ethersproject/providers'

import { AGENT_ABI, ERC20_ABI, FACTORY_ABI, POOL_ABI } from './abi'
import { AGENT_FACTORY, AGENT_FROM_BLOCK, DEXES } from './config'

export type Token = { address: string; symbol: string; decimals: number }
export type PoolInfo = {
  pool: string
  kind: number
  feeBps: number
  token0: Token
  token1: Token
  /** "Ubeswap V3", "Uniswap", …; "Other" for an unknown factory */
  dex: string
  /** "0.01%" */
  fee: string
  /** the token this pool is the reference of (null if none): the agent needs it selected to close inventory there */
  refOf: string | null
  /** both tokens have a reference (or are the numeraire): an agent can value, so select, it */
  priced: boolean
}

export function requireFactory(): string {
  if (!AGENT_FACTORY) throw new Error('UbeAgent is not available yet: no agent factory is configured.')
  return AGENT_FACTORY
}

const factoryOf = (p: JsonRpcProvider) => new Contract(requireFactory(), FACTORY_ABI, p)
const erc20 = (address: string, p: JsonRpcProvider) => new Contract(address, ERC20_ABI, p)

/** Most public Celo RPCs answer eth_getLogs over at most 5,000 blocks. */
const LOG_SPAN = 5_000

const tokenCache = new Map<string, Token>()
export async function tokens(p: JsonRpcProvider, addrs: string[]): Promise<Map<string, Token>> {
  const uniq = [...new Set(addrs.map((a) => getAddress(a)))]
  await Promise.all(
    uniq
      .filter((a) => !tokenCache.has(a))
      .map(async (a) => {
        const c = erc20(a, p)
        const [symbol, decimals] = await Promise.all([c.symbol(), c.decimals()])
        tokenCache.set(a, { address: a, symbol, decimals: Number(decimals) })
      })
  )
  return new Map(uniq.map((a) => [a, tokenCache.get(a) as Token]))
}

/** Every pool the factory lists now (its UniverseSet log, then the factory's own record), with exchange, fee and tokens. */
export async function universe(p: JsonRpcProvider): Promise<PoolInfo[]> {
  const factory = factoryOf(p)
  const head = await p.getBlockNumber()
  const last = new Map<string, boolean>()
  for (let from = AGENT_FROM_BLOCK; from <= head; from += LOG_SPAN) {
    const logs = await factory.queryFilter(factory.filters.UniverseSet(), from, Math.min(from + LOG_SPAN - 1, head))
    for (const l of logs) last.set(getAddress(l.args?.pool), Boolean(l.args?.allowed))
  }
  const pools = [...last].filter(([, on]) => on).map(([pool]) => pool)
  if (pools.length === 0) return []
  const specs = await Promise.all(pools.map((pool) => factory.universe(pool)))
  const meta = await Promise.all(
    pools.map(async (pool) => {
      const c = new Contract(pool, POOL_ABI, p)
      const [f, fee] = await Promise.all([c.factory().catch(() => ''), c.fee().catch(() => undefined)])
      return { factory: String(f).toLowerCase(), fee: fee === undefined ? undefined : Number(fee) }
    })
  )
  const toks = await tokens(
    p,
    specs.flatMap((s) => [s.token0, s.token1])
  )
  const numeraire = getAddress(await factory.NUMERAIRE())
  const refs = await Promise.all([...toks.keys()].map((t) => factory.referenceOf(t)))
  const refFor = new Map<string, string>()
  ;[...toks.keys()].forEach((t, i) => {
    const r = getAddress(refs[i])
    if (BigNumber.from(r).gt(0)) refFor.set(r, t)
  })
  const priced = new Set([numeraire, ...refFor.values()])
  return pools.map((pool, i) => {
    const s = specs[i]
    // V3 pools report fee in millionths; V2 pairs carry it in the listing (bps)
    const fee = meta[i].fee !== undefined ? (meta[i].fee as number) / 1e4 : Number(s.feeBps) / 100
    const [t0, t1] = [getAddress(s.token0), getAddress(s.token1)]
    return {
      pool,
      kind: Number(s.kind),
      feeBps: Number(s.feeBps),
      token0: toks.get(t0) as Token,
      token1: toks.get(t1) as Token,
      dex: DEXES[meta[i].factory] ?? 'Other',
      fee: `${fee.toLocaleString('en-US', { maximumFractionDigits: 3 })}%`,
      refOf: refFor.get(pool) ?? null,
      priced: priced.has(t0) && priced.has(t1),
    }
  })
}

/**
 * USD per whole token at each token's Uniswap reference spot (the numeraire is $1). A token whose reference pairs it
 * with another token (UBE through CELO) is priced through that token's own reference.
 */
export async function prices(p: JsonRpcProvider, toks: Token[]): Promise<Map<string, number>> {
  const factory = factoryOf(p)
  const numeraire = getAddress(await factory.NUMERAIRE())
  type Ref = { other: string; raw: number } // other-token raw units per raw unit of the token
  const refOf = new Map<string, Ref>()
  const read = async (ts: string[]) => {
    const refs: string[] = await Promise.all(ts.map((t) => factory.referenceOf(t)))
    await Promise.all(
      ts.map(async (t, i) => {
        if (BigNumber.from(refs[i]).isZero()) return
        const c = new Contract(refs[i], POOL_ABI, p)
        try {
          const [s0, a0, a1] = await Promise.all([c.slot0(), c.token0(), c.token1()])
          const t0 = getAddress(a0)
          const s = Number(BigNumber.from(s0.sqrtPriceX96 ?? s0).toString()) / 2 ** 96
          refOf.set(t, { other: t0 === t ? getAddress(a1) : t0, raw: t0 === t ? s * s : 1 / (s * s) })
        } catch {
          // an unreadable reference prices nothing
        }
      })
    )
  }
  const others = [...new Set(toks.map((t) => getAddress(t.address)))].filter((t) => t !== numeraire)
  if (others.length) await read(others)
  const vias = [...new Set([...refOf.values()].map((r) => r.other))].filter((t) => t !== numeraire && !refOf.has(t))
  if (vias.length) await read(vias)
  const dec = await tokens(p, [numeraire, ...others, ...vias])
  const usd = (t: string, depth: number): number | undefined => {
    if (t === numeraire) return 1
    const r = refOf.get(t)
    if (!r || depth > 1) return undefined
    const o = usd(r.other, depth + 1)
    return o === undefined
      ? undefined
      : ((r.raw * 10 ** (dec.get(t) as Token).decimals) / 10 ** (dec.get(r.other) as Token).decimals) * o
  }
  const out = new Map<string, number>([[numeraire, 1]])
  for (const t of others) {
    const v = usd(t, 0)
    if (v !== undefined) out.set(t, v)
  }
  return out
}

export async function agentsOf(p: JsonRpcProvider, owner: string): Promise<string[]> {
  return (await factoryOf(p).agentsOf(owner)).map((a: string) => getAddress(a))
}

export class NotAnAgent extends Error {
  constructor(address: string) {
    super(`${address} is not a UbeAgent: the agent factory didn’t create it.`)
  }
}

export type AgentView = {
  address: string
  owner: string
  paused: boolean
  /** unix seconds */
  paidUntil: number
  pools: string[]
  tokens: Token[]
  balances: Map<string, BigNumber>
  /** numeraire (USD₮) units at the agent's 30-minute reference average; null when a reference can't price right now */
  totalValue: BigNumber | null
  lossUsed: BigNumber
  lossBps: number
  implementation: string
  latest: string
  configVersion: BigNumber
}

export async function agent(p: JsonRpcProvider, address: string): Promise<AgentView> {
  const factory = factoryOf(p)
  // only an address the factory itself created is an agent: anything else could report any owner and lure that
  // wallet into signing calls to it
  if (!(await factory.isAgent(address))) throw new NotAnAgent(address)
  const a = new Contract(address, AGENT_ABI, p)
  const [owner, paused, paidUntil, pools, held, lossUsed, lossBps, implementation, latest, configVersion] =
    await Promise.all([
      a.owner(),
      a.paused(),
      a.paidUntil(),
      a.selectedPools(),
      a.heldTokens(),
      a.lossUsed(),
      a.lossBps(),
      a.implementation(),
      factory.latest(),
      factory.configVersion(),
    ])
  const toks = [...(await tokens(p, held)).values()]
  const bal: BigNumber[] = await Promise.all(toks.map((t) => erc20(t.address, p).balanceOf(address)))
  let totalValue: BigNumber | null = null
  try {
    totalValue = await a.totalValue()
  } catch {
    totalValue = null // a reference out of its spread, until it settles
  }
  return {
    address: getAddress(address),
    owner: getAddress(owner),
    paused,
    paidUntil: Number(paidUntil),
    pools: pools.map((x: string) => getAddress(x)),
    tokens: toks,
    balances: new Map(toks.map((t, i) => [t.address, bal[i]])),
    totalValue,
    lossUsed,
    lossBps: Number(lossBps),
    implementation: getAddress(implementation),
    latest: getAddress(latest),
    configVersion,
  }
}

/** USD value of everything the agent holds, at the reference spot prices. */
export function agentUsd(v: AgentView, px: Map<string, number>): number {
  return v.tokens.reduce(
    (s, t) =>
      s +
      (Number((v.balances.get(t.address) ?? BigNumber.from(0)).toString()) / 10 ** t.decimals) *
        (px.get(t.address) ?? 0),
    0
  )
}

export type Trade = {
  block: number
  tx: string
  tokenIn: string
  tokenOut: string
  /** numeraire units, the contract's own valuation before gas */
  valueIn: BigNumber
  valueOut: BigNumber
}

/** The agent's trades (its Traded events), newest first. */
export async function trades(p: JsonRpcProvider, address: string): Promise<Trade[]> {
  const a = new Contract(address, AGENT_ABI, p)
  const head = await p.getBlockNumber()
  const out: Trade[] = []
  for (let from = AGENT_FROM_BLOCK; from <= head; from += LOG_SPAN) {
    const logs = await a.queryFilter(a.filters.Traded(), from, Math.min(from + LOG_SPAN - 1, head))
    for (const l of logs) {
      out.push({
        block: l.blockNumber,
        tx: l.transactionHash,
        tokenIn: getAddress(l.args?.tokenIn),
        tokenOut: getAddress(l.args?.tokenOut),
        valueIn: l.args?.valueIn,
        valueOut: l.args?.valueOut,
      })
    }
  }
  return out.reverse()
}
