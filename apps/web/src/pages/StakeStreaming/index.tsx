import { defaultAbiCoder, Interface } from '@ethersproject/abi'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { CurrencyAmount, Percent } from '@ubeswap/sdk-core'
import { MaxUint256 } from '@uniswap/permit2-sdk'
import { useWeb3React } from '@web3-react/core'
import { useAccountDrawer } from 'components/AccountDrawer/MiniPortfolio/hooks'
import { useToken } from 'hooks/Tokens'
import { useContract } from 'hooks/useContract'
import { t } from 'i18n'
import { NEVER_RELOAD, useSingleCallResult } from 'lib/hooks/multicall'
import tryParseCurrencyAmount from 'lib/utils/tryParseCurrencyAmount'
import { BodyWrapper } from 'pages/AppBody'
import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Text } from 'rebass'
import { useTransactionAdder } from 'state/transactions/hooks'
import { TransactionType } from 'state/transactions/types'
import styled from 'styled-components'
import { ExternalLink } from 'theme/components'
import { useFormatter } from 'utils/formatNumbers'

import { ButtonLight, ButtonPrimary, ButtonRadio } from '../../components-old/Button'
import { AutoColumn } from '../../components-old/Column'
import CurrencyLogo from '../../components-old/CurrencyLogo'
import Loader from '../../components-old/Loader'
import { AutoRow } from '../../components-old/Row'
import { InformationWrapper } from '../../components-old/Stake/Proposals/ProposalCard'
import StakeCollapseCard from '../../components-old/Stake/StakeCollapseCard'
import StakeInputField from '../../components-old/Stake/StakeInputField'

const SAVINGS_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function getEffectiveFlowRate() view returns (int96)',
  'function rewardRate() view returns (uint256)',
  'function getDailyRewards() view returns (uint256)',
  'function periodFinish() view returns (uint256)',
  'function pool() view returns (address)',
  'function superToken() view returns (address)',
  'function trustedForwarder() view returns (address)',
  'function stake(uint256 amount)',
  'function withdraw(uint256 amount)',
  'function exit()',
]

const SUPER_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
]

const POOL_ABI = [
  'function getUnits(address) view returns (uint128)',
  'function getTotalUnits() view returns (uint128)',
  'function getMemberFlowRate(address) view returns (int96)',
  'function getTotalAmountReceivedByMember(address) view returns (uint256)',
]

const HOST_ABI = ['function batchCall(tuple(uint32 operationType, address target, bytes data)[] operations)']

const GDA_FORWARDER_ABI = [
  'function connectPool(address pool, bytes userData) returns (bool)',
  'function isMemberConnected(address pool, address member) view returns (bool)',
]

const OP_TYPE = {
  ERC20_APPROVE: 1,
  SUPERFLUID_CALL_AGREEMENT: 201,
  SIMPLE_FORWARD_CALL: 301,
  ERC2771_FORWARD_CALL: 302,
} as const

const HOST_ADDRESS = '0xA4Ff07cF81C02CFD356184879D953970cA957585'
const GDA_FORWARDER_ADDRESS = '0x308b7405272d11494716e30C6E972DbF6fb89555'

const NEW_GOODDOLLAR_STAKE = '0x059ee811414230d1fb157878d2b491240f4d8d3b'
const OLD_GOODDOLLAR_STAKE = '0x799a23da264a157db6f9c02be62f82ce8d602a45'

const SECONDS_PER_DAY = 86400
const SECONDS_PER_YEAR = 365 * SECONDS_PER_DAY

const savingsIface = new Interface(SAVINGS_ABI)
const gdaIface = new Interface(GDA_FORWARDER_ABI)

const StyledButtonRadio = styled(ButtonRadio)({
  padding: '8px',
  borderRadius: '4px',
})

const TopSection = styled(AutoColumn)({
  maxWidth: '480px',
  width: '100%',
})

const Wrapper = styled.div({
  margin: '0px 24px',
})

const MigrateAlert = styled.div`
  margin: 16px 8px -16px 8px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(255, 184, 0, 0.12);
  border: 1px solid rgba(255, 184, 0, 0.4);
  display: flex;
  flex-direction: column;
  gap: 10px;
`

export const StakeStreaming: React.FC = () => {
  const { account, chainId, provider } = useWeb3React()
  const { contractAddress } = useParams<{ contractAddress: string }>()
  const { formatPercent } = useFormatter()

  const savingsContract = useContract(contractAddress, SAVINGS_ABI, true)

  const isGoodDollarContract = contractAddress?.toLowerCase() === NEW_GOODDOLLAR_STAKE

  const superTokenAddr = useSingleCallResult(savingsContract, 'superToken', undefined, NEVER_RELOAD).result?.[0] as
    | string
    | undefined
  const poolAddr = useSingleCallResult(savingsContract, 'pool', undefined, NEVER_RELOAD).result?.[0] as
    | string
    | undefined

  const token = useToken(superTokenAddr, chainId)

  const superTokenContract = useContract(superTokenAddr, SUPER_TOKEN_ABI, false)
  const poolContract = useContract(poolAddr, POOL_ABI, false)
  const gdaForwarder = useContract(GDA_FORWARDER_ADDRESS, GDA_FORWARDER_ABI, false)
  const oldStakeContract = useContract(isGoodDollarContract ? OLD_GOODDOLLAR_STAKE : undefined, SAVINGS_ABI, true)

  const [, toggleAccountDrawer] = useAccountDrawer()
  const [amount, setAmount] = useState('')
  const [staking, setStaking] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [migratingAmount, setMigratingAmount] = useState<BigNumber | undefined>(undefined)

  const tokenAmount = tryParseCurrencyAmount(amount === '' ? '0' : amount, token ?? undefined)

  const walletRaw = useSingleCallResult(superTokenContract, 'balanceOf', [account ?? undefined]).result?.[0] as
    | BigNumber
    | undefined
  const stakeRaw = useSingleCallResult(savingsContract, 'balanceOf', [account ?? undefined]).result?.[0] as
    | BigNumber
    | undefined
  const allowanceRaw = useSingleCallResult(superTokenContract, 'allowance', [account ?? undefined, contractAddress])
    .result?.[0] as BigNumber | undefined
  const totalSupplyRaw = useSingleCallResult(savingsContract, 'totalSupply', []).result?.[0] as BigNumber | undefined
  const rewardRateFn = isGoodDollarContract ? 'getEffectiveFlowRate' : 'rewardRate'
  const rewardRateRaw = useSingleCallResult(savingsContract, rewardRateFn, []).result?.[0] as BigNumber | undefined
  const userFlowRateRaw = useSingleCallResult(poolContract, 'getMemberFlowRate', [account ?? undefined]).result?.[0] as
    | BigNumber
    | undefined
  const totalReceivedRaw = useSingleCallResult(poolContract, 'getTotalAmountReceivedByMember', [account ?? undefined])
    .result?.[0] as BigNumber | undefined
  const isConnectedRaw = useSingleCallResult(gdaForwarder, 'isMemberConnected', [
    poolAddr ?? undefined,
    account ?? undefined,
  ]).result?.[0] as boolean | undefined
  const oldStakeRaw = useSingleCallResult(oldStakeContract, 'balanceOf', [account ?? undefined]).result?.[0] as
    | BigNumber
    | undefined

  const userFlowRate = userFlowRateRaw ?? BigNumber.from(0)
  const rewardRate = rewardRateRaw ?? BigNumber.from(0)
  const totalSupplyBN = totalSupplyRaw ?? BigNumber.from(0)
  const stakeBalanceBN = stakeRaw ?? BigNumber.from(0)
  const hasOldStake = !!(oldStakeRaw && oldStakeRaw.gt(0))

  // Real-time tick (1s)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Reset snapshot time whenever the underlying chain reads refresh
  const walletKey = walletRaw?.toString() ?? ''
  const receivedKey = totalReceivedRaw?.toString() ?? ''
  const [snapshotTime, setSnapshotTime] = useState(() => Date.now())
  useEffect(() => {
    setSnapshotTime(Date.now())
  }, [walletKey, receivedKey])

  const elapsedMs = Math.max(0, now - snapshotTime)
  const flowDelta = userFlowRate.mul(elapsedMs).div(1000)

  const liveWalletBN = walletRaw ? walletRaw.add(flowDelta) : undefined
  const liveReceivedBN = totalReceivedRaw ? totalReceivedRaw.add(flowDelta) : undefined

  const liveWalletAmount =
    token && liveWalletBN ? CurrencyAmount.fromRawAmount(token, liveWalletBN.toString()) : undefined
  const liveReceivedAmount =
    token && liveReceivedBN ? CurrencyAmount.fromRawAmount(token, liveReceivedBN.toString()) : undefined
  const stakeBalance = token && stakeRaw ? CurrencyAmount.fromRawAmount(token, stakeRaw.toString()) : undefined
  const totalSupply =
    token && totalSupplyRaw ? CurrencyAmount.fromRawAmount(token, totalSupplyRaw.toString()) : undefined

  const dailyRewardsBN = userFlowRate.mul(SECONDS_PER_DAY)
  const dailyRewardsAmount = token ? CurrencyAmount.fromRawAmount(token, dailyRewardsBN.toString()) : undefined

  const poolShareBP = totalSupplyBN.gt(0) ? stakeBalanceBN.mul(10000).div(totalSupplyBN).toNumber() : 0
  const poolShare = new Percent(poolShareBP, 10_000)

  const aprBP =
    totalSupplyBN.gt(0) && rewardRate.gt(0)
      ? rewardRate.mul(SECONDS_PER_YEAR).mul(10000).div(totalSupplyBN).toNumber()
      : 0
  const apr = new Percent(aprBP, 10_000)

  const addTransaction = useTransactionAdder()
  const signer = provider?.getSigner()

  const stakeWithBatchCall = useCallback(
    async (amountBN: BigNumber, summary: string) => {
      if (!signer || !contractAddress || !superTokenAddr || !poolAddr) {
        return undefined
      }
      const operations: Array<{
        operationType: number
        target: string
        data: string
      }> = []

      if (!allowanceRaw || allowanceRaw.lt(amountBN)) {
        operations.push({
          operationType: OP_TYPE.ERC20_APPROVE,
          target: superTokenAddr,
          data: defaultAbiCoder.encode(['address', 'uint256'], [contractAddress, MaxUint256]),
        })
      }

      if (!isConnectedRaw) {
        const connectPoolCall = gdaIface.encodeFunctionData('connectPool', [poolAddr, '0x'])
        operations.push({
          operationType: OP_TYPE.SUPERFLUID_CALL_AGREEMENT,
          target: GDA_FORWARDER_ADDRESS,
          data: defaultAbiCoder.encode(['bytes', 'bytes'], [connectPoolCall, '0x']),
        })
      }

      operations.push({
        operationType: OP_TYPE.ERC2771_FORWARD_CALL,
        target: contractAddress,
        data: savingsIface.encodeFunctionData('stake', [amountBN]),
      })

      const host = new Contract(HOST_ADDRESS, HOST_ABI, signer)
      const tx = await host.batchCall(operations)
      addTransaction(tx, {
        type: TransactionType.CUSTOM,
        summary,
      })
      await tx.wait()
      return tx
    },
    [signer, contractAddress, superTokenAddr, poolAddr, allowanceRaw, isConnectedRaw, addTransaction]
  )

  const onStakeClick = useCallback(async () => {
    if (!tokenAmount || !token) {
      return
    }
    setSubmitting(true)
    try {
      const stakeBN = BigNumber.from(tokenAmount.quotient.toString())
      await stakeWithBatchCall(stakeBN, `Stake ${amount} ${token.symbol}`)
      setAmount('')
    } catch (err) {
      console.error('Stake error', err)
    } finally {
      setSubmitting(false)
    }
  }, [stakeWithBatchCall, tokenAmount, token, amount])

  const onUnstakeClick = useCallback(async () => {
    if (!signer || !tokenAmount || !contractAddress || !token) {
      return
    }
    setSubmitting(true)
    try {
      const savings = new Contract(contractAddress, SAVINGS_ABI, signer)
      const withdrawAmount = BigNumber.from(tokenAmount.quotient.toString())
      const tx =
        stakeRaw && withdrawAmount.gte(stakeRaw) ? await savings.exit() : await savings.withdraw(withdrawAmount)
      addTransaction(tx, {
        type: TransactionType.CUSTOM,
        summary: `Unstake ${amount} ${token.symbol}`,
      })
      await tx.wait()
      setAmount('')
    } catch (err) {
      console.error('Unstake error', err)
    } finally {
      setSubmitting(false)
    }
  }, [signer, tokenAmount, contractAddress, token, stakeRaw, amount, addTransaction])

  const onMigrateClick = useCallback(async () => {
    if (!signer || !oldStakeRaw || !token) {
      return
    }
    setMigrating(true)
    setMigratingAmount(oldStakeRaw)
    try {
      const oldStake = new Contract(OLD_GOODDOLLAR_STAKE, SAVINGS_ABI, signer)
      const exitTx = await oldStake.exit()
      addTransaction(exitTx, {
        type: TransactionType.CUSTOM,
        summary: `Exit old ${token.symbol} stake`,
      })
      await exitTx.wait()

      await stakeWithBatchCall(oldStakeRaw, `Migrate ${token.symbol} into Savings`)
    } catch (err) {
      console.error('Migrate error', err)
    } finally {
      setMigrating(false)
      setMigratingAmount(undefined)
    }
  }, [signer, oldStakeRaw, token, stakeWithBatchCall, addTransaction])

  const isAmountValid = !isNaN(Number(amount)) && Number(amount) > 0

  let button = <ButtonLight onClick={() => toggleAccountDrawer()}>{t('Connect Wallet')}</ButtonLight>
  if (account) {
    if (staking) {
      button = (
        <ButtonPrimary
          onClick={onStakeClick}
          disabled={!isAmountValid || submitting || migrating}
          altDisabledStyle={submitting}
        >
          {submitting ? (
            <AutoRow gap="6px" justify="center">
              {t('Staking')} <Loader stroke="white" />
            </AutoRow>
          ) : (
            t('Stake')
          )}
        </ButtonPrimary>
      )
    } else {
      button = (
        <ButtonPrimary
          onClick={onUnstakeClick}
          disabled={!isAmountValid || submitting || migrating}
          altDisabledStyle={submitting}
        >
          {submitting ? (
            <AutoRow gap="6px" justify="center">
              {t('Unstaking')} <Loader stroke="white" />
            </AutoRow>
          ) : (
            t('Unstake')
          )}
        </ButtonPrimary>
      )
    }
  }

  return (
    <>
      <TopSection gap="lg" justify="center">
        {((hasOldStake && oldStakeRaw) || migrating) && token && (
          <MigrateAlert>
            <Text fontWeight={600} fontSize={14}>
              {t('You have {{amount}} {{symbol}} staked in the previous savings.', {
                amount: Number(
                  CurrencyAmount.fromRawAmount(
                    token,
                    (migratingAmount ?? oldStakeRaw ?? BigNumber.from(0)).toString()
                  ).toSignificant(6)
                ).toLocaleString('en-US'),
                symbol: token.symbol ?? '',
              })}
            </Text>
            <Text fontSize={12}>
              {t(
                'Migration will be done in 2 steps, first exiting your stake from the old contract, then staking the same amount into the new contract.'
              )}
            </Text>
            <ButtonPrimary
              onClick={onMigrateClick}
              disabled={migrating || submitting}
              altDisabledStyle={migrating}
              padding="8px"
            >
              {migrating ? (
                <AutoRow gap="6px" justify="center">
                  {t('Migrating')} <Loader stroke="white" />
                </AutoRow>
              ) : (
                t('Migrate')
              )}
            </ButtonPrimary>
          </MigrateAlert>
        )}
        <BodyWrapper>
          <CurrencyLogo
            currency={token}
            size="42px"
            style={{
              position: 'absolute',
              top: '30px',
              right: 'calc(50% + 112px)',
            }}
          />
          <h2 style={{ textAlign: 'center', margin: '15px 0px 15px 6px' }}>
            {token?.symbol} {isGoodDollarContract ? 'Savings' : 'Staking'}
          </h2>
          <div
            style={{
              margin: '10px 0 0 6px',
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div style={{ width: '100px' }}>
              <StyledButtonRadio active={staking} onClick={() => setStaking(true)}>
                {t('Stake')}
              </StyledButtonRadio>
            </div>
            <div style={{ width: '100px' }}>
              <StyledButtonRadio active={!staking} onClick={() => setStaking(false)}>
                {t('Unstake')}
              </StyledButtonRadio>
            </div>
          </div>

          <Wrapper>
            <div style={{ margin: '24px 0' }}>
              <StakeInputField
                id="stake-currency"
                value={amount}
                onUserInput={setAmount}
                onMax={() => {
                  if (staking) {
                    liveWalletAmount && setAmount(liveWalletAmount.toSignificant(18))
                  } else {
                    stakeBalance && setAmount(stakeBalance.toSignificant(18))
                  }
                }}
                currency={token}
                stakeBalance={stakeBalance}
                walletBalance={liveWalletAmount}
              />
            </div>
            {liveReceivedAmount && userFlowRate.gt(0) && (
              <InformationWrapper style={{ margin: '0px 8px 0px 8px' }}>
                <Text fontWeight={500} fontSize={16}>
                  {t('Streaming Rewards')}
                </Text>
                <Text fontWeight={500} fontSize={16}>
                  {liveReceivedAmount.toFixed(6, { groupSeparator: ',' })}
                </Text>
              </InformationWrapper>
            )}
            <div style={{ margin: '24px 0 16px 0' }}>{button}</div>
          </Wrapper>
        </BodyWrapper>

        <StakeCollapseCard title={t('Staking Statistics')} gap="16px" openedDefault>
          <InformationWrapper>
            <Text>Total {token?.symbol} Staked</Text>
            <Text>{totalSupply ? Number(totalSupply.toSignificant(6)).toLocaleString('en-US') : '--'}</Text>
          </InformationWrapper>
          <InformationWrapper>
            <Text>Your {token?.symbol} Stake Pool Share</Text>
            <Text>{formatPercent(poolShare)}</Text>
          </InformationWrapper>
          <InformationWrapper>
            <Text>{t('Your Daily Rewards')}</Text>
            <Text>{dailyRewardsAmount ? dailyRewardsAmount.toFixed(4, { groupSeparator: ',' }) : '--'}</Text>
          </InformationWrapper>
          <InformationWrapper>
            <Text>{t('Your Total Rewards So Far')}</Text>
            <Text>{liveReceivedAmount ? liveReceivedAmount.toFixed(6, { groupSeparator: ',' }) : '--'}</Text>
          </InformationWrapper>
          <InformationWrapper>
            <Text>{t('Annual Stake APR')}</Text>
            <Text>{aprBP > 0 ? formatPercent(apr) : '- %'}</Text>
          </InformationWrapper>
          <ExternalLink
            style={{ textDecoration: 'underline', textAlign: 'left' }}
            target="_blank"
            href={`https://celoscan.io/address/${superTokenAddr ?? ''}`}
          >
            <Text fontSize={14} fontWeight={600}>
              View {token?.symbol} Contract
            </Text>
          </ExternalLink>
          <ExternalLink
            style={{ textDecoration: 'underline', textAlign: 'left' }}
            target="_blank"
            href={`https://info.ubeswap.org/#/celo/tokens/${superTokenAddr ?? ''}`}
          >
            <Text fontSize={14} fontWeight={600}>
              View {token?.symbol} Chart
            </Text>
          </ExternalLink>
        </StakeCollapseCard>
      </TopSection>
    </>
  )
}

export default StakeStreaming
