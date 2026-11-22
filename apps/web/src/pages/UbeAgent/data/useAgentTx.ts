import { Contract } from '@ethersproject/contracts'
import { TransactionReceipt, TransactionResponse } from '@ethersproject/providers'
import { useWeb3React } from '@web3-react/core'
import useSelectChain from 'hooks/useSelectChain'
import { useCallback } from 'react'

import { AGENT_CHAIN } from './config'

/**
 * Sends UbeAgent transactions from the connected wallet: switches it to Celo first if needed, and waits for each
 * receipt (a reverted one throws).
 */
export function useAgentTx() {
  const { provider, account, chainId } = useWeb3React()
  const selectChain = useSelectChain()

  const signer = useCallback(async () => {
    if (!provider || !account) throw new Error('Connect a wallet first.')
    if (chainId !== AGENT_CHAIN && !(await selectChain(AGENT_CHAIN))) throw new Error('Switch your wallet to Celo.')
    return provider.getSigner(account)
  }, [provider, account, chainId, selectChain])

  /** A contract bound to the wallet's signer. */
  const contract = useCallback(
    async (address: string, abi: string[]) => new Contract(address, abi, await signer()),
    [signer]
  )

  /** Waits for `tx`; a reverted transaction throws `failure`. */
  const settle = useCallback(async (tx: TransactionResponse, failure: string): Promise<TransactionReceipt> => {
    const rc = await tx.wait()
    if (rc.status !== 1) throw new Error(failure)
    return rc
  }, [])

  return { account, signer, contract, settle }
}
