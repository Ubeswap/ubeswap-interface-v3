const MIN_TICK = -887272
const MAX_TICK = 887272

export interface IncentiveKey {
  rewardToken: string
  pool: string
  startTime: number
  lockTime: number
  minimumTickRange: number
  maxTickLower: number
  minTickLower: number
  maxTickUpper: number
  minTickUpper: number
}

const incentiveKeys: Record<string, IncentiveKey> = {
  // CELO-UBE 0.01% - UBE Incentive
  '0xeec6459eb0d7379623c6b1d8b323cc64dea67f43e6ca85e8909a27424d21e812': {
    rewardToken: '0x71e26d0e519d14591b9de9a0fe9513a398101490',
    pool: '0x3efc8d831b754d3ed58a2b4c37818f2e69dadd19',
    startTime: 1725104100,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: MAX_TICK,
    minTickLower: MIN_TICK,
    maxTickUpper: MAX_TICK,
    minTickUpper: MIN_TICK,
  },
  // CELO-UBE 0.01% - CELO Incentive
  '0x3b85446788d259ca857dbb337cdb9ba3557a7fe0ab296ee405b8d2fd51d2500d': {
    rewardToken: '0x471ece3750da237f93b8e339c536989b8978a438',
    pool: '0x3efc8d831b754d3ed58a2b4c37818f2e69dadd19',
    startTime: 1725105600,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: MAX_TICK,
    minTickLower: MIN_TICK,
    maxTickUpper: MAX_TICK,
    minTickUpper: MIN_TICK,
  },
  // USDGLO-USDC 0.01% - UBE Incentive
  '0x82774b5b1443759f20679a61497abf11115a4d0e2076caedf9d700a8c53f286f': {
    rewardToken: '0x71e26d0e519d14591b9de9a0fe9513a398101490',
    pool: '0x28ade0134b9d0bc7041f4e5ea74fecb58504720b',
    startTime: 1727713800,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: MAX_TICK,
    minTickLower: MIN_TICK,
    maxTickUpper: MAX_TICK,
    minTickUpper: MIN_TICK,
  },
  // USDGLO-USDC 0.01% - CELO Incentive
  '0x114570896ebb76092b5bca76943aa8d7792fec67a65ac7b4c809cacfbb79fac0': {
    rewardToken: '0x471ece3750da237f93b8e339c536989b8978a438',
    pool: '0x28ade0134b9d0bc7041f4e5ea74fecb58504720b',
    startTime: 1727713800,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: MAX_TICK,
    minTickLower: MIN_TICK,
    maxTickUpper: MAX_TICK,
    minTickUpper: MIN_TICK,
  },
  // USDGLO-USDC 0.01% - USDGLO Incentive
  '0x2262434f83b2caa9bfcd1a3d0463b58001bfb235f08b3fd78d5815604a26f72d': {
    rewardToken: '0x4f604735c1cf31399c6e711d5962b2b3e0225ad3',
    pool: '0x28ade0134b9d0bc7041f4e5ea74fecb58504720b',
    startTime: 1727713800,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: MAX_TICK,
    minTickLower: MIN_TICK,
    maxTickUpper: MAX_TICK,
    minTickUpper: MIN_TICK,
  },
  // CELO-USDC 1% - UBE Incentive
  '0x738da96b317eed57cea87521b9afc6db1da9198bde1dbb8d3dfc1316d2182d25': {
    rewardToken: '0x71e26d0E519D14591b9dE9a0fE9513A398101490',
    pool: '0x44569704b206798014217b8A02c700bf73cEb72F',
    startTime: 1750081381,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // CELO-USDC 1% - CELO Incentive
  '0x5ce1939298d9fa489ed7b72c73e2141a19097c527e3585041efa6df573675bf2': {
    rewardToken: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    pool: '0x44569704b206798014217b8A02c700bf73cEb72F',
    startTime: 1750081381,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // CELO-USDT 1% - UBE Incentive
  '0xfcdf11b63e8269a880bda8a38e80f2ad693faef5d262d49a376f67f74fb3fe73': {
    rewardToken: '0x71e26d0E519D14591b9dE9a0fE9513A398101490',
    pool: '0x6AdE22bD1D73C7162DF10E06B51dBc725e2D44a2',
    startTime: 1750081381,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // CELO-USDT 1% - CELO Incentive
  '0xe379e0032719339a09ee4a73f3b87aabb55b19d3ec963e2f3d3b6372728a4d1a': {
    rewardToken: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    pool: '0x6AdE22bD1D73C7162DF10E06B51dBc725e2D44a2',
    startTime: 1750081381,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // CELO-UBE 0.3% - UBE Incentive
  '0x49f80a97d9098a6bdc4b40c0ba916edd77ffce503e5b9afa8efae6d6212fc3fb': {
    rewardToken: '0x71e26d0E519D14591b9dE9a0fE9513A398101490',
    pool: '0x1eF76d432280C837E5668f582C82de8f6cA4024d',
    startTime: 1750081381,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // CELO-UBE 0.3% - CELO Incentive
  '0x97b265327f11c09b6b4443d3539e779ddaef5cadf64b78dcc5a818dd23fe568e': {
    rewardToken: '0x471EcE3750Da237f93B8E339c536989b8978a438',
    pool: '0x1eF76d432280C837E5668f582C82de8f6cA4024d',
    startTime: 1750081381,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // USDGLO-G$ 1% - UBE Incentive
  '0x331a86c2cac46e56186ffdec064eff69309e8295620b2004dd12369e564f8442': {
    rewardToken: '0x71e26d0E519D14591b9dE9a0fE9513A398101490',
    pool: '0x3D9e27C04076288eBfdC4815b4f6d81b0ED1b341',
    startTime: 1750610974,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // USDGLO-G$ 1% - G$ Incentive
  '0xd16e99550073f6aa8d9c3869df25ff1914ad9337d4e60f9fa7dbf50da542f808': {
    rewardToken: '0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A',
    pool: '0x3D9e27C04076288eBfdC4815b4f6d81b0ED1b341',
    startTime: 1750610974,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // REGEN-CELO 0.3% - UBE Incentive
  '0x9fde166e7857f8b802dcd5da79a1362730c1d9c80771ba6000082f5d6aa6de42': {
    rewardToken: '0x71e26d0E519D14591b9dE9a0fE9513A398101490',
    pool: '0x1e283e3cb1ffcbD92551867CFED10B712F52878c',
    startTime: 1753980646,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
  // REGEN-CELO 0.3% - REGEN Incentive
  '0xf8e541ec3c61d81809a55838a6e418c33dfe184737850dbb64ee548e1161f3e7': {
    rewardToken: '0x2E6C05f1f7D1f4Eb9A088bf12257f1647682b754',
    pool: '0x1e283e3cb1ffcbD92551867CFED10B712F52878c',
    startTime: 1753980646,
    lockTime: 0,
    minimumTickRange: 0,
    maxTickLower: 887272,
    minTickLower: -887272,
    maxTickUpper: 887272,
    minTickUpper: -887272,
  },
}

const incentiveIds: string[] = [
  '0xeec6459eb0d7379623c6b1d8b323cc64dea67f43e6ca85e8909a27424d21e812',
  '0x3b85446788d259ca857dbb337cdb9ba3557a7fe0ab296ee405b8d2fd51d2500d',
  '0x82774b5b1443759f20679a61497abf11115a4d0e2076caedf9d700a8c53f286f',
  '0x114570896ebb76092b5bca76943aa8d7792fec67a65ac7b4c809cacfbb79fac0',
  '0x2262434f83b2caa9bfcd1a3d0463b58001bfb235f08b3fd78d5815604a26f72d',
  '0x738da96b317eed57cea87521b9afc6db1da9198bde1dbb8d3dfc1316d2182d25',
  '0x5ce1939298d9fa489ed7b72c73e2141a19097c527e3585041efa6df573675bf2',
  '0xfcdf11b63e8269a880bda8a38e80f2ad693faef5d262d49a376f67f74fb3fe73',
  '0xe379e0032719339a09ee4a73f3b87aabb55b19d3ec963e2f3d3b6372728a4d1a',
  '0x49f80a97d9098a6bdc4b40c0ba916edd77ffce503e5b9afa8efae6d6212fc3fb',
  '0x97b265327f11c09b6b4443d3539e779ddaef5cadf64b78dcc5a818dd23fe568e',
  '0x331a86c2cac46e56186ffdec064eff69309e8295620b2004dd12369e564f8442',
  '0xd16e99550073f6aa8d9c3869df25ff1914ad9337d4e60f9fa7dbf50da542f808',
  '0x9fde166e7857f8b802dcd5da79a1362730c1d9c80771ba6000082f5d6aa6de42',
  '0xf8e541ec3c61d81809a55838a6e418c33dfe184737850dbb64ee548e1161f3e7',
]

export function getAllIncentiveIds() {
  return incentiveIds
}

export function getIncentiveIdsByPool(poolAddress: string) {
  return incentiveIds.filter((incentiveId) => {
    return incentiveKeys[incentiveId].pool == poolAddress
  })
}

export function getIncentiveKey(incentiveId: string) {
  return incentiveKeys[incentiveId]
}
