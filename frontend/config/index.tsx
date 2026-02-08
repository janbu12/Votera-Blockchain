import { http, createConfig } from 'wagmi'
import { hardhat} from 'wagmi/chains'

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545'

export const config = createConfig({
  chains: [hardhat],
  transports: {
    [hardhat.id]: http(rpcUrl),
  },
})
