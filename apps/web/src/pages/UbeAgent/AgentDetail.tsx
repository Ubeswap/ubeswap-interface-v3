/**
 * One agent's page: balance, results, recent trades, and the owner's controls (pause/resume, extend rent, change
 * tokens, update to the factory's latest version, withdraw everything and close).
 */
import { getAddress, isAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { TransactionResponse } from '@ethersproject/providers'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ButtonPrimary, ButtonSecondary } from 'components/Button'
import { Trans } from 'i18n'
import { useState } from 'react'
import { ArrowLeft } from 'react-feather'
import { useParams } from 'react-router-dom'
import styled from 'styled-components'
import { ExternalLink, StyledInternalLink, ThemedText } from 'theme/components'

import { AgentAvatar, formatDate, shortenAddr, StatusBadge } from './components/shared'
import { TokenPicker } from './components/TokenPicker'
import { amount, Failure, Note, Page, Panel, TokenLogo, usd } from './components/ui'
import { AGENT_ABI, ERC20_ABI, FACTORY_ABI } from './data/abi'
import { agent, agentUsd, prices, trades, universe } from './data/chain'
import { AGENT_FACTORY, agentProvider, DAY_BLOCKS } from './data/config'
import { picked as pickedPools, Selection, selectionOf, withReferences } from './data/selection'
import { useAgentTx } from './data/useAgentTx'
import { AgentStatus } from './data/useUserAgents'

const Back = styled(StyledInternalLink)`
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
`

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
`

const Stat = styled.div<{ $tone?: 'good' | 'bad' }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 18px;
  font-weight: 535;
  color: ${({ theme, $tone }) =>
    $tone === 'good' ? theme.success : $tone === 'bad' ? theme.critical : theme.neutral1};

  small {
    font-size: 12px;
    font-weight: 485;
    color: ${({ theme }) => theme.neutral2};
  }
`

const Holdings = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 13px;
  color: ${({ theme }) => theme.neutral2};

  span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
`

const TradeList = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.surface3};
  overflow: hidden;
`

const TradeRow = styled(ExternalLink)<{ $tone: 'good' | 'bad' }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 0 14px;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral1};
  border-bottom: 1px solid ${({ theme }) => theme.surface3};

  &:last-child {
    border-bottom: none;
  }
  em {
    width: 64px;
    font-style: normal;
    font-size: 12px;
    color: ${({ theme }) => theme.neutral3};
  }
  b {
    margin-left: auto;
    font-weight: 535;
    color: ${({ theme, $tone }) => ($tone === 'good' ? theme.success : theme.critical)};
  }
`

const Actions = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

export default function AgentDetail() {
  const { address } = useParams<{ address: string }>()
  if (!address || !isAddress(address)) {
    return (
      <Page>
        <Back to="/ubeagent">
          <ArrowLeft size={16} />
          <Trans>Back to your agents</Trans>
        </Back>
        <Note tone="warn">This isn’t an agent address.</Note>
      </Page>
    )
  }
  return <AgentPanel address={getAddress(address)} />
}

type Run = (label: string, send: () => Promise<TransactionResponse>) => Promise<void>

function AgentPanel({ address }: { address: string }) {
  const qc = useQueryClient()
  const { account, contract, settle } = useAgentTx()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState(false)

  const q = useQuery({
    queryKey: ['ubeagent', 'agent', address],
    refetchInterval: 30_000,
    queryFn: async () => {
      const p = agentProvider()
      const v = await agent(p, address)
      const [px, log, block] = await Promise.all([prices(p, v.tokens), trades(p, address), p.getBlock('latest')])
      return { v, px, log, head: block.number, now: block.timestamp }
    },
  })

  const run: Run = async (label, send) => {
    setError(null)
    setBusy(label)
    try {
      await settle(await send(), `${label}: the transaction reverted.`)
      await qc.invalidateQueries({ queryKey: ['ubeagent'] })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(null)
    }
  }

  if (q.isLoading || !q.data) {
    return (
      <Page>
        <Back to="/ubeagent">
          <ArrowLeft size={16} />
          <Trans>Back to your agents</Trans>
        </Back>
        {q.isLoading ? (
          <ThemedText.BodySecondary>
            <Trans>Reading from chain…</Trans>
          </ThemedText.BodySecondary>
        ) : (
          <Failure error={q.error} />
        )}
      </Page>
    )
  }
  const { v, px, log, head, now } = q.data
  const mine = !!account && getAddress(account) === v.owner
  const total = agentUsd(v, px)
  // valueIn/valueOut are the contract's own reference valuation (USD₮, 6 decimals), before gas
  const net = (xs: typeof log) => xs.reduce((s, t) => s + Number(t.valueOut.sub(t.valueIn).toString()) / 1e6, 0)
  const lastDay = log.filter((t) => t.block + DAY_BLOCKS >= head)
  const status: AgentStatus = v.paidUntil < now ? 'stopped' : v.paused ? 'paused' : 'running'
  const cap = v.totalValue ? (Number(v.totalValue.toString()) * v.lossBps) / 1e4 / 2 : null
  const used = cap ? Math.min(1, Number(v.lossUsed.toString()) / cap) : 0
  const symbol = (t: string) => v.tokens.find((x) => x.address === t)?.symbol ?? shortenAddr(t)
  const tokenOf = (t: string) => v.tokens.find((x) => x.address === t)

  return (
    <Page>
      <Back to="/ubeagent">
        <ArrowLeft size={16} />
        <Trans>Back to your agents</Trans>
      </Back>
      <Head>
        <AgentAvatar seed={address} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ThemedText.HeadlineSmall>
            <Trans>Agent</Trans> {shortenAddr(address)}
          </ThemedText.HeadlineSmall>
          <ThemedText.BodySmall color="neutral2">
            <Trans>Rent paid until</Trans> {formatDate(v.paidUntil * 1000)}
          </ThemedText.BodySmall>
        </div>
        <StatusBadge status={status} />
      </Head>
      {!mine && <Note>This agent isn’t owned by your wallet; you are only viewing it.</Note>}

      <Panel>
        <ThemedText.BodySecondary>
          <Trans>Balance</Trans>
        </ThemedText.BodySecondary>
        <ThemedText.HeadlineLarge>{usd(total)}</ThemedText.HeadlineLarge>
        <Holdings>
          {v.tokens
            .filter((t) => (v.balances.get(t.address) ?? BigNumber.from(0)).gt(0))
            .map((t) => (
              <span key={t.address}>
                <TokenLogo token={t} size={16} />
                {amount(v.balances.get(t.address) as BigNumber, t.decimals, 2)} {t.symbol}
              </span>
            ))}
          {v.tokens.every((t) => (v.balances.get(t.address) ?? BigNumber.from(0)).isZero()) && <Trans>Empty</Trans>}
        </Holdings>
        <Stats>
          <Stat $tone={net(log) >= 0 ? 'good' : 'bad'}>
            <small>
              <Trans>Since start (before gas)</Trans>
            </small>
            {usd(net(log), { sign: true, digits: 4 })}
          </Stat>
          <Stat $tone={net(lastDay) >= 0 ? 'good' : 'bad'}>
            <small>
              <Trans>Last 24 h (before gas)</Trans>
            </small>
            {usd(net(lastDay), { sign: true, digits: 4 })}
          </Stat>
          <Stat>
            <small>
              <Trans>Trades, last 24 h</Trans>
            </small>
            {lastDay.length}
          </Stat>
          <Stat $tone={used >= 1 ? 'bad' : undefined}>
            <small>
              <Trans>Daily loss budget</Trans>
            </small>
            {cap === null ? 'unreadable' : `${Math.round(used * 100)}% used`}
          </Stat>
        </Stats>
      </Panel>
      {used >= 1 && (
        <Note tone="warn">
          Daily loss budget used up: the agent makes no trade that could lose; the budget frees up again over the day.
        </Note>
      )}
      {v.totalValue === null && (
        <Note tone="warn">The reference price is far from its average right now; trading waits until it settles.</Note>
      )}
      {mine && v.implementation !== v.latest && (
        <Panel>
          <ThemedText.SubHeader>
            <Trans>A new version is available</Trans>
          </ThemedText.SubHeader>
          <ThemedText.BodySmall color="neutral2">
            <Trans>
              Updating is your call: the factory can’t apply any change to your agent without your approval.
            </Trans>
          </ThemedText.BodySmall>
          <ButtonSecondary
            disabled={!!busy}
            onClick={() => run('Update', async () => (await contract(address, AGENT_ABI)).update(v.configVersion))}
          >
            <Trans>Update</Trans>
          </ButtonSecondary>
        </Panel>
      )}

      <ThemedText.SubHeader>
        <Trans>Recent trades</Trans>
      </ThemedText.SubHeader>
      {log.length === 0 ? (
        <ThemedText.BodySecondary>
          <Trans>No trades yet.</Trans>
        </ThemedText.BodySecondary>
      ) : (
        <TradeList>
          {log.slice(0, 20).map((t) => {
            const n = Number(t.valueOut.sub(t.valueIn).toString()) / 1e6
            const tin = tokenOf(t.tokenIn)
            const tout = tokenOf(t.tokenOut)
            return (
              <TradeRow key={t.tx} href={`https://celoscan.io/tx/${t.tx}`} $tone={n >= 0 ? 'good' : 'bad'}>
                <em>#{String(t.block).slice(-6)}</em>
                {tin && <TokenLogo token={tin} size={16} />}
                {symbol(t.tokenIn)} → {tout && <TokenLogo token={tout} size={16} />}
                {symbol(t.tokenOut)}
                <b>{usd(n, { sign: true, digits: 4 })}</b>
              </TradeRow>
            )
          })}
        </TradeList>
      )}
      <ThemedText.BodySmall color="neutral2">
        <Trans>
          Values at the contract’s reference price, before gas. Reverted attempts aren’t recorded on the agent.
        </Trans>
      </ThemedText.BodySmall>

      {mine && !editing && (
        <Actions>
          <ButtonSecondary
            disabled={!!busy}
            onClick={() =>
              run(v.paused ? 'Resume' : 'Pause', async () => (await contract(address, AGENT_ABI)).setPaused(!v.paused))
            }
          >
            {busy === 'Pause' || busy === 'Resume' ? '…' : v.paused ? <Trans>Resume</Trans> : <Trans>Pause</Trans>}
          </ButtonSecondary>
          <ButtonSecondary
            disabled={!!busy}
            onClick={() => run('Withdraw all', async () => (await contract(address, AGENT_ABI)).close())}
          >
            {busy === 'Withdraw all' ? '…' : <Trans>Withdraw all and close</Trans>}
          </ButtonSecondary>
          <ButtonSecondary disabled={!!busy} onClick={() => run('Extend rent', () => extendRent(address, account))}>
            {busy === 'Extend rent' ? '…' : <Trans>Extend rent 1 month</Trans>}
          </ButtonSecondary>
          <ButtonSecondary disabled={!!busy} onClick={() => setEditing(true)}>
            <Trans>Change tokens</Trans>
          </ButtonSecondary>
        </Actions>
      )}
      {mine && editing && (
        <EditPools
          current={v.pools}
          busy={!!busy}
          done={() => setEditing(false)}
          save={(pools) =>
            run('Save tokens', async () => (await contract(address, AGENT_ABI)).setPools(pools, v.configVersion))
          }
        />
      )}
      <Failure error={error} />
      <ThemedText.BodySmall color="neutral3">
        <Trans>Updated</Trans> {new Date(now * 1000).toLocaleTimeString()} · block #{head}
      </ThemedText.BodySmall>
    </Page>
  )

  /** One more month of rent in the factory's numeraire: approval first when the allowance is short. */
  async function extendRent(agentAddr: string, owner: string | undefined): Promise<TransactionResponse> {
    if (!owner) throw new Error('Connect a wallet first.')
    const factoryAddr = AGENT_FACTORY
    const reader = new Contract(factoryAddr, FACTORY_ABI, agentProvider())
    const token: string = await reader.NUMERAIRE()
    const price: BigNumber = await reader.rentPerMonth(token)
    const erc20 = await contract(token, ERC20_ABI)
    if ((await erc20.allowance(owner, factoryAddr)).lt(price)) {
      await settle(await erc20.approve(factoryAddr, price), 'The rent approval reverted.')
    }
    return (await contract(factoryAddr, FACTORY_ABI)).extendRent(agentAddr, 1, token)
  }
}

function EditPools({
  current,
  busy,
  done,
  save,
}: {
  current: string[]
  busy: boolean
  done: () => void
  save: (pools: string[]) => Promise<void>
}) {
  const q = useQuery({ queryKey: ['ubeagent', 'universe'], queryFn: () => universe(agentProvider()) })
  const [sel, setSel] = useState<Selection | null>(null)
  if (!q.data) {
    return q.error ? (
      <Failure error={q.error} />
    ) : (
      <ThemedText.BodySecondary>
        <Trans>Reading pools…</Trans>
      </ThemedText.BodySecondary>
    )
  }
  const s = sel ?? selectionOf(q.data, current)
  const chosen = withReferences(q.data, pickedPools(q.data, s))
  return (
    <>
      <TokenPicker all={q.data} sel={s} setSel={setSel} />
      <Actions>
        <ButtonSecondary onClick={done}>
          <Trans>Cancel</Trans>
        </ButtonSecondary>
        <ButtonPrimary
          disabled={busy || chosen.length === 0}
          onClick={() => save(chosen.map((p) => p.pool)).then(done)}
        >
          <Trans>Save</Trans> ({chosen.length} <Trans>pools</Trans>)
        </ButtonPrimary>
      </Actions>
    </>
  )
}
