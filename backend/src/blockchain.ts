import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL, SIGNER_PRIVATE_KEY, VOTING_CONTRACT_ADDRESS } from "./config";

export const signerAccount = SIGNER_PRIVATE_KEY
  ? privateKeyToAccount(SIGNER_PRIVATE_KEY as `0x${string}`)
  : null;

export const publicClient = createPublicClient({
  transport: http(RPC_URL),
});

export const walletClient = signerAccount
  ? createWalletClient({
      account: signerAccount,
      transport: http(RPC_URL),
    })
  : null;

if (!SIGNER_PRIVATE_KEY || !VOTING_CONTRACT_ADDRESS) {
  console.warn(
    "Missing SIGNER_PRIVATE_KEY or VOTING_CONTRACT_ADDRESS in env. Signature endpoint will fail."
  );
}
