import { JsonRpcProvider } from '@ethersproject/providers'
import { ChainId } from '@ubeswap/sdk-core'
import { RPC_PROVIDERS } from 'constants/providers'

import mentoLogo from '../assets/dex/mento.png'
import sushiswapLogo from '../assets/dex/sushiswap.png'
import ubeswapLogo from '../assets/dex/ubeswap.png'
import uniswapLogo from '../assets/dex/uniswap.png'
import velodromeLogo from '../assets/dex/velodrome.png'

/** UbeAgent runs on Celo only. */
export const AGENT_CHAIN = ChainId.CELO

/** The AgentFactory on Celo mainnet (owner: a Safe) and the block it was deployed at. */
const MAINNET_FACTORY = '0x57D69E0cA474B39494EBB2BD86381E21b93134C0'
const MAINNET_FROM_BLOCK = 83538586

/** The AgentFactory every build uses; REACT_APP_UBEAGENT_FACTORY points a build at another one (e.g. a local fork). */
export const AGENT_FACTORY: string = process.env.REACT_APP_UBEAGENT_FACTORY || MAINNET_FACTORY

/** The factory's deploy block: its pool list (UniverseSet logs) is read from here on. */
export const AGENT_FROM_BLOCK = process.env.REACT_APP_UBEAGENT_FACTORY
  ? Number(process.env.REACT_APP_UBEAGENT_FROM_BLOCK ?? '0')
  : MAINNET_FROM_BLOCK

/** Local testing only: a Celo fork's RPC that agent reads go to instead of the app's Celo providers. */
const AGENT_RPC_URL: string | undefined = process.env.REACT_APP_UBEAGENT_RPC_URL || undefined

let forkProvider: JsonRpcProvider | undefined
/** The provider agent reads use (writes go through the connected wallet). */
export function agentProvider(): JsonRpcProvider {
  if (!AGENT_RPC_URL) return RPC_PROVIDERS[AGENT_CHAIN]
  forkProvider ??= new JsonRpcProvider(AGENT_RPC_URL, AGENT_CHAIN)
  return forkProvider
}

export const CELO_TOKEN = '0x471EcE3750Da237f93B8E339c536989b8978a438'

/** Pool factories on Celo, read from live pools' factory() (2026-11-16): a pool's exchange. */
export const DEXES: Record<string, string> = {
  '0x62d5b84be28a183abb507e125b384122d2c25fae': 'Ubeswap V2',
  '0x67fea58d5a5a4162ced847e13c2c81c73bf8aec4': 'Ubeswap V3',
  '0xafe208a311b21f13ef87e33a90049fc17a7acdec': 'Uniswap',
  '0x04625b046c69577efc40e6c0bb83cdbafab5a55f': 'Velodrome',
  '0xc35dadb65012ec5796536bd9864ed8773abc74c4': 'SushiSwap',
}
/** The exchanges a user picks from (a pool's exchange name starts with one of these). */
export const DEX_FAMILIES = ['Ubeswap', 'Uniswap', 'Velodrome', 'SushiSwap', 'Mento'] as const
/** The exchanges a new agent starts with. */
export const DEFAULT_DEXES = ['Ubeswap']
/** Why an exchange can have no pools for a reason other than "nothing listed yet". */
export const DEX_NOTES: Record<string, string> = {
  Mento: "Mento Reserve swaps go through its Broker rather than a pool contract; agents can't trade it yet.",
}
/** Each exchange's logo: Ubeswap's from its own interface, the others from DefiLlama's protocol icons. */
export const DEX_LOGOS: Record<string, string> = {
  Ubeswap: ubeswapLogo,
  Uniswap: uniswapLogo,
  Velodrome: velodromeLogo,
  SushiSwap: sushiswapLogo,
  Mento: mentoLogo,
}
/** "Ubeswap" for "Ubeswap V3". */
export const dexFamily = (dex: string): string => dex.split(' ')[0]

/** Tokens shown first, in this order; every other token sits under "Others". */
export const MAIN_TOKENS = [
  '0x71e26d0e519d14591b9de9a0fe9513a398101490', // UBE
  '0x471ece3750da237f93b8e339c536989b8978a438', // CELO
  '0x765de816845861e75a25fca122bb6898b8b1282a', // USDm
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e', // USD₮
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c', // USDC
]

/** Capital rules: below MIN nothing opens; below IDEAL the page warns; above HIGH more capital adds nothing. */
export const MIN_USD = 5
export const IDEAL_USD = 50
export const HIGH_USD = 100

/** ~1 s Celo blocks: the last day of trades, by block number. */
export const DAY_BLOCKS = 86_400
