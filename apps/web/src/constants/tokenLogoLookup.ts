import { ListsState } from 'state/lists/types'

import { DEFAULT_LIST_OF_LISTS } from './lists'

class TokenLogoLookupTable {
  private dict: { [key: string]: string[] | undefined } = {}
  private source: ListsState['byUrl'] | undefined

  // Rebuild whenever the lists state changes (rehydration, list version updates)
  private initialize(lists: ListsState['byUrl']) {
    const dict: { [key: string]: string[] | undefined } = {}

    DEFAULT_LIST_OF_LISTS.forEach((list) => {
      const listData = lists[list]
      if (!listData) {
        return
      }
      listData.current?.tokens.forEach((token) => {
        if (token.logoURI) {
          const lowercaseAddress = token.address.toLowerCase()
          const currentEntry = dict[lowercaseAddress + ':' + token.chainId]
          if (currentEntry) {
            currentEntry.push(token.logoURI)
          } else {
            dict[lowercaseAddress + ':' + token.chainId] = [token.logoURI]
          }
        }
      })
    })
    this.dict = dict
    this.source = lists
  }
  getIcons(lists: ListsState['byUrl'], address?: string | null, chainId: number | null = 42220) {
    if (!address) return undefined

    if (this.source !== lists) {
      this.initialize(lists)
    }

    return this.dict[address.toLowerCase() + ':' + chainId]
  }
}

export default new TokenLogoLookupTable()
