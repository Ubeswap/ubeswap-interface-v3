import { BigNumber } from '@ethersproject/bignumber'
import { InterfacePageName } from '@ubeswap/analytics-events'
import { useWeb3React } from '@web3-react/core'
import { Trace } from 'analytics'
import { ButtonPrimary } from 'components/Button'
import { AutoColumn } from 'components/Column'
import Row from 'components/Row'
import { Trans } from 'i18n'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { cachedProposalEvents } from 'pages/Stake/hooks/romulus/cachedStakeEvents'
import { transparentize } from 'polished'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, Clock, Copy, X } from 'react-feather'
import { Link, useParams } from 'react-router-dom'
import { ProposalState, useUserVotes } from 'state/governance/hooks'
import styled from 'styled-components'
import { BREAKPOINTS } from 'theme'
import { ClickableStyle, ThemedText } from 'theme/components'
import VotingStats from './VotingStats'

// Governance contract address for new UBE token
const NEW_GOVERNANCE_ADDRESS = '0xD355A00220FbA16b69Cd8C4fbE16E02CA855f928'
const NEW_GOVERNANCE_ID_OFFSET = 15

// Average block time in seconds (Celo ~5 seconds)
const BLOCK_TIME_SECONDS = 5

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

// Proposal data interface
interface ProposalData {
  id: string
  title: string
  description: string
  status: ProposalState
  startBlock: number
  endBlock: number
  blockNumber: number
  governanceAddress: string
  proposer: string
  forVotes: number
  againstVotes: number
  abstainVotes: number
}

// Tab types
type TabType = 'details' | 'voters' | 'discussion'

// Mock voters data
const MOCK_VOTERS = [
  { address: '0x1234567890abcdef1234567890abcdef12345678', vote: 'For', amount: '150,000', date: '2024-01-15' },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', vote: 'Against', amount: '75,000', date: '2024-01-15' },
  { address: '0x9876543210fedcba9876543210fedcba98765432', vote: 'For', amount: '50,000', date: '2024-01-14' },
  { address: '0xfedcba9876543210fedcba9876543210fedcba98', vote: 'Abstain', amount: '25,000', date: '2024-01-14' },
  { address: '0x1111222233334444555566667777888899990000', vote: 'For', amount: '100,000', date: '2024-01-13' },
]

// Mock discussion data
const MOCK_COMMENTS = [
  {
    author: '0x1234567890abcdef1234567890abcdef12345678',
    text: 'This proposal is a great step forward for the protocol. I fully support the initiative.',
    date: '2024-01-14',
    replies: [
      {
        author: '0xabcdef1234567890abcdef1234567890abcdef12',
        text: 'Agreed! Looking forward to seeing this implemented.',
        date: '2024-01-14',
      },
    ],
  },
  {
    author: '0x9876543210fedcba9876543210fedcba98765432',
    text: 'I have some concerns about the timeline. Can we discuss extending the implementation period?',
    date: '2024-01-13',
    replies: [],
  },
]

// Styled Components
const PageWrapper = styled(AutoColumn)`
  padding: 68px 8px 0px;
  max-width: 1100px;
  width: 100%;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    max-width: 800px;
    padding-top: 48px;
  }

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    max-width: 500px;
    padding-top: 20px;
  }
`

const BackLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: 8px;
  color: ${({ theme }) => theme.neutral2};
  text-decoration: none;
  margin-bottom: 16px;
  ${ClickableStyle}

  &:hover {
    color: ${({ theme }) => theme.neutral1};
  }
`

const HeaderSection = styled.div`
  background-color: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
`

const HeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    flex-direction: column;
  }
`

const ProposalBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  background-color: ${({ theme }) => theme.surface2};
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.neutral2};
  margin-right: 12px;
`

const ProposalTitle = styled.h1`
  font-size: 28px;
  font-weight: 600;
  color: ${({ theme }) => theme.neutral1};
  margin: 8px 0 16px;
  line-height: 1.3;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 22px;
  }
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

const HeaderMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
`

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
`

const AddressText = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  ${ClickableStyle}

  &:hover {
    color: ${({ theme }) => theme.neutral1};
  }
`

const CountdownBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: ${({ theme }) => transparentize(0.9, theme.accent1)};
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.accent1};
`

const CastVoteSection = styled.div`
  background-color: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 16px;
`

const SectionTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.neutral1};
  margin: 0 0 16px;
`

const VotingPowerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 12px 16px;
  background-color: ${({ theme }) => theme.surface2};
  border-radius: 12px;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
`

const VotingPowerLabel = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
`

const VotingPowerValue = styled.span`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.accent1};
`

const VoteButtonsRow = styled.div`
  display: flex;
  gap: 12px;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    flex-direction: column;
  }
`

const VoteButton = styled(ButtonPrimary)<{ variant: 'for' | 'against' | 'abstain' }>`
  flex: 1;
  padding: 14px 24px;
  font-size: 16px;
  font-weight: 600;
  border-radius: 12px;
  background-color: ${({ theme, variant }) =>
    variant === 'for' ? theme.success : variant === 'against' ? theme.critical : theme.neutral3};
  color: ${({ theme, variant }) => (variant === 'abstain' ? theme.neutral1 : 'white')};

  &:hover {
    background-color: ${({ theme, variant }) =>
      variant === 'for'
        ? transparentize(0.1, theme.success)
        : variant === 'against'
        ? transparentize(0.1, theme.critical)
        : transparentize(0.1, theme.neutral3)};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`

const MainArea = styled.div`
  display: flex;
  gap: 20px;

  @media (max-width: ${BREAKPOINTS.md}px) {
    flex-direction: column;
  }
`

const MainColumn = styled.div`
  flex: 1;
  min-width: 0;
`

const Sidebar = styled.div`
  width: 350px;
  flex-shrink: 0;

  @media (max-width: ${BREAKPOINTS.md}px) {
    width: 100%;
  }
`

const TabsContainer = styled.div`
  background-color: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 16px;
  overflow: hidden;
`

const TabsHeader = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.surface3};
`

const TabButton = styled.button<{ active: boolean }>`
  flex: 1;
  padding: 16px;
  background: none;
  border: none;
  font-size: 15px;
  font-weight: 500;
  color: ${({ theme, active }) => (active ? theme.neutral1 : theme.neutral2)};
  cursor: pointer;
  position: relative;
  transition: color 0.2s;

  &:hover {
    color: ${({ theme }) => theme.neutral1};
  }

  ${({ active, theme }) =>
    active &&
    `
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background-color: ${theme.accent1};
    }
  `}
`

const TabContent = styled.div`
  padding: 24px;
`

const DescriptionText = styled.div`
  font-size: 15px;
  line-height: 1.6;
  color: ${({ theme }) => theme.neutral1};
  white-space: pre-wrap;
`

const VotersTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`

const VotersTableHeader = styled.thead`
  border-bottom: 1px solid ${({ theme }) => theme.surface3};
`

const VotersTableHeaderCell = styled.th`
  text-align: left;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 500;
  color: ${({ theme }) => theme.neutral2};

  &:last-child {
    text-align: right;
  }

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding: 10px 8px;
    font-size: 12px;
  }
`

const VotersTableBody = styled.tbody``

const VotersTableRow = styled.tr`
  border-bottom: 1px solid ${({ theme }) => theme.surface3};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${({ theme }) => theme.surface2};
  }
`

const VotersTableCell = styled.td`
  padding: 14px 16px;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral1};

  &:last-child {
    text-align: right;
  }

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding: 12px 8px;
    font-size: 13px;
  }
`

const VoterAddress = styled.span`
  font-family: monospace;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral1};

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 12px;
  }
`

const VoterVoteBadge = styled.span<{ vote: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 500;
  background-color: ${({ theme, vote }) =>
    vote === 'For'
      ? transparentize(0.85, theme.success)
      : vote === 'Against'
      ? transparentize(0.85, theme.critical)
      : transparentize(0.85, theme.neutral2)};
  color: ${({ theme, vote }) =>
    vote === 'For' ? theme.success : vote === 'Against' ? theme.critical : theme.neutral2};
`

const VoterAmount = styled.span`
  font-size: 14px;
  font-weight: 500;
  color: ${({ theme }) => theme.neutral1};

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 13px;
  }
`

const CommentItem = styled.div`
  padding: 16px 0;
  border-bottom: 1px solid ${({ theme }) => theme.surface3};

  &:last-child {
    border-bottom: none;
  }
`

const CommentHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`

const CommentAuthor = styled.span`
  font-family: monospace;
  font-size: 13px;
  color: ${({ theme }) => theme.neutral2};
`

const CommentDate = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.neutral3};
`

const CommentText = styled.p`
  font-size: 14px;
  line-height: 1.5;
  color: ${({ theme }) => theme.neutral1};
  margin: 0;
`

const ReplyContainer = styled.div`
  margin-left: 24px;
  margin-top: 12px;
  padding-left: 16px;
  border-left: 2px solid ${({ theme }) => theme.surface3};
`

// Helper functions
function getProposalStatus(startBlock: number, endBlock: number, currentBlock: number): ProposalState {
  if (currentBlock < startBlock) {
    return ProposalState.PENDING
  } else if (currentBlock >= startBlock && currentBlock <= endBlock) {
    return ProposalState.ACTIVE
  } else {
    return ProposalState.EXECUTED
  }
}

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

function getStatusIcon(status: ProposalState): React.ReactElement | null {
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

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatCountdown(blocks: number): string {
  const seconds = blocks * BLOCK_TIME_SECONDS
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

// Find proposal by ID
function findProposalById(proposalId: string, currentBlock: number): ProposalData | null {
  const numericId = parseInt(proposalId, 10)

  for (const event of cachedProposalEvents as CachedProposalEvent[]) {
    const rawProposalId = event.args.id.toNumber()
    const isNewGovernance = event.address.toLowerCase() === NEW_GOVERNANCE_ADDRESS.toLowerCase()
    const displayId = isNewGovernance ? rawProposalId + NEW_GOVERNANCE_ID_OFFSET : rawProposalId

    if (displayId === numericId) {
      const startBlock = event.args.startBlock.toNumber()
      const endBlock = event.args.endBlock.toNumber()

      // Mock vote counts based on proposal ID for demo purposes
      const baseVotes = numericId * 100000
      const forVotes = baseVotes + Math.floor(Math.random() * 500000)
      const againstVotes = Math.floor(baseVotes * 0.3) + Math.floor(Math.random() * 100000)
      const abstainVotes = Math.floor(baseVotes * 0.1) + Math.floor(Math.random() * 50000)

      return {
        id: displayId.toString(),
        title: event.title,
        description: event.args.description,
        status: getProposalStatus(startBlock, endBlock, currentBlock),
        startBlock,
        endBlock,
        blockNumber: event.blockNumber,
        governanceAddress: event.address,
        proposer: event.args.proposer,
        forVotes,
        againstVotes,
        abstainVotes,
      }
    }
  }

  return null
}

export default function ProposalDetails() {
  const { proposalId } = useParams<{ proposalId: string }>()
  const { account } = useWeb3React()
  const currentBlock = useBlockNumber()
  const { votes: userVotes } = useUserVotes()
  const [activeTab, setActiveTab] = useState<TabType>('details')
  const [copied, setCopied] = useState(false)

  const proposal = useMemo(() => {
    if (!proposalId || !currentBlock) return null
    return findProposalById(proposalId, currentBlock)
  }, [proposalId, currentBlock])

  const blocksUntilStart = useMemo(() => {
    if (!proposal || !currentBlock) return 0
    return Math.max(0, proposal.startBlock - currentBlock)
  }, [proposal, currentBlock])

  const blocksUntilEnd = useMemo(() => {
    if (!proposal || !currentBlock) return 0
    return Math.max(0, proposal.endBlock - currentBlock)
  }, [proposal, currentBlock])

  const isPending = proposal?.status === ProposalState.PENDING
  const isActive = proposal?.status === ProposalState.ACTIVE

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopied(true)
  }

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [copied])

  const formattedVotingPower = useMemo(() => {
    if (!userVotes) return '0'
    return parseFloat(userVotes.toExact()).toLocaleString(undefined, { maximumFractionDigits: 2 })
  }, [userVotes])

  if (!proposal) {
    return (
      <PageWrapper>
        <BackLink to="/governance">
          <ArrowLeft size={16} />
          <Trans>Back to Governance</Trans>
        </BackLink>
        <ThemedText.BodyPrimary>
          <Trans>Proposal not found</Trans>
        </ThemedText.BodyPrimary>
      </PageWrapper>
    )
  }

  return (
    <Trace page={InterfacePageName.VOTE_PAGE} shouldLogImpression>
      <PageWrapper>
        <BackLink to="/governance">
          <ArrowLeft size={16} />
          <Trans>Back to Governance</Trans>
        </BackLink>

        {/* Header Section */}
        <HeaderSection>
          <HeaderTop>
            <div>
              <Row align="center">
                <ProposalBadge>UIP-{proposal.id}</ProposalBadge>
                <StatusBadge variant={getStatusVariant(proposal.status)} isActive={isActive}>
                  {getStatusText(proposal.status)}
                  {getStatusIcon(proposal.status) && <BadgeIcon>{getStatusIcon(proposal.status)}</BadgeIcon>}
                </StatusBadge>
              </Row>
              <ProposalTitle>{proposal.title}</ProposalTitle>
            </div>
            {(isPending || isActive) && (
              <CountdownBadge>
                <Clock size={16} />
                {isPending ? (
                  <span>Starts in {formatCountdown(blocksUntilStart)}</span>
                ) : (
                  <span>Ends in {formatCountdown(blocksUntilEnd)}</span>
                )}
              </CountdownBadge>
            )}
          </HeaderTop>
          <HeaderMeta>
            <MetaItem>
              <span>Proposer:</span>
              <AddressText onClick={() => handleCopyAddress(proposal.proposer)}>
                {truncateAddress(proposal.proposer)}
                <Copy size={12} />
              </AddressText>
            </MetaItem>
            <MetaItem>
              <span>Start:</span>
              <span>Block #{proposal.startBlock.toLocaleString()}</span>
            </MetaItem>
            <MetaItem>
              <span>End:</span>
              <span>Block #{proposal.endBlock.toLocaleString()}</span>
            </MetaItem>
          </HeaderMeta>
        </HeaderSection>

        {/* Cast Vote Section - only show for pending or active proposals */}
        {(isPending || isActive) && (
          <CastVoteSection>
            <SectionTitle>
              <Trans>Cast Your Vote</Trans>
            </SectionTitle>
            <VotingPowerRow>
              <VotingPowerLabel>
                <Trans>Your Voting Power</Trans>
              </VotingPowerLabel>
              <VotingPowerValue>{formattedVotingPower} UBE</VotingPowerValue>
            </VotingPowerRow>
            <VoteButtonsRow>
              <VoteButton variant="for" disabled={!isActive || !account}>
                <Trans>Accept</Trans>
              </VoteButton>
              <VoteButton variant="against" disabled={!isActive || !account}>
                <Trans>Reject</Trans>
              </VoteButton>
              <VoteButton variant="abstain" disabled={!isActive || !account}>
                <Trans>Abstain</Trans>
              </VoteButton>
            </VoteButtonsRow>
          </CastVoteSection>
        )}

        {/* Main Area */}
        <MainArea>
          <MainColumn>
            <TabsContainer>
              <TabsHeader>
                <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')}>
                  <Trans>Details</Trans>
                </TabButton>
                <TabButton active={activeTab === 'voters'} onClick={() => setActiveTab('voters')}>
                  <Trans>Voters</Trans>
                </TabButton>
                <TabButton active={activeTab === 'discussion'} onClick={() => setActiveTab('discussion')}>
                  <Trans>Discussion</Trans>
                </TabButton>
              </TabsHeader>
              <TabContent>
                {activeTab === 'details' && (
                  <DescriptionText>{proposal.description || 'No description available.'}</DescriptionText>
                )}
                {activeTab === 'voters' && (
                  <VotersTable>
                    <VotersTableHeader>
                      <tr>
                        <VotersTableHeaderCell>
                          <Trans>Address</Trans>
                        </VotersTableHeaderCell>
                        <VotersTableHeaderCell>
                          <Trans>Vote</Trans>
                        </VotersTableHeaderCell>
                        <VotersTableHeaderCell>
                          <Trans>Amount</Trans>
                        </VotersTableHeaderCell>
                      </tr>
                    </VotersTableHeader>
                    <VotersTableBody>
                      {MOCK_VOTERS.map((voter, index) => (
                        <VotersTableRow key={index}>
                          <VotersTableCell>
                            <VoterAddress>{truncateAddress(voter.address)}</VoterAddress>
                          </VotersTableCell>
                          <VotersTableCell>
                            <VoterVoteBadge vote={voter.vote}>{voter.vote}</VoterVoteBadge>
                          </VotersTableCell>
                          <VotersTableCell>
                            <VoterAmount>{voter.amount} UBE</VoterAmount>
                          </VotersTableCell>
                        </VotersTableRow>
                      ))}
                    </VotersTableBody>
                  </VotersTable>
                )}
                {activeTab === 'discussion' && (
                  <div>
                    {MOCK_COMMENTS.map((comment, index) => (
                      <CommentItem key={index}>
                        <CommentHeader>
                          <CommentAuthor>{truncateAddress(comment.author)}</CommentAuthor>
                          <CommentDate>{comment.date}</CommentDate>
                        </CommentHeader>
                        <CommentText>{comment.text}</CommentText>
                        {comment.replies.map((reply, replyIndex) => (
                          <ReplyContainer key={replyIndex}>
                            <CommentHeader>
                              <CommentAuthor>{truncateAddress(reply.author)}</CommentAuthor>
                              <CommentDate>{reply.date}</CommentDate>
                            </CommentHeader>
                            <CommentText>{reply.text}</CommentText>
                          </ReplyContainer>
                        ))}
                      </CommentItem>
                    ))}
                  </div>
                )}
              </TabContent>
            </TabsContainer>
          </MainColumn>

          <Sidebar>
            <VotingStats
              forVotes={proposal.forVotes}
              againstVotes={proposal.againstVotes}
              abstainVotes={proposal.abstainVotes}
              status={proposal.status}
              startBlock={proposal.startBlock}
              endBlock={proposal.endBlock}
              proposer={proposal.proposer}
              blockNumber={proposal.blockNumber}
              currentBlock={currentBlock ?? 0}
            />
          </Sidebar>
        </MainArea>
      </PageWrapper>
    </Trace>
  )
}
