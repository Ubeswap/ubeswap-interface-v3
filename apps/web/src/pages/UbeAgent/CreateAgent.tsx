/**
 * Create a UbeAgent: pick the exchanges and tokens it may trade, then the deposit and the rent term. Up to three
 * signatures: rent approval, opening the agent (AgentFactory.createAgent), the deposit (a plain transfer to the agent).
 */
import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { useQuery } from '@tanstack/react-query'
import { ButtonPrimary } from 'components/Button'
import { parseUnits } from 'ethers/lib/utils'
import { Trans } from 'i18n'
import { useMemo, useState } from 'react'
import { ArrowLeft } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { StyledInternalLink, ThemedText } from 'theme/components'

import { ConnectWalletButton } from './components/actions'
import { AgentIllustration } from './components/shared'
import { TokenPicker } from './components/TokenPicker'
import { amount, Chip, Chips, Failure, Note, Page, Panel, Row, TokenLogo, usd } from './components/ui'
import { ERC20_ABI, FACTORY_ABI } from './data/abi'
import { PoolInfo, prices, Token, tokens, universe } from './data/chain'
import { AGENT_FACTORY, agentProvider, CELO_TOKEN, HIGH_USD, IDEAL_USD, MIN_USD } from './data/config'
import { emptySelection, picked as pickedPools, Selection, withReferences } from './data/selection'
import { useAgentTx } from './data/useAgentTx'

export const AGENT_PATH = (address: string) => `/ubeagent/${address}`

const Back = styled(StyledInternalLink)`
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
`

const AmountBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 56px;
  padding: 0 14px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.surface3};
  background: ${({ theme }) => theme.surface1};

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    background: transparent;
    color: ${({ theme }) => theme.neutral1};
    font-family: inherit;
    font-size: 22px;
    font-weight: 535;
  }
`

const Consent = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13px;
  line-height: 20px;
  color: ${({ theme }) => theme.neutral2};
  cursor: pointer;

  input {
    margin: 2px 0 0;
    width: 18px;
    height: 18px;
    accent-color: ${({ theme }) => theme.accent1};
  }
`

export default function CreateAgent() {
  const { account } = useAgentTx()
  const [step, setStep] = useState<'pools' | 'fund'>('pools')
  const [sel, setSel] = useState<Selection>(emptySelection)
  const q = useQuery({
    queryKey: ['ubeagent', 'universe'],
    queryFn: () => universe(agentProvider()),
  })

  const all = q.data ?? []
  const picked = pickedPools(all, sel)
  const chosen = withReferences(all, picked)

  if (!account) {
    return (
      <Page style={{ alignItems: 'center', textAlign: 'center' }}>
        <AgentIllustration width={260} />
        <ThemedText.HeadlineMedium>
          <Trans>Create new agent</Trans>
        </ThemedText.HeadlineMedium>
        <ThemedText.BodySecondary>
          <Trans>Connect your wallet to create an agent.</Trans>
        </ThemedText.BodySecondary>
        <ConnectWalletButton />
        <Back to="/ubeagent">
          <ArrowLeft size={16} />
          <Trans>Back to your agents</Trans>
        </Back>
      </Page>
    )
  }

  if (step === 'fund') {
    // the deposit is made in a token the user picked (hand-picked pools: any token they hold)
    return (
      <Fund owner={account} pools={chosen} only={sel.manual ? undefined : sel.tokens} back={() => setStep('pools')} />
    )
  }
  return (
    <Page>
      <Back to="/ubeagent">
        <ArrowLeft size={16} />
        <Trans>Back to your agents</Trans>
      </Back>
      <ThemedText.HeadlineMedium>
        <Trans>Create new agent</Trans>
      </ThemedText.HeadlineMedium>
      <ThemedText.BodySecondary>
        <Trans>
          Pick the exchanges and the tokens your agent may hold. It trades every pool between those tokens on those
          exchanges.
        </Trans>
      </ThemedText.BodySecondary>
      {q.isLoading && (
        <ThemedText.BodySecondary>
          <Trans>Reading pools from chain…</Trans>
        </ThemedText.BodySecondary>
      )}
      <Failure error={q.error} />
      {q.data && <TokenPicker all={all} sel={sel} setSel={setSel} />}
      <Panel>
        <Row label={<Trans>Pools traded</Trans>} value={String(picked.size)} />
        <Row
          label={<Trans>Reference pools (for rebalancing, added automatically)</Trans>}
          value={String(chosen.length - picked.size)}
        />
      </Panel>
      <ButtonPrimary disabled={picked.size === 0} onClick={() => setStep('fund')}>
        <Trans>Next: add funds</Trans>
      </ButtonPrimary>
    </Page>
  )
}

type Phase = 'idle' | 'approve' | 'create' | 'deposit'

function Fund({
  owner,
  pools,
  only,
  back,
}: {
  owner: string
  pools: PoolInfo[]
  only?: Set<string>
  back: () => void
}) {
  const navigate = useNavigate()
  const { contract, signer, settle } = useAgentTx()
  const held = useMemo(() => {
    const m = new Map<string, Token>()
    for (const p of pools) for (const t of [p.token0, p.token1]) if (!only || only.has(t.address)) m.set(t.address, t)
    return [...m.values()]
  }, [pools, only])
  const [tokenAddr, setToken] = useState<string>(held[0]?.address)
  const [usdText, setUsd] = useState('50')
  const [months, setMonths] = useState(1)
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<unknown>(null)

  const q = useQuery({
    queryKey: ['ubeagent', 'fund', owner, held.map((t) => t.address).join()],
    queryFn: async () => {
      const p = agentProvider()
      const factory = new Contract(AGENT_FACTORY, [...FACTORY_ABI], p)
      const numeraire = getAddress(await factory.NUMERAIRE())
      const candidates = [numeraire, getAddress(CELO_TOKEN)]
      const perMonth: BigNumber[] = await Promise.all(candidates.map((t) => factory.rentPerMonth(t)))
      const rentToks = await tokens(p, candidates)
      const rent = candidates
        .map((t, i) => ({ token: rentToks.get(t) as Token, perMonth: perMonth[i] }))
        .filter((r) => r.perMonth.gt(0))
      const px = await prices(p, [...held, ...rent.map((r) => r.token)])
      const wallet: BigNumber[] = await Promise.all(
        held.map((t) =>
          t.address === getAddress(CELO_TOKEN)
            ? p.getBalance(owner) // CELO's ERC20 balance is the native one
            : new Contract(t.address, ERC20_ABI, p).balanceOf(owner)
        )
      )
      const version: BigNumber = await factory.configVersion()
      return { rent, px, wallet: new Map(held.map((t, i) => [t.address, wallet[i]])), version }
    },
  })

  const token = held.find((t) => t.address === tokenAddr) ?? held[0]
  const dollars = Number(usdText.replace(',', '.')) || 0
  const price = q.data?.px.get(token.address)
  // from a decimal string: a float times 10^decimals passes 2^53, which BigNumber refuses
  const units =
    price && dollars > 0
      ? parseUnits((dollars / price).toFixed(Math.min(token.decimals, 12)), token.decimals)
      : BigNumber.from(0)
  const rent = q.data?.rent[0]
  const rentAmount = rent ? rent.perMonth.mul(months) : BigNumber.from(0)
  const have = q.data?.wallet.get(token.address) ?? BigNumber.from(0)
  const rentFromSame = rent?.token.address === token.address ? rentAmount : BigNumber.from(0)
  const tooLittle = units.add(rentFromSame).gt(have)
  const valid = dollars >= MIN_USD && !!rent && !!price && !tooLittle
  const busy = phase !== 'idle'

  async function go() {
    if (!rent || !q.data) return
    setError(null)
    try {
      const factoryAddr = AGENT_FACTORY
      const rentToken = await contract(rent.token.address, ERC20_ABI)
      const allowance: BigNumber = await rentToken.allowance(owner, factoryAddr)
      if (allowance.lt(rentAmount)) {
        setPhase('approve')
        await settle(await rentToken.approve(factoryAddr, rentAmount), 'The rent approval reverted.')
      }
      setPhase('create')
      const factory = await contract(factoryAddr, FACTORY_ABI)
      const rc = await settle(
        await factory.createAgent(
          pools.map((p) => p.pool),
          months,
          rent.token.address,
          false,
          q.data.version
        ),
        'The agent could not be opened (the transaction reverted).'
      )
      let agentAddr: string | undefined
      // only the factory's own AgentCreated for this wallet names where the deposit goes
      for (const l of rc.logs) {
        if (getAddress(l.address) !== getAddress(factoryAddr)) continue
        try {
          const ev = factory.interface.parseLog(l)
          if (ev.name === 'AgentCreated' && getAddress(ev.args.owner) === getAddress(owner)) {
            agentAddr = getAddress(ev.args.agent)
          }
        } catch {
          // not one of the factory's events
        }
      }
      if (!agentAddr) throw new Error('The agent’s address wasn’t in the transaction.')
      if (!(await factory.isAgent(agentAddr)))
        throw new Error('The factory doesn’t know this agent; nothing was deposited.')
      setPhase('deposit')
      const s = await signer()
      const deposit =
        token.address === getAddress(CELO_TOKEN)
          ? await s.sendTransaction({ to: agentAddr, value: units })
          : await (await contract(token.address, ERC20_ABI)).transfer(agentAddr, units)
      await settle(deposit, 'The agent is open but the deposit reverted; you can deposit again from its page.')
      navigate(AGENT_PATH(agentAddr))
    } catch (e) {
      setError(e)
      setPhase('idle')
    }
  }

  const label = {
    idle: `Rent and deposit · ${usd(dollars + (rent ? months : 0))}`,
    approve: '1/3 Approving rent…',
    create: '2/3 Opening agent…',
    deposit: '3/3 Depositing…',
  }[phase]
  return (
    <Page>
      <Back to="#" onClick={(e) => (e.preventDefault(), back())}>
        <ArrowLeft size={16} />
        <Trans>Back to tokens</Trans>
      </Back>
      <ThemedText.HeadlineMedium>
        <Trans>Add funds</Trans>
      </ThemedText.HeadlineMedium>
      <Failure error={q.error} />
      <ThemedText.SubHeader>
        <Trans>Token</Trans>
      </ThemedText.SubHeader>
      <Chips>
        {held.map((t) => (
          <Chip
            key={t.address}
            $on={t.address === token.address}
            aria-pressed={t.address === token.address}
            onClick={() => setToken(t.address)}
          >
            <TokenLogo token={t} />
            {t.symbol}
          </Chip>
        ))}
      </Chips>
      <ThemedText.SubHeader>
        <Trans>Amount (in USD)</Trans>
      </ThemedText.SubHeader>
      <AmountBox>
        <ThemedText.HeadlineSmall color="neutral3">$</ThemedText.HeadlineSmall>
        <input id="ubeagent-amount" inputMode="decimal" value={usdText} onChange={(e) => setUsd(e.target.value)} />
        <ThemedText.BodySecondary>
          {price ? `${amount(units, token.decimals)} ${token.symbol}` : token.symbol}
        </ThemedText.BodySecondary>
      </AmountBox>
      <Chips>
        {[5, 20, 50, 100].map((v) => (
          <Chip key={v} $on={dollars === v} onClick={() => setUsd(String(v))}>
            ${v}
          </Chip>
        ))}
      </Chips>
      <ThemedText.BodySmall color="neutral2">
        Minimum ${MIN_USD} · recommended ${IDEAL_USD} · in your wallet: {amount(have, token.decimals)} {token.symbol}
      </ThemedText.BodySmall>
      {dollars >= MIN_USD && dollars < IDEAL_USD && (
        <Note tone="warn">
          Below ${IDEAL_USD} the agent trades in one direction only and less often: there is no room for the other side
          or for rebalancing.
        </Note>
      )}
      {dollars > HIGH_USD && (
        <Note>
          Capital above ${HIGH_USD} doesn’t raise profit: opportunities are limited. A second agent gets more of them.
        </Note>
      )}
      {tooLittle && <Note tone="warn">You don’t have that much {token.symbol} in your wallet.</Note>}
      <ThemedText.SubHeader>
        <Trans>Rent period</Trans>
        {rent && ` (${amount(rent.perMonth, rent.token.decimals)} ${rent.token.symbol}/month)`}
      </ThemedText.SubHeader>
      <Chips>
        {[1, 3, 6, 12].map((m) => (
          <Chip key={m} $on={months === m} aria-pressed={months === m} onClick={() => setMonths(m)}>
            {m} mo
          </Chip>
        ))}
      </Chips>
      <Panel>
        <Row
          label={<Trans>Rent</Trans>}
          value={rent ? `${amount(rentAmount, rent.token.decimals)} ${rent.token.symbol}` : '—'}
        />
        <Row
          label={<Trans>Deposit to agent</Trans>}
          value={`${usd(dollars)} (${amount(units, token.decimals)} ${token.symbol})`}
        />
        <Row label={<Trans>Pools</Trans>} value={String(pools.length)} />
        <ThemedText.BodySmall color="neutral2">
          <Trans>Up to three signatures: rent approval, opening the agent, the deposit. You can always withdraw.</Trans>
        </ThemedText.BodySmall>
      </Panel>
      <Consent htmlFor="ubeagent-consent">
        <input id="ubeagent-consent" type="checkbox" checked={consent} onChange={() => setConsent(!consent)} />
        <span>
          <Trans>
            Estimates are not promises; you can lose money. Figures shown are realized results, not a guarantee of
            future ones.
          </Trans>
        </span>
      </Consent>
      <Failure error={error} />
      <ButtonPrimary disabled={!valid || !consent || busy} onClick={go}>
        {!valid && dollars < MIN_USD ? `Minimum $${MIN_USD}` : !consent && !busy ? 'Tick the box first' : label}
      </ButtonPrimary>
    </Page>
  )
}
