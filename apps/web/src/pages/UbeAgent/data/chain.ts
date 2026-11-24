/**
 * Reads the UbeAgent contracts: the factory's pool universe and references, token prices at the references, the
 * user's agents and each agent's state and trades. All reads go through `agentProvider()`.
 */
import { Result } from '@ethersproject/abi'
import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import * as constants from '@ethersproject/constants'
import { Contract } from '@ethersproject/contracts'
import { Filter, JsonRpcProvider, Log } from '@ethersproject/providers'

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

const factoryOf = (p: JsonRpcProvider) => new Contract(AGENT_FACTORY, FACTORY_ABI, p)
const erc20 = (address: string, p: JsonRpcProvider) => new Contract(address, ERC20_ABI, p)

/** How long a read pool listing stays fresh (the factory's owner rarely edits it). */
export const UNIVERSE_FRESH_MS = 10 * 60_000

/** Most public Celo RPCs answer eth_getLogs over at most 5,000 blocks. */
const LOG_SPAN = 5_000
/** Log spans read at once: a browser opens about six connections per host. */
const LOG_PARALLEL = 6

/** Multicall3, at the same address on Celo as everywhere. */
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11'
const MULTICALL_ABI = [
  'function aggregate3((address target, bool allowFailure, bytes callData)[] calls) view returns ((bool success, bytes returnData)[])',
]
const MULTICALL_CHUNK = 150

/** One read: a contract, its method and arguments. */
type Read = { contract: Contract; method: string; args?: unknown[] }

/** Many reads in one eth_call each `MULTICALL_CHUNK`; a failed read is null instead of failing the rest. */
async function reads(p: JsonRpcProvider, rs: Read[]): Promise<(Result | null)[]> {
  const mc = new Contract(MULTICALL3, MULTICALL_ABI, p)
  const chunks: Read[][] = []
  for (let i = 0; i < rs.length; i += MULTICALL_CHUNK) chunks.push(rs.slice(i, i + MULTICALL_CHUNK))
  const answers = await Promise.all(
    chunks.map((c) =>
      mc.aggregate3(
        c.map((r) => ({
          target: r.contract.address,
          allowFailure: true,
          callData: r.contract.interface.encodeFunctionData(r.method, r.args ?? []),
        }))
      )
    )
  )
  return answers.flat().map((a: { success: boolean; returnData: string }, i: number) => {
    if (!a.success) return null
    try {
      return rs[i].contract.interface.decodeFunctionResult(rs[i].method, a.returnData)
    } catch {
      return null
    }
  })
}

/** Every log matching `filter` from `fromBlock` on, its spans read `LOG_PARALLEL` at a time, oldest first. */
async function scanLogs(p: JsonRpcProvider, filter: Filter, fromBlock: number): Promise<Log[]> {
  const head = await p.getBlockNumber()
  const spans: [number, number][] = []
  for (let from = fromBlock; from <= head; from += LOG_SPAN) spans.push([from, Math.min(from + LOG_SPAN - 1, head)])
  const out: Log[][] = new Array(spans.length)
  for (let i = 0; i < spans.length; i += LOG_PARALLEL) {
    const batch = spans.slice(i, i + LOG_PARALLEL)
    const got = await Promise.all(batch.map(([fromBlock, toBlock]) => p.getLogs({ ...filter, fromBlock, toBlock })))
    got.forEach((logs, j) => (out[i + j] = logs))
  }
  return out.flat()
}

const tokenCache = new Map<string, Token>()
export async function tokens(p: JsonRpcProvider, addrs: string[]): Promise<Map<string, Token>> {
  const uniq = [...new Set(addrs.map((a) => getAddress(a)))]
  const missing = uniq.filter((a) => !tokenCache.has(a))
  if (missing.length) {
    const r = await reads(
      p,
      missing.flatMap((a) => [
        { contract: erc20(a, p), method: 'symbol' },
        { contract: erc20(a, p), method: 'decimals' },
      ])
    )
    missing.forEach((a, i) => {
      const [sym, dec] = [r[2 * i], r[2 * i + 1]]
      if (!sym || !dec) throw new Error(`Token ${a} doesn’t answer symbol() and decimals().`)
      tokenCache.set(a, { address: a, symbol: sym[0], decimals: Number(dec[0]) })
    })
  }
  return new Map(uniq.map((a) => [a, tokenCache.get(a) as Token]))
}

/** Every pool the factory lists now (its UniverseSet log, then the factory's own record), with exchange, fee and tokens. */
export async function universe(p: JsonRpcProvider): Promise<PoolInfo[]> {
  const factory = factoryOf(p)
  const last = new Map<string, boolean>()
  for (const l of await scanLogs(p, factory.filters.UniverseSet(), AGENT_FROM_BLOCK)) {
    const e = factory.interface.parseLog(l)
    last.set(getAddress(e.args.pool), Boolean(e.args.allowed))
  }
  const pools = [...last].filter(([, on]) => on).map(([pool]) => pool)
  if (pools.length === 0) return []
  // the factory's record, the pool's own factory and fee (V2 pairs have no fee()): one multicall
  const r = await reads(
    p,
    pools.flatMap((pool) => {
      const c = new Contract(pool, POOL_ABI, p)
      return [
        { contract: factory, method: 'universe', args: [pool] },
        { contract: c, method: 'factory' },
        { contract: c, method: 'fee' },
      ]
    })
  )
  const specs = pools.map((pool, i) => {
    const s = r[3 * i]
    if (!s) throw new Error(`The factory’s record of pool ${pool} is unreadable.`)
    return s
  })
  const meta = pools.map((_, i) => ({
    factory: r[3 * i + 1] ? String(r[3 * i + 1]?.[0]).toLowerCase() : '',
    fee: r[3 * i + 2] ? Number(r[3 * i + 2]?.[0]) : undefined,
  }))
  const toks = await tokens(
    p,
    specs.flatMap((s) => [s.token0, s.token1])
  )
  const numeraire = getAddress(await factory.NUMERAIRE())
  const refs = (
    await reads(
      p,
      [...toks.keys()].map((t) => ({ contract: factory, method: 'referenceOf', args: [t] }))
    )
  ).map((x) => (x ? String(x[0]) : constants.AddressZero))
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

/** What has left the agent besides trades: native CELO paid to executors for gas, and the owner's withdrawals. */
export type History = {
  /** newest first */
  trades: Trade[]
  /** CELO (wei) the agent paid for its own gas */
  refueled: BigNumber
  /** token => amount the owner took out with `withdraw` (profit), not with `close` (everything); native CELO under CELO's */
  withdrawn: Map<string, BigNumber>
}

/**
 * The agent's Traded, Refueled and Withdrawn events since the factory's deploy, in one log query per span. Withdrawals
 * made by `close` (its transaction also pauses the agent) return the deposit, not profit, so they are left out.
 */
export async function history(p: JsonRpcProvider, address: string, celo: string): Promise<History> {
  const a = new Contract(address, AGENT_ABI, p)
  const topics = ['Traded', 'Refueled', 'Withdrawn', 'PausedSet'].map((e) => a.interface.getEventTopic(e))
  const trades: Trade[] = []
  let refueled = BigNumber.from(0)
  const withdrawn = new Map<string, BigNumber>()
  const logs = (await scanLogs(p, { address, topics: [topics] }, AGENT_FROM_BLOCK)).map((l) => ({
    l,
    e: a.interface.parseLog(l),
  }))
  const closes = new Set(
    logs.filter(({ e }) => e.name === 'PausedSet' && e.args.paused).map(({ l }) => l.transactionHash)
  )
  for (const { l, e } of logs) {
    if (e.name === 'PausedSet') continue
    if (e.name === 'Traded') {
      trades.push({
        block: l.blockNumber,
        tx: l.transactionHash,
        tokenIn: getAddress(e.args.tokenIn),
        tokenOut: getAddress(e.args.tokenOut),
        valueIn: e.args.valueIn,
        valueOut: e.args.valueOut,
      })
    } else if (e.name === 'Refueled') {
      refueled = refueled.add(e.args.amount)
    } else if (!closes.has(l.transactionHash)) {
      // address(0) is native CELO, the same balance as CELO's token
      const t = e.args.token === constants.AddressZero ? getAddress(celo) : getAddress(e.args.token)
      withdrawn.set(t, (withdrawn.get(t) ?? BigNumber.from(0)).add(e.args.amount))
    }
  }
  return { trades: trades.reverse(), refueled, withdrawn }
}
