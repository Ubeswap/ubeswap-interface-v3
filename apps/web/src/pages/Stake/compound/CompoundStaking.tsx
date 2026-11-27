/**
 * Compound Staking on the UBE Stake page: the user's own CompoundAgent holds their stake in UBE Stake, and a keeper
 * claims and re-stakes the rewards on the chosen schedule. A turn runs only when the reward is at least 10x its gas fee,
 * so small stakes compound less often than their schedule says; the box shows how often to expect it.
 */
import { BigNumber } from '@ethersproject/bignumber'
import { formatUnits, parseUnits } from '@ethersproject/units'
import { useWeb3React } from '@web3-react/core'
import { useAccountDrawer } from 'components/AccountDrawer/MiniPortfolio/hooks'
import { ButtonPrimary } from 'components/Button'
import { useState } from 'react'
import styled from 'styled-components'
import { shortenAddress } from 'utilities/src/addresses'

import { AGENT_ABI, FACTORY_ABI, STAKING_ABI } from './abi'
import { COMPOUND_FACTORY, INTERVALS, UBE_STAKE, VOTES } from './config'
import { CompoundState, useCompoundState, useCompoundTx, useUbePermit } from './useCompound'

const YEAR = 365 * 86400

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 480px;
  padding: 20px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.surface3};
  background: ${({ theme }) => theme.surface2};
`
const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 535;
  }
`
const Badge = styled.span<{ tone?: 'on' | 'off' }>`
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 535;
  color: ${({ theme, tone }) => (tone === 'on' ? theme.success : tone === 'off' ? theme.neutral2 : theme.accent1)};
  background: ${({ theme, tone }) =>
    tone === 'on' ? `${theme.success}1f` : tone === 'off' ? theme.surface3 : `${theme.accent1}26`};
`
const Sub = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.neutral2};
  font-size: 15px;
  line-height: 1.4;
`
const Label = styled.div`
  margin-bottom: -6px;
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
`
const AmountBox = styled.div`
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  background: ${({ theme }) => theme.surface1};
`
const AmountTop = styled.div`
  display: flex;
  justify-content: space-between;
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
`
const InputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: ${({ theme }) => theme.neutral1};
    font-family: inherit;
    font-size: 28px;
    font-weight: 485;
  }
`
const SmallInputRow = styled(InputRow)`
  padding: 6px 10px;
  border-radius: 12px;
  background: ${({ theme }) => theme.surface1};
  input {
    font-size: 18px;
  }
`
const Max = styled.button`
  padding: 4px 8px;
  border: none;
  border-radius: 8px;
  background: ${({ theme }) => `${theme.accent1}26`};
  color: ${({ theme }) => theme.accent1};
  font-family: inherit;
  font-size: 13px;
  font-weight: 535;
  cursor: pointer;
`
const Segmented = styled.div<{ cols: number }>`
  display: grid;
  grid-template-columns: repeat(${({ cols }) => cols}, 1fr);
  gap: 4px;
  padding: 4px;
  border-radius: 14px;
  background: ${({ theme }) => theme.surface1};
`
const Segment = styled.button<{ selected: boolean; faded: boolean }>`
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 8px 4px;
  border: none;
  border-radius: 10px;
  background: ${({ theme, selected }) => (selected ? theme.surface2 : 'transparent')};
  box-shadow: ${({ theme, selected }) => (selected ? `inset 0 0 0 1px ${theme.accent1}` : 'none')};
  color: ${({ theme, selected }) => (selected ? theme.neutral1 : theme.neutral2)};
  opacity: ${({ faded, selected }) => (faded && !selected ? 0.45 : 1)};
  font-family: inherit;
  font-size: 15px;
  font-weight: 535;
  cursor: pointer;
  small {
    color: ${({ theme }) => theme.neutral3};
    font-size: 12px;
    font-weight: 485;
  }
  &:disabled {
    cursor: not-allowed;
  }
`
const Rows = styled.dl<{ boxed?: boolean }>`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: ${({ boxed }) => (boxed ? '14px 16px' : '0')};
  border-radius: 16px;
  background: ${({ theme, boxed }) => (boxed ? theme.surface1 : 'transparent')};
  div {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 15px;
  }
  dt {
    color: ${({ theme }) => theme.neutral2};
  }
  dd {
    margin: 0;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`
const Hint = styled.p<{ tone?: 'warn' | 'error' }>`
  margin: -4px 0 0;
  color: ${({ theme, tone }) =>
    tone === 'warn' ? theme.warning2 : tone === 'error' ? theme.critical : theme.neutral2};
  font-size: 13px;
  line-height: 1.4;
`
const Steps = styled.ol`
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
`
const Step = styled.li<{ done: boolean; active: boolean }>`
  display: grid;
  grid-template-columns: 24px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: ${({ theme }) => theme.surface1};
  span:first-child {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 13px;
    color: ${({ theme, done, active }) => (done ? theme.success : active ? theme.accent1 : theme.neutral2)};
    background: ${({ theme, done, active }) =>
      done ? `${theme.success}1f` : active ? `${theme.accent1}26` : theme.surface3};
  }
  span:last-child {
    color: ${({ theme }) => theme.neutral2};
    font-size: 13px;
  }
`
const Actions = styled.div`
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
`
const Secondary = styled.button<{ danger?: boolean }>`
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid ${({ theme }) => theme.surface3};
  background: ${({ theme }) => theme.surface1};
  color: ${({ theme, danger }) => (danger ? theme.critical : theme.neutral1)};
  font-family: inherit;
  font-size: 16px;
  font-weight: 535;
  cursor: pointer;
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`
const History = styled.ul`
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  li {
    display: flex;
    justify-content: space-between;
    padding: 8px 12px;
    border-radius: 10px;
    background: ${({ theme }) => theme.surface1};
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }
`

const fmt = (v: BigNumber, dp = 2) =>
  Number(formatUnits(v, 18)).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })
const when = (ts: number) =>
  new Date(ts * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function span(secs: number) {
  const h = Math.round(secs / 3600)
  if (h < 48) return `${h} hours`
  const d = Math.round(secs / 86400)
  return d < 14 ? `${d} days` : `${Math.round(d / 7)} weeks`
}
function rel(secs: number) {
  const s = Math.abs(secs)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const t = h >= 48 ? `${Math.round(h / 24)}d` : h ? `${h}h ${m}m` : `${m}m`
  return secs >= 0 ? `in ${t}` : `${t} ago`
}
function parse(value: string): BigNumber | undefined {
  try {
    const v = value.trim().replace(/,/g, '')
    return v ? parseUnits(v, 18) : undefined
  } catch {
    return undefined
  }
}

/**
 * How often a stake really compounds at interval `idx`: the keeper skips turns until the reward reaches what a turn
 * needs, so a small stake compounds every k-th turn.
 */
function cadence(state: CompoundState, stake: BigNumber, idx: number, alreadyStaked: boolean) {
  const total = alreadyStaked ? state.totalStaked : state.totalStaked.add(stake)
  const secs = INTERVALS[idx].secs
  if (state.rewardRate.isZero() || total.isZero() || stake.isZero()) return { every: undefined, apr: 0, full: false }
  const perTurn = state.rewardRate.mul(secs).mul(stake).div(total)
  const turns = perTurn.isZero()
    ? Infinity
    : Math.max(1, Math.ceil(Number(state.turnNeedsUBE.toString()) / Number(perTurn.toString())))
  const apr = (Number(state.rewardRate.toString()) * YEAR) / Number(total.toString())
  return { every: turns === Infinity ? undefined : turns * secs, apr, full: turns === 1 }
}
const apy = (apr: number, every?: number) => {
  if (!apr || !every) return apr
  const n = YEAR / every
  return Math.pow(1 + apr / n, n) - 1
}
const pct = (x: number) => `${(x * 100).toFixed(2)}%`

export function CompoundStaking() {
  const { account } = useWeb3React()
  const [, toggleAccountDrawer] = useAccountDrawer()
  const { data: state, refetch } = useCompoundState()
  const send = useCompoundTx()
  const signPermit = useUbePermit()
  const [amount, setAmount] = useState('')
  const [freq, setFreq] = useState(0)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [busy, setBusy] = useState<string>()
  const [error, setError] = useState<string>()

  if (!COMPOUND_FACTORY) {
    return (
      <Card>
        <TitleRow>
          <h3>Compound Staking</h3>
          <Badge tone="off">Coming soon</Badge>
        </TitleRow>
        <Sub>Your UBE rewards claimed and re-staked for you on a schedule, so they keep earning.</Sub>
      </Card>
    )
  }

  const factory: string = COMPOUND_FACTORY

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    setError(undefined)
    try {
      await fn()
      await refetch()
    } catch (e) {
      setError((e as { reason?: string; message?: string }).reason ?? (e as Error).message)
    } finally {
      setBusy(undefined)
    }
  }

  const agent = state?.agent
  if (state && agent && agent.staked.gt(0)) {
    const w = parse(withdrawAmount)
    const c = cadence(state, agent.staked, agent.intervalIdx, true)
    const last = agent.history[agent.history.length - 1]
    return (
      <Card>
        <TitleRow>
          <h3>Compound Staking</h3>
          <Badge tone="on">Active</Badge>
        </TitleRow>
        <Rows boxed>
          <div>
            <dt>Staked</dt>
            <dd>{fmt(agent.staked)} UBE</dd>
          </div>
          <div>
            <dt>Pending reward</dt>
            <dd>{fmt(agent.pending, 4)} UBE</dd>
          </div>
          <div>
            <dt>Next compound</dt>
            <dd>
              {agent.nextCompoundAt <= state.now
                ? 'due now'
                : `${when(agent.nextCompoundAt)} (${rel(agent.nextCompoundAt - state.now)})`}
            </dd>
          </div>
          <div>
            <dt>Last compound</dt>
            <dd>{last ? `${when(last.ts)} · +${fmt(last.restaked)} UBE` : 'not yet'}</dd>
          </div>
          <div>
            <dt>Fees taken</dt>
            <dd>{fmt(agent.fees, 4)} UBE</dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd>{shortenAddress(agent.address)}</dd>
          </div>
        </Rows>
        {!c.full && c.every && (
          <Hint tone="warn">
            A turn runs only when the reward is at least 10× its gas fee (now ~{fmt(state.turnNeedsUBE, 0)} UBE), so
            expect a compound every ~{span(c.every)}.
          </Hint>
        )}

        <Label>Interval</Label>
        <Segmented cols={4}>
          {INTERVALS.map((it, i) => (
            <Segment
              key={it.label}
              selected={i === agent.intervalIdx}
              faded={!cadence(state, agent.staked, i, true).full}
              disabled={!!busy}
              onClick={() =>
                i !== agent.intervalIdx &&
                run('interval', () =>
                  send(agent.address, AGENT_ABI, 'setInterval', [i], `Set compound interval to ${it.label}`)
                )
              }
            >
              {it.label}
              <small>{it.sub}</small>
            </Segment>
          ))}
        </Segmented>

        <Label>Vote direction of your staked UBE</Label>
        <Segmented cols={3}>
          {VOTES.map((v, i) => (
            <Segment
              key={v}
              selected={i === agent.vote}
              faded={false}
              disabled={!!busy}
              onClick={() =>
                i !== agent.vote &&
                run('vote', () => send(agent.address, AGENT_ABI, 'setVote', [i], `Set compound agent vote to ${v}`))
              }
            >
              {v}
            </Segment>
          ))}
        </Segmented>

        <Label>Withdraw</Label>
        <Actions>
          <SmallInputRow>
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              aria-label="Withdraw amount"
            />
            <Max type="button" onClick={() => setWithdrawAmount(formatUnits(agent.staked, 18))}>
              MAX
            </Max>
          </SmallInputRow>
          <Secondary
            disabled={!!busy || !w || w.lte(0) || w.gt(agent.staked)}
            onClick={() =>
              w &&
              run('withdraw', async () => {
                await send(agent.address, AGENT_ABI, 'withdraw', [w], `Withdraw ${fmt(w)} UBE`)
                setWithdrawAmount('')
              })
            }
          >
            {busy === 'withdraw' ? 'Withdrawing…' : 'Withdraw'}
          </Secondary>
          <Secondary
            danger
            disabled={!!busy}
            onClick={() => run('exit', () => send(agent.address, AGENT_ABI, 'exit', [], 'Exit Compound Staking'))}
          >
            {busy === 'exit' ? 'Exiting…' : 'Exit'}
          </Secondary>
        </Actions>
        <Hint>Exit withdraws everything and claims the pending reward to your wallet.</Hint>
        {error && <Hint tone="error">{error}</Hint>}

        {agent.history.length > 0 && (
          <>
            <Label>History</Label>
            <History>
              {agent.history
                .slice()
                .reverse()
                .map((h) => (
                  <li key={h.ts}>
                    <span>{when(h.ts)}</span>
                    <span>
                      +{fmt(h.restaked)} UBE · fee {fmt(h.fee)}
                    </span>
                  </li>
                ))}
            </History>
          </>
        )}
      </Card>
    )
  }

  // set-up: no agent yet, or an agent with nothing staked. Most users already stake in UBE Stake directly: they move
  // all of it (stake + its reward + wallet) in two steps, (1) exit UBE Stake, (2) sign a permit and deploy the agent.
  const direct = state ? state.directStaked : BigNumber.from(0)
  const movable = state ? state.balance.add(state.directStaked).add(state.directEarned) : BigNumber.from(0)
  const value = amount === '' && movable.gt(0) ? movable : parse(amount)
  const stake = value ?? BigNumber.from(0)
  const insufficient = !!value && !!state && value.gt(movable)
  const c = state ? cadence(state, stake, freq, false) : undefined
  const iv = INTERVALS[freq]
  const hasDirect = direct.gt(0)

  const setUp = () =>
    run('setup', async () => {
      if (!value || !state) return
      let amountToStake = value
      if (hasDirect) {
        setBusy('unstake')
        await send(UBE_STAKE, STAKING_ABI, 'exit', [], 'Unstake from UBE Stake')
        // the reward in "everything" was an estimate: stake what actually arrived
        const after = (await refetch()).data?.balance ?? state.balance
        amountToStake = value.gte(movable) || value.gt(after) ? after : value
      }
      setBusy('sign')
      const p = await signPermit(amountToStake, state.now)
      setBusy('create')
      if (agent) {
        if (agent.intervalIdx !== freq) {
          await send(agent.address, AGENT_ABI, 'setInterval', [freq], `Set compound interval to ${iv.label}`)
        }
        await send(
          factory,
          FACTORY_ABI,
          'depositWithPermit',
          [amountToStake, p.deadline, p.v, p.r, p.s],
          `Stake ${fmt(amountToStake)} UBE in your stake agent`
        )
      } else {
        await send(
          factory,
          FACTORY_ABI,
          'createAgentWithPermit',
          [freq, amountToStake, p.deadline, p.v, p.r, p.s],
          `Deploy stake agent with ${fmt(amountToStake)} UBE`
        )
      }
      setAmount('')
    })

  let label = agent ? 'Stake in Stake Agent' : 'Deploy Stake Agent'
  if (insufficient) label = 'Insufficient UBE balance'
  if (busy === 'unstake') label = 'Unstaking from UBE Stake…'
  if (busy === 'sign') label = 'Sign the UBE permit in your wallet…'
  if (busy === 'create') label = agent ? 'Staking…' : 'Deploying agent & staking…'

  return (
    <Card>
      <TitleRow>
        <h3>Compound Staking</h3>
        <Badge>New</Badge>
      </TitleRow>
      <Sub>Your UBE rewards are claimed and re-staked for you on a schedule, so they keep earning.</Sub>

      <AmountBox>
        <AmountTop>
          <span>{hasDirect ? 'Amount (wallet + UBE Stake)' : 'Amount'}</span>
          <span>Available: {state ? fmt(movable) : '–'}</span>
        </AmountTop>
        <InputRow>
          <input
            value={amount === '' && movable.gt(0) ? formatUnits(movable, 18) : amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.0"
            aria-label="UBE amount for Compound Staking"
          />
          <Max type="button" onClick={() => setAmount('')}>
            MAX
          </Max>
        </InputRow>
      </AmountBox>

      <Label>Compound frequency</Label>
      <Segmented cols={4}>
        {INTERVALS.map((it, i) => (
          <Segment
            key={it.label}
            selected={i === freq}
            faded={!!state && !!value && !cadence(state, stake, i, false).full}
            disabled={!!busy}
            onClick={() => setFreq(i)}
          >
            {it.label}
            <small>{it.sub}</small>
          </Segment>
        ))}
      </Segmented>

      <Rows>
        <div>
          <dt>Runs by</dt>
          <dd>your compound agent</dd>
        </div>
        <div>
          <dt>First claim &amp; re-stake</dt>
          <dd>{state ? `${when(state.now + (c?.every ?? iv.secs))}` : '–'}</dd>
        </div>
        <div>
          <dt>Est. APY</dt>
          <dd>{c && c.apr ? `${pct(apy(c.apr, c.every))} (APR ${pct(c.apr)})` : '–'}</dd>
        </div>
      </Rows>
      {state && value && c?.every && !c.full && (
        <Hint tone="warn">
          A turn runs only when the reward is at least 10× its gas fee (now ~{fmt(state.turnNeedsUBE, 0)} UBE). At{' '}
          {iv.label.toLowerCase()} this stake skips turns: expect a compound every ~{span(c.every)}.
        </Hint>
      )}

      <Steps>
        {hasDirect && (
          <Step done={false} active={busy === 'unstake'}>
            <span>1</span>
            <span>Unstake from UBE Stake</span>
            <span>{fmt(direct)} UBE + reward</span>
          </Step>
        )}
        <Step done={false} active={busy === 'sign' || busy === 'create'}>
          <span>{hasDirect ? '2' : '1'}</span>
          <span>{agent ? 'Sign & stake in your agent' : 'Sign & deploy agent & stake'}</span>
          <span>no approve needed</span>
        </Step>
      </Steps>

      {account ? (
        <ButtonPrimary disabled={!!busy || !value || value.lte(0) || insufficient || !state} onClick={setUp}>
          {label}
        </ButtonPrimary>
      ) : (
        <ButtonPrimary onClick={toggleAccountDrawer}>Connect Wallet</ButtonPrimary>
      )}
      {error && <Hint tone="error">{error}</Hint>}
    </Card>
  )
}
