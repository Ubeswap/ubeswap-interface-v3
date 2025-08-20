import { ChainId, CurrencyAmount } from '@ubeswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { ButtonConfirmed, ButtonError, ButtonOutlined } from 'components/Button'
import { BlueCard } from 'components/Card'
import { AutoColumn, Column } from 'components/Column'
import Row, { AutoRow } from 'components/Row'
import TransactionConfirmationModal from 'components/TransactionConfirmationModal'
import { UBE } from 'constants/tokens'
import { useToken } from 'hooks/Tokens'
import { useAtom } from 'jotai'
import useCurrencyBalance from 'lib/hooks/useCurrencyBalance'
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { ThemedText } from 'theme/components'
import { NumberType, useFormatter } from 'utils/formatNumbers'
import Loader from '../../components-old/Loader'
import { ApprovalState, useApproveCallback } from '../../hooks/useApproveCallback'
import AppBody from '../AppBody'
import { getFactoryAddress } from './launchpad-constants'
import { launchpadParams, launchpadValidationResult } from './launchpad-state'
import { useDeployLauchpadCallback } from './ubestarter-factory-actions'

const PageWrapper = styled(AutoColumn)`
  padding: 68px 8px 0px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.md}px`}) {
    padding: 48px 8px 0px;
  }

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding-top: 20px;
  }
`
const Table = styled.table`
  border: 1px solid ${({ theme }) => theme.surface3};
  border-radius: 20px;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
  width: 100%;
  min-width: 500px;
  overflow: hidden;
`

export const Thead = styled.thead`
  overflow: auto;
  width: unset;
  background: ${({ theme }) => theme.surface2};
  overscroll-behavior: none;
`

const TR = styled.tr`
  width: 100%;

  &:last-child {
    border-bottom: none;
  }
`

const TD = styled.td`
  border: ${({ theme }) => `1px solid ${theme.surface3}`};
  color: ${({ theme }) => theme.neutral2};
  padding: 10px 16px;
  text-align: left;
  vertical-align: middle;
  font-weight: 485;
  font-size: 16px;
`

const SimpleTable = ({ children }: { children: ReactNode }) => {
  return (
    <Table>
      <tbody>{children}</tbody>
    </Table>
  )
}

const Divider = styled.div`
  border-bottom: ${({ theme }) => `1px solid ${theme.surface3}`};
  width: 100%;
  margin: 20px 0;
`

export default function FinalStep({ onBack }: { onBack: () => void }) {
  const { account } = useWeb3React()
  const { formatCurrencyAmount } = useFormatter()
  const [options] = useAtom(launchpadParams)
  const [validationResult] = useAtom(launchpadValidationResult)

  const token = useToken(options.tokenInfo.tokenAddress)
  const quoteToken = useToken(options.tokenSale.quoteToken)
  const tokenBalance = useCurrencyBalance(account, token)
  const ubeBalance = useCurrencyBalance(account, UBE[ChainId.CELO])

  // UBE Approval process
  const ubeFeeAmount = CurrencyAmount.fromRawAmount(UBE[ChainId.CELO], validationResult?.feeAmountWei || 0)
  const [ubeApproval, ubeApproveCallback] = useApproveCallback(ubeFeeAmount, getFactoryAddress())
  const [ubeApprovalSubmitted, setUbeApprovalSubmitted] = useState<boolean>(false)
  useEffect(() => {
    if (ubeApproval === ApprovalState.PENDING) {
      setUbeApprovalSubmitted(true)
    }
  }, [ubeApproval, setUbeApprovalSubmitted])
  const handleUbeApprove = useCallback(() => {
    if (!ubeApproveCallback) {
      return
    }
    ubeApproveCallback()
      .then(() => {
        //
      })
      .catch((error) => {
        console.error(error)
      })
  }, [ubeApproveCallback])

  // Token Approval process
  const tokenAmountForSale =
    token && validationResult ? CurrencyAmount.fromRawAmount(token, validationResult.tokensForSaleWei) : undefined
  const tokenAmountForLiq =
    token && validationResult ? CurrencyAmount.fromRawAmount(token, validationResult.tokensForLiquidityWei) : undefined
  const tokenAmount = tokenAmountForSale && tokenAmountForLiq ? tokenAmountForSale.add(tokenAmountForLiq) : undefined
  const [tokenApproval, tokenApproveCallback] = useApproveCallback(tokenAmount, getFactoryAddress())
  const [tokenApprovalSubmitted, setTokenApprovalSubmitted] = useState<boolean>(false)
  useEffect(() => {
    if (tokenApproval === ApprovalState.PENDING) {
      setTokenApprovalSubmitted(true)
    }
  }, [tokenApproval, setTokenApprovalSubmitted])
  const handleTokenApprove = useCallback(() => {
    if (!tokenApproveCallback) {
      return
    }
    tokenApproveCallback()
      .then(() => {
        //
      })
      .catch((error) => {
        console.error(error)
      })
  }, [tokenApproveCallback])

  // --------
  const navigate = useNavigate()
  const onDissmissConfirmationModal = useCallback(() => {}, [])
  const [callDeploy, deployTxHash, isDeploying] = useDeployLauchpadCallback()
  const onDeploy = useCallback(() => {
    console.log('onDeploy')
    if (isDeploying == false) {
      console.log('isDeploying false')
      callDeploy().then(() => {
        console.log('hello')
        localStorage.removeItem('ubestarter_options')
        setTimeout(() => navigate('/ubestarter'), 1000)
      })
    }
  }, [isDeploying, callDeploy, navigate])

  const errorText: string | undefined = useMemo(() => {
    if (!account) {
      return 'Connect Wallet'
    }
    if (ubeBalance && ubeBalance.lessThan(ubeFeeAmount)) {
      return 'Insufficient UBE balance'
    }
    if (tokenBalance && tokenAmount && tokenBalance.lessThan(tokenAmount)) {
      return `Insufficient ${token?.symbol} balance`
    }
    return undefined
  }, [account, ubeBalance, ubeFeeAmount, token, tokenBalance, tokenAmount])

  return (
    <PageWrapper>
      <TransactionConfirmationModal
        isOpen={isDeploying}
        attemptingTxn={isDeploying}
        hash={deployTxHash}
        reviewContent={() => <div></div>}
        onDismiss={onDissmissConfirmationModal}
        pendingText="Creating Launchpad"
      />
      <AppBody $maxWidth="800px">
        <Column style={{ padding: '20px' }}>
          <ThemedText.MediumHeader marginBottom="12px">Launchpad Creation Confirmation</ThemedText.MediumHeader>
          <Divider />

          <SimpleTable>
            <TR>
              <TD>
                <ThemedText.BodyPrimary color="neutral2">Token for Sale</ThemedText.BodyPrimary>
              </TD>
              <TD>
                <ThemedText.BodyPrimary color="neutral1">
                  {token?.name} {token?.symbol}
                </ThemedText.BodyPrimary>
              </TD>
            </TR>
            <TR>
              <TD>
                <ThemedText.BodyPrimary color="neutral2">Token to be raised</ThemedText.BodyPrimary>
              </TD>
              <TD>
                <ThemedText.BodyPrimary color="neutral1">
                  {quoteToken?.name} {quoteToken?.symbol}
                </ThemedText.BodyPrimary>
              </TD>
            </TR>
            <TR>
              <TD>
                <ThemedText.BodyPrimary color="neutral2">Fee amount</ThemedText.BodyPrimary>
              </TD>
              <TD>
                <ThemedText.BodyPrimary color="neutral1">
                  {formatCurrencyAmount({
                    amount: ubeFeeAmount,
                    type: NumberType.TokenNonTx,
                  })}{' '}
                  UBE
                </ThemedText.BodyPrimary>
              </TD>
            </TR>
            <TR>
              <TD>
                <ThemedText.BodyPrimary color="neutral2">Token amount for sale</ThemedText.BodyPrimary>
              </TD>
              <TD>
                <ThemedText.BodyPrimary color="neutral1">
                  {formatCurrencyAmount({
                    amount: tokenAmountForSale,
                    type: NumberType.TokenNonTx,
                  })}{' '}
                  {token?.symbol}
                </ThemedText.BodyPrimary>
              </TD>
            </TR>
            <TR>
              <TD>
                <ThemedText.BodyPrimary color="neutral2">Token amount for liquidity</ThemedText.BodyPrimary>
              </TD>
              <TD>
                <ThemedText.BodyPrimary color="neutral1">
                  {formatCurrencyAmount({
                    amount: tokenAmountForLiq,
                    type: NumberType.TokenNonTx,
                  })}{' '}
                  {token?.symbol}
                </ThemedText.BodyPrimary>
              </TD>
            </TR>
            <TR>
              <TD>
                <ThemedText.BodyPrimary color="neutral2">Liquidity Action</ThemedText.BodyPrimary>
              </TD>
              <TD>
                {options.liquidity.liquidityAction == 'BURN' ? (
                  <ThemedText.BodyPrimary color="neutral1">Liquidty will be burned</ThemedText.BodyPrimary>
                ) : (
                  <ThemedText.BodyPrimary color="neutral1">
                    Liquidty will be locked for {options.liquidity.lockDurationDays} days
                  </ThemedText.BodyPrimary>
                )}
              </TD>
            </TR>
          </SimpleTable>

          <BlueCard marginTop="20px">
            <AutoColumn gap="10px">
              <ThemedText.DeprecatedLink fontWeight={485} color="accent1">
                <ul>
                  <li>
                    <strong>
                      {formatCurrencyAmount({
                        amount: ubeFeeAmount,
                        type: NumberType.TokenNonTx,
                      })}{' '}
                      UBE
                    </strong>{' '}
                    will be transfered from your wallet and burned.
                  </li>
                  <li>
                    <strong>
                      {formatCurrencyAmount({
                        amount: tokenAmount,
                        type: NumberType.TokenNonTx,
                      })}{' '}
                      {token?.symbol}
                    </strong>{' '}
                    will be transfered from your wallet.
                  </li>
                </ul>
              </ThemedText.DeprecatedLink>
            </AutoColumn>
          </BlueCard>

          <Row gap="20px" marginTop="20px">
            <ButtonOutlined onClick={onBack}>Back</ButtonOutlined>
            {ubeApproval !== ApprovalState.APPROVED ? (
              <ButtonConfirmed
                onClick={handleUbeApprove}
                disabled={ubeApproval !== ApprovalState.NOT_APPROVED || ubeApprovalSubmitted}
                altDisabledStyle={ubeApproval === ApprovalState.PENDING} // show solid button while waiting
              >
                {ubeApproval === ApprovalState.PENDING ? (
                  <AutoRow gap="6px" justify="center">
                    Approving <Loader stroke="white" />
                  </AutoRow>
                ) : (
                  'Approve UBE'
                )}
              </ButtonConfirmed>
            ) : tokenApproval !== ApprovalState.APPROVED ? (
              <ButtonConfirmed
                onClick={handleTokenApprove}
                disabled={tokenApproval !== ApprovalState.NOT_APPROVED || tokenApprovalSubmitted}
                altDisabledStyle={tokenApproval === ApprovalState.PENDING} // show solid button while waiting
              >
                {tokenApproval === ApprovalState.PENDING ? (
                  <AutoRow gap="6px" justify="center">
                    Approving <Loader stroke="white" />
                  </AutoRow>
                ) : (
                  'Approve ' + token?.symbol
                )}
              </ButtonConfirmed>
            ) : (
              <ButtonError onClick={onDeploy} disabled={isDeploying || !!errorText} error={!!errorText}>
                {isDeploying ? 'Deploying...' : errorText ? errorText : 'Create Launch'}
              </ButtonError>
            )}
          </Row>
        </Column>
      </AppBody>
    </PageWrapper>
  )
}
