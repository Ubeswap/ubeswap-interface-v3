import { BrowserEvent, InterfaceElementName, InterfacePageName, SharedEventName } from '@ubeswap/analytics-events'
import { Trace, TraceEvent } from 'analytics'
import { AutoRow } from 'components/Row'
import { MAX_WIDTH_MEDIA_BREAKPOINT } from 'components/Tokens/constants'
import { Trans } from 'i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'
import { StyledInternalLink, ThemedText } from 'theme/components'
import EarnHeader from './EarnHeader'
import { ActiveFarmTable, InactiveFarmTable } from './tables/FarmTable'
import { StakeTable } from './tables/StakeTable'

import { manualChainOutageAtom } from 'featureFlags/flags/outageBanner'
import { validateUrlChainParam } from 'graphql/data/util'
import { useResetAtom } from 'jotai/utils'
import { Chain } from 'uniswap/src/data/graphql/uniswap-data-api/__generated__/types-and-hooks'
import { useEarnParams } from './redirects'

const EarnContainer = styled.div`
  width: 100%;
  min-width: 320px;
  padding: 0px 40px;

  @media only screen and (max-width: ${({ theme }) => `${theme.breakpoint.sm}px`}) {
    padding: 0px 16px;
    padding-bottom: 0px;
  }
`

const NavWrapper = styled.div`
  display: flex;
  max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
  margin: 0 auto;
  margin-bottom: 16px;
  color: ${({ theme }) => theme.neutral3};
  flex-direction: row;
  justify-content: space-between;
  @media screen and (max-width: ${({ theme }) => `${theme.breakpoint.lg}px`}) {
    flex-direction: column;
    gap: 16px;
  }
`
const TabBar = styled(AutoRow)`
  gap: 24px;
  @media screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
    gap: 16px;
  }
`
const TabItem = styled(ThemedText.HeadlineMedium)<{ active?: boolean }>`
  align-items: center;
  color: ${({ theme, active }) => (active ? theme.neutral1 : theme.neutral2)};
  cursor: pointer;
  transition: ${({ theme }) => `${theme.transition.duration.medium} ${theme.transition.timing.ease} color`};

  @media screen and (max-width: ${({ theme }) => theme.breakpoint.md}px) {
    font-size: 24px !important;
    line-height: 32px !important;
  }
`
// const FiltersContainer = styled.div`
//   display: flex;
//   gap: 8px;
//   height: 40px;
//   justify-content: flex-start;
// `

export enum EarnTab {
  Farms = 'farms',
  Stakes = 'stakes',
  DeprecatedFarms = 'deprecated_farms',
}

export function getEarnURL({ tab, chain }: { tab: EarnTab; chain?: Chain }) {
  let chainName = 'celo'
  if (chain) {
    chainName = chain.toLowerCase()
  }
  if (chainName != 'celo') {
    throw 'Wrong chain'
  }
  return `/earn/${tab}/${chainName}`
}

interface Page {
  title: React.ReactNode
  key: EarnTab
  component: () => JSX.Element
  loggingElementName: string
}
const Pages: Array<Page> = [
  {
    title: <Trans>Farm</Trans>,
    key: EarnTab.Farms,
    component: ActiveFarmTable,
    loggingElementName: InterfaceElementName.EXPLORE_TOKENS_TAB,
  },
  {
    title: <Trans>Stake</Trans>,
    key: EarnTab.Stakes,
    component: StakeTable,
    loggingElementName: InterfaceElementName.EXPLORE_POOLS_TAB,
  },
  {
    title: <Trans>Inactive Yields</Trans>,
    key: EarnTab.DeprecatedFarms,
    component: InactiveFarmTable,
    loggingElementName: InterfaceElementName.EXPLORE_TRANSACTIONS_TAB,
  },
]

// const InfoBoxWrapper = styled.div`
//   margin: 0 auto;
//   max-width: ${MAX_WIDTH_MEDIA_BREAKPOINT};
// `
//
// const InfoBoxContainer = styled.div`
//   display: flex;
//   align-items: center;
//   padding: 12px;
//   gap: 16px;
//   border: 1px solid ${({ theme }) => theme.accent1};
//   border-radius: 20px;
//   background: ${({ theme }) => theme.surface4};
//   backdrop-filter: blur(5px);
// `

// function InfoBox({ message }: { message?: ReactNode }) {
//   const theme = useTheme()
//   return (
//     <InfoBoxWrapper>
//       <InfoBoxContainer>
//         <Info size={36} stroke={theme.primary1} />
//         {message && (
//           <ThemedText.BodyPrimary padding={10} textAlign="center">
//             {message}
//           </ThemedText.BodyPrimary>
//         )}
//       </InfoBoxContainer>
//     </InfoBoxWrapper>
//   )
// }

const EarnPage = ({ initialTab }: { initialTab?: EarnTab }) => {
  const tabNavRef = useRef<HTMLDivElement>(null)
  const resetManualOutage = useResetAtom(manualChainOutageAtom)

  const initialKey: number = useMemo(() => {
    const key = initialTab && Pages.findIndex((page) => page.key === initialTab)

    if (!key || key === -1) return 0
    return key
  }, [initialTab])

  useEffect(() => {
    if (tabNavRef.current && initialTab) {
      const offsetTop = tabNavRef.current.getBoundingClientRect().top + window.scrollY
      window.scrollTo({ top: offsetTop - 90, behavior: 'smooth' })
    }
    // scroll to tab navbar on initial page mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [currentTab, setCurrentTab] = useState(initialKey)

  // to allow backward navigation between tabs
  const { tab: tabName, chainName } = useEarnParams()
  const tab = tabName ?? EarnTab.Farms
  const chain = validateUrlChainParam(chainName)
  useEffect(() => {
    const tabIndex = Pages.findIndex((page) => page.key === tab)
    if (tabIndex !== -1) {
      setCurrentTab(tabIndex)
    }
    resetManualOutage()
  }, [resetManualOutage, tab])

  const { component: Page } = Pages[currentTab]

  // Automatically trigger a navigation when the app chain changes
  // const navigate = useNavigate()
  // useOnGlobalChainSwitch(
  //   useCallback(
  //     (_chainId, chain) => {
  //       if (chain && isBackendSupportedChain(chain)) {
  //         navigate(getTokenExploreURL({ tab, chain }))
  //       }
  //     },
  //     [navigate, tab]
  //   )
  // )

  return (
    <Trace page={InterfacePageName.EXPLORE_PAGE} properties={{ chainName: chain }} shouldLogImpression>
      <EarnContainer>
        <EarnHeader />
        <NavWrapper ref={tabNavRef}>
          <TabBar data-testid="explore-navbar">
            {Pages.map(({ title, loggingElementName, key }, index) => {
              return (
                <TraceEvent
                  events={[BrowserEvent.onClick]}
                  name={SharedEventName.NAVBAR_CLICKED}
                  element={loggingElementName}
                  key={index}
                >
                  <StyledInternalLink to={`/earn/${key}`}>
                    <TabItem onClick={() => setCurrentTab(index)} active={currentTab === index} key={key}>
                      {title}
                    </TabItem>
                  </StyledInternalLink>
                </TraceEvent>
              )
            })}
          </TabBar>
          {/* <FiltersContainer>{currentKey === EarnTab.Farms && <TimeSelector />}</FiltersContainer> */}
        </NavWrapper>
        <Page />
        {/*currentKey === EarnTab.Farms && <InfoBox message={t('V3 Farms will be announced soon')} />*/}
        {/*currentKey === EarnTab.Stakes && <InfoBox message={t('New Stake programs be announced soon')} />*/}
      </EarnContainer>
    </Trace>
  )
}

export default EarnPage
