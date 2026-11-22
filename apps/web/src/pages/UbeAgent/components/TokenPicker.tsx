import { Trans } from 'i18n'
import { useState } from 'react'
import styled from 'styled-components'
import { ThemedText } from 'theme/components'

import { PoolInfo } from '../data/chain'
import { DEX_FAMILIES, DEX_NOTES, MAIN_TOKENS, dexFamily } from '../data/config'
import { Selection, flip, picked, tradeable, withReferences } from '../data/selection'
import { Chip, Chips, Note, TokenLogo } from './ui'

const TokenGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

const Tile = styled.button<{ $on?: boolean; $dashed?: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  padding: 0 12px;
  border-radius: 16px;
  border: 1px ${({ $dashed }) => ($dashed ? 'dashed' : 'solid')}
    ${({ theme, $on }) => ($on ? theme.accent1 : theme.surface3)};
  background: ${({ theme, $on }) => ($on ? theme.accent2 : theme.surface1)};
  color: ${({ theme }) => theme.neutral1};
  font-family: inherit;
  text-align: left;
  cursor: pointer;
`

const TileText = styled.span`
  display: flex;
  flex-direction: column;
  font-size: 15px;
  font-weight: 535;

  small {
    font-size: 12px;
    font-weight: 485;
    color: ${({ theme }) => theme.neutral2};
  }
`

const PoolRow = styled.button<{ $on: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid ${({ theme, $on }) => ($on ? theme.accent1 : theme.surface3)};
  background: ${({ theme, $on }) => ($on ? theme.accent2 : theme.surface1)};
  color: ${({ theme }) => theme.neutral1};
  font-family: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;

  small {
    margin-left: auto;
    color: ${({ theme }) => theme.neutral2};
  }
`

const Advanced = styled.details`
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid ${({ theme }) => theme.surface3};

  summary {
    cursor: pointer;
    font-weight: 535;
    color: ${({ theme }) => theme.neutral2};
  }
`

const PoolList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`

/** Exchanges, then tokens (UBE first, the rest under "Others"), then pools by hand under Advanced. */
export function TokenPicker({ all, sel, setSel }: { all: PoolInfo[]; sel: Selection; setSel: (s: Selection) => void }) {
  const pools = tradeable(all, sel.dexes)
  const toks = [...new Map(pools.flatMap((p) => [p.token0, p.token1]).map((t) => [t.address, t])).values()]
  const rank = (a: string) => MAIN_TOKENS.indexOf(a.toLowerCase())
  const main = toks.filter((t) => rank(t.address) >= 0).sort((a, b) => rank(a.address) - rank(b.address))
  const rest = toks.filter((t) => rank(t.address) < 0).sort((a, b) => a.symbol.localeCompare(b.symbol))
  const [showRest, setShowRest] = useState(false)
  const open = showRest || rest.some((t) => sel.tokens.has(t.address))
  const chosen = picked(all, sel)
  const auto = new Set(withReferences(all, chosen).map((p) => p.pool))
  // picked exchanges with no tradeable pool (Mento, or one not listed yet)
  const empty = DEX_FAMILIES.filter((d) => sel.dexes.has(d) && !all.some((p) => p.priced && dexFamily(p.dex) === d))
  const shown = all.filter((p) => sel.dexes.has(dexFamily(p.dex)) && p.priced)

  return (
    <>
      <ThemedText.SubHeader>
        <Trans>Exchanges</Trans>
      </ThemedText.SubHeader>
      <Chips>
        {DEX_FAMILIES.map((d) => (
          <Chip
            key={d}
            $on={sel.dexes.has(d)}
            aria-pressed={sel.dexes.has(d)}
            onClick={() => setSel({ dexes: flip(sel.dexes, d), tokens: sel.tokens, manual: null })}
          >
            {d}
          </Chip>
        ))}
      </Chips>
      {sel.dexes.size === 0 && <Note>Pick at least one exchange.</Note>}
      {empty.map((d) => (
        <Note key={d}>{DEX_NOTES[d] ?? `No ${d} pools are listed yet.`}</Note>
      ))}

      <ThemedText.SubHeader>
        <Trans>Tokens</Trans>
      </ThemedText.SubHeader>
      <TokenGrid>
        {[...main, ...(open ? rest : [])].map((t) => {
          const on = sel.tokens.has(t.address)
          const n = pools.filter((p) => p.token0.address === t.address || p.token1.address === t.address).length
          return (
            <Tile
              key={t.address}
              $on={on}
              aria-pressed={on}
              onClick={() => setSel({ dexes: sel.dexes, tokens: flip(sel.tokens, t.address), manual: null })}
            >
              <TokenLogo token={t} size={28} />
              <TileText>
                <span>{t.symbol}</span>
                <small>
                  {n} {n === 1 ? 'pool' : 'pools'}
                </small>
              </TileText>
            </Tile>
          )
        })}
        {rest.length > 0 && !open && (
          <Tile $dashed onClick={() => setShowRest(true)}>
            <TileText>
              <Trans>Others</Trans>
              <small>
                {rest.length} more {rest.length === 1 ? 'token' : 'tokens'}
              </small>
            </TileText>
          </Tile>
        )}
      </TokenGrid>
      {!sel.manual && sel.tokens.size === 1 && (
        <Note>Pick at least two tokens: every trade swaps one for another.</Note>
      )}
      {!sel.manual && sel.tokens.size > 1 && sel.dexes.size > 0 && chosen.size === 0 && (
        <Note tone="warn">No pool on these exchanges pairs these tokens. Add a token or an exchange.</Note>
      )}
      {sel.manual && (
        <Note>
          Using {sel.manual.size} hand-picked {sel.manual.size === 1 ? 'pool' : 'pools'} from Advanced.{' '}
          <Chip $on={false} onClick={() => setSel({ dexes: sel.dexes, tokens: sel.tokens, manual: null })}>
            Back to tokens
          </Chip>
        </Note>
      )}

      <Advanced>
        <summary>
          <Trans>Advanced: pick pools by hand</Trans>
        </summary>
        <PoolList>
          {shown.length === 0 && <Note>No pools on the picked exchanges.</Note>}
          {shown.map((p) => {
            const on = chosen.has(p.pool)
            return (
              <PoolRow
                key={p.pool}
                $on={on}
                aria-pressed={on}
                onClick={() => setSel({ dexes: sel.dexes, tokens: sel.tokens, manual: flip(chosen, p.pool) })}
              >
                <TokenLogo token={p.token0} />
                <TokenLogo token={p.token1} />
                <span>
                  {p.token0.symbol} / {p.token1.symbol} · {p.dex} · {p.fee}
                </span>
                {p.refOf && <small>{!on && auto.has(p.pool) ? 'reference · added' : 'reference'}</small>}
              </PoolRow>
            )
          })}
        </PoolList>
      </Advanced>
    </>
  )
}
