/**
 * UbeAgent: lists the agents deployed by the connected wallet.
 * Follows the UbeStarter/Earn layout: large hero header with an illustration, summary stats, and a card grid.
 */
import { useWeb3React } from '@web3-react/core'
import { MAX_WIDTH_MEDIA_BREAKPOINT } from 'components/Tokens/constants'
import { Trans } from 'i18n'
import { Calendar, Layers, Plus } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import styled, { useTheme } from 'styled-components'
import { ThemedText } from 'theme/components'

import { ConnectWalletButton, CREATE_AGENT_PATH, CreateAgentButton } from './components/actions'
import {
  AgentAvatar,
  AgentIllustration,
  agentName,
  formatDate,
  formatPools,
  formatUsd,
  shortenAddr,
  StatusBadge,
  useStatusColor,
} from './components/shared'
import { UserAgent, useUserAgents } from './data/useUserAgents'

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
`

const Hero = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 36px;
  padding: 32px 0 40px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    flex-direction: column-reverse;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 16px 0 24px;
  }
`

const HeroText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 560px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    align-items: center;
  }
`

const HeroTitle = styled.h1`
  margin: 0;
  font-weight: 535;
  font-size: 72px;
  line-height: 88px;
  color: ${({ theme }) => theme.neutral1};

  span {
    background: linear-gradient(90deg, ${({ theme }) => theme.accent1}, #c1b4f5);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.lg}px`}) {
    font-size: 48px;
    line-height: 60px;
  }
  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    font-size: 36px;
    line-height: 44px;
  }
`

const HeroIllustration = styled(AgentIllustration)`
  flex-shrink: 0;
  max-width: 100%;
  height: auto;
`

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    grid-template-columns: repeat(2, 1fr);
  }
`

const StatCard = styled.div`
  padding: 16px 20px;
  border-radius: 16px;
  background: ${({ theme }) => theme.surface2};
  border: 1px solid ${({ theme }) => theme.surface3};
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    grid-template-columns: 1fr;
  }
`

const Card = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border-radius: 20px;
  background: ${({ theme }) => theme.surface1};
  border: 1px solid ${({ theme }) => theme.surface3};
  cursor: pointer;
  overflow: hidden;
  transition: transform ${({ theme }) => theme.transition.duration.medium},
    border-color ${({ theme }) => theme.transition.duration.medium};

  &:hover {
    transform: translateY(-2px);
    border-color: ${({ theme }) => theme.accent1};
  }
`

const CardGlow = styled.div<{ $color: string }>`
  position: absolute;
  top: -60px;
  right: -60px;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  opacity: 0.12;
  filter: blur(30px);
  pointer-events: none;
`

const CardTop = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`

const Mono = styled.span`
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 13px;
  color: ${({ theme }) => theme.neutral2};
`

const StrategyChip = styled.span`
  width: fit-content;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 535;
  line-height: 20px;
  color: ${({ theme }) => theme.accent1};
  background: ${({ theme }) => theme.accent2};
`

const InfoList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const InfoItem = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: ${({ theme }) => theme.neutral2};
`

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid ${({ theme }) => theme.surface3};
`

const CreateTile = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 220px;
  border-radius: 20px;
  border: 1.5px dashed ${({ theme }) => theme.accent1};
  background: ${({ theme }) => theme.accent2};
  color: ${({ theme }) => theme.accent1};
  font-family: inherit;
  font-size: 16px;
  font-weight: 535;
  cursor: pointer;
  transition: opacity ${({ theme }) => theme.transition.duration.fast};

  &:hover {
    opacity: 0.8;
  }
`

const PlusCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ theme }) => theme.accent1};
  color: ${({ theme }) => theme.neutralContrast};
`

const EmptyCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 48px 24px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.surface3};
  background: ${({ theme }) => theme.surface1};
`

function AgentCard({ agent }: { agent: UserAgent }) {
  const theme = useTheme()
  const statusColor = useStatusColor(agent.status)

  return (
    <Card>
      <CardGlow $color={statusColor} />
      <CardTop>
        <AgentAvatar seed={agent.id} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ThemedText.SubHeader>{agentName(agent)}</ThemedText.SubHeader>
          <Mono>{shortenAddr(agent.address)}</Mono>
        </div>
        <StatusBadge status={agent.status} />
      </CardTop>
      <InfoList>
        <StrategyChip>{agent.strategy}</StrategyChip>
        <InfoItem>
          <Layers size={16} color={theme.neutral3} />
          {formatPools(agent.poolCount)}
        </InfoItem>
        <InfoItem>
          <Calendar size={16} color={theme.neutral3} />
          <span>
            <Trans>Rent paid until</Trans> {formatDate(agent.rentPaidUntil)}
          </span>
        </InfoItem>
      </InfoList>
      <CardFooter>
        <ThemedText.LabelSmall>
          <Trans>Balance</Trans>
        </ThemedText.LabelSmall>
        <ThemedText.HeadlineSmall>{formatUsd(agent.balanceUsd)}</ThemedText.HeadlineSmall>
      </CardFooter>
    </Card>
  )
}

function Stats({ agents }: { agents: UserAgent[] }) {
  const running = agents.filter((a) => a.status === 'running').length
  const total = agents.reduce((sum, a) => sum + a.balanceUsd, 0)
  const pools = agents.reduce((sum, a) => sum + a.poolCount, 0)
  const items = [
    { label: <Trans>Total agents</Trans>, value: agents.length },
    { label: <Trans>Running</Trans>, value: running },
    { label: <Trans>Pools covered</Trans>, value: pools },
    { label: <Trans>Total balance</Trans>, value: formatUsd(total) },
  ]
  return (
    <StatsRow>
      {items.map((item, i) => (
        <StatCard key={i}>
          <ThemedText.LabelSmall>{item.label}</ThemedText.LabelSmall>
          <ThemedText.HeadlineSmall>{item.value}</ThemedText.HeadlineSmall>
        </StatCard>
      ))}
    </StatsRow>
  )
}

export default function UbeAgentPage() {
  const { account } = useWeb3React()
  const { agents } = useUserAgents()
  const navigate = useNavigate()

  return (
    <Container>
      <Inner>
        <Hero>
          <HeroText>
            <HeroTitle>
              Ube<span>Agent</span>
            </HeroTitle>
            <ThemedText.HeadlineSmall color="neutral2">
              <Trans>Deploy autonomous agents that trade, provide liquidity and farm on Celo — around the clock.</Trans>
            </ThemedText.HeadlineSmall>
            <div>{account ? <CreateAgentButton /> : <ConnectWalletButton />}</div>
          </HeroText>
          <HeroIllustration width={380} />
        </Hero>

        {agents.length > 0 && <Stats agents={agents} />}

        <SectionHeader>
          <ThemedText.HeadlineMedium>
            <Trans>Your agents</Trans>
          </ThemedText.HeadlineMedium>
        </SectionHeader>

        {agents.length > 0 ? (
          <Grid>
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
            <CreateTile onClick={() => navigate(CREATE_AGENT_PATH)}>
              <PlusCircle>
                <Plus size={24} />
              </PlusCircle>
              <Trans>Create new agent</Trans>
            </CreateTile>
          </Grid>
        ) : (
          <EmptyCard>
            <ThemedText.HeadlineSmall>
              {account ? <Trans>You have not deployed any agents yet</Trans> : <Trans>Wallet not connected</Trans>}
            </ThemedText.HeadlineSmall>
            <ThemedText.BodySecondary>
              {account ? (
                <Trans>Your deployed agents will show up here.</Trans>
              ) : (
                <Trans>Connect your wallet to see the agents you have deployed.</Trans>
              )}
            </ThemedText.BodySecondary>
            <div style={{ marginTop: 8 }}>{account ? <CreateAgentButton /> : <ConnectWalletButton />}</div>
          </EmptyCard>
        )}
      </Inner>
    </Container>
  )
}
