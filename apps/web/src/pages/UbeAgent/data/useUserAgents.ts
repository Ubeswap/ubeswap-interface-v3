import { useWeb3React } from '@web3-react/core'
import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export type AgentStatus = 'running' | 'paused' | 'stopped'

export type AgentStrategy = 'Arbitrage'

export interface UserAgent {
  id: string
  /** Sequential number shown as "Agent #N" */
  number: number
  address: string
  strategy: AgentStrategy
  status: AgentStatus
  /** Number of pools the agent operates on */
  poolCount: number
  /** Timestamp (ms) until which the agent's rent is paid */
  rentPaidUntil: number
  /** Agent balance, in USD */
  balanceUsd: number
}

// TODO: replace with real backend once the UbeAgent API is available.
const MOCK_AGENTS: UserAgent[] = [
  {
    id: 'agent-1',
    number: 1,
    address: '0x1234aB7c9E0f2D4b6A8c3E5f7D9b1C2e4F60abcd',
    strategy: 'Arbitrage',
    status: 'running',
    poolCount: 4,
    rentPaidUntil: new Date(2026, 11, 16).getTime(),
    balanceUsd: 20,
  },
  {
    id: 'agent-2',
    number: 2,
    address: '0x8894E0a0c962CB723c1976a4421c95949bE2D4E3',
    strategy: 'Arbitrage',
    status: 'running',
    poolCount: 7,
    rentPaidUntil: new Date(2027, 0, 4).getTime(),
    balanceUsd: 145.5,
  },
  {
    id: 'agent-3',
    number: 3,
    address: '0x1d2C7a8E3F0b6D4e9A5c2B8f7E6d3C1a0B9e8F7d',
    strategy: 'Arbitrage',
    status: 'paused',
    poolCount: 2,
    rentPaidUntil: new Date(2026, 10, 28).getTime(),
    balanceUsd: 8.2,
  },
  {
    id: 'agent-4',
    number: 4,
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    strategy: 'Arbitrage',
    status: 'stopped',
    poolCount: 1,
    rentPaidUntil: new Date(2026, 10, 2).getTime(),
    balanceUsd: 0,
  },
]

/**
 * Returns the agents deployed by the connected wallet.
 * Currently backed by mock data. Append `?empty` to the URL to preview the empty state.
 */
export function useUserAgents(): { agents: UserAgent[]; loading: boolean } {
  const { account } = useWeb3React()
  const { search } = useLocation()
  const forceEmpty = new URLSearchParams(search).has('empty')

  return useMemo(() => {
    if (!account || forceEmpty) return { agents: [], loading: false }
    return { agents: MOCK_AGENTS, loading: false }
  }, [account, forceEmpty])
}
