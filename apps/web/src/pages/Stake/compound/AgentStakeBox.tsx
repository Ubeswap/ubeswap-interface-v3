/**
 * The UBE Stake box for an account that has a Stake Agent: Stake goes into the agent (a permit signature + one
 * transaction), Unstake comes out of it, and "Current Stake" is what the agent holds. UBE still staked directly in
 * UBE Stake (the old way) is shown under it with a button that moves it into the agent.
 */
import { BigNumber } from '@ethersproject/bignumber'
import { formatUnits, parseUnits } from '@ethersproject/units'
import { CurrencyAmount } from '@ubeswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { UBE } from 'constants/tokens'
import { BodyWrapper } from 'pages/AppBody'
import { useState } from 'react'
import { Text } from 'rebass'
import styled from 'styled-components'

import { ButtonEmpty, ButtonPrimary, ButtonRadio } from '../../../components-old/Button'
import CurrencyLogo from '../../../components-old/CurrencyLogo'
import { InformationWrapper } from '../../../components-old/Stake/Proposals/ProposalCard'
import StakeInputField from '../../../components-old/Stake/StakeInputField'
import { AGENT_ABI, FACTORY_ABI, STAKING_ABI } from './abi'
import { COMPOUND_FACTORY, UBE_STAKE } from './config'
import { CompoundState, useCompoundTx, useUbePermit } from './useCompound'

const StyledButtonRadio = styled(ButtonRadio)({
  padding: '8px',
  borderRadius: '4px',
})
const Wrapper = styled.div({
  margin: '0px 24px',
})
const Note = styled.p<{ tone?: 'error' }>`
  margin: 8px 8px 0;
  color: ${({ theme, tone }) => (tone === 'error' ? theme.critical : theme.neutral2)};
  font-size: 13px;
  line-height: 1.4;
`

const fmt = (v: BigNumber, dp = 2) =>
  Number(formatUnits(v, 18)).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
function parse(value: string): BigNumber | undefined {
  try {
    return value.trim() ? parseUnits(value.trim().replace(/,/g, ''), 18) : undefined
  } catch {
    return undefined
  }
}

export function AgentStakeBox({ state, refetch }: { state: CompoundState; refetch: () => Promise<unknown> }) {
  const { chainId } = useWeb3React()
  const ube = chainId ? UBE[chainId] : undefined
  const send = useCompoundTx()
  const signPermit = useUbePermit()
  const [staking, setStaking] = useState(true)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()
  const agent = state.agent
  if (!agent || !COMPOUND_FACTORY) return null
  const factory: string = COMPOUND_FACTORY

  const value = parse(amount)
  const limit = staking ? state.balance : agent.staked
  const bad = !value || value.lte(0) || value.gt(limit)

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    setError(undefined)
    try {
      await fn()
      setAmount('')
      await refetch()
    } catch (e) {
      setError((e as { reason?: string; message?: string }).reason ?? (e as Error).message)
    } finally {
      setBusy(undefined)
    }
  }

  const stake = (v: BigNumber) =>
    run('stake', async () => {
      const p = await signPermit(v, state.now)
      await send(factory, FACTORY_ABI, 'depositWithPermit', [v, p.deadline, p.v, p.r, p.s], `Stake ${fmt(v)} UBE`)
    })
  const unstake = (v: BigNumber) =>
    run('unstake', () => send(agent.address, AGENT_ABI, 'withdraw', [v], `Unstake ${fmt(v)} UBE`))
  // old direct stake -> agent: exit UBE Stake, then stake what arrived (permit + deposit)
  const moveDirect = () =>
    run('move', async () => {
      const before = state.balance
      await send(UBE_STAKE, STAKING_ABI, 'exit', [], 'Unstake from UBE Stake')
      const after = (await refetch()) as { data?: CompoundState }
      // move only what the exit brought (stake + its reward), not UBE that was already in the wallet
      const moved = (after.data?.balance ?? before).sub(before)
      if (moved.lte(0)) return
      const p = await signPermit(moved, state.now)
      await send(
        factory,
        FACTORY_ABI,
        'depositWithPermit',
        [moved, p.deadline, p.v, p.r, p.s],
        `Stake ${fmt(moved)} UBE`
      )
    })

  const asAmount = (v: BigNumber) => (ube ? CurrencyAmount.fromRawAmount(ube, v.toString()) : undefined)
  let label = staking ? 'Stake' : 'Unstake'
  if (busy === 'stake') label = 'Sign the permit, then confirm…'
  if (busy === 'unstake') label = 'Unstaking…'

  return (
    <BodyWrapper>
      <CurrencyLogo
        currency={ube}
        size="42px"
        style={{ position: 'absolute', top: '30px', right: 'calc(50% + 112px)' }}
      />
      <h2 style={{ textAlign: 'center', margin: '15px 0px 15px 6px' }}>UBE Stake</h2>
      <div style={{ margin: '10px 0 0 6px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100px' }}>
          <StyledButtonRadio active={staking} onClick={() => setStaking(true)}>
            Stake
          </StyledButtonRadio>
        </div>
        <div style={{ width: '100px' }}>
          <StyledButtonRadio active={!staking} onClick={() => setStaking(false)}>
            Unstake
          </StyledButtonRadio>
        </div>
      </div>

      <Wrapper>
        <div style={{ margin: '24px 0' }}>
          <StakeInputField
            id="agent-stake-currency"
            value={amount}
            onUserInput={setAmount}
            onMax={() => setAmount(formatUnits(limit, 18))}
            currency={ube}
            stakeBalance={asAmount(agent.staked)}
            walletBalance={asAmount(state.balance)}
          />
        </div>
        <InformationWrapper style={{ margin: '0px 8px 0px 8px' }}>
          <Text fontWeight={500} fontSize={16}>
            Pending reward
          </Text>
          <Text fontWeight={500} fontSize={16}>
            {fmt(agent.pending, 4)} UBE
          </Text>
        </InformationWrapper>
        <Note>Staked through your Stake Agent: rewards are claimed and re-staked on its schedule.</Note>
        {(state.directStaked.gt(0) || busy === 'move') && (
          <InformationWrapper style={{ margin: '12px 8px 0px 8px' }}>
            <Text fontSize={14}>Still staked directly: {fmt(state.directStaked)} UBE</Text>
            <ButtonEmpty padding="0 8px" borderRadius="8px" width="fit-content" disabled={!!busy} onClick={moveDirect}>
              {busy === 'move' ? 'Moving…' : 'Move to agent'}
            </ButtonEmpty>
          </InformationWrapper>
        )}
        <div style={{ margin: '24px 0 16px 0' }}>
          <ButtonPrimary disabled={!!busy || bad} onClick={() => value && (staking ? stake(value) : unstake(value))}>
            {label}
          </ButtonPrimary>
        </div>
        {error && <Note tone="error">{error}</Note>}
      </Wrapper>
    </BodyWrapper>
  )
}
