/** Human-readable ABIs of the Compound Staking contracts (CompoundAgentFactory, CompoundAgent) and what they read. */
export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function nonces(address) view returns (uint256)',
]

export const STAKING_ABI = [
  'function rewardRate() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function periodFinish() view returns (uint256)',
  'function userDelegateIdx(address) view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function earned(address) view returns (uint256)',
  'function exit()',
]

export const FACTORY_ABI = [
  'function agentOf(address user) view returns (address)',
  'function createAgentWithPermit(uint8 intervalIdx, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) returns (address)',
  'function depositWithPermit(uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)',
  'function predictAgent(address user) view returns (address)',
  'function feeCapUBE(uint256 gasPrice) view returns (uint256)',
  'function gasUnitsCap() view returns (uint256)',
]

export const AGENT_ABI = [
  'function staked() view returns (uint256)',
  'function pendingReward() view returns (uint256)',
  'function intervalIdx() view returns (uint8)',
  'function lastCompound() view returns (uint64)',
  'function nextCompoundAt() view returns (uint256)',
  'function setInterval(uint8 idx)',
  'function setVote(uint8 delegateIdx)',
  'function withdraw(uint256 amount)',
  'function exit()',
  'event Compounded(address indexed keeper, uint256 reward, uint256 fee, uint256 restaked)',
]
