// Ubeswap tx stats collector. Usage: node tx-stats.mjs path/to/stats.json  (reads previous file if present, updates in place)
// Days split at Europe/Istanbul midnight (UTC+3), from 2026-11-17. No dependencies (Node 18+).
import fs from 'fs'
const FORNO = 'https://forno.celo.org', BS = 'https://celo.blockscout.com/api'
const FACTORIES = [
  ['0x62d5b84be28a183abb507e125b384122d2c25fae', '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9', 0], // V2 PairCreated, pair = word 0
  ['0x67fea58d5a5a4162ced847e13c2c81c73bf8aec4', '0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118', 1], // V3 PoolCreated, pool = word 1
]
const SWAP_TOPICS = ['0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822', '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67']
const ADDRS = { stake: '0x388D611A57Ac15dCC1B937f287E5E908Ba5ff5c9', farm: '0xA6E9069CB055a425Eb41D185b740B22Ec8f51853', agents: '0x0169bB608644B63eCfF1b46C7AA38C7e8A41F873' }
const COUNT_FAILED = false // reverted txs to stake/farm/agents are not counted
const TZ = 3 * 3600, START = Date.UTC(2026, 10, 17) / 1e3 - TZ
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(f) { let e; for (let i = 0; i < 6; i++) { try { return await f() } catch (x) { e = x; await sleep(500 * 2 ** i) } } throw e }
const bs = (q) => retry(async () => { const j = await (await fetch(BS + '?' + new URLSearchParams(q))).json(); if (!Array.isArray(j.result) && j.status !== '1') throw new Error(JSON.stringify(j).slice(0, 200)); return j.result })
const rpc = (method, params) => retry(async () => { const j = await (await fetch(FORNO, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json(); if (j.error) throw new Error(j.error.message); return j.result })
const blk = async (n) => { const r = await rpc('eth_getBlockByNumber', [n, false]); return [parseInt(r.number, 16), parseInt(r.timestamp, 16)] }
const blockAt = async (ts) => { const [hn, ht] = await blk('latest'); let b = hn - (ht - ts) // Celo: one block per second
  for (;;) { const [, t] = await blk('0x' + b.toString(16)); if (t < ts) { b += ts - t; continue } const [, p] = await blk('0x' + (b - 1).toString(16)); if (p < ts) return b; b -= Math.max(1, t - ts) } }

async function updatePools(prev) {
  const pools = new Set(prev.pools || []); let to = 0
  for (const [f, topic, word] of FACTORIES) {
    let from = prev.poolsBlock ? prev.poolsBlock + 1 : 0
    for (;;) {
      const r = await bs({ module: 'logs', action: 'getLogs', address: f, topic0: topic, fromBlock: from, toBlock: 'latest' })
      for (const l of r) { pools.add('0x' + l.data.slice(2 + 64 * word + 24, 2 + 64 * (word + 1))); to = Math.max(to, parseInt(l.blockNumber, 16)) }
      if (r.length < 1000) break
      from = parseInt(r[r.length - 1].blockNumber, 16) + 1
    }
  }
  return { pools: [...pools], poolsBlock: Math.max(to, prev.poolsBlock || 0) }
}
async function swapTxs(pools, from, to) {
  const jobs = []
  for (let k = 0; k < pools.length; k += 1000) for (let b = from; b <= to; b += 5000) jobs.push([pools.slice(k, k + 1000), b, Math.min(b + 4999, to)]) // forno limits
  const txs = new Map(); let i = 0
  await Promise.all(Array.from({ length: 8 }, async () => { while (i < jobs.length) { const [g, a, b] = jobs[i++]
    for (const l of await rpc('eth_getLogs', [{ fromBlock: '0x' + a.toString(16), toBlock: '0x' + b.toString(16), address: g, topics: [SWAP_TOPICS] }])) txs.set(l.transactionHash, parseInt(l.blockNumber, 16)) } }))
  return txs
}
async function addrTxs(addr, from, to) {
  const txs = new Map(); let s = from
  for (;;) {
    const r = await bs({ module: 'account', action: 'txlist', address: addr, startblock: s, endblock: to, sort: 'asc', page: 1, offset: 10000 })
    for (const t of r) if (t.to && t.to.toLowerCase() === addr.toLowerCase() && (COUNT_FAILED || t.isError === '0')) txs.set(t.hash, +t.blockNumber)
    if (r.length < 10000) break
    s = +r[r.length - 1].blockNumber
  }
  return txs
}

const file = process.argv[2] || 'stats.json'
let prev = {}; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
const now = Math.floor(Date.now() / 1e3)
const head = parseInt(await rpc('eth_blockNumber', []), 16)
const { pools, poolsBlock } = await updatePools(prev)
// day boundaries; keep finished days from the previous file
const done = new Map((prev.daily || []).filter((d) => !d.partial).map((d) => [d.date, d]))
const days = []; for (let t = START; t <= now; t += 86400) days.push({ t, date: new Date((t + TZ) * 1e3).toISOString().slice(0, 10) })
const todo = days.filter((d, i) => !done.has(d.date) || i === days.length - 1)
for (const d of todo) d.b = await blockAt(d.t)
const b24 = await blockAt(now - 86400)
const from = Math.min(b24, ...todo.map((d) => d.b))
const sets = { swap: await swapTxs(pools, from, head) }
for (const k in ADDRS) sets[k] = await addrTxs(ADDRS[k], from, head)
const count = (lo, hi) => { const r = {}, all = new Set(); for (const k in sets) { let n = 0; for (const [h, b] of sets[k]) if (b >= lo && b < hi) { n++; all.add(h) } r[k] = n } r.total = all.size; return r } // total = unique txs (an agent swap is also a Swap)
const daily = []
for (let i = 0; i < days.length; i++) {
  const d = days[i], next = days[i + 1]
  if (!todo.includes(d)) { daily.push(done.get(d.date)); continue }
  if (next && next.b === undefined) next.b = await blockAt(next.t)
  daily.push({ date: d.date, partial: !next, ...count(d.b, next ? next.b : head + 1) })
}
const out = { updatedAt: new Date(now * 1e3).toISOString(), headBlock: head, last24h: count(b24, head + 1), daily, pools, poolsBlock }
fs.writeFileSync(file, JSON.stringify(out))
console.log(JSON.stringify(out.last24h), daily.length, 'days')
