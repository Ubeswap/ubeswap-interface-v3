import { Trans } from 'i18n'
import { transparentize } from 'polished'
import { Check } from 'react-feather'
import { ProposalState } from 'state/governance/hooks'
import styled from 'styled-components'

// Average block time in seconds (Celo ~5 seconds)
const BLOCK_TIME_SECONDS = 5

interface VotingStatsProps {
  forVotes: number
  againstVotes: number
  abstainVotes: number
  status: ProposalState
  startBlock: number
  endBlock: number
  proposer: string
  blockNumber: number
  currentBlock: number
}

// Styled Components
const Container = styled.div`
  background-color: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 16px;
  padding: 24px;
`

const SectionTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: ${({ theme }) => theme.neutral1};
  margin: 0 0 20px;
`

const VotingBar = styled.div`
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 20px;
  background-color: ${({ theme }) => theme.surface3};
`

const VoteSegment = styled.div<{ width: number; color: string }>`
  width: ${({ width }) => width}%;
  background-color: ${({ color }) => color};
  transition: width 0.3s ease;
`

const VoteStatsGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 20px;

  @media (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    grid-template-columns: 1fr;
  }
`

const VoteStat = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const VoteLabel = styled.div<{ color?: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: ${({ theme }) => theme.neutral2};

  &::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 2px;
    background-color: ${({ color, theme }) => color || theme.neutral3};
  }
`

const VotePercentage = styled.span<{ color?: string }>`
  font-size: 24px;
  font-weight: 600;
  color: ${({ color, theme }) => color || theme.neutral1};
`

const VoteCount = styled.span`
  font-size: 13px;
  color: ${({ theme }) => theme.neutral2};
`

const ThresholdCard = styled.div`
  background-color: ${({ theme }) => theme.surface2};
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
`

const ThresholdHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`

const ThresholdLabel = styled.span`
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
`

const ThresholdValue = styled.span`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.neutral1};
`

const ThresholdDescription = styled.p`
  font-size: 13px;
  color: ${({ theme }) => theme.neutral3};
  margin: 0;
  line-height: 1.4;
`

const Divider = styled.div`
  height: 1px;
  background-color: ${({ theme }) => theme.surface3};
  margin: 24px 0;
`

const HistoryTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: ${({ theme }) => theme.neutral1};
  margin: 0 0 16px;
`

const HistoryTimeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`

const HistoryItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`

const HistoryIcon = styled.div<{ completed?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${({ theme, completed }) => (completed ? transparentize(0.85, theme.success) : theme.surface3)};
  color: ${({ theme, completed }) => (completed ? theme.success : theme.neutral3)};
`

const HistoryContent = styled.div`
  flex: 1;
`

const HistoryLabel = styled.div`
  font-size: 14px;
  color: ${({ theme }) => theme.neutral1};
  margin-bottom: 2px;
`

const HistoryMeta = styled.div`
  font-size: 13px;
  color: ${({ theme }) => theme.neutral3};
`

// Helper functions
function formatVoteCount(votes: number): string {
  if (votes >= 1000000) {
    return `${(votes / 1000000).toFixed(1)}M votes`
  } else if (votes >= 1000) {
    return `${(votes / 1000).toFixed(0)}K votes`
  }
  return `${votes.toLocaleString()} votes`
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function estimateBlockDate(targetBlock: number, currentBlock: number): string {
  const blocksUntil = targetBlock - currentBlock
  const secondsUntil = blocksUntil * BLOCK_TIME_SECONDS
  const targetDate = new Date(Date.now() + secondsUntil * 1000)
  return targetDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function VotingStats({
  forVotes,
  againstVotes,
  abstainVotes,
  startBlock,
  endBlock,
  proposer,
  blockNumber,
  currentBlock,
}: VotingStatsProps) {
  const totalVotes = forVotes + againstVotes + abstainVotes
  const totalWithRemaining = totalVotes || 1 // Prevent division by zero

  const forPercentage = (forVotes / totalWithRemaining) * 100
  const againstPercentage = (againstVotes / totalWithRemaining) * 100
  const abstainPercentage = (abstainVotes / totalWithRemaining) * 100

  // Calculate participation percentage (mock: assume 50% quorum requirement)
  const quorumRequired = 50
  const participationPercentage = Math.min(100, Math.round((forPercentage + againstPercentage) * 0.84))

  // Determine history milestones
  const isDeployed = blockNumber > 0
  const isSubmitted = blockNumber > 0
  const isStarted = currentBlock >= startBlock
  const isEnded = currentBlock > endBlock

  // Use theme colors
  const forColor = '#40B66B' // success green
  const againstColor = '#FF5F52' // critical red
  const abstainColor = '#98A1C0' // neutral grey

  return (
    <Container>
      <SectionTitle>
        <Trans>Voting</Trans>
      </SectionTitle>

      {/* Voting Bar */}
      <VotingBar>
        <VoteSegment width={forPercentage} color={forColor} />
        <VoteSegment width={againstPercentage} color={againstColor} />
        <VoteSegment width={abstainPercentage} color={abstainColor} />
      </VotingBar>

      {/* Vote Stats */}
      <VoteStatsGrid>
        <VoteStat>
          <VoteLabel color={forColor}>FOR</VoteLabel>
          <VotePercentage color={forColor}>{forPercentage.toFixed(0)}%</VotePercentage>
          <VoteCount>{formatVoteCount(forVotes)}</VoteCount>
        </VoteStat>
        <VoteStat>
          <VoteLabel color={againstColor}>AGAINST</VoteLabel>
          <VotePercentage color={againstColor}>{againstPercentage.toFixed(0)}%</VotePercentage>
          <VoteCount>{formatVoteCount(againstVotes)}</VoteCount>
        </VoteStat>
      </VoteStatsGrid>

      <VoteStat style={{ marginBottom: 20 }}>
        <VoteLabel color={abstainColor}>ABSTAIN</VoteLabel>
        <VotePercentage color={abstainColor}>{abstainPercentage.toFixed(0)}%</VotePercentage>
        <VoteCount>{formatVoteCount(abstainVotes)}</VoteCount>
      </VoteStat>

      {/* Pass Threshold */}
      <ThresholdCard>
        <ThresholdHeader>
          <ThresholdLabel>
            <Trans>Pass threshold</Trans>
          </ThresholdLabel>
          <ThresholdValue>
            {participationPercentage}% / {quorumRequired}%
          </ThresholdValue>
        </ThresholdHeader>
        <ThresholdDescription>
          <Trans>At least {quorumRequired}% participation is needed to proceed with this proposal.</Trans>
        </ThresholdDescription>
      </ThresholdCard>

      <Divider />

      {/* History Timeline */}
      <HistoryTitle>
        <Trans>History</Trans>
      </HistoryTitle>
      <HistoryTimeline>
        <HistoryItem>
          <HistoryIcon completed={isDeployed}>
            <Check size={14} />
          </HistoryIcon>
          <HistoryContent>
            <HistoryLabel>
              <Trans>Deployed</Trans>
            </HistoryLabel>
            <HistoryMeta>{estimateBlockDate(blockNumber, currentBlock)}</HistoryMeta>
          </HistoryContent>
        </HistoryItem>

        <HistoryItem>
          <HistoryIcon completed={isSubmitted}>
            <Check size={14} />
          </HistoryIcon>
          <HistoryContent>
            <HistoryLabel>
              <Trans>Submitted</Trans>
            </HistoryLabel>
            <HistoryMeta>
              by {truncateAddress(proposer)}
              <br />
              Block {blockNumber.toLocaleString()}
            </HistoryMeta>
          </HistoryContent>
        </HistoryItem>

        <HistoryItem>
          <HistoryIcon completed={isStarted}>
            <Check size={14} />
          </HistoryIcon>
          <HistoryContent>
            <HistoryLabel>
              <Trans>Voting started</Trans>
            </HistoryLabel>
            <HistoryMeta>Block {startBlock.toLocaleString()}</HistoryMeta>
          </HistoryContent>
        </HistoryItem>

        <HistoryItem>
          <HistoryIcon completed={isEnded}>
            <Check size={14} />
          </HistoryIcon>
          <HistoryContent>
            <HistoryLabel>
              <Trans>Voting ended</Trans>
            </HistoryLabel>
            <HistoryMeta>Block {endBlock.toLocaleString()}</HistoryMeta>
          </HistoryContent>
        </HistoryItem>
      </HistoryTimeline>
    </Container>
  )
}
