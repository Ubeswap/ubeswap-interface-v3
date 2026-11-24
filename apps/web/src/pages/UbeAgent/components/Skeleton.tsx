/**
 * Loading states for UbeAgent pages: the shape of what is coming, in the interface's own shimmer, with a spinner and
 * a line saying what is being read.
 */
import { LoaderV3 } from 'components/Icons/LoadingSpinner'
import { LoadingBubble } from 'components/Tokens/loading'
import { ReactNode } from 'react'
import styled from 'styled-components'
import { ThemedText } from 'theme/components'

const Reading = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.neutral2};
  font-size: 14px;
`

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const TileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
`

const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.surface3};
  background: ${({ theme }) => theme.surface1};
`

/** A spinner and what is being read. */
export function ReadingLine({ children }: { children: ReactNode }) {
  return (
    <Reading role="status" aria-live="polite">
      <LoaderV3 size="16px" />
      {children}
    </Reading>
  )
}

/** The exchange chips and token tiles, while the pool list is read. */
export function PickerSkeleton({ label }: { label: ReactNode }) {
  return (
    <>
      <ReadingLine>{label}</ReadingLine>
      <ThemedText.SubHeader color="neutral3">Exchanges</ThemedText.SubHeader>
      <ChipRow aria-hidden="true">
        {[112, 96, 116, 120, 92].map((w, i) => (
          <LoadingBubble key={i} height="40px" width={`${w}px`} delay={`${i * 0.08}s`} style={{ borderRadius: 999 }} />
        ))}
      </ChipRow>
      <ThemedText.SubHeader color="neutral3">Tokens</ThemedText.SubHeader>
      <TileGrid aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <LoadingBubble key={i} height="56px" width="100%" delay={`${i * 0.08}s`} style={{ borderRadius: 16 }} />
        ))}
      </TileGrid>
    </>
  )
}

/** An agent's header, balance card and trade list, while the agent is read. */
export function AgentSkeleton({ label }: { label: ReactNode }) {
  return (
    <>
      <ReadingLine>{label}</ReadingLine>
      <ChipRow aria-hidden="true" style={{ alignItems: 'center', gap: 12 }}>
        <LoadingBubble height="48px" width="48px" style={{ borderRadius: 14 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
          <LoadingBubble height="22px" width="45%" />
          <LoadingBubble height="14px" width="30%" delay="0.1s" />
        </div>
      </ChipRow>
      <Block aria-hidden="true">
        <LoadingBubble height="14px" width="20%" />
        <LoadingBubble height="36px" width="40%" delay="0.08s" />
        <LoadingBubble height="14px" width="55%" delay="0.16s" />
        <TileGrid>
          {[0, 1, 2, 3].map((i) => (
            <LoadingBubble key={i} height="40px" width="80%" delay={`${0.2 + i * 0.08}s`} />
          ))}
        </TileGrid>
      </Block>
      <Block aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <LoadingBubble key={i} height="20px" width="100%" delay={`${i * 0.1}s`} />
        ))}
      </Block>
    </>
  )
}
