/**
 * Data for the Tx stats page.
 *
 * The page reads stats.json, which the hourly "Tx stats" GitHub Action (.github/scripts/tx-stats.mjs)
 * publishes on the tx-stats-data branch. If that file can't be read, the 24h card is computed in the
 * browser from public, CORS-open endpoints (Blockscout's etherscan-compatible API and the forno RPC);
 * the daily table needs the file.
 */

export const TX_STATS_URL =
  process.env.REACT_APP_TX_STATS_URL ||
  'https://raw.githubusercontent.com/Ubeswap/ubeswap-interface-v3/tx-stats-data/stats.json'

export const BLOCKSCOUT_API = 'https://celo.blockscout.com/api'
export const RPC_URL = 'https://forno.celo.org'

// Counting rules of the live fallback; keep them equal to the collector's.
/** Count reverted agent txs too (collector: COUNT_FAILED). */
export const AGENTS_COUNT_FAILED = false
/** Total = unique tx hashes across all categories (an agent swap is also a swap). false = plain sum. */
export const TOTAL_UNIQUE = true

const V2_FACTORY = '0x62d5b84be28a183abb507e125b384122d2c25fae'
const V2_PAIR_CREATED = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9'
const V3_FACTORY = '0x67fea58d5a5a4162ced847e13c2c81c73bf8aec4'
const V3_POOL_CREATED = '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118'
const V2_SWAP = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
const V3_SWAP = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'

export const CATEGORIES = [
  { key: 'swap', label: 'Swap', link: 'https://dexscreener.com/celo/ubeswap' },
  {
    key: 'stake',
    label: 'Stake',
    link: 'https://celoscan.io/address/0x388D611A57Ac15dCC1B937f287E5E908Ba5ff5c9',
    address: '0x388d611a57ac15dcc1b937f287e5e908ba5ff5c9',
  },
  {
    key: 'farm',
    label: 'Farm',
    link: 'https://celoscan.io/address/0xA6E9069CB055a425Eb41D185b740B22Ec8f51853',
    address: '0xa6e9069cb055a425eb41d185b740b22ec8f51853',
  },
  {
    key: 'agents',
    label: 'Agents',
    link: 'https://celo.blockscout.com/address/0x0169bB608644B63eCfF1b46C7AA38C7e8A41F873',
    address: '0x0169bb608644b63ecff1b46c7aa38c7e8a41f873',
  },
] as const

export type CategoryKey = (typeof CATEGORIES)[number]['key']
export type Counts = Record<CategoryKey | 'total', number>
export interface DayCounts extends Counts {
  date: string
  /** true for today, which is still running */
  partial: boolean
}
export interface TxStats {
  updatedAt: number
  last24h: Counts
  /** newest first */
  daily: DayCounts[]
}

const LOGS_BLOCK_RANGE = 5000
const LOGS_MAX_ADDRESSES = 1000
const RPC_CONCURRENCY = 6
const MAX_ATTEMPTS = 5
const TXLIST_PAGE = 10000

const CACHE_VERSION = 1
const POOLS_KEY = `txstats:pools:v${CACHE_VERSION}`

function readCache<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : undefined
  } catch {
    return undefined
  }
}

function writeCache(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or unavailable: the page still works, it just recomputes next time
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function withRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS - 1) await sleep(500 * 2 ** attempt)
    }
  }
  throw new Error(`${what} failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

// Blockscout allows anonymous callers only a few requests at a time and answers bursts with long 429 bans,
// so its calls go one by one with a gap, and the page makes as few of them as it can.
const BLOCKSCOUT_GAP_MS = 400
let blockscoutQueue: Promise<unknown> = Promise.resolve()

function blockscout(params: Record<string, string | number>): Promise<any> {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  const call = () =>
    withRetry(`blockscout ${params.module}.${params.action}`, async () => {
      const body = await fetchJson(`${BLOCKSCOUT_API}?${query}`)
      // status '0' with "No ... found" is an empty result, anything else is an error
      if (body.status !== '1' && !/^no .*found/i.test(body.message ?? '')) {
        throw new Error(body.message || body.result || 'bad response')
      }
      return body.result
    })
  const result = blockscoutQueue.then(call)
  blockscoutQueue = result.catch(() => undefined).then(() => sleep(BLOCKSCOUT_GAP_MS))
  return result
}

async function rpc(method: string, params: unknown[]): Promise<any> {
  return withRetry(`rpc ${method}`, async () => {
    const body = await fetchJson(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
    if (body.error) throw new Error(body.error.message ?? 'rpc error')
    return body.result
  })
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

const hexToNumber = (hex: string) => parseInt(hex, 16)
const wordAddress = (data: string, word: number) => `0x${data.slice(2 + word * 64 + 24, 2 + (word + 1) * 64)}`

/** Every Ubeswap V2 pair and V3 pool, cached and extended with only the blocks since the last visit. */
async function getPools(head: number): Promise<string[]> {
  const cached = readCache<{ pools: string[]; lastBlock: number }>(POOLS_KEY)
  const pools = new Set(cached?.pools ?? [])
  const fromBlock = cached ? cached.lastBlock + 1 : 0
  const sources = [
    { address: V2_FACTORY, topic0: V2_PAIR_CREATED, word: 0 },
    { address: V3_FACTORY, topic0: V3_POOL_CREATED, word: 1 },
  ]
  await Promise.all(
    sources.map(async ({ address, topic0, word }) => {
      let from = fromBlock
      for (;;) {
        const logs: { data: string; blockNumber: string }[] =
          (await blockscout({ module: 'logs', action: 'getLogs', address, topic0, fromBlock: from, toBlock: head })) ??
          []
        logs.forEach((log) => pools.add(wordAddress(log.data, word)))
        if (logs.length < 1000) break
        // a full page may end mid-block, so re-read that block; the set removes duplicates
        const last = hexToNumber(logs[logs.length - 1].blockNumber)
        from = last > from ? last : last + 1
      }
    })
  )
  const list = Array.from(pools)
  writeCache(POOLS_KEY, { pools: list, lastBlock: head })
  return list
}

interface Head {
  number: number
  timestamp: number
}

async function blockTimestamp(block: number): Promise<number> {
  const result = await rpc('eth_getBlockByNumber', [`0x${block.toString(16)}`, false])
  if (!result) throw new Error(`block ${block} not found`)
  return hexToNumber(result.timestamp)
}

/**
 * First block at or after a timestamp. Celo makes a block every second, so the guess from the head is
 * usually exact and one read confirms it (no Blockscout call, which is rate limited).
 */
async function blockAt(timestamp: number, head: Head): Promise<number> {
  let guess = Math.min(head.number, head.number - (head.timestamp - timestamp))
  let found: number | undefined
  for (let step = 0; step < 8 && found === undefined; step++) {
    const time = await blockTimestamp(guess)
    if (time < timestamp) {
      guess += Math.max(1, timestamp - time)
    } else if (time === timestamp || (await blockTimestamp(guess - 1)) < timestamp) {
      found = guess
    } else {
      guess -= Math.max(1, time - timestamp)
    }
  }
  if (found === undefined || found > head.number) throw new Error(`no block for timestamp ${timestamp}`)
  return found
}

/** A tx touching Ubeswap: its hash, block and category. */
interface Tx {
  hash: string
  block: number
  category: CategoryKey
}

async function swapTxs(pools: string[], fromBlock: number, toBlock: number): Promise<Tx[]> {
  const groups: string[][] = []
  for (let i = 0; i < pools.length; i += LOGS_MAX_ADDRESSES) groups.push(pools.slice(i, i + LOGS_MAX_ADDRESSES))
  const queries: { address: string[]; from: number; to: number }[] = []
  for (let from = fromBlock; from <= toBlock; from += LOGS_BLOCK_RANGE) {
    const to = Math.min(from + LOGS_BLOCK_RANGE - 1, toBlock)
    groups.forEach((address) => queries.push({ address, from, to }))
  }
  const results = await mapLimit(queries, RPC_CONCURRENCY, ({ address, from, to }) =>
    rpc('eth_getLogs', [
      { address, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${to.toString(16)}`, topics: [[V2_SWAP, V3_SWAP]] },
    ])
  )
  return results.flat().map((log: { transactionHash: string; blockNumber: string }) => ({
    hash: log.transactionHash,
    block: hexToNumber(log.blockNumber),
    category: 'swap' as const,
  }))
}

/** Txs sent to a contract, continuing from the last block when a page is full. */
async function txsTo(category: CategoryKey, address: string, fromBlock: number, toBlock: number): Promise<Tx[]> {
  const byHash = new Map<string, Tx>()
  let start = fromBlock
  for (;;) {
    const page: { hash: string; to: string; blockNumber: string; isError: string }[] =
      (await blockscout({
        module: 'account',
        action: 'txlist',
        address,
        startblock: start,
        endblock: toBlock,
        sort: 'asc',
        page: 1,
        offset: TXLIST_PAGE,
      })) ?? []
    for (const tx of page) {
      if (tx.to?.toLowerCase() !== address) continue
      if (category === 'agents' && !AGENTS_COUNT_FAILED && tx.isError !== '0') continue
      byHash.set(tx.hash, { hash: tx.hash, block: Number(tx.blockNumber), category })
    }
    if (page.length < TXLIST_PAGE) break
    const last = Number(page[page.length - 1].blockNumber)
    if (last <= start) break
    start = last
  }
  return Array.from(byHash.values())
}

async function contractTxs(fromBlock: number, toBlock: number): Promise<Tx[]> {
  const parts = await Promise.all(
    CATEGORIES.flatMap((c) => ('address' in c ? [txsTo(c.key, c.address, fromBlock, toBlock)] : []))
  )
  return parts.flat()
}

async function allTxs(pools: string[], fromBlock: number, toBlock: number): Promise<Tx[]> {
  const [swaps, contracts] = await Promise.all([swapTxs(pools, fromBlock, toBlock), contractTxs(fromBlock, toBlock)])
  return [...swaps, ...contracts]
}

function count(txs: Tx[], fromBlock: number, toBlock: number): Counts {
  const sets: Record<CategoryKey, Set<string>> = {
    swap: new Set(),
    stake: new Set(),
    farm: new Set(),
    agents: new Set(),
  }
  for (const tx of txs) if (tx.block >= fromBlock && tx.block <= toBlock) sets[tx.category].add(tx.hash)
  const swap = sets.swap.size
  const stake = sets.stake.size
  const farm = sets.farm.size
  const agents = sets.agents.size
  const total = TOTAL_UNIQUE
    ? new Set([...sets.swap, ...sets.stake, ...sets.farm, ...sets.agents]).size
    : swap + stake + farm + agents
  return { swap, stake, farm, agents, total }
}

const isCounts = (value: any): value is Counts =>
  value && ['swap', 'stake', 'farm', 'agents', 'total'].every((key) => typeof value[key] === 'number')

/** The collector's stats.json. */
export async function loadTxStats(): Promise<TxStats> {
  const body = await withRetry('stats.json', () => fetchJson(TX_STATS_URL, { cache: 'no-cache' }))
  const updatedAt = Date.parse(body?.updatedAt)
  const daily: DayCounts[] = Array.isArray(body?.daily) ? body.daily : []
  if (!isCounts(body?.last24h) || !Number.isFinite(updatedAt) || !daily.every((d) => isCounts(d) && d.date)) {
    throw new Error('stats.json has an unexpected shape')
  }
  return { updatedAt, last24h: body.last24h, daily: [...daily].sort((a, b) => b.date.localeCompare(a.date)) }
}

/** The last 24 hours computed in the browser, for when stats.json can't be read. */
export async function loadLast24h(): Promise<{ updatedAt: number; counts: Counts }> {
  const latest = await rpc('eth_getBlockByNumber', ['latest', false])
  const head: Head = { number: hexToNumber(latest.number), timestamp: hexToNumber(latest.timestamp) }
  const [fromBlock, pools] = await Promise.all([blockAt(head.timestamp - 86400, head), getPools(head.number)])
  const txs = await allTxs(pools, fromBlock, head.number)
  return { updatedAt: head.timestamp * 1000, counts: count(txs, fromBlock, head.number) }
}
