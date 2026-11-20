import { AutoColumn } from 'components/Column'
import { Trans } from 'i18n'
import { ArrowLeft } from 'react-feather'
import styled from 'styled-components'
import { StyledInternalLink, ThemedText } from 'theme/components'

import { AgentIllustration } from './components/shared'

const Wrapper = styled(AutoColumn)`
  max-width: 480px;
  width: 100%;
  padding: 68px 16px 0;
  justify-items: center;
  text-align: center;
`

// Placeholder until the agent creation flow is built.
export default function CreateAgent() {
  return (
    <Wrapper gap="md">
      <AgentIllustration width={260} />
      <ThemedText.HeadlineMedium>
        <Trans>Create new agent</Trans>
      </ThemedText.HeadlineMedium>
      <ThemedText.BodySecondary>
        <Trans>Agent creation is coming soon.</Trans>
      </ThemedText.BodySecondary>
      <StyledInternalLink to="/ubeagent" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ArrowLeft size={16} />
        <Trans>Back to your agents</Trans>
      </StyledInternalLink>
    </Wrapper>
  )
}
