import { BigNumber } from '@ethersproject/bignumber'
import { splitSignature } from '@ethersproject/bytes'
import { Contract } from '@ethersproject/contracts'
import { useQuery } from '@tanstack/react-query'
import { useWeb3React } from '@web3-react/core'
import useSelectChain from 'hooks/useSelectChain'
import { useCallback } from 'react'
import { useTransactionAdder } from 'state/transactions/hooks'
import { TransactionType } from 'state/transactions/types'

import { AGENT_ABI, ERC20_ABI, FACTORY_ABI, STAKING_ABI } from './abi'
import {
  COMPOUND_CHAIN,
  COMPOUND_FACTORY,
  COMPOUND_FROM_BLOCK,
  COMPOUND_GAS,
  REWARD_TO_FEE,
  UBE_STAKE,
  UBE_TOKEN,
  compoundProvider,
} from './config'

const ZERO = '0x0000000000000000000000000000000000000000'

export type CompoundHistory = { ts: number; reward: BigNumber; fee: BigNumber; restaked: BigNumber }

export type CompoundAgentState = {
  address: string
  staked: BigNumber
  pending: BigNumber
  intervalIdx: number
  lastCompound: number
  nextCompoundAt: number
  vote: number
  fees: BigNumber
  history: CompoundHistory[]
}

export type CompoundState = {
  /** chain time of the latest block (a fork can run ahead of the wall clock) */
  now: number
  balance: BigNumber
  allowance: BigNumber
  /** UBE the account stakes in UBE Stake itself (the old way), and its unclaimed reward there */
  directStaked: BigNumber
  directEarned: BigNumber
  /** UBE Stake's reward rate per second, 0 once its period has ended */
  rewardRate: BigNumber
  totalStaked: BigNumber
  /** reward a keeper turn needs before it runs: REWARD_TO_FEE x its gas fee in UBE */
  turnNeedsUBE: BigNumber
  agent?: CompoundAgentState
}

async function load(account: string, factoryAddress: string): Promise<CompoundState> {
  const provider = compoundProvider()
  const ube = new Contract(UBE_TOKEN, ERC20_ABI, provider)
  const staking = new Contract(UBE_STAKE, STAKING_ABI, provider)
  const factory = new Contract(factoryAddress, FACTORY_ABI, provider)

  const [
    block,
    gasPrice,
    balance,
    allowance,
    agentAddress,
    rate,
    total,
    finish,
    gasUnitsCap,
    directStaked,
    directEarned,
  ] = await Promise.all([
    provider.getBlock('latest'),
    provider.getGasPrice(),
    ube.balanceOf(account) as Promise<BigNumber>,
    ube.allowance(account, factoryAddress) as Promise<BigNumber>,
    factory.agentOf(account) as Promise<string>,
    staking.rewardRate() as Promise<BigNumber>,
    staking.totalSupply() as Promise<BigNumber>,
    staking.periodFinish() as Promise<BigNumber>,
    factory.gasUnitsCap() as Promise<BigNumber>,
    staking.balanceOf(account) as Promise<BigNumber>,
    staking.earned(account) as Promise<BigNumber>,
  ])
  const feeCap: BigNumber = await factory.feeCapUBE(gasPrice)
  const now = Math.max(block.timestamp, Math.floor(Date.now() / 1000))
  const state: CompoundState = {
    now,
    balance,
    allowance,
    directStaked,
    directEarned,
    rewardRate: finish.gt(block.timestamp) ? rate : BigNumber.from(0),
    totalStaked: total,
    turnNeedsUBE: feeCap.mul(COMPOUND_GAS).div(gasUnitsCap).mul(REWARD_TO_FEE),
  }
  if (agentAddress === ZERO) return state

  const agent = new Contract(agentAddress, AGENT_ABI, provider)
  const [staked, pending, intervalIdx, lastCompound, nextCompoundAt, vote, logs] = await Promise.all([
    agent.staked() as Promise<BigNumber>,
    agent.pendingReward() as Promise<BigNumber>,
    agent.intervalIdx() as Promise<number>,
    agent.lastCompound() as Promise<BigNumber>,
    agent.nextCompoundAt() as Promise<BigNumber>,
    staking.userDelegateIdx(agentAddress) as Promise<number>,
    agent.queryFilter(agent.filters.Compounded(), COMPOUND_FROM_BLOCK),
  ])
  const recent = logs.slice(-5)
  const times = await Promise.all(recent.map((l) => provider.getBlock(l.blockNumber).then((b) => b.timestamp)))
  state.agent = {
    address: agentAddress,
    staked,
    pending,
    intervalIdx,
    lastCompound: lastCompound.toNumber(),
    nextCompoundAt: nextCompoundAt.toNumber(),
    vote,
    fees: logs.reduce((sum, l) => sum.add(l.args?.fee ?? 0), BigNumber.from(0)),
    history: recent.map((l, i) => ({
      ts: times[i],
      reward: l.args?.reward ?? BigNumber.from(0),
      fee: l.args?.fee ?? BigNumber.from(0),
      restaked: l.args?.restaked ?? BigNumber.from(0),
    })),
  }
  return state
}

/** The connected account's UBE, allowance and compound agent; undefined while there is no factory or no account. */
export function useCompoundState() {
  const { account } = useWeb3React()
  return useQuery({
    queryKey: ['compound-staking', COMPOUND_FACTORY, account],
    queryFn: () => load(account as string, COMPOUND_FACTORY as string),
    enabled: !!account && !!COMPOUND_FACTORY,
    refetchInterval: 10_000,
  })
}

/**
 * Sends compound transactions from the connected wallet (switching it to Celo first) and waits for each receipt.
 * Gas is 1.5x the estimate: UBE Stake forwards a stake to its voter through a low-level call that runs out of gas at
 * the node's estimate (createAgent reverted at it on a Celo fork).
 */
export function useCompoundTx() {
  const { provider, account, chainId } = useWeb3React()
  const selectChain = useSelectChain()
  const addTransaction = useTransactionAdder()

  return useCallback(
    async (address: string, abi: string[], method: string, args: unknown[], summary: string) => {
      if (!provider || !account) throw new Error('Connect a wallet first.')
      if (chainId !== COMPOUND_CHAIN && !(await selectChain(COMPOUND_CHAIN)))
        throw new Error('Switch your wallet to Celo.')
      const contract = new Contract(address, abi, provider.getSigner(account))
      const gas: BigNumber = await contract.estimateGas[method](...args)
      const tx = await contract[method](...args, { gasLimit: gas.mul(3).div(2) })
      addTransaction(tx, { type: TransactionType.CUSTOM, summary })
      const receipt = await tx.wait()
      if (receipt.status !== 1) throw new Error(`${summary} failed`)
      return receipt
    },
    [provider, account, chainId, selectChain, addTransaction]
  )
}

/**
 * Signs a UBE permit for the factory (EIP-712; UBE's domain has name, chainId and verifyingContract, no version), so
 * staking through the agent needs a signature instead of an approve transaction.
 */
export function useUbePermit() {
  const { provider, account } = useWeb3React()
  return useCallback(
    async (amount: BigNumber, now: number) => {
      if (!provider || !account || !COMPOUND_FACTORY) throw new Error('Connect a wallet first.')
      const nonce: BigNumber = await new Contract(UBE_TOKEN, ERC20_ABI, compoundProvider()).nonces(account)
      const deadline = now + 3600
      const signature = await provider.getSigner(account)._signTypedData(
        { name: 'Ubeswap', chainId: COMPOUND_CHAIN, verifyingContract: UBE_TOKEN },
        {
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        { owner: account, spender: COMPOUND_FACTORY, value: amount, nonce, deadline }
      )
      const { v, r, s } = splitSignature(signature)
      return { deadline, v, r, s }
    },
    [provider, account]
  )
}
