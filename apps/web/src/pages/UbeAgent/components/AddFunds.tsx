/**
 * Adds funds to an agent from the owner's wallet: one of the agent's tokens, an amount in USD. A closed agent (paused
 * and empty) is resumed in the same flow, so funding it again restarts it.
 */
import { getAddress } from '@ethersproject/address'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import { TransactionResponse } from '@ethersproject/providers'
import { useQuery } from '@tanstack/react-query'
import { ButtonPrimary, ButtonSecondary } from 'components/Button'
import { parseUnits } from 'ethers/lib/utils'
import { Trans } from 'i18n'
import { useState } from 'react'
import styled from 'styled-components'
import { ThemedText } from 'theme/components'

import { AGENT_ABI, ERC20_ABI } from '../data/abi'
import { Token } from '../data/chain'
import { CELO_TOKEN, MIN_USD, agentProvider } from '../data/config'
import { useAgentTx } from '../data/useAgentTx'
import { ReadingLine } from './Skeleton'
import { Chip, Chips, Note, Panel, TokenLogo, amount, usd } from './ui'

const AmountBox = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
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
    font-size: 20px;
    font-weight: 535;
  }
`

const Buttons = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

type Send = (label: string, send: () => Promise<TransactionResponse>) => Promise<boolean>

export function AddFunds({
  agentAddr,
  tokens,
  px,
  closed,
  busy,
  run,
  setStep,
  done,
  cancel,
}: {
  agentAddr: string
  tokens: Token[]
  px: Map<string, number>
  /** paused and empty: the deposit also resumes it */
  closed: boolean
  busy: boolean
  run: Send
  setStep: (s: string) => void
  done: (message: string) => void
  cancel: () => void
}) {
  const { account, contract, signer, settle } = useAgentTx()
  const celo = getAddress(CELO_TOKEN)
  const priced = tokens.filter((t) => (px.get(t.address) ?? 0) > 0)
  const wallet = useQuery({
    queryKey: ['ubeagent', 'wallet', account, priced.map((t) => t.address).join()],
    enabled: !!account,
    queryFn: async () => {
      const p = agentProvider()
      const bal: BigNumber[] = await Promise.all(
        priced.map((t) =>
          t.address === celo
            ? p.getBalance(account as string)
            : new Contract(t.address, ERC20_ABI, p).balanceOf(account)
        )
      )
      return new Map(priced.map((t, i) => [t.address, bal[i]]))
    },
  })
  const usdOf = (t: Token) =>
    (Number((wallet.data?.get(t.address) ?? BigNumber.from(0)).toString()) / 10 ** t.decimals) *
    (px.get(t.address) ?? 0)
  const [picked, setPicked] = useState<string | undefined>()
  const [usdText, setUsd] = useState(closed ? '20' : '10')
  const token = priced.find((t) => t.address === picked) ?? [...priced].sort((a, b) => usdOf(b) - usdOf(a))[0]

  if (!token) return <Note tone="warn">None of this agent’s tokens can be priced right now.</Note>
  const price = px.get(token.address) as number
  const dollars = Number(usdText.replace(',', '.')) || 0
  const units =
    dollars > 0
      ? parseUnits((dollars / price).toFixed(Math.min(token.decimals, 12)), token.decimals)
      : BigNumber.from(0)
  const have = wallet.data?.get(token.address)
  const short = !!have && units.gt(have)
  const tooSmall = closed ? dollars < MIN_USD : dollars <= 0
  const words = `${amount(units, token.decimals)} ${token.symbol}`

  async function go() {
    const ok = await run(closed ? 'Fund again' : 'Add funds', async () => {
      setStep(`Confirm the deposit of ${words} in your wallet…`)
      const tx =
        token.address === celo
          ? await (await signer()).sendTransaction({ to: agentAddr, value: units })
          : await (await contract(token.address, ERC20_ABI)).transfer(agentAddr, units)
      if (!closed) return tx
      setStep(`Depositing ${words}…`)
      await settle(tx, 'The deposit reverted.')
      setStep('Confirm resuming the agent in your wallet…')
      return (await contract(agentAddr, AGENT_ABI)).setPaused(false)
    })
    if (ok)
      done(closed ? `Deposited ${words} and resumed: the agent trades again.` : `Deposited ${words} to the agent.`)
  }

  return (
    <Panel>
      <ThemedText.SubHeader>{closed ? <Trans>Fund again</Trans> : <Trans>Add funds</Trans>}</ThemedText.SubHeader>
      <Chips>
        {priced.map((t) => (
          <Chip
            key={t.address}
            $on={t.address === token.address}
            aria-pressed={t.address === token.address}
            onClick={() => setPicked(t.address)}
          >
            <TokenLogo token={t} size={18} /> {t.symbol}
          </Chip>
        ))}
      </Chips>
      <AmountBox>
        <ThemedText.HeadlineSmall color="neutral3">$</ThemedText.HeadlineSmall>
        <input id="ubeagent-topup" inputMode="decimal" value={usdText} onChange={(e) => setUsd(e.target.value)} />
        <ThemedText.BodySecondary>{words}</ThemedText.BodySecondary>
      </AmountBox>
      {wallet.data ? (
        <ThemedText.BodySmall color="neutral2">
          In your wallet: {amount(have ?? BigNumber.from(0), token.decimals)} {token.symbol} ({usd(usdOf(token))})
          {closed && ` · minimum $${MIN_USD}`}
        </ThemedText.BodySmall>
      ) : (
        <ReadingLine>
          <Trans>Reading your wallet…</Trans>
        </ReadingLine>
      )}
      {short && <Note tone="warn">You don’t have enough {token.symbol} in your wallet.</Note>}
      <ThemedText.BodySmall color="neutral2">
        {closed ? (
          <Trans>Two signatures: the deposit, then resuming the agent.</Trans>
        ) : (
          <Trans>One signature: a transfer from your wallet to the agent.</Trans>
        )}
      </ThemedText.BodySmall>
      <Buttons>
        <ButtonSecondary disabled={busy} onClick={cancel}>
          <Trans>Cancel</Trans>
        </ButtonSecondary>
        <ButtonPrimary disabled={busy || short || tooSmall || !wallet.data} onClick={go}>
          {busy ? '…' : closed ? `Deposit ${usd(dollars)} and resume` : `Deposit ${usd(dollars)}`}
        </ButtonPrimary>
      </Buttons>
    </Panel>
  )
}
