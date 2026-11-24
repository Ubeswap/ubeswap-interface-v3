import { useQuery } from '@tanstack/react-query'
import { useWeb3React } from '@web3-react/core'

import { agent, agentsOf, agentUsd, prices } from './chain'
import { agentProvider } from './config'

/** `closed`: paused and empty (Withdraw all); funding it again resumes it */
export type AgentStatus = 'running' | 'paused' | 'stopped' | 'closed'

export type AgentStrategy = 'Arbitrage'

export interface UserAgent {
  id: string
  /** Sequential number shown as "Agent #N" */
  number: number
  address: string
  strategy: AgentStrategy
  /** stopped = rent ran out */
  status: AgentStatus
  /** Number of pools the agent operates on */
  poolCount: number
  /** Timestamp (ms) until which the agent's rent is paid */
  rentPaidUntil: number
  /** Agent balance, in USD at the reference prices */
  balanceUsd: number
}

/** The agents the connected wallet owns, read from the AgentFactory (none while no factory is configured). */
export function useUserAgents(): { agents: UserAgent[]; loading: boolean; error: unknown } {
  const { account } = useWeb3React()
  const q = useQuery({
    queryKey: ['ubeagent', 'agents', account],
    enabled: !!account,
    refetchInterval: 30_000,
    queryFn: async (): Promise<UserAgent[]> => {
      const p = agentProvider()
      const list = await agentsOf(p, account as string)
      const views = await Promise.all(list.map((a) => agent(p, a)))
      const px = await prices(
        p,
        views.flatMap((v) => v.tokens)
      )
      const now = (await p.getBlock('latest')).timestamp // chain time decides rent, not the device clock
      return views.map((v, i) => ({
        id: v.address,
        number: i + 1,
        address: v.address,
        strategy: 'Arbitrage',
        status: v.paidUntil < now ? 'stopped' : v.paused ? (agentUsd(v, px) === 0 ? 'closed' : 'paused') : 'running',
        poolCount: v.pools.length,
        rentPaidUntil: v.paidUntil * 1000,
        balanceUsd: agentUsd(v, px),
      }))
    },
  })
  return { agents: q.data ?? [], loading: q.isLoading, error: q.error }
}
