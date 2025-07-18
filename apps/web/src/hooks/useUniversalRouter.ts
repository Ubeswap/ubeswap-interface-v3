import { getDataSuffix, submitReferral } from '@divvi/referral-sdk'
import { TransactionResponse } from '@ethersproject/abstract-provider'
import { BigNumber } from '@ethersproject/bignumber'
import { CustomUserProperties, SwapEventName } from '@ubeswap/analytics-events'
import { ChainId, Percent, UNIVERSAL_ROUTER_ADDRESS } from '@ubeswap/sdk-core'
import { FlatFeeOptions, SwapRouter } from '@uniswap/universal-router-sdk'
import { FeeOptions, toHex } from '@uniswap/v3-sdk'
import { useWeb3React } from '@web3-react/core'
import { sendAnalyticsEvent, useTrace } from 'analytics'
import { getConnection } from 'connection'
import { useTotalBalancesUsdForAnalytics } from 'graphql/data/apollo/TokenBalancesProvider'
import { useGetTransactionDeadline } from 'hooks/useTransactionDeadline'
import { t } from 'i18n'
import useBlockNumber from 'lib/hooks/useBlockNumber'
import { formatCommonPropertiesForTrade, formatSwapSignedAnalyticsEventProperties } from 'lib/utils/analytics'
import { useCallback } from 'react'
import { ClassicTrade, TradeFillType } from 'state/routing/types'
import { useUserSlippageTolerance } from 'state/user/hooks'
import { trace } from 'tracing/trace'
import { calculateGasMargin } from 'utils/calculateGasMargin'
import { UserRejectedRequestError, WrongChainError } from 'utils/errors'
import isZero from 'utils/isZero'
import { didUserReject, swapErrorToUserReadableMessage } from 'utils/swapErrorToUserReadableMessage'
import { getWalletMeta } from 'utils/walletMeta'
import { PermitSignature } from './usePermitAllowance'

/** Thrown when gas estimation fails. This class of error usually requires an emulator to determine the root cause. */
class GasEstimationError extends Error {
  constructor() {
    super(t`Your swap is expected to fail.`)
  }
}

/**
 * Thrown when the user modifies the transaction in-wallet before submitting it.
 * In-wallet calldata modification nullifies any safeguards (eg slippage) from the interface, so we recommend reverting them immediately.
 */
class ModifiedSwapError extends Error {
  constructor() {
    super(
      t`Your swap was modified through your wallet. If this was a mistake, please cancel immediately or risk losing your funds.`
    )
  }
}

interface SwapOptions {
  slippageTolerance: Percent
  permit?: PermitSignature
  feeOptions?: FeeOptions
  flatFeeOptions?: FlatFeeOptions
}

export function useUniversalRouterSwapCallback(
  trade: ClassicTrade | undefined,
  fiatValues: { amountIn?: number; amountOut?: number; feeUsd?: number },
  options: SwapOptions
) {
  const { account, chainId, provider, connector } = useWeb3React()
  const analyticsContext = useTrace()
  const blockNumber = useBlockNumber()
  const getDeadline = useGetTransactionDeadline()
  const isAutoSlippage = useUserSlippageTolerance()[0] === 'auto'
  const portfolioBalanceUsd = useTotalBalancesUsdForAnalytics()

  return useCallback(
    (): Promise<{ type: TradeFillType.Classic; response: TransactionResponse; deadline?: BigNumber }> =>
      trace({ name: 'Swap (Classic)', op: 'swap.classic' }, async (trace) => {
        try {
          if (!account) throw new Error('missing account')
          if (!chainId) throw new Error('missing chainId')
          if (!provider) throw new Error('missing provider')
          if (!trade) throw new Error('missing trade')
          const connectedChainId = await provider.getSigner().getChainId()
          if (chainId !== connectedChainId) throw new WrongChainError()

          const deadline = await getDeadline()

          trace.setData('slippageTolerance', options.slippageTolerance.toFixed(2))
          const { calldata: data, value } = SwapRouter.swapERC20CallParameters(trade, {
            slippageTolerance: options.slippageTolerance,
            deadlineOrPreviousBlockhash: deadline?.toString(),
            inputTokenPermit: options.permit,
            fee: options.feeOptions,
            flatFee: options.flatFeeOptions,
          })
          const dataSuffix = getDataSuffix({
            consumer: '0x2c2bc76B97BCe84A5a9c6e2835AB13306B964cf1',
            providers: ['0x0423189886d7966f0dd7e7d256898daeee625dca', '0xc95876688026be9d6fa7a7c33328bd013effa2bb'],
          })
          const tx = {
            from: account,
            to: UNIVERSAL_ROUTER_ADDRESS(chainId),
            data: data + dataSuffix,
            // TODO(https://github.com/Uniswap/universal-router-sdk/issues/113): universal-router-sdk returns a non-hexlified value.
            ...(value && !isZero(value) ? { value: toHex(value) } : {}),
          }

          let gasLimit: BigNumber
          try {
            const gasEstimate = await provider.estimateGas(tx)
            gasLimit = calculateGasMargin(gasEstimate)
            trace.setData('gasLimit', gasLimit.toNumber())
          } catch (gasError) {
            sendAnalyticsEvent(SwapEventName.SWAP_ESTIMATE_GAS_CALL_FAILED, {
              ...formatCommonPropertiesForTrade(trade, options.slippageTolerance),
              ...analyticsContext,
              client_block_number: blockNumber,
              tx,
              isAutoSlippage,
            })
            console.warn(gasError)
            throw new GasEstimationError()
          }

          const response = await trace.child(
            { name: 'Send transaction', op: 'wallet.send_transaction' },
            async (walletTrace) => {
              try {
                return await provider.getSigner().sendTransaction({ ...tx, gasLimit })
              } catch (error) {
                if (didUserReject(error)) {
                  walletTrace.setStatus('cancelled')
                  throw new UserRejectedRequestError(swapErrorToUserReadableMessage(error))
                } else {
                  throw error
                }
              }
            }
          )
          submitReferral({
            txHash: response.hash as `0x${string}`,
            chainId: ChainId.CELO,
          })
          sendAnalyticsEvent(SwapEventName.SWAP_SIGNED, {
            ...formatSwapSignedAnalyticsEventProperties({
              trade,
              timeToSignSinceRequestMs: trace.now(),
              allowedSlippage: options.slippageTolerance,
              fiatValues,
              txHash: response.hash,
              portfolioBalanceUsd,
            }),
            ...analyticsContext,
            // TODO (WEB-2993): remove these after debugging missing user properties.
            [CustomUserProperties.WALLET_ADDRESS]: account,
            [CustomUserProperties.WALLET_TYPE]: getConnection(connector).getProviderInfo().name,
            [CustomUserProperties.PEER_WALLET_AGENT]: provider ? getWalletMeta(provider)?.agent : undefined,
          })
          if (tx.data !== response.data) {
            sendAnalyticsEvent(SwapEventName.SWAP_MODIFIED_IN_WALLET, {
              txHash: response.hash,
              ...analyticsContext,
            })
            if (!response.data || response.data.length === 0 || response.data === '0x') {
              throw new ModifiedSwapError()
            }
          }
          return { type: TradeFillType.Classic as const, response, deadline }
        } catch (error: unknown) {
          if (error instanceof GasEstimationError) {
            throw error
          } else if (error instanceof UserRejectedRequestError) {
            trace.setStatus('cancelled')
            throw error
          } else if (error instanceof ModifiedSwapError) {
            trace.setError(error, 'data_loss')
            throw error
          } else {
            trace.setError(error)
            throw Error(swapErrorToUserReadableMessage(error))
          }
        }
      }),
    [
      account,
      chainId,
      provider,
      trade,
      getDeadline,
      options.slippageTolerance,
      options.permit,
      options.feeOptions,
      options.flatFeeOptions,
      fiatValues,
      portfolioBalanceUsd,
      analyticsContext,
      connector,
      blockNumber,
      isAutoSlippage,
    ]
  )
}
