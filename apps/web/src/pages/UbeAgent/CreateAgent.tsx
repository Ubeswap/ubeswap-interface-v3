/**
 * Create a UbeAgent: pick the agent's kind (only the arbitrage agent is live), then the exchanges and tokens it may trade, then the deposit and the rent term. Up to three
 * signatures: rent approval, opening the agent (AgentFactory.createAgent), the deposit (a plain transfer to the agent).
 */
import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { useQuery } from '@tanstack/react-query'
import { ButtonPrimary } from 'components/Button'
import { parseUnits } from 'ethers/lib/utils'
import { Trans } from 'i18n'
import { ReactNode, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BarChart2, Crosshair, Icon, Repeat, Shuffle, Sliders, TrendingUp } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { StyledInternalLink, ThemedText } from 'theme/components'

import { ConnectWalletButton } from './components/actions'
import { AgentIllustration } from './components/shared'
import { PickerSkeleton } from './components/Skeleton'
import { TokenPicker } from './components/TokenPicker'
import { amount, Chip, Chips, Failure, Note, Page, Panel, Row, TokenLogo, usd } from './components/ui'
import { ERC20_ABI, FACTORY_ABI } from './data/abi'
import { PoolInfo, prices, Token, tokens, universe, UNIVERSE_FRESH_MS } from './data/chain'
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

const BackButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
  padding: 0;
  border: none;
  background: none;
  color: ${({ theme }) => theme.accent1};
  font-family: inherit;
  font-size: 16px;
  font-weight: 485;
  cursor: pointer;
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

const Kinds = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
`

const Kind = styled.button<{ $live?: boolean }>`
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border-radius: 20px;
  border: 1px solid ${({ theme, $live }) => ($live ? theme.accent1 : theme.surface3)};
  background: ${({ theme, $live }) => ($live ? theme.accent2 : theme.surface1)};
  color: ${({ theme }) => theme.neutral1};
  font-family: inherit;
  text-align: left;
  cursor: ${({ $live }) => ($live ? 'pointer' : 'default')};
  transition: transform 125ms ease, box-shadow 125ms ease, border-color 125ms ease;

  &:hover {
    ${({ $live }) => $live && 'transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);'}
  }
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.accent1};
    outline-offset: 2px;
  }
`

const KindIcon = styled.div<{ $live?: boolean }>`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: ${({ theme, $live }) => ($live ? theme.accent1 : theme.surface2)};
  color: ${({ theme, $live }) => ($live ? theme.white : theme.neutral2)};
`

const KindText = styled.span<{ $live?: boolean }>`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  opacity: ${({ $live }) => ($live ? 1 : 0.7)};

  strong {
    font-size: 16px;
    font-weight: 535;
  }
  small {
    font-size: 13px;
    font-weight: 485;
    line-height: 18px;
    color: ${({ theme }) => theme.neutral2};
  }
`

const KindBadge = styled.em`
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 999px;
  background: ${({ theme }) => theme.surface3};
  color: ${({ theme }) => theme.neutral2};
  font-size: 12px;
  font-style: normal;
  font-weight: 535;
  white-space: nowrap;
`

/** The agent kinds; only the arbitrage agent can be opened today, the rest are listed as coming soon. */
const KINDS: { name: ReactNode; about: ReactNode; Icon: Icon; live?: boolean }[] = [
  {
    name: <Trans>Arbitrage Agent</Trans>,
    about: <Trans>Buys where an asset is cheaper and sells where it is dearer.</Trans>,
    Icon: Shuffle,
    live: true,
  },
  {
    name: <Trans>Yield Agent</Trans>,
    about: <Trans>Keeps idle stablecoins where they earn the most, within your limits.</Trans>,
    Icon: TrendingUp,
  },
  {
    name: <Trans>LP Rebalancer Agent</Trans>,
    about: <Trans>Keeps a liquidity position in range as prices move.</Trans>,
    Icon: Crosshair,
  },
  {
    name: <Trans>Volume Agent</Trans>,
    about: <Trans>Splits a large buy or sell into small orders over time.</Trans>,
    Icon: BarChart2,
  },
  {
    name: <Trans>Trade Agent</Trans>,
    about: <Trans>Buys and sells on the rules you set, under a spending cap.</Trans>,
    Icon: Sliders,
  },
  {
    name: <Trans>Market Maker Agent</Trans>,
    about: <Trans>Quotes both sides of a market and earns the spread.</Trans>,
    Icon: Repeat,
  },
]

/** What a wallet balance of `t` is worth in USD (0 when unpriced). */
function walletUsd(t: Token, raw: BigNumber | undefined, px: Map<string, number>): number {
  return raw ? (Number(raw.toString()) / 10 ** t.decimals) * (px.get(t.address) ?? 0) : 0
}

export default function CreateAgent() {
  const { account } = useAgentTx()
  const [step, setStep] = useState<'kind' | 'pools' | 'fund'>('kind')
  const [sel, setSel] = useState<Selection>(emptySelection)
  const q = useQuery({
    queryKey: ['ubeagent', 'universe'],
    queryFn: () => universe(agentProvider()),
    // the listing changes only when the factory's owner edits it
    staleTime: UNIVERSE_FRESH_MS,
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

  if (step === 'kind') {
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
          <Trans>Choose what your agent does.</Trans>
        </ThemedText.BodySecondary>
        <Kinds>
          {KINDS.map(({ name, about, Icon, live }, i) => (
            <Kind
              key={i}
              $live={live}
              disabled={!live}
              aria-disabled={!live}
              onClick={live ? () => setStep('pools') : undefined}
            >
              <KindIcon $live={live}>
                <Icon size={22} />
              </KindIcon>
              <KindText $live={live}>
                <strong>{name}</strong>
                <small>{about}</small>
              </KindText>
              {live ? (
                <ArrowRight size={20} style={{ flexShrink: 0, alignSelf: 'center' }} />
              ) : (
                <KindBadge>
                  <Trans>Soon</Trans>
                </KindBadge>
              )}
            </Kind>
          ))}
        </Kinds>
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
      <BackButton onClick={() => setStep('kind')}>
        <ArrowLeft size={16} />
        <Trans>Agent types</Trans>
      </BackButton>
      <ThemedText.HeadlineMedium>
        <Trans>Arbitrage Agent</Trans>
      </ThemedText.HeadlineMedium>
      <ThemedText.BodySecondary>
        <Trans>
          Pick the exchanges and the tokens your agent may hold. It trades every pool between those tokens on those
          exchanges.
        </Trans>
      </ThemedText.BodySecondary>
      {q.isLoading && <PickerSkeleton label={<Trans>Reading pools from chain…</Trans>} />}
      <Failure error={q.error} />
      {q.data && (
        <>
          <TokenPicker all={all} sel={sel} setSel={setSel} />
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
        </>
      )}
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
  /** the token the user picked; until then the one their wallet holds most of (in USD) */
  const [tokenAddr, setToken] = useState<string | undefined>()
  const [usdText, setUsd] = useState('50')
  const [months, setMonths] = useState(1)
  const [consent, setConsent] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<unknown>(null)

  const q = useQuery({
    queryKey: ['ubeagent', 'fund', owner, held.map((t) => t.address).join(), pools.map((x) => x.pool).join()],
    queryFn: async () => {
      const p = agentProvider()
      const factory = new Contract(AGENT_FACTORY, [...FACTORY_ABI], p)
      const numeraire = getAddress(await factory.NUMERAIRE())
      const candidates = [numeraire, getAddress(CELO_TOKEN)]
      // the rent of this selection: a basic one (few exchanges and tokens) pays less
      const poolAddrs = pools.map((x) => x.pool)
      const perMonth: BigNumber[] = await Promise.all(candidates.map((t) => factory.rentFor(poolAddrs, t)))
      const [basic, full, maxDexes, maxTokens]: [BigNumber, BigNumber, number, number] = await Promise.all([
        factory.basicRentPerMonth(numeraire),
        factory.rentPerMonth(numeraire),
        factory.basicMaxDexes(),
        factory.basicMaxTokens(),
      ])
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
      const tiers = basic.gt(0) ? { basic, full, maxDexes, maxTokens } : null
      return { rent, tiers, px, wallet: new Map(held.map((t, i) => [t.address, wallet[i]])), version }
    },
  })

  const richest = q.data
    ? [...held].sort(
        (a, b) =>
          walletUsd(b, q.data.wallet.get(b.address), q.data.px) - walletUsd(a, q.data.wallet.get(a.address), q.data.px)
      )[0]
    : undefined
  const token = held.find((t) => t.address === (tokenAddr ?? richest?.address)) ?? held[0]
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
          true, // automatic updates: a new version reaches the agent without the user doing anything
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
    // the rent at its token's price (the selection's monthly rent, not a fixed $1)
    idle: `Rent and deposit · ${usd(
      dollars +
        (rent
          ? (Number(rentAmount.toString()) / 10 ** rent.token.decimals) * (q.data?.px.get(rent.token.address) ?? 1)
          : 0)
    )}`,
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
      {tooLittle && <Note tone="warn">You don’t have enough {token.symbol} in your wallet.</Note>}
      <ThemedText.SubHeader>
        <Trans>Rent period</Trans>
        {rent && ` (${amount(rent.perMonth, rent.token.decimals)} ${rent.token.symbol}/month)`}
      </ThemedText.SubHeader>
      {q.data?.tiers && rent && (
        <ThemedText.BodySmall color="neutral2">
          Up to {q.data.tiers.maxDexes} exchanges and {q.data.tiers.maxTokens} tokens:{' '}
          {amount(q.data.tiers.basic, rent.token.decimals)} {rent.token.symbol}/month; more:{' '}
          {amount(q.data.tiers.full, rent.token.decimals)} {rent.token.symbol}/month.
        </ThemedText.BodySmall>
      )}
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
