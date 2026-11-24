import { ChainId, Token as SdkToken } from '@ubeswap/sdk-core'
import CurrencyLogo from 'components/Logo/CurrencyLogo'
import { ReactNode, useMemo } from 'react'
import styled, { DefaultTheme } from 'styled-components'
import { ThemedText } from 'theme/components'

import { Token } from '../data/chain'

export const Page = styled.div`
  width: 100%;
  max-width: 560px;
  padding: 32px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 20px;
  background: ${({ theme }) => theme.surface2};
  border: 1px solid ${({ theme }) => theme.surface3};
`

export const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

export const Chip = styled.button<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent1 : theme.surface3)};
  background: ${({ theme, $on }) => ($on ? theme.accent2 : theme.surface1)};
  color: ${({ theme, $on }) => ($on ? theme.accent1 : theme.neutral1)};
  font-family: inherit;
  font-size: 14px;
  font-weight: 535;
  cursor: pointer;
  &:disabled {
    cursor: default;
    opacity: 0.5;
  }
`

type Tone = 'info' | 'warn' | 'good'
const toneColor = (theme: DefaultTheme, tone: Tone) =>
  tone === 'warn' ? theme.warning2 : tone === 'good' ? theme.success : undefined

const NoteBox = styled.div<{ $tone: Tone }>`
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 20px;
  color: ${({ theme, $tone }) => toneColor(theme, $tone) ?? theme.neutral2};
  background: ${({ theme }) => theme.surface2};
  border: 1px solid ${({ theme, $tone }) => toneColor(theme, $tone) ?? theme.surface3};
`

/** A short message: `good` for what an action just did, `warn` for what stops one. */
export function Note({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return <NoteBox $tone={tone}>{children}</NoteBox>
}

/** A failed read or transaction, in the user's words (a rejected signature is not an error worth showing). */
/** The UbeAgent contracts' errors a user can run into, by selector, in their words. */
const CONTRACT_ERRORS: Record<string, string> = {
  '0x90b8ec18': 'A token transfer failed: check that your wallet holds enough and that the approval covers it.',
  '0x103da618': 'That rent token or term isn’t accepted.',
  '0x8e012bd5': 'The agent settings changed a moment ago. Reload the page and try again.',
  '0x82b42900': 'Only this agent’s owner can do that.',
  '0xfa5cd00f': 'One of the picked pools isn’t listed anymore. Reload and pick again.',
  '0x1a47a690': 'A picked token has no reference price yet. Pick another token.',
  '0x52f49c95': 'This address isn’t a UbeAgent.',
  '0x30553b16': 'That version isn’t published by the factory.',
  '0x07cc321c': 'The factory refused these settings.',
}

export function Failure({ error }: { error: unknown }) {
  if (!error) return null
  const e = error as { code?: number | string; reason?: string; message?: string }
  if (e.code === 4001 || e.code === 'ACTION_REJECTED') return <Note>You declined the request in your wallet.</Note>
  const text = e.reason ?? e.message ?? String(error)
  const known = Object.keys(CONTRACT_ERRORS).find((sel) => text.toLowerCase().includes(sel))
  if (known) return <Note tone="warn">{CONTRACT_ERRORS[known]}</Note>
  return <Note tone="warn">{text.length > 240 ? `${text.slice(0, 240)}…` : text}</Note>
}

const RowBox = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
`

export function Row({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <RowBox>
      <ThemedText.BodySecondary>{label}</ThemedText.BodySecondary>
      <ThemedText.BodyPrimary>{value}</ThemedText.BodyPrimary>
    </RowBox>
  )
}

/** A token's logo from the app's token lists (symbol initials when it has none). */
export function TokenLogo({ token, size = 20 }: { token: Token; size?: number }) {
  const currency = useMemo(
    () => new SdkToken(ChainId.CELO, token.address, token.decimals, token.symbol),
    [token.address, token.decimals, token.symbol]
  )
  return <CurrencyLogo currency={currency} size={`${size}px`} />
}

export function usd(n: number, opts: { sign?: boolean; digits?: number } = {}): string {
  const s = Math.abs(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: opts.digits ?? 2,
  })
  return opts.sign ? `${n < 0 ? '−' : '+'}${s}` : n < 0 ? `−${s}` : s
}

/** A raw token amount with at most `digits` decimals. */
export function amount(raw: { toString(): string }, decimals: number, digits = 4): string {
  return (Number(raw.toString()) / 10 ** decimals).toLocaleString('en-US', { maximumFractionDigits: digits })
}
