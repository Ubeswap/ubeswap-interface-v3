import { JsonRpcProvider } from '@ethersproject/providers'
import { ChainId } from '@ubeswap/sdk-core'
import { RPC_PROVIDERS } from 'constants/providers'

/** Compound Staking runs on Celo only, next to UBE Stake. */
export const COMPOUND_CHAIN = ChainId.CELO

export const UBE_STAKE = '0x388D611A57Ac15dCC1B937f287E5E908Ba5ff5c9'
export const UBE_TOKEN = '0x71e26d0E519D14591b9dE9a0fE9513A398101490'

/**
 * The CompoundAgentFactory. Not deployed yet: without REACT_APP_COMPOUND_FACTORY the box shows "Coming soon" and
 * sends nothing.
 */
export const COMPOUND_FACTORY: string | undefined = process.env.REACT_APP_COMPOUND_FACTORY || undefined

/** The factory's deploy block: an agent's Compounded logs are read from here on. */
export const COMPOUND_FROM_BLOCK = Number(process.env.REACT_APP_COMPOUND_FROM_BLOCK ?? '0')

/** Local testing only: a Celo fork's RPC that compound reads go to instead of the app's Celo providers. */
const COMPOUND_RPC_URL: string | undefined = process.env.REACT_APP_COMPOUND_RPC_URL || undefined

let forkProvider: JsonRpcProvider | undefined
/** The provider compound reads use (writes go through the connected wallet). */
export function compoundProvider(): JsonRpcProvider {
  if (!COMPOUND_RPC_URL) return RPC_PROVIDERS[COMPOUND_CHAIN]
  forkProvider ??= new JsonRpcProvider(COMPOUND_RPC_URL, COMPOUND_CHAIN)
  return forkProvider
}

/** The agent's schedule; the index is the contract's intervalIdx. */
export const INTERVALS = [
  { label: '6 Hours', sub: '4× a day', secs: 6 * 3600, perYear: 1460 },
  { label: '12 Hours', sub: '2× a day', secs: 12 * 3600, perYear: 730 },
  { label: 'Daily', sub: '1× a day', secs: 86400, perYear: 365 },
  { label: 'Weekly', sub: '1× a week', secs: 7 * 86400, perYear: 52 },
] as const

/** UBE Stake's vote delegates; the index is its delegateIdx. */
export const VOTES = ['Abstain', 'For', 'Against'] as const

/** Gas the keeper charges for one compound: its estimate (~254k on a Celo fork) plus its 20% margin. */
export const COMPOUND_GAS = 355_000

/** A keeper compounds only when the reward is at least this many times its fee (the factory's maxFeeBps = 1000). */
export const REWARD_TO_FEE = 10
