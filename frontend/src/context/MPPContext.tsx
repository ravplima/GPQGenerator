import { createContext, useContext } from 'react'
import type { MPPConfig } from '../types'
import { DEFAULT_MPP_CONFIG } from '../types'

interface MPPContextValue {
  config: MPPConfig
  setConfig: (config: MPPConfig) => void
}

export const MPPContext = createContext<MPPContextValue>({
  config: DEFAULT_MPP_CONFIG,
  setConfig: () => {},
})

export function useMPP() {
  return useContext(MPPContext)
}
