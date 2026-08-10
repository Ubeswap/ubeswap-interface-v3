import { BigNumber } from '@ethersproject/bignumber'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useV3PositionsFromTokenIds } from 'hooks/useV3Positions'
import { useCallback, useMemo } from 'react'
import { PositionDetails } from 'types/position'

const ACCOUNT_STAKES_URL = 'https://interface-gateway.ubeswap.org/v1/data/farm-v3-account-stakes'
const TRACK_TRANSACTION_URL = 'https://interface-gateway.ubeswap.org/v1/data/farm-v3-track-transaction'

const ACCOUNT_STAKES_QUERY_KEY = 'farm-v3-account-stakes'

export interface FarmV3AccountStake {
  /** `${tokenId}-${incentiveId}` */
  id: string
  /** decimal string, may exceed the safe integer range */
  tokenId: string
  /** lowercase 0x-prefixed bytes32 */
  incentiveId: string
}

interface FarmV3AccountStakesResponse {
  address: string
  latestBlock: number
  /** epoch milliseconds */
  updatedAt: number
  stakes: FarmV3AccountStake[]
}

export class FarmV3StakesRequestError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'FarmV3StakesRequestError'
    this.status = status
  }

  /** The backend event index is stalled or behind the chain, so the stakes are unknown - not empty. */
  get isIndexUnavailable() {
    return this.status === 503
  }
}

async function fetchAccountStakes(address: string, incentiveIds: string[]): Promise<FarmV3AccountStakesResponse> {
  const params = new URLSearchParams({ address })
  if (incentiveIds.length > 0) {
    params.set('incentiveIds', incentiveIds.join(','))
  }
  const res = await fetch(`${ACCOUNT_STAKES_URL}?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
    },
  })
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    throw new FarmV3StakesRequestError(res.status, body?.message || `Request failed with status ${res.status}`)
  }
  return body as FarmV3AccountStakesResponse
}

/**
 * Folds the farm events of a just confirmed transaction into the backend index, so a stake or a
 * withdraw shows up immediately instead of after the indexer catches up. Never throws: the
 * background indexer picks the transaction up within a few minutes anyway.
 */
async function trackTransaction(transactionId: string): Promise<void> {
  try {
    const res = await fetch(TRACK_TRANSACTION_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transactionId }),
      // It runs while the transaction confirmation modal is still up, so it may not hang around.
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      console.warn('Failed to track farm transaction', transactionId, res.status)
    }
  } catch (e) {
    console.warn('Failed to track farm transaction', transactionId, e)
  }
}

/**
 * Pushes a confirmed farm transaction to the backend index and refetches the account stakes.
 * Call it right after the receipt: the tracking endpoint rejects transactions older than 5 minutes.
 */
export function useRefreshStakes(): (transactionHash?: string) => Promise<void> {
  const queryClient = useQueryClient()
  return useCallback(
    async (transactionHash?: string) => {
      try {
        if (transactionHash) {
          await trackTransaction(transactionHash)
        }
        // Not awaited: a slow or retrying refetch must not hold up the caller, the list updates
        // on its own once the answer lands.
        queryClient.invalidateQueries({ queryKey: [ACCOUNT_STAKES_QUERY_KEY] }).catch((e) => {
          console.warn('Failed to refresh farm stakes', e)
        })
      } catch (e) {
        console.warn('Failed to refresh farm stakes', e)
      }
    },
    [queryClient]
  )
}

interface UseV3StakedPositionsResult {
  loading: boolean
  positions?: PositionDetails[]
  /** The stakes could not be read. Positions are unknown, which is not the same as none staked. */
  error: boolean
}

export function useV3StakedPositions(
  account: string | null | undefined,
  incentiveIds: string[]
): UseV3StakedPositionsResult {
  // The API returns lowercase incentive ids, local constants may be checksummed or mixed case.
  const wantedIncentiveIds = useMemo(() => incentiveIds.map((id) => id.toLowerCase()), [incentiveIds])
  const incentiveIdsKey = useMemo(() => [...wantedIncentiveIds].sort().join(','), [wantedIncentiveIds])
  const enabled = Boolean(account) && wantedIncentiveIds.length > 0

  const {
    data,
    isPending,
    isError: error,
  } = useQuery({
    queryKey: [ACCOUNT_STAKES_QUERY_KEY, account?.toLowerCase() ?? '', incentiveIdsKey],
    queryFn: () => fetchAccountStakes(account as string, incentiveIdsKey.split(',')),
    enabled,
    staleTime: 15_000,
    retry: (failureCount, err) => {
      // A rejected address will not become valid by asking again.
      if (err instanceof FarmV3StakesRequestError && err.status === 400) {
        return false
      }
      return failureCount < 4
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    // A stalled index recovers on its own, so keep asking until it does.
    refetchInterval: (query) => (query.state.status === 'error' ? 15_000 : 60_000),
  })

  const tokenIds = useMemo(() => {
    if (!data) {
      return []
    }
    const wanted = new Set(incentiveIdsKey.split(','))
    const stakedTokenIds = new Set(
      data.stakes.filter((s) => wanted.has(s.incentiveId.toLowerCase())).map((s) => s.tokenId)
    )
    return [...stakedTokenIds].map((tokenId) => BigNumber.from(tokenId))
  }, [data, incentiveIdsKey])

  const { positions, loading: positionsLoading } = useV3PositionsFromTokenIds(tokenIds)

  return {
    // A disabled query stays pending forever, so it only counts as loading when it can actually run.
    loading: (enabled && isPending) || positionsLoading,
    positions: error ? undefined : positions,
    error,
  }
}
