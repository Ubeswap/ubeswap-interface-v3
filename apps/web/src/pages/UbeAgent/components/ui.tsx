import { ChainId, Token as SdkToken } from '@ubeswap/sdk-core'
import CurrencyLogo from 'components/Logo/CurrencyLogo'
import { ReactNode, useMemo } from 'react'
import styled from 'styled-components'
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

const NoteBox = styled.div<{ $tone: 'info' | 'warn' }>`
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 20px;
  color: ${({ theme, $tone }) => ($tone === 'warn' ? theme.warning2 : theme.neutral2)};
  background: ${({ theme }) => theme.surface2};
  border: 1px solid ${({ theme, $tone }) => ($tone === 'warn' ? theme.warning2 : theme.surface3)};
`

export function Note({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return <NoteBox $tone={tone}>{children}</NoteBox>
}

/** A failed read or transaction, in the user's words (a rejected signature is not an error worth showing). */
export function Failure({ error }: { error: unknown }) {
  if (!error) return null
  const e = error as { code?: number | string; reason?: string; message?: string }
  if (e.code === 4001 || e.code === 'ACTION_REJECTED') return <Note>You declined the request in your wallet.</Note>
  const text = e.reason ?? e.message ?? String(error)
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
