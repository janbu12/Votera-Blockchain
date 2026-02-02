export function formatTxToast(
  message: string,
  hash?: `0x${string}` | null,
  blockNumber?: bigint | null
) {
  if (!hash) return message;
  const shortHash = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  const blockInfo =
    typeof blockNumber === "bigint" ? ` (block #${blockNumber.toString()})` : "";
  return `${message} • Tx ${shortHash}${blockInfo}`;
}
