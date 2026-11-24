/**
 * One agent's page: balance, results, recent trades, and the owner's controls (pause/resume, extend rent, change
 * tokens, add funds, withdraw profits or everything).
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

import { AddFunds } from './components/AddFunds'
import { AgentAvatar, formatDate, shortenAddr, StatusBadge } from './components/shared'
import { AgentSkeleton, PickerSkeleton, ReadingLine } from './components/Skeleton'
import { TokenPicker } from './components/TokenPicker'
import { amount, Failure, Note, Page, Panel, TokenLogo, usd } from './components/ui'
import { AGENT_ABI, ERC20_ABI, FACTORY_ABI } from './data/abi'
import { agent, agentUsd, AgentView, history, prices, Token, tokens, universe, UNIVERSE_FRESH_MS } from './data/chain'
import { AGENT_FACTORY, agentProvider, CELO_TOKEN, DAY_BLOCKS } from './data/config'
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

const Receive = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  div {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
  }
  b {
    margin-left: auto;
    font-weight: 485;
    color: ${({ theme }) => theme.neutral2};
  }
  div:last-child {
    padding-top: 8px;
    border-top: 1px solid ${({ theme }) => theme.surface3};
    font-weight: 535;
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

/** Sends a transaction and waits for it; true once it landed. */
type Run = (label: string, send: () => Promise<TransactionResponse>) => Promise<boolean>

/** What a withdrawal returns: each token the agent holds, as it holds it. */
type Held = { token: Token; raw: BigNumber; usd: number }

/**
 * Profit the owner may take out, in USD: the agent's trade results at the contract's own valuation, less the CELO it
 * paid for gas and what was withdrawn already (both at today's prices). Deposits are plain transfers the contract
 * doesn't record, so this is the trading result, not "balance minus deposits".
 */
function profitOf(
  net: number,
  h: { refueled: BigNumber; withdrawn: Map<string, BigNumber> },
  v: AgentView,
  px: Map<string, number>
): number {
  const celo = getAddress(CELO_TOKEN)
  const gas = (Number(h.refueled.toString()) / 1e18) * (px.get(celo) ?? 0)
  let out = 0
  for (const [t, raw] of h.withdrawn) {
    const tok = v.tokens.find((x) => x.address === t)
    if (tok) out += (Number(raw.toString()) / 10 ** tok.decimals) * (px.get(t) ?? 0)
  }
  return net - gas - out
}

/** Takes `usdAmount` from one holding: the numeraire if it covers it, else the largest one. */
function profitPick(held: Held[], usdAmount: number, numeraire: string): Held | null {
  if (usdAmount <= 0 || held.length === 0) return null
  const home = held.find((h) => h.token.address === numeraire && h.usd >= usdAmount)
  const from = home ?? [...held].sort((a, b) => b.usd - a.usd)[0]
  if (from.usd <= 0) return null
  const share = Math.min(1, usdAmount / from.usd)
  // a share of the raw balance, in 1e6 steps so the BigNumber math stays exact
  const raw = from.raw.mul(Math.floor(share * 1e6)).div(1e6)
  return raw.gt(0) ? { token: from.token, raw, usd: from.usd * share } : null
}

function heldOf(v: AgentView, px: Map<string, number>): Held[] {
  return v.tokens
    .map((token) => {
      const raw = v.balances.get(token.address) ?? BigNumber.from(0)
      return { token, raw, usd: (Number(raw.toString()) / 10 ** token.decimals) * (px.get(token.address) ?? 0) }
    })
    .filter((h) => h.raw.gt(0))
}

function HeldList({ held }: { held: Held[] }) {
  return (
    <Receive>
      {held.map((h) => (
        <div key={h.token.address}>
          <TokenLogo token={h.token} size={20} />
          {amount(h.raw, h.token.decimals, 4)} {h.token.symbol}
          <b>{usd(h.usd)}</b>
        </div>
      ))}
      <div>
        <Trans>Total</Trans>
        <b>{usd(held.reduce((s, h) => s + h.usd, 0))}</b>
      </div>
    </Receive>
  )
}

function AgentPanel({ address }: { address: string }) {
  const qc = useQueryClient()
  const { account, contract, settle } = useAgentTx()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState<'all' | 'profits' | 'rent' | 'fund' | null>(null)
  /** the holdings shown when "Withdraw all" was opened: the panel keeps them while the page refreshes under it */
  const [closing, setClosing] = useState<Held[] | null>(null)
  /** what the transaction in flight is waiting for, in the user's words */
  const [step, setStep] = useState<string | null>(null)
  /** what the last action did, once it landed */
  const [done, setDone] = useState<string | null>(null)
  /** what the last withdrawal sent to the wallet, as shown when it was confirmed */
  const [received, setReceived] = useState<Held[] | null>(null)

  const q = useQuery({
    queryKey: ['ubeagent', 'agent', address],
    refetchInterval: 30_000,
    queryFn: async () => {
      const p = agentProvider()
      const v = await agent(p, address)
      const factory = new Contract(AGENT_FACTORY, FACTORY_ABI, p)
      const [px, h, block, numeraire] = await Promise.all([
        prices(p, v.tokens),
        history(p, address, CELO_TOKEN),
        p.getBlock('latest'),
        factory.NUMERAIRE(),
      ])
      return { v, px, log: h.trades, h, head: block.number, now: block.timestamp, numeraire: getAddress(numeraire) }
    },
  })

  const run: Run = async (label, send) => {
    setError(null)
    setDone(null)
    setBusy(label)
    setStep(`${label}: confirm in your wallet…`)
    try {
      const tx = await send()
      setStep(`${label}: waiting for the transaction…`)
      await settle(tx, `${label}: the transaction reverted.`)
      await qc.invalidateQueries({ queryKey: ['ubeagent'] })
      await q.refetch()
      return true
    } catch (e) {
      setError(e)
      return false
    } finally {
      setBusy(null)
      setStep(null)
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
          <AgentSkeleton label={<Trans>Reading the agent from chain…</Trans>} />
        ) : (
          <Failure error={q.error} />
        )}
      </Page>
    )
  }
  const { v, px, log, h, head, now, numeraire } = q.data
  const mine = !!account && getAddress(account) === v.owner
  const total = agentUsd(v, px)
  // valueIn/valueOut are the contract's own reference valuation (USD₮, 6 decimals), before gas
  const net = (xs: typeof log) => xs.reduce((s, t) => s + Number(t.valueOut.sub(t.valueIn).toString()) / 1e6, 0)
  const lastDay = log.filter((t) => t.block + DAY_BLOCKS >= head)
  const empty = v.tokens.every((t) => (v.balances.get(t.address) ?? BigNumber.from(0)).isZero())
  const closed = v.paused && empty
  const status: AgentStatus = v.paidUntil < now ? 'stopped' : closed ? 'closed' : v.paused ? 'paused' : 'running'
  const cap = v.totalValue ? (Number(v.totalValue.toString()) * v.lossBps) / 1e4 / 2 : null
  const used = cap ? Math.min(1, Number(v.lossUsed.toString()) / cap) : 0
  const symbol = (t: string) => v.tokens.find((x) => x.address === t)?.symbol ?? shortenAddr(t)
  const tokenOf = (t: string) => v.tokens.find((x) => x.address === t)
  const held = heldOf(v, px)
  const profit = profitOf(net(log), h, v, px)
  // below a cent there is nothing worth a transaction
  const profitTake = profit >= 0.01 ? profitPick(held, profit, numeraire) : null

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
          {held.map((h) => (
            <span key={h.token.address}>
              <TokenLogo token={h.token} size={16} />
              {amount(h.raw, h.token.decimals, 2)} {h.token.symbol} · {usd(h.usd)}
            </span>
          ))}
          {held.length === 0 && <Trans>Empty</Trans>}
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
              <Trans>Trades since start</Trans>
            </small>
            {log.length}
          </Stat>
          <Stat>
            <small>
              <Trans>Trades, last 24 h</Trans>
            </small>
            {lastDay.length}
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

      {received && (
        <Note tone="good">
          Sent to your wallet:{' '}
          {received.map((h) => `${amount(h.raw, h.token.decimals, 4)} ${h.token.symbol}`).join(' + ')} (
          {usd(received.reduce((s, h) => s + h.usd, 0))} at withdrawal).
        </Note>
      )}
      {mine && confirming === 'rent' && (
        <RentConfirm
          owner={account}
          pools={v.pools}
          paidUntil={v.paidUntil}
          now={now}
          busy={!!busy}
          cancel={() => setConfirming(null)}
          confirm={async (quote) => {
            if (await run('Extend rent', () => extendRent(address, v.pools, account))) {
              setConfirming(null)
              setDone(
                `Rent extended to ${formatDate(quote.until * 1000)} · paid ${amount(
                  quote.price,
                  quote.token.decimals
                )} ${quote.token.symbol}.`
              )
            }
          }}
        />
      )}
      {mine && confirming === 'profits' && profitTake && (
        <Panel>
          <ThemedText.SubHeader>
            <Trans>You’ll receive</Trans>
          </ThemedText.SubHeader>
          <HeldList held={[profitTake]} />
          <ThemedText.BodySmall color="neutral2">
            <Trans>
              Profit is the agent’s trade results since it started, less the gas it paid and what you already took out.
              The rest stays in the agent and keeps trading.
            </Trans>
          </ThemedText.BodySmall>
          <Actions>
            <ButtonSecondary disabled={!!busy} onClick={() => setConfirming(null)}>
              <Trans>Cancel</Trans>
            </ButtonSecondary>
            <ButtonPrimary
              disabled={!!busy}
              onClick={async () => {
                const snapshot = [profitTake]
                if (
                  await run('Withdraw profits', async () =>
                    (await contract(address, AGENT_ABI)).withdraw(profitTake.token.address, profitTake.raw)
                  )
                ) {
                  setReceived(snapshot)
                  setConfirming(null)
                }
              }}
            >
              {busy === 'Withdraw profits' ? '…' : <Trans>Withdraw profits</Trans>}
            </ButtonPrimary>
          </Actions>
        </Panel>
      )}
      {mine && confirming === 'all' && (
        <Panel>
          <ThemedText.SubHeader>
            <Trans>You’ll receive</Trans>
          </ThemedText.SubHeader>
          {(closing ?? held).length > 0 ? (
            <HeldList held={closing ?? held} />
          ) : (
            <ThemedText.BodySecondary>
              <Trans>The agent holds nothing; closing only stops it.</Trans>
            </ThemedText.BodySecondary>
          )}
          <ThemedText.BodySmall color="neutral2">
            <Trans>
              Each token comes back to your wallet as the agent holds it; nothing is swapped. The agent stops trading.
              Dollar values are at the reference price now.
            </Trans>
          </ThemedText.BodySmall>
          <Actions>
            <ButtonSecondary disabled={!!busy} onClick={() => setConfirming(null)}>
              <Trans>Cancel</Trans>
            </ButtonSecondary>
            <ButtonPrimary
              disabled={!!busy}
              onClick={async () => {
                const snapshot = closing ?? held
                if (await run('Withdraw all', async () => (await contract(address, AGENT_ABI)).close())) {
                  setReceived(snapshot)
                  setConfirming(null)
                }
              }}
            >
              {busy === 'Withdraw all' ? '…' : <Trans>Withdraw all and close</Trans>}
            </ButtonPrimary>
          </Actions>
        </Panel>
      )}
      {mine && confirming === 'fund' && (
        <AddFunds
          agentAddr={address}
          tokens={v.tokens}
          px={px}
          closed={closed}
          busy={!!busy}
          run={run}
          setStep={setStep}
          done={(m) => {
            setConfirming(null)
            setDone(m)
          }}
          cancel={() => setConfirming(null)}
        />
      )}
      {mine && !editing && !confirming && closed && (
        <>
          <ThemedText.BodySmall color="neutral2">
            <Trans>
              This agent is closed: its funds went back to your wallet and it doesn’t trade. Fund it again to restart it
              with the same tokens.
            </Trans>
          </ThemedText.BodySmall>
          <ButtonPrimary disabled={!!busy} onClick={() => setConfirming('fund')}>
            <Trans>Fund again</Trans>
          </ButtonPrimary>
        </>
      )}
      {mine && !editing && !confirming && !closed && (
        <Actions>
          <ButtonSecondary disabled={!!busy || !profitTake} onClick={() => setConfirming('profits')}>
            {profitTake ? (
              <>
                <Trans>Withdraw profits</Trans> · {usd(profitTake.usd)}
              </>
            ) : (
              <Trans>No profit to withdraw yet</Trans>
            )}
          </ButtonSecondary>
          <ButtonSecondary
            disabled={!!busy}
            onClick={async () => {
              const resume = v.paused
              if (
                await run(resume ? 'Resume' : 'Pause', async () =>
                  (await contract(address, AGENT_ABI)).setPaused(!resume)
                )
              ) {
                setDone(
                  resume
                    ? 'Agent running again: it trades from the next opportunity.'
                    : 'Agent paused: nothing trades it until you resume. Your funds stay in it.'
                )
              }
            }}
          >
            {busy === 'Pause' || busy === 'Resume' ? '…' : v.paused ? <Trans>Resume</Trans> : <Trans>Pause</Trans>}
          </ButtonSecondary>
          <ButtonSecondary
            disabled={!!busy}
            onClick={() => {
              setClosing(held)
              setConfirming('all')
            }}
          >
            <Trans>Withdraw all and close</Trans>
          </ButtonSecondary>
          <ButtonSecondary disabled={!!busy} onClick={() => setConfirming('rent')}>
            <Trans>Extend rent 1 month</Trans>
          </ButtonSecondary>
          <ButtonSecondary disabled={!!busy} onClick={() => setEditing(true)}>
            <Trans>Change tokens</Trans>
          </ButtonSecondary>
          <ButtonSecondary disabled={!!busy} onClick={() => setConfirming('fund')}>
            <Trans>Add funds</Trans>
          </ButtonSecondary>
        </Actions>
      )}
      {mine && editing && (
        <EditPools
          current={v.pools}
          paidUntil={v.paidUntil}
          busy={!!busy}
          done={() => setEditing(false)}
          save={async (pools) => {
            let paid = ''
            const ok = await run('Save tokens', async () => {
              paid = await payWidening(v.pools, pools, v.paidUntil, account)
              setStep('Save tokens: confirm the new selection in your wallet…')
              return (await contract(address, AGENT_ABI)).setPools(pools, v.configVersion)
            })
            if (ok) setDone(`Tokens saved: the agent trades ${pools.length} pools now${paid ? ` · paid ${paid}` : ''}.`)
            return ok
          }}
        />
      )}
      {busy && step && <ReadingLine>{step}</ReadingLine>}
      {done && !busy && <Note tone="good">{done}</Note>}
      {mine && !editing && !confirming && !profitTake && held.length > 0 && (
        <ThemedText.BodySmall color="neutral2">
          {profit > 0
            ? `Profit so far ${usd(profit, { digits: 4 })} · withdrawable from $0.01 (after gas).`
            : profit < 0
            ? `No profit to take: results so far are ${usd(-profit, {
                digits: 4,
              })} below the gas paid and earlier withdrawals.`
            : 'No profit yet.'}
        </ThemedText.BodySmall>
      )}
      <Failure error={error} />
      <ThemedText.BodySmall color="neutral3">
        <Trans>Updated</Trans> {new Date(now * 1000).toLocaleTimeString()} · block #{head}
      </ThemedText.BodySmall>
    </Page>
  )

  /** A selection with a higher rent costs the difference for the time already paid: approve it to the factory. */
  /** Approves the rent difference a wider selection costs; returns it in words ("0.2 USD₮ rent difference"), or ''. */
  async function payWidening(old: string[], pools: string[], paidUntil: number, owner: string | undefined) {
    if (!owner) throw new Error('Connect a wallet first.')
    const reader = new Contract(AGENT_FACTORY, FACTORY_ABI, agentProvider())
    const due: BigNumber = await reader.selectionCharge(old, pools, paidUntil)
    if (due.isZero()) return ''
    const numeraire = getAddress(await reader.NUMERAIRE())
    const tok = (await tokens(agentProvider(), [numeraire])).get(numeraire) as Token
    const words = `${amount(due, tok.decimals)} ${tok.symbol} rent difference`
    const erc20 = await contract(numeraire, ERC20_ABI)
    if ((await erc20.allowance(owner, AGENT_FACTORY)).lt(due)) {
      setStep(`Approve ${words} in your wallet…`)
      await settle(await erc20.approve(AGENT_FACTORY, due), 'The approval for the rent difference reverted.')
    }
    return words
  }

  /** One more month of rent in the factory's numeraire, at the current selection's price: approval first when short. */
  async function extendRent(
    agentAddr: string,
    pools: string[],
    owner: string | undefined
  ): Promise<TransactionResponse> {
    if (!owner) throw new Error('Connect a wallet first.')
    const factoryAddr = AGENT_FACTORY
    const reader = new Contract(factoryAddr, FACTORY_ABI, agentProvider())
    const token: string = await reader.NUMERAIRE()
    const price: BigNumber = await reader.rentFor(pools, token)
    const erc20 = await contract(token, ERC20_ABI)
    if ((await erc20.allowance(owner, factoryAddr)).lt(price)) {
      setStep('Extend rent: approve the rent in your wallet (1 of 2)…')
      await settle(await erc20.approve(factoryAddr, price), 'The rent approval reverted.')
      setStep('Extend rent: confirm the extension in your wallet (2 of 2)…')
    }
    return (await contract(factoryAddr, FACTORY_ABI)).extendRent(agentAddr, 1, token)
  }
}

function EditPools({
  current,
  paidUntil,
  busy,
  done,
  save,
}: {
  current: string[]
  paidUntil: number
  busy: boolean
  done: () => void
  save: (pools: string[]) => Promise<boolean>
}) {
  const q = useQuery({
    queryKey: ['ubeagent', 'universe'],
    queryFn: () => universe(agentProvider()),
    staleTime: UNIVERSE_FRESH_MS,
  })
  const [sel, setSel] = useState<Selection | null>(null)
  if (!q.data) {
    return q.error ? <Failure error={q.error} /> : <PickerSkeleton label={<Trans>Reading pools from chain…</Trans>} />
  }
  const s = sel ?? selectionOf(q.data, current)
  const chosen = withReferences(q.data, pickedPools(q.data, s))
  return (
    <>
      <TokenPicker all={q.data} sel={s} setSel={setSel} />
      <SelectionRent current={current} next={chosen.map((p) => p.pool)} paidUntil={paidUntil} />
      <Actions>
        <ButtonSecondary onClick={done}>
          <Trans>Cancel</Trans>
        </ButtonSecondary>
        <ButtonPrimary
          disabled={busy || chosen.length === 0}
          onClick={() => save(chosen.map((p) => p.pool)).then((ok) => ok && done())}
        >
          <Trans>Save</Trans> ({chosen.length} <Trans>pools</Trans>)
        </ButtonPrimary>
      </Actions>
    </>
  )
}

/** The new selection's monthly rent and, when it costs more, the difference due for the time already paid. */
function SelectionRent({ current, next, paidUntil }: { current: string[]; next: string[]; paidUntil: number }) {
  const q = useQuery({
    queryKey: ['ubeagent', 'selectionRent', current.join(), next.join(), paidUntil],
    enabled: next.length > 0,
    queryFn: async () => {
      const f = new Contract(AGENT_FACTORY, FACTORY_ABI, agentProvider())
      const numeraire = getAddress(await f.NUMERAIRE())
      const [perMonth, due, toks] = await Promise.all([
        f.rentFor(next, numeraire) as Promise<BigNumber>,
        f.selectionCharge(current, next, paidUntil) as Promise<BigNumber>,
        tokens(agentProvider(), [numeraire]),
      ])
      return { perMonth, due, token: toks.get(numeraire) as Token }
    },
  })
  if (!q.data) return null
  const { perMonth, due, token } = q.data
  return (
    <Note>
      Rent for this selection: {amount(perMonth, token.decimals)} {token.symbol}/month.
      {due.gt(0) && ` Saving costs ${amount(due, token.decimals)} ${token.symbol} for the time already paid.`}
    </Note>
  )
}

type RentQuote = { price: BigNumber; token: Token; until: number; wallet: BigNumber | null }

/** One more month of rent: what it costs at this selection's price and the date it pays up to, before anything is sent. */
function RentConfirm({
  owner,
  pools,
  paidUntil,
  now,
  busy,
  cancel,
  confirm,
}: {
  owner: string | undefined
  pools: string[]
  paidUntil: number
  now: number
  busy: boolean
  cancel: () => void
  confirm: (q: RentQuote) => Promise<void>
}) {
  const q = useQuery({
    queryKey: ['ubeagent', 'rentQuote', pools.join(), paidUntil, owner],
    queryFn: async (): Promise<RentQuote> => {
      const f = new Contract(AGENT_FACTORY, FACTORY_ABI, agentProvider())
      const numeraire = getAddress(await f.NUMERAIRE())
      const [price, toks, wallet] = await Promise.all([
        f.rentFor(pools, numeraire) as Promise<BigNumber>,
        tokens(agentProvider(), [numeraire]),
        owner ? (new Contract(numeraire, ERC20_ABI, agentProvider()).balanceOf(owner) as Promise<BigNumber>) : null,
      ])
      // the factory extends from the paid-up date, or from now when rent already ran out
      return { price, token: toks.get(numeraire) as Token, until: Math.max(paidUntil, now) + 30 * 86400, wallet }
    },
  })
  const short = !!q.data?.wallet && q.data.wallet.lt(q.data.price)
  return (
    <Panel>
      <ThemedText.SubHeader>
        <Trans>Extend rent by 1 month</Trans>
      </ThemedText.SubHeader>
      {q.data ? (
        <Receive>
          <div>
            <Trans>You pay</Trans>
            <b>
              {amount(q.data.price, q.data.token.decimals)} {q.data.token.symbol}
            </b>
          </div>
          <div>
            <Trans>Rent paid until</Trans>
            <b>
              {formatDate(paidUntil * 1000)} → {formatDate(q.data.until * 1000)}
            </b>
          </div>
        </Receive>
      ) : q.error ? (
        <Failure error={q.error} />
      ) : (
        <ReadingLine>
          <Trans>Reading the rent…</Trans>
        </ReadingLine>
      )}
      {short && q.data && (
        <Note tone="warn">
          Your wallet holds {amount(q.data.wallet as BigNumber, q.data.token.decimals)} {q.data.token.symbol}; one month
          costs {amount(q.data.price, q.data.token.decimals)} {q.data.token.symbol}.
        </Note>
      )}
      <ThemedText.BodySmall color="neutral2">
        <Trans>
          The price is this agent’s current selection: up to 2 exchanges and 2 tokens pay the basic rent. Up to two
          signatures: the rent approval (when needed), then the extension.
        </Trans>
      </ThemedText.BodySmall>
      <Actions>
        <ButtonSecondary disabled={busy} onClick={cancel}>
          <Trans>Cancel</Trans>
        </ButtonSecondary>
        <ButtonPrimary disabled={busy || !q.data || short} onClick={() => q.data && confirm(q.data)}>
          {busy ? '…' : q.data ? `Pay ${amount(q.data.price, q.data.token.decimals)} ${q.data.token.symbol}` : '…'}
        </ButtonPrimary>
      </Actions>
    </Panel>
  )
}
