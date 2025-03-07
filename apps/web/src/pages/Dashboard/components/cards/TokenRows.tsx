import { ChainId, Token } from '@ubeswap/sdk-core'
import { PortfolioLogo } from 'components/AccountDrawer/MiniPortfolio/PortfolioLogo'
import { DeltaArrow } from 'components/Tokens/TokenDetails/Delta'
import { chainIdToBackendName, getTokenDetailsURL } from 'graphql/data/util'
import { useCurrency } from 'hooks/Tokens'
import { useScreenSize } from 'hooks/useScreenSize'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { NumberType, useFormatter } from 'utils/formatNumbers'
import { Box } from '../Generics'

const TokenRow = styled.div`
  width: 100%;
  height: 64px;
  overflow: hidden;
  padding: 16px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16px;
  border-radius: 20px;
  background-color: ${({ theme }) => theme.surface1};
  cursor: pointer;

  @media (max-width: 1024px) {
    height: 64px;
  }

  @media (max-width: 768px) {
    height: 56px;
    padding: 12px;
  }

  @media (max-width: 468px) {
    height: 48px;
    padding: 8px;
    border-radius: 16px;
  }

  transition: background-color 125ms ease-in, transform 125ms ease-in;
  &:hover {
    background-color: ${({ theme }) => theme.surface2};
    transform: scale(1.03);
  }
`

const TokenName = styled.h3`
  padding: 0;
  margin: 0;
  font-family: Basel;
  font-size: 18px;
  font-style: normal;
  font-weight: 500;
  line-height: 32px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: ${(props) => props.color || props.theme.neutral1};

  @media (max-width: 1024px) {
    font-size: 18px;
    line-height: 24px;
  }

  @media (max-width: 468px) {
    font-size: 16px;
    line-height: 20px;
  }
`

const TokenTicker = styled.h3`
  padding: 0;
  margin: 0;
  font-family: Basel;
  font-size: 18px;
  font-style: normal;
  font-weight: 500;
  line-height: 32px;
  color: ${(props) => props.color || props.theme.neutral1};

  white-space: nowrap; // Metin tek satırda kalacak
  overflow: hidden;
  text-overflow: ellipsis; // Taşan kısım ... ile gösterilecek

  @media (max-width: 1024px) {
    font-size: 16px;
    line-height: 24px;
  }

  @media (max-width: 468px) {
    font-size: 16px;
    line-height: 20px;
  }

  @media (max-width: ${({ theme }) => theme.breakpoint.xs}px) {
    color: ${(props) => props.color || props.theme.neutral1};
  }
`

const TokenPrice = styled.h3`
  padding: 0;
  margin: 0;
  font-family: Basel;
  font-size: 18px;
  font-style: normal;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 32px;
  color: ${(props) => props.color || props.theme.neutral1};

  @media (max-width: 1024px) {
    font-size: 16px;
    line-height: 24px;
  }

  @media (max-width: 468px) {
    font-size: 16px;
    line-height: 20px;
  }
`

const DeltaText = styled.h3`
  text-align: right;
  padding: 0;
  margin: 0;
  font-family: Basel;
  font-size: 18px;
  font-style: normal;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 32px;
  color: ${(props) => (props.color === 'red' ? props.theme.critical : props.theme.success)};

  @media (max-width: 1024px) {
    font-size: 16px;
    line-height: 24px;
    width: 50px;
  }

  @media (max-width: 468px) {
    font-size: 16px;
    line-height: 20px;
    width: 50px;
  }
`

const DeltaContainer = styled(Box)`
  @media (min-width: 1030px) and (max-width: 1150px) {
    display: none;
  }
  @media (min-width: 767px) and (max-width: 915px) {
    display: none;
  }
`

type PoolData = {
  type: 'stake' | 'farm'
  contractAddress: string
  stakingToken?: string
  rewardTokens?: string[]
  token0?: string
  token1?: string
  protocolVersion?: number
  apr: number
  url: string
  poolAddress?: string
}

export function GainerTokenRow({
  tokenAddress,
  price,
  change24h,
}: {
  tokenAddress: string
  price: number
  change24h: number
}) {
  const screenIsSmall = useScreenSize()['sm']
  const navigate = useNavigate()
  const { formatFiatPrice, formatDelta } = useFormatter()
  const currency = useCurrency(tokenAddress, ChainId.CELO)

  return (
    <TokenRow
      onClick={() =>
        navigate(
          getTokenDetailsURL({
            address: tokenAddress,
            chain: chainIdToBackendName(ChainId.CELO),
          })
        )
      }
    >
      <PortfolioLogo currencies={[currency]} chainId={ChainId.CELO} size={screenIsSmall ? '32px' : '32px'} />
      <Box justify="space-between" gap="16px">
        <Box width="auto" gap="8px" align="center" overflow="hidden">
          {/* <TokenName>{currency?.name}</TokenName> */}
          <TokenTicker>{currency?.symbol}</TokenTicker>
        </Box>
        <Box width="auto" gap="8px" align="center">
          <TokenPrice>
            {formatFiatPrice({
              price,
              type: NumberType.FiatTokenPrice,
            })}
          </TokenPrice>
          <DeltaContainer gap="4px" align="center" justify="flex-end">
            <DeltaArrow delta={change24h} />
            <DeltaText color={change24h < 0 ? 'red' : 'green'}>{formatDelta(change24h)}</DeltaText>
          </DeltaContainer>
        </Box>
      </Box>
    </TokenRow>
  )
}

// Top Earners için token satırı bileşeni
export function EarnerTokenRow({ poolData }: { poolData: PoolData }) {
  const navigate = useNavigate()
  const { formatNumber } = useFormatter()

  const stakingToken = useCurrency(poolData.stakingToken, ChainId.CELO)
  const rewardToken = useCurrency(poolData.rewardTokens ? poolData.rewardTokens[0] : undefined, ChainId.CELO)
  const token0 = useCurrency(poolData.token0, ChainId.CELO)
  const token1 = useCurrency(poolData.token1, ChainId.CELO)

  const logoSize = '32px'

  const handleClick = () => {
    navigate(poolData.url)
  }

  if (poolData.type === 'stake') {
    // Token adreslerini wrapped üzerinden karşılaştırıyoruz
    const showDoubleLogo = stakingToken && rewardToken && stakingToken.wrapped.address !== rewardToken.wrapped.address

    return (
      <TokenRow onClick={handleClick}>
        <PortfolioLogo
          currencies={showDoubleLogo ? [stakingToken, rewardToken] : [stakingToken]}
          chainId={ChainId.CELO}
          size={logoSize}
          style={{ minWidth: logoSize }}
        />
        <Box justify="space-between" gap="16px" style={{ width: '100%' }}>
          <Box width="auto" gap="8px" align="center" overflow="hidden">
            <TokenName>{`${stakingToken?.symbol} Stake`}</TokenName>
            {/* {showDoubleLogo && rewardToken && (
              <TokenTicker style={{ color: '#2FBA61' }}>{`Earns ${rewardToken.symbol}`}</TokenTicker>
            )} */}
          </Box>
          <Box width="auto" gap="8px" align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            <TokenPrice>
              {formatNumber({
                input: poolData.apr,
                type: NumberType.TokenNonTx,
              })}
              %
            </TokenPrice>
          </Box>
        </Box>
      </TokenRow>
    )
  }

  // Farm durumu için kod aynı kalıyor
  return (
    <TokenRow onClick={handleClick}>
      <PortfolioLogo
        currencies={[token0, token1]}
        chainId={ChainId.CELO}
        size={logoSize}
        style={{ minWidth: logoSize }}
      />
      <Box justify="space-between" gap="16px" style={{ width: '100%' }}>
        <Box width="auto" gap="8px" align="center" overflow="hidden">
          <TokenName>{`${token0?.symbol}-${token1?.symbol} Farm`}</TokenName>
        </Box>
        <Box width="auto" gap="8px" align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          <TokenPrice>
            {formatNumber({
              input: poolData.apr,
              type: NumberType.TokenNonTx,
            })}
            %
          </TokenPrice>
        </Box>
      </Box>
    </TokenRow>
  )
}

function LaunchpadItem({
  launchpad,
}: {
  launchpad: {
    launchpadAddress: string
    tokenAddress: string
    apr?: number
    tokenName?: string
    logoUrl?: string
  }
}) {
  const navigate = useNavigate()
  const { formatNumber } = useFormatter()
  const token = new Token(ChainId.CELO, launchpad.tokenAddress, 18, '', launchpad.tokenName)
  const logoSize = '32px'

  return (
    <TokenRow
      key={launchpad.launchpadAddress}
      onClick={() => navigate(`/ubestarter/details/${launchpad.launchpadAddress}`)}
    >
      <PortfolioLogo
        images={[launchpad.logoUrl]}
        currencies={[token]}
        chainId={ChainId.CELO}
        size={logoSize}
        style={{ minWidth: logoSize }}
      />
      <Box justify="space-between" gap="16px" style={{ width: '100%' }}>
        <Box width="auto" gap="8px" align="center" overflow="hidden">
          <TokenName>{launchpad.tokenName || token?.symbol || 'Unknown Project'}</TokenName>
        </Box>
        {launchpad.apr !== undefined && (
          <Box width="auto" gap="8px" align="center" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            <TokenPrice>
              {formatNumber({
                input: launchpad.apr,
                type: NumberType.TokenNonTx,
              })}
              %
            </TokenPrice>
          </Box>
        )}
      </Box>
    </TokenRow>
  )
}

// Ana LaunchpadRow bileşeni
export function LaunchpadRow({
  launchpads,
}: {
  launchpads?: {
    launchpadAddress: string
    tokenAddress: string
    name?: string
    apr?: number
    url: string
  }[]
}) {
  // Aktif proje yoksa "No Active Projects" mesajını göster
  if (!launchpads || launchpads.length === 0) {
    return (
      <TokenRow onClick={() => {}} style={{ height: '204px' }}>
        <Box justify="space-between" gap="16px" style={{ width: '100%' }}>
          <TokenName style={{ width: '100%', textAlign: 'center' }}>No Active Projects</TokenName>
        </Box>
      </TokenRow>
    )
  }

  const maxRows = 3

  // Aktif projeleri göster
  return (
    <>
      {launchpads.map((launchpad) => (
        <LaunchpadItem key={launchpad.launchpadAddress} launchpad={launchpad} />
      ))}

      {/* Eksik satırlar için boş satırlar ekle */}
      {launchpads.length < maxRows &&
        Array.from({ length: maxRows - launchpads.length }).map((_, index) => (
          <div
            key={`empty-${index}`}
            style={{
              height: '58px', // TokenRow ile aynı yükseklik(neredeyse)
              width: '100%',
              margin: '3px 0', // Satırlar arası boşluk
            }}
          />
        ))}
    </>
  )
}
