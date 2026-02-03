import { BigNumber } from '@ethersproject/bignumber'
import { createColumnHelper } from '@tanstack/react-table'
import { InterfacePageName } from '@ubeswap/analytics-events'
import { Trace } from 'analytics'
import { AutoColumn } from 'components/Column'
import Row from 'components/Row'
import { Table } from 'components/Table'
import { Cell } from 'components/Table/Cell'
import { MAX_WIDTH_MEDIA_BREAKPOINT } from 'components/Tokens/constants'
import { Trans } from 'i18n'
import { cachedProposalEvents } from 'pages/Stake/hooks/romulus/cachedStakeEvents'
import { transparentize } from 'polished'
import { ReactElement, useMemo } from 'react'
import { Check, Plus, X } from 'react-feather'
import { Link } from 'react-router-dom'
import { ProposalState } from 'state/governance/hooks'
import styled from 'styled-components'
import { ClickableStyle, ExternalLink, ThemedText } from 'theme/components'

// Governance contract address for new UBE token
const NEW_GOVERNANCE_ADDRESS = '0xD355A00220FbA16b69Cd8C4fbE16E02CA855f928'

// Offset for new governance proposals to continue from old numbering (old governance ended at 15)
const NEW_GOVERNANCE_ID_OFFSET = 15

// Interface for cached proposal events
interface CachedProposalEvent {
  id: string
  title: string
  address: string
  blockNumber: number
  args: {
    id: BigNumber
    proposer: string
    description: string
    startBlock: BigNumber
    endBlock: BigNumber
  }
}

// Transformed proposal interface
interface Proposal {
  id: string
  title: string
  description: string
  status: ProposalState
  startBlock: number
  endBlock: number
  blockNumber: number
  governanceAddress: string
}

// Determine proposal status (all cached proposals are historical and already executed)
function getProposalStatus(): ProposalState {
  // All cached proposals have already ended, so they're either EXECUTED or DEFEATED
  // Since we don't have the actual state, we'll mark them as EXECUTED (most passed)
  // In a real implementation, you'd query the contract for the actual state
  return ProposalState.EXECUTED
}

// Transform cached events to proposals
function transformCachedProposals(): Proposal[] {
  return (cachedProposalEvents as CachedProposalEvent[])
    .filter((event) => event.title && event.title.trim() !== '')
    .map((event) => {
      const rawProposalId = event.args.id.toNumber()
      const isNewGovernance = event.address.toLowerCase() === NEW_GOVERNANCE_ADDRESS.toLowerCase()

      // New governance proposals continue numbering from old governance (15 + new id)
      const displayId = isNewGovernance ? rawProposalId + NEW_GOVERNANCE_ID_OFFSET : rawProposalId

      return {
        id: displayId.toString(),
        title: event.title,
        description: event.args.description,
        status: getProposalStatus(),
        startBlock: event.args.startBlock.toNumber(),
        endBlock: event.args.endBlock.toNumber(),
        blockNumber: event.blockNumber,
        governanceAddress: event.address,
      }
    })
    .sort((a, b) => b.blockNumber - a.blockNumber) // Sort by block number descending (newest first)
}

// Mock voting power (to be replaced with real data)
const MOCK_VOTING_POWER = '0'
const MOCK_DELEGATEE = 'Not delegated'

// Styled Components
const GovernanceContainer = styled.div`
  width: 100%;
  min-width: 320px;
  padding: 0px 32px;
  margin-bottom: 20px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding: 10px 16px;
  }
`

const ContentWrapper = styled.div`
  max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
  margin: 0 auto;
`

const HeaderWrapper = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 20px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    flex-direction: column;
  }
`

const HeaderLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Title = styled.h1`
  max-width: 600px;
  font-weight: 535;
  font-size: 60px;
  line-height: 72px;
  flex-shrink: 0;
  margin: 10px 0;

  color: ${({ theme }) => theme.neutral1};

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.lg}px`}) {
    font-size: 42px;
    line-height: 56px;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    font-size: 38px;
    line-height: 48px;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 32px;
    line-height: 38px;

    br {
      display: none;
    }
  }

  /* Custom breakpoint to split into two lines on smaller screens */
  @media only screen and (max-width: 550px) {
    font-size: 28px;
    line-height: 34px;

    br {
      display: unset;
    }
  }
`

const Description = styled.p`
  font-weight: normal;
  font-size: 20px;
  margin: 0;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.lg}px`}) {
    font-size: 18px;
    margin: 0;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    font-size: 16px;
    margin: 0;
  }
`

const RulesLink = styled(ExternalLink)`
  font-size: 16px;
  color: ${({ theme }) => theme.accent1};
  text-decoration: underline;

  &:hover {
    color: ${({ theme }) => theme.accent3};
  }
`

const CreateProposalButton = styled(Link)`
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60%;
  min-width: 240px;
  padding: 12px 16px;
  border-radius: 24px;
  border: 0;
  background-color: ${({ theme }) => theme.surface2};
  font-family: Basel;
  font-size: 20px;
  font-style: normal;
  font-weight: 535;
  line-height: 24px;
  color: ${({ theme }) => theme.neutral1};
  ${ClickableStyle}
`

const VotingPowerCard = styled.div`
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 16px;
  background-color: ${({ theme }) => theme.surface1};
  min-width: 260px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    width: 100%;
  }
`

const VotingPowerLabel = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
  margin-bottom: 8px;
`

const VotingPowerValue = styled.span`
  font-size: 32px;
  font-weight: 500;
  color: ${({ theme }) => theme.accent1};
`

const VotingPowerUnit = styled.span`
  font-size: 16px;
  font-weight: 400;
  color: ${({ theme }) => theme.neutral2};
  margin-left: 4px;
`

const DelegatedTo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
`

const EditLink = styled(Link)`
  color: ${({ theme }) => theme.neutral2};
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

const ProposalsSection = styled.div`
  margin-top: 24px;
`

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 500;
  color: ${({ theme }) => theme.neutral1};
  margin: 0 0 16px;
`

const TableWrapper = styled.div`
  width: 100%;
`

const StatusBadge = styled.span<{ variant: 'success' | 'error' | 'accent' | 'info'; isActive?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  background-color: ${({ theme, variant, isActive }) =>
    isActive
      ? theme.success
      : variant === 'success'
      ? transparentize(0.75, theme.success)
      : variant === 'error'
      ? transparentize(0.75, theme.critical)
      : variant === 'accent'
      ? transparentize(0.75, theme.accent1)
      : transparentize(0.75, theme.neutral2)};
  color: ${({ theme, variant, isActive }) =>
    isActive
      ? theme.background
      : variant === 'success'
      ? theme.success
      : variant === 'error'
      ? theme.critical
      : variant === 'accent'
      ? theme.accent1
      : theme.neutral2};
`

const BadgeIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
`

// Table value interface
interface ProposalTableValues {
  index: string
  title: ReactElement
  status: ProposalState
  time: string
  link: string
}

// Helper functions
function getStatusVariant(status: ProposalState): 'success' | 'error' | 'accent' | 'info' {
  switch (status) {
    case ProposalState.ACTIVE:
    case ProposalState.SUCCEEDED:
    case ProposalState.EXECUTED:
    case ProposalState.QUEUED:
      return 'success'
    case ProposalState.PENDING:
      return 'accent'
    case ProposalState.DEFEATED:
    case ProposalState.CANCELED:
    case ProposalState.EXPIRED:
      return 'error'
    default:
      return 'info'
  }
}

function getStatusText(status: ProposalState): string {
  switch (status) {
    case ProposalState.PENDING:
      return 'Pending'
    case ProposalState.ACTIVE:
      return 'Active'
    case ProposalState.CANCELED:
      return 'Canceled'
    case ProposalState.DEFEATED:
      return 'Rejected'
    case ProposalState.SUCCEEDED:
      return 'Passed'
    case ProposalState.QUEUED:
      return 'Queued'
    case ProposalState.EXPIRED:
      return 'Expired'
    case ProposalState.EXECUTED:
      return 'Passed'
    default:
      return 'Unknown'
  }
}

function getStatusIcon(status: ProposalState): ReactElement | null {
  switch (status) {
    case ProposalState.SUCCEEDED:
    case ProposalState.EXECUTED:
    case ProposalState.QUEUED:
      return <Check size={14} />
    case ProposalState.DEFEATED:
    case ProposalState.CANCELED:
    case ProposalState.EXPIRED:
      return <X size={14} />
    default:
      return null
  }
}

function formatTimeDisplay(proposal: Proposal): string {
  // For historical proposals, show the block number
  return `Block #${proposal.endBlock.toLocaleString()}`
}

function ProposalTitle({ title }: { title: string }) {
  return <ThemedText.BodyPrimary>{title}</ThemedText.BodyPrimary>
}

// Proposals Table Component
function ProposalsTable({ proposals }: { proposals: Proposal[] }) {
  const tableValues: ProposalTableValues[] = useMemo(
    () =>
      proposals.map((proposal) => ({
        index: `UIP-${proposal.id}`,
        title: <ProposalTitle title={proposal.title} />,
        status: proposal.status,
        time: formatTimeDisplay(proposal),
        link: `/governance/${proposal.id}`,
      })),
    [proposals]
  )

  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<ProposalTableValues>()
    return [
      columnHelper.accessor((row) => row.index, {
        id: 'index',
        header: () => (
          <Cell justifyContent="flex-start" minWidth={80}>
            <ThemedText.BodySecondary>#</ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (index) => (
          <Cell justifyContent="flex-start" minWidth={80}>
            <ThemedText.BodySecondary>{index.getValue?.()}</ThemedText.BodySecondary>
          </Cell>
        ),
      }),
      columnHelper.accessor((row) => row.title, {
        id: 'title',
        header: () => (
          <Cell justifyContent="flex-start" width={300} grow>
            <ThemedText.BodySecondary>
              <Trans>Proposal</Trans>
            </ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (title) => (
          <Cell justifyContent="flex-start" width={300} grow>
            {title.getValue?.()}
          </Cell>
        ),
      }),
      columnHelper.accessor((row) => row.status, {
        id: 'status',
        header: () => (
          <Cell justifyContent="flex-start" minWidth={120}>
            <ThemedText.BodySecondary>
              <Trans>Status</Trans>
            </ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (status) => {
          const statusValue = status.getValue?.()
          const icon = getStatusIcon(statusValue)
          const isActive = statusValue === ProposalState.ACTIVE
          return (
            <Cell justifyContent="flex-start" minWidth={120}>
              <StatusBadge variant={getStatusVariant(statusValue)} isActive={isActive}>
                {getStatusText(statusValue)}
                {icon && <BadgeIcon>{icon}</BadgeIcon>}
              </StatusBadge>
            </Cell>
          )
        },
      }),
      columnHelper.accessor((row) => row.time, {
        id: 'time',
        header: () => (
          <Cell justifyContent="flex-start" minWidth={180}>
            <ThemedText.BodySecondary>
              <Trans>Time</Trans>
            </ThemedText.BodySecondary>
          </Cell>
        ),
        cell: (time) => (
          <Cell justifyContent="flex-start" minWidth={180}>
            <ThemedText.BodyPrimary>{time.getValue?.()}</ThemedText.BodyPrimary>
          </Cell>
        ),
      }),
    ]
  }, [])

  return (
    <TableWrapper>
      <Table columns={columns} data={tableValues} loading={false} error={undefined} />
    </TableWrapper>
  )
}

// Main Page Component
export default function GovernancePage() {
  const proposals = useMemo(() => transformCachedProposals(), [])

  return (
    <Trace page={InterfacePageName.VOTE_PAGE} shouldLogImpression>
      <GovernanceContainer>
        <ContentWrapper>
          <HeaderWrapper>
            <HeaderLeft>
              <Title>Ubeswap Governance</Title>
              <Description>Participate in Ubeswap Governance with your UBE tokens</Description>
              <RulesLink href="https://docs.ubeswap.org/governance">See the governance rules...</RulesLink>
              <CreateProposalButton to="/governance/create-proposal">
                <Row gap="sm" align="center" width="fit-content">
                  <Trans>Create Proposal</Trans>
                  <Plus size={18} />
                </Row>
              </CreateProposalButton>
            </HeaderLeft>
            <VotingPowerCard>
              <VotingPowerLabel>Your Current Voting Power</VotingPowerLabel>
              <Row align="baseline">
                <VotingPowerValue>{MOCK_VOTING_POWER}</VotingPowerValue>
                <VotingPowerUnit>votes</VotingPowerUnit>
              </Row>
              <DelegatedTo>
                Delegated to: {MOCK_DELEGATEE} <EditLink to="/governance/delegate">(edit)</EditLink>
              </DelegatedTo>
            </VotingPowerCard>
          </HeaderWrapper>

          <ProposalsSection>
            <SectionTitle>Proposals ({proposals.length})</SectionTitle>
            <AutoColumn gap="md">
              <ProposalsTable proposals={proposals} />
            </AutoColumn>
          </ProposalsSection>
        </ContentWrapper>
      </GovernanceContainer>
    </Trace>
  )
}
