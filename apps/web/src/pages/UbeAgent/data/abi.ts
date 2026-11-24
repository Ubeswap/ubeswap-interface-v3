/** The parts of the UbeAgent contracts (ubeswap-arbitrage contracts/src) the page uses, as ethers fragments. */
export const FACTORY_ABI = [
  'function NUMERAIRE() view returns (address)',
  'function universe(address) view returns (bool allowed, uint8 kind, uint16 feeBps, address token0, address token1)',
  'function referenceOf(address) view returns (address)',
  'function rentPerMonth(address) view returns (uint256)',
  'function rentFor(address[] pools, address token) view returns (uint256)',
  'function basicRentPerMonth(address) view returns (uint256)',
  'function basicMaxDexes() view returns (uint8)',
  'function basicMaxTokens() view returns (uint8)',
  'function selectionCharge(address[] oldPools, address[] newPools, uint64 paidUntil) view returns (uint256)',
  'function configVersion() view returns (uint256)',
  'function listedPools() view returns (address[])',
  'function latest() view returns (address)',
  'function agentsOf(address user) view returns (address[])',
  'function isAgent(address) view returns (bool)',
  'function createAgent(address[] pools, uint256 months, address rentToken, bool autoUpdate, uint256 expectedVersion) returns (address agent)',
  'function extendRent(address agent, uint256 months, address rentToken)',
  'event AgentCreated(address indexed owner, address indexed agent, uint64 paidUntil)',
]

export const AGENT_ABI = [
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
  'function paidUntil() view returns (uint64)',
  'function autoUpdate() view returns (bool)',
  'function selectedPools() view returns (address[])',
  'function heldTokens() view returns (address[])',
  'function lossUsed() view returns (uint256)',
  'function lossBps() view returns (uint16)',
  'function implementation() view returns (address)',
  'function totalValue() view returns (uint256)',
  'function setPaused(bool p)',
  'function close()',
  'function update(uint256 expectedVersion)',
  'function setPools(address[] pools, uint256 expectedVersion)',
  'function withdraw(address token, uint256 amount)',
  'event Refueled(address indexed executor, uint256 amount)',
  'event Withdrawn(address indexed token, uint256 amount)',
  'event PausedSet(bool paused)',
  'event Traded(address indexed pool, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 valueIn, uint256 valueOut)',
]

export const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
]

/** Enough of a V2 pair / V3 pool for listing and pricing (slot0's first word is the sqrt price). */
export const POOL_ABI = [
  'function factory() view returns (address)',
  'function fee() view returns (uint24)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function slot0() view returns (uint160 sqrtPriceX96)',
]
