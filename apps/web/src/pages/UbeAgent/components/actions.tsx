import { useToggleAccountDrawer } from 'components/AccountDrawer/MiniPortfolio/hooks'
import { ButtonPrimary } from 'components/Button'
import { Trans } from 'i18n'
import { Plus } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'

export const CREATE_AGENT_PATH = '/ubeagent/create'

const StyledCreateButton = styled(ButtonPrimary)`
  border-radius: 12px;
  font-size: 16px;
  padding: 8px 16px;
  width: fit-content;
  gap: 6px;
  white-space: nowrap;
`

export function CreateAgentButton({ className }: { className?: string }) {
  const navigate = useNavigate()
  return (
    <StyledCreateButton className={className} onClick={() => navigate(CREATE_AGENT_PATH)} data-testid="create-agent">
      <Plus size={18} />
      <Trans>Create new agent</Trans>
    </StyledCreateButton>
  )
}

const StyledConnectButton = styled(ButtonPrimary)`
  border-radius: 12px;
  font-size: 16px;
  padding: 8px 16px;
  width: fit-content;
`

export function ConnectWalletButton() {
  const toggleWalletDrawer = useToggleAccountDrawer()
  return (
    <StyledConnectButton onClick={toggleWalletDrawer}>
      <Trans>Connect a wallet</Trans>
    </StyledConnectButton>
  )
}
