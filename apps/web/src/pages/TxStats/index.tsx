/**
 * Tx stats: how many Ubeswap transactions happened on Celo in the last 24 hours and per day.
 * Not linked from the nav yet; reachable at /stats.
 */
import { ButtonPrimary } from 'components/Button'
import { MAX_WIDTH_MEDIA_BREAKPOINT } from 'components/Tokens/constants'
import { LoadingBubble } from 'components/Tokens/loading'
import { Trans } from 'i18n'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'react-feather'
import styled from 'styled-components'
import { ExternalLink, ThemedText } from 'theme/components'

import { CATEGORIES, Counts, DayCounts, loadLast24h, loadTxStats, TxStats } from './data'

const Container = styled.div`
  width: 100%;
  min-width: 320px;
  padding: 0px 40px 40px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding: 0px 16px 24px;
  }
`

const Inner = styled.div`
  max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
`

const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 32px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding-top: 16px;
  }
`

const Title = styled.h1`
  margin: 0;
  font-weight: 535;
  font-size: 36px;
  line-height: 44px;
  color: ${({ theme }) => theme.neutral1};

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 28px;
    line-height: 36px;
  }
`

const Panel = styled.div`
  border-radius: 20px;
  background: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  overflow: hidden;
`

const SummaryPanel = styled(Panel)`
  max-width: 480px;
  width: 100%;
`

const SummaryRow = styled.div<{ $total?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 0 20px;
  border-top: 1px solid ${({ theme }) => theme.surface3};
  background: ${({ theme, $total }) => ($total ? theme.surface2 : 'transparent')};

  &:first-child {
    border-top: none;
  }
`

const Label = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  color: ${({ theme }) => theme.neutral1};
`

const IconLink = styled(ExternalLink)`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.neutral2};

  &:hover {
    color: ${({ theme }) => theme.accent1};
    opacity: 1;
  }
`

const Number = styled.span<{ $bold?: boolean }>`
  font-size: ${({ $bold }) => ($bold ? '20px' : '18px')};
  font-weight: ${({ $bold }) => ($bold ? 535 : 485)};
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.neutral1};
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
`

const TableScroll = styled.div`
  overflow-x: auto;
`

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;

  th,
  td {
    padding: 14px 16px;
    text-align: right;
    white-space: nowrap;
    border-top: 1px solid ${({ theme }) => theme.surface3};
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
  thead th {
    border-top: none;
    background: ${({ theme }) => theme.surface2};
    font-size: 14px;
    font-weight: 485;
    color: ${({ theme }) => theme.neutral2};
  }
  td {
    font-size: 16px;
    color: ${({ theme }) => theme.neutral1};
  }
  td:last-child {
    font-weight: 535;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    th,
    td {
      padding: 12px 8px;
    }
    th {
      font-size: 13px;
    }
    td {
      font-size: 14px;
    }
  }
`

const Partial = styled.span`
  margin-left: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.neutral2};

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    display: block;
    margin-left: 0;
    font-size: 12px;
  }
`

const SkeletonCell = styled(LoadingBubble)`
  display: inline-block;
  vertical-align: middle;
`

const ErrorPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 20px;
`

const RetryButton = styled(ButtonPrimary)`
  width: fit-content;
  padding: 8px 20px;
  border-radius: 12px;
`

const istanbulTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul',
  hour: '2-digit',
  minute: '2-digit',
})

const dayLabel = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' })
const formatDay = (date: string) => dayLabel.format(new Date(`${date}T00:00:00Z`))
const formatCount = (n: number) => n.toLocaleString('en-US')

const COLUMNS: (keyof Counts)[] = ['swap', 'stake', 'farm', 'agents', 'total']

function Summary({ counts }: { counts?: Counts }) {
  const value = (n: number | undefined, bold?: boolean) =>
    n === undefined ? <LoadingBubble height="20px" width="56px" /> : <Number $bold={bold}>{formatCount(n)}</Number>
  return (
    <SummaryPanel>
      {CATEGORIES.map((category) => (
        <SummaryRow key={category.key}>
          <Label>
            <Trans>{category.label}</Trans>
            <IconLink href={category.link} aria-label={`${category.label} on explorer`}>
              <ArrowUpRight size={14} />
            </IconLink>
          </Label>
          {value(counts?.[category.key])}
        </SummaryRow>
      ))}
      <SummaryRow $total>
        <Label style={{ fontWeight: 535 }}>
          <Trans>Total</Trans>
        </Label>
        {value(counts?.total, true)}
      </SummaryRow>
    </SummaryPanel>
  )
}

const SKELETON_ROWS = 6

function Daily({ daily }: { daily?: DayCounts[] }) {
  return (
    <Panel>
      <TableScroll>
        <Table>
          <thead>
            <tr>
              <th>
                <Trans>Date</Trans>
              </th>
              <th>
                <Trans>Swap</Trans>
              </th>
              <th>
                <Trans>Stake</Trans>
              </th>
              <th>
                <Trans>Farm</Trans>
              </th>
              <th>
                <Trans>Agents</Trans>
              </th>
              <th>
                <Trans>Total</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {daily
              ? daily.map((day) => (
                  <tr key={day.date}>
                    <td>
                      {formatDay(day.date)}
                      {day.partial && (
                        <Partial>
                          <Trans>today (partial)</Trans>
                        </Partial>
                      )}
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column}>{formatCount(day[column])}</td>
                    ))}
                  </tr>
                ))
              : Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i}>
                    <td>
                      <SkeletonCell height="18px" width="96px" />
                    </td>
                    {COLUMNS.map((column) => (
                      <td key={column}>
                        <SkeletonCell height="18px" width="44px" />
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </Table>
      </TableScroll>
    </Panel>
  )
}

function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <ErrorPanel>
      <ThemedText.BodyPrimary>
        <Trans>Could not load the stats.</Trans>
      </ThemedText.BodyPrimary>
      <ThemedText.BodySmall color="neutral2">{message}</ThemedText.BodySmall>
      <RetryButton onClick={onRetry}>
        <Trans>Retry</Trans>
      </RetryButton>
    </ErrorPanel>
  )
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

export default function TxStatsPage() {
  const [stats, setStats] = useState<TxStats>()
  const [statsError, setStatsError] = useState<string>()
  // only used when stats.json can't be read
  const [live, setLive] = useState<{ updatedAt: number; counts: Counts }>()
  const [liveError, setLiveError] = useState<string>()
  const run = useRef(0)

  const loadLive = useCallback((id: number) => {
    setLiveError(undefined)
    loadLast24h()
      .then((result) => run.current === id && setLive(result))
      .catch((e: unknown) => run.current === id && setLiveError(errorMessage(e)))
  }, [])

  const load = useCallback(() => {
    const id = ++run.current
    setStatsError(undefined)
    loadTxStats()
      .then((result) => run.current === id && setStats(result))
      .catch((e: unknown) => {
        if (run.current !== id) return
        setStatsError(errorMessage(e))
        loadLive(id)
      })
  }, [loadLive])

  useEffect(() => {
    load()
    const runs = run
    return () => {
      // drop answers that arrive after leaving the page
      runs.current++
    }
  }, [load])

  const updatedAt = stats?.updatedAt ?? live?.updatedAt

  return (
    <Container>
      <Inner>
        <Header>
          <Title>
            <Trans>Ubeswap on-chain activity</Trans>
          </Title>
          <ThemedText.BodySecondary>
            <Trans>Transactions in the last 24 hours</Trans>
          </ThemedText.BodySecondary>
        </Header>

        {!stats && liveError ? (
          <LoadError message={liveError} onRetry={() => loadLive(run.current)} />
        ) : (
          <Summary counts={stats?.last24h ?? live?.counts} />
        )}

        <SectionHeader>
          <ThemedText.SubHeaderLarge>
            <Trans>Daily transactions</Trans>
          </ThemedText.SubHeaderLarge>
          <ThemedText.BodySmall color="neutral2">
            <Trans>Times in UTC+3</Trans>
            {updatedAt !== undefined && (
              <>
                {' · '}
                <Trans>Updated {istanbulTime.format(updatedAt)} (UTC+3)</Trans>
              </>
            )}
          </ThemedText.BodySmall>
        </SectionHeader>
        {statsError ? <LoadError message={statsError} onRetry={load} /> : <Daily daily={stats?.daily} />}
      </Inner>
    </Container>
  )
}
