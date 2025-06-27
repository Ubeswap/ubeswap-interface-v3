import { BigNumber } from '@ethersproject/bignumber'
import { useQuery } from '@tanstack/react-query'
import { ChainId, Fraction, Percent, Token } from '@ubeswap/sdk-core'
import CID from 'cids'
import { exploreSearchStringAtom } from 'components/Tokens/state'
import { formatEther } from 'ethers/lib/utils'
import { OrderDirection } from 'graphql/data/util'
import { useDefaultActiveTokens } from 'hooks/Tokens'
import { useAtomValue } from 'jotai/utils'
import { hexToUint8Array } from 'lib/utils/contenthashToUri'
import { toB58String } from 'multihashes'
import { useFarmRegistry } from 'pages/Farm/data/useFarmRegistry'
import { useIncentiveContractInfo } from 'pages/FarmV3/farm-actions'
import { useEffect, useMemo, useState } from 'react'
import { ProtocolVersion } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { isAddress } from 'utilities/src/addresses'

export function sortFarms(pools: TableFarm[], sortState: FarmTableSortState) {
  return pools.sort((a, b) => {
    switch (sortState.sortBy) {
      case FarmSortFields.APR:
        if (a.apr.equalTo(b.apr)) {
          if (a.farmAddress == '0x534408e91d755a0d898e1c508e987e8d0615b52c') {
            return -1
          } else if (b.farmAddress == '0x534408e91d755a0d898e1c508e987e8d0615b52c') {
            return 1
          }
        }
        return sortState.sortDirection === OrderDirection.Desc
          ? b.apr.greaterThan(a.apr)
            ? 1
            : -1
          : a.apr.greaterThan(b.apr)
          ? 1
          : -1
      case FarmSortFields.TVL:
        return sortState.sortDirection === OrderDirection.Desc ? b.tvl - a.tvl : a.tvl - b.tvl
      default:
        return sortState.sortDirection === OrderDirection.Desc ? b.tvl - a.tvl : a.tvl - b.tvl
    }
  })
}

export interface TableFarm {
  hash: string
  farmAddress: string
  poolAddress: string
  token0: Token
  token1: Token
  token0Amount: Fraction
  token1Amount: Fraction
  tvl: number
  apr: Percent
  feeTier: number
  protocolVersion: ProtocolVersion
}

export interface FetchedFarm {
  contractAddress: string
  poolAddress: string
  token0: string
  token1: string
  fee: number
  apr: number
  tvl: number
  protocolVersion: number
  rewardTokens: string[]
}

export enum FarmSortFields {
  TVL = 'TVL',
  APR = 'APR',
}

export type FarmTableSortState = {
  sortBy: FarmSortFields
  sortDirection: OrderDirection
}

function useFilteredFarms(pools: TableFarm[]) {
  const filterString = useAtomValue(exploreSearchStringAtom)
  const lowercaseFilterString = useMemo(() => filterString.toLowerCase(), [filterString])

  return useMemo(
    () =>
      pools.filter((pool) => {
        const addressIncludesFilterString = pool.hash.toLowerCase().includes(lowercaseFilterString)
        const token0IncludesFilterString = pool.token0?.symbol?.toLowerCase().includes(lowercaseFilterString)
        const token1IncludesFilterString = pool.token1?.symbol?.toLowerCase().includes(lowercaseFilterString)
        const token0HashIncludesFilterString = pool.token0?.address?.toLowerCase().includes(lowercaseFilterString)
        const token1HashIncludesFilterString = pool.token1?.address?.toLowerCase().includes(lowercaseFilterString)
        const poolName = `${pool.token0?.symbol}/${pool.token1?.symbol}`.toLowerCase()
        const poolNameIncludesFilterString = poolName.includes(lowercaseFilterString)
        return (
          token0IncludesFilterString ||
          token1IncludesFilterString ||
          addressIncludesFilterString ||
          token0HashIncludesFilterString ||
          token1HashIncludesFilterString ||
          poolNameIncludesFilterString
        )
      }),
    [lowercaseFilterString, pools]
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useInactiveFarms(sortState: FarmTableSortState, chainId?: ChainId) {
  const farms = useFarmRegistry()
  const tokens = useDefaultActiveTokens(ChainId.CELO)
  const loading = farms.length == 0

  const unfilteredPools = useMemo(() => {
    const fff: TableFarm[] =
      farms
        ?.map((farm) => {
          const token0Address = isAddress(farm.token0Address)
          const token1Address = isAddress(farm.token1Address)
          if (token0Address && token1Address) {
            if (tokens[token0Address] && tokens[token1Address]) {
              return {
                hash: farm.stakingAddress,
                farmAddress: farm.stakingAddress,
                poolAddress: '',
                token0: tokens[token0Address],
                token1: tokens[token1Address],
                token0Amount: new Fraction(0),
                token1Amount: new Fraction(0),
                tvl: farm.tvlUSD ? Number(formatEther(farm.tvlUSD)) : 0,
                apr: new Percent(0),
                feeTier: V2_BIPS,
                protocolVersion: 'V2',
              } as TableFarm
            } else {
              console.log(`token not found token0=${token0Address} token1=${token1Address}`)
            }
          } else {
            console.log(`no token address token0=${token0Address} token1=${token1Address}`)
          }
          return []
        })
        .flat() ?? []
    const rt = sortFarms([...fff], sortState)
    return rt
  }, [farms, tokens, sortState])

  const filteredFarms = useFilteredFarms(unfilteredPools).slice(0, 100)
  return { farms: filteredFarms, loading }
}

async function fetchFarms(): Promise<FetchedFarm[] | undefined> {
  try {
    const res = await fetch('https://interface-gateway.ubeswap.org/v1/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: 'Farms',
        variables: {},
        query: '',
      }),
    })
    const data = await res.json()
    return data
  } catch (e) {
    console.error('Error fetching farms:', e)
    return undefined
  }
}

const whitelistedPools = [
  '0x3efc8d831b754d3ed58a2b4c37818f2e69dadd19', // UBE-CELO V3
  '0x28ade0134b9d0bc7041f4e5ea74fecb58504720b', // USDGLO-USDC 0.01%
  '0x44569704b206798014217b8a02c700bf73ceb72f', // CELO-USDC 1%
  '0x6ade22bd1d73c7162df10e06b51dbc725e2d44a2', // CELO-USDT 1%
  '0x1ef76d432280c837e5668f582c82de8f6ca4024d', // CELO-UBE 0.3%
  '0x3d9e27c04076288ebfdc4815b4f6d81b0ed1b341', // USDGLO-G$ 1%
]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useActiveFarms(sortState: FarmTableSortState, chainId?: ChainId) {
  const tokens = useDefaultActiveTokens(ChainId.CELO)
  const v3Farms = useV3Farms()

  const { data: farmsBackend, isLoading } = useQuery({
    queryKey: ['farms'],
    queryFn: () => fetchFarms(),
    staleTime: 30_000,
  })

  const farms = useMemo(() => {
    const _farmsBackend = farmsBackend || []
    const backendFarms =
      _farmsBackend
        .filter((f: FetchedFarm) => whitelistedPools.includes(f.poolAddress.toLowerCase()))
        .map((fetchedFarm): TableFarm[] => {
          if (tokens[fetchedFarm.token0] && tokens[fetchedFarm.token1]) {
            return [
              {
                hash: `${fetchedFarm.poolAddress}-v${fetchedFarm.protocolVersion}`,
                farmAddress: fetchedFarm.contractAddress,
                poolAddress: fetchedFarm.poolAddress,
                token0: tokens[fetchedFarm.token0],
                token1: tokens[fetchedFarm.token1],
                token0Amount: new Fraction(0),
                token1Amount: new Fraction(0),
                tvl: fetchedFarm.tvl,
                apr: new Percent(Math.round(fetchedFarm.apr * 1_000_000), 100 * 1_000_000),
                feeTier: fetchedFarm.fee,
                protocolVersion: fetchedFarm.protocolVersion === 3 ? ProtocolVersion.V3 : ProtocolVersion.V2,
              } as TableFarm,
            ]
          }
          return []
        })
        .flat() ?? []

    // Combine farms and remove duplicates based on hash
    const allFarms = [...backendFarms, ...v3Farms]
    const uniqueFarms = allFarms.reduce((acc, current) => {
      const x = acc.find((item) => item.hash === current.hash)
      if (!x) {
        return acc.concat([current])
      }
      return acc
    }, [] as TableFarm[])

    return uniqueFarms
  }, [farmsBackend, tokens, v3Farms])

  const unfilteredPools = useMemo(() => {
    return sortFarms([...farms], sortState)
  }, [farms, sortState])

  const filteredFarms = useFilteredFarms(unfilteredPools).slice(0, 100)

  return { farms: filteredFarms, loading: isLoading }
}

interface Metadata {
  platform: string
  farmContract: string
  chainId: number
  incentiveId: string
  blocknumber: number
  timestamp: number
  duration: number
  distributedRewards: string
  totalDistributedRewards: string
  merkleRoot: string
  activeTvlNative: string
  activeTokenCount: number
  inactiveTvlNative: string
  inactiveTokenCount: number
  unstakedTokenCount: number
  totalShares: string
  dataFile: string
}

async function fetchMetadata(incentiveId: string, _ipfsHash: string): Promise<Metadata | undefined> {
  if (!_ipfsHash) {
    return
  }
  let data = {
    platform: 'Ubeswap',
    farmContract: '0xA6E9069CB055a425Eb41D185b740B22Ec8f51853',
    chainId: 42220,
    incentiveId,
    timestamp: 0,
    blocknumber: 0,
    duration: 1,
    distributedRewards: '0',
    totalDistributedRewards: '0',
    merkleRoot: '0x0000000000000000000000000000000000000000000000000000000000000000',
    activeTvlNative: '0',
    activeTokenCount: 0,
    inactiveTvlNative: '0',
    inactiveTokenCount: 0,
    unstakedTokenCount: 0,
    totalShares: '0',
    dataFile: './data.json',
  }
  if (_ipfsHash != '0x0000000000000000000000000000000000000000000000000000000000000000' && incentiveId) {
    const ipfsHash = _ipfsHash.replace(/^0x/, '')
    const cidV0 = new CID(toB58String(hexToUint8Array('1220' + ipfsHash)))
    const cidV1Str = cidV0.toV1().toString()
    const res = await fetch('https://scarlet-bored-roundworm-446.mypinata.cloud/ipfs/' + cidV1Str + '/metadata.json')
    data = (await res.json()) as Metadata
  }
  return data
}

export function useV3IncentiveMetadata(incentiveId?: string): Metadata | undefined {
  const incentiveInfo = useIncentiveContractInfo(incentiveId)
  const { data: metadata } = useQuery({
    queryKey: ['farm-metadata', incentiveInfo?.ipfsHash || ''],
    queryFn: () => fetchMetadata(incentiveId || '', incentiveInfo?.ipfsHash || ''),
    enabled: !!incentiveInfo,
    staleTime: 1000_0000,
  })
  return metadata
}

export interface IncentiveDataItem {
  tokenId: BigNumber
  accumulatedRewards: BigNumber
  lastSecondsInsideOfTickRange: number
  tvlNative: BigNumber
  shares: BigNumber
  duration: number
  activeDuration: number
  merkleProof: string[] | null
  isStaked: boolean
  isActive: boolean
}

async function fetchIncentiveFullData(
  incentiveId: string | undefined,
  _ipfsHash: string
): Promise<IncentiveDataItem[] | undefined> {
  if (!_ipfsHash) {
    return
  }
  let result: IncentiveDataItem[] = []
  if (_ipfsHash != '0x0000000000000000000000000000000000000000000000000000000000000000') {
    const ipfsHash = _ipfsHash.replace(/^0x/, '')
    const cidV0 = new CID(toB58String(hexToUint8Array('1220' + ipfsHash)))
    const cidV1Str = cidV0.toV1().toString()
    const res = await fetch('https://scarlet-bored-roundworm-446.mypinata.cloud/ipfs/' + cidV1Str + '/data.json')
    const data = await res.json()
    data.forEach((d: any) => {
      d.tokenId = BigNumber.from(d.tokenId)
      d.accumulatedRewards = BigNumber.from(d.accumulatedRewards)
      d.tvlNative = BigNumber.from(d.tvlNative)
      d.shares = BigNumber.from(d.shares)
    })
    result = data as IncentiveDataItem[]
  }
  return result
}

export function useV3IncentiveFullData(incentiveId?: string): IncentiveDataItem[] | undefined {
  const incentiveInfo = useIncentiveContractInfo(incentiveId)
  const { data } = useQuery({
    queryKey: ['farm-fulldata', incentiveInfo?.ipfsHash || ''],
    queryFn: () => fetchIncentiveFullData(incentiveId, incentiveInfo?.ipfsHash || ''),
    enabled: !!incentiveInfo,
    staleTime: 1000_0000,
  })
  return data
}

export function useV3Farms(): TableFarm[] {
  const tokens = useDefaultActiveTokens(ChainId.CELO)
  const [farms, setFarms] = useState<TableFarm[]>([])

  useEffect(() => {
    try {
      if (
        tokens['0x471EcE3750Da237f93B8E339c536989b8978a438'] &&
        tokens['0x71e26d0E519D14591b9dE9a0fE9513A398101490']
      ) {
        setFarms([
          {
            hash: '0x3efc8d831b754d3ed58a2b4c37818f2e69dadd19-v3',
            farmAddress: '0x13b0a5Bf2589d603BB735c79813ee1AA6C12FB1d',
            poolAddress: '0x3efc8d831b754d3ed58a2b4c37818f2e69dadd19',
            token0: tokens['0x471EcE3750Da237f93B8E339c536989b8978a438'],
            token1: tokens['0x71e26d0E519D14591b9dE9a0fE9513A398101490'],
            token0Amount: new Fraction(0),
            token1Amount: new Fraction(0),
            tvl: 0,
            apr: new Percent(0),
            feeTier: 100,
            protocolVersion: ProtocolVersion.V3,
          },
          {
            hash: '0x28ade0134b9d0bc7041f4e5ea74fecb58504720b-v3',
            farmAddress: '0x13b0a5Bf2589d603BB735c79813ee1AA6C12FB1d',
            poolAddress: '0x28ade0134b9d0bc7041f4e5ea74fecb58504720b',
            token0: tokens['0x4F604735c1cF31399C6E711D5962b2B3E0225AD3'],
            token1: tokens['0xcebA9300f2b948710d2653dD7B07f33A8B32118C'],
            token0Amount: new Fraction(0),
            token1Amount: new Fraction(0),
            tvl: 0,
            apr: new Percent(0),
            feeTier: 100,
            protocolVersion: ProtocolVersion.V3,
          },
        ])
      } else {
        setFarms([])
      }
    } catch (e) {
      console.error(e)
    }
  }, [tokens])
  return farms
}

export const V2_BIPS = 3000
