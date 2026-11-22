import { PoolInfo } from './chain'
import { DEFAULT_DEXES, dexFamily } from './config'

// What the user picked: exchanges and tokens (the default), or pools by hand (`manual`, cleared by any exchange or
//  token change).
export type Selection = { dexes: Set<string>; tokens: Set<string>; manual: Set<string> | null }

export const emptySelection = (): Selection => ({ dexes: new Set(DEFAULT_DEXES), tokens: new Set(), manual: null })

/** Pools an agent can trade on the picked exchanges: those whose tokens all have a reference price. */
export function tradeable(all: PoolInfo[], dexes: Set<string>): PoolInfo[] {
  return all.filter((p) => p.priced && dexes.has(dexFamily(p.dex)))
}

/** The pools a selection trades: every tradeable pool pairing two picked tokens, or the hand-picked ones. */
export function picked(all: PoolInfo[], sel: Selection): Set<string> {
  if (sel.manual) return sel.manual
  return new Set(
    tradeable(all, sel.dexes)
      .filter((p) => sel.tokens.has(p.token0.address) && sel.tokens.has(p.token1.address))
      .map((p) => p.pool)
  )
}

// The picked pools plus the reference pool of every token they hold, and of every token those references hold (UBE's
//  is UBE/CELO, so CELO's too): without those the agent can't close inventory.
export function withReferences(all: PoolInfo[], sel: Set<string>): PoolInfo[] {
  const chosen = new Set(sel)
  for (;;) {
    const held = new Set(all.filter((p) => chosen.has(p.pool)).flatMap((p) => [p.token0.address, p.token1.address]))
    const add = all.filter((p) => !chosen.has(p.pool) && p.refOf !== null && held.has(p.refOf))
    if (add.length === 0) break
    for (const p of add) chosen.add(p.pool)
  }
  return all.filter((p) => chosen.has(p.pool))
}

// A selection that reproduces an agent's current pools: by exchanges + tokens when they give the same set, else by
//  hand. Reference pools are added on every save, so they say nothing about what the user picked.
export function selectionOf(all: PoolInfo[], pools: string[]): Selection {
  const cur = new Set(pools)
  const own = all.filter((p) => cur.has(p.pool) && p.priced && p.refOf === null)
  const dexes = new Set<string>(own.length ? own.map((p) => dexFamily(p.dex)) : DEFAULT_DEXES)
  const tokens = new Set(own.flatMap((p) => [p.token0.address, p.token1.address]))
  const again = new Set(withReferences(all, picked(all, { dexes, tokens, manual: null })).map((p) => p.pool))
  const known = all.filter((p) => cur.has(p.pool))
  const same = again.size === known.length && known.every((p) => again.has(p.pool))
  return { dexes, tokens, manual: same ? null : new Set(own.map((p) => p.pool)) }
}

export function flip<T>(set: Set<T>, x: T): Set<T> {
  const n = new Set(set)
  if (n.has(x)) n.delete(x)
  else n.add(x)
  return n
}
