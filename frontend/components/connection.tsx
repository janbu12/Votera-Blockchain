"use client";

import { useConnection, useDisconnect, useEnsAvatar, useEnsName } from "wagmi";

export function Connection() {
  const { address } = useConnection()
  const { disconnect } = useDisconnect()
  const { data: ensName } = useEnsName({ address })
  const { data: ensAvatar } = useEnsAvatar({ name: ensName! })
  const shortAddress =
    address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null
  return (
     <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {ensAvatar && (
          <img
            alt="ENS Avatar"
            src={ensAvatar}
            className="h-10 w-10 rounded-full"
          />
        )}
        <div>
          <p className="text-xs text-slate-500">Wallet terhubung</p>
          <p className="text-sm font-semibold text-slate-900">
            {address &&
              (ensName ? `${ensName} (${shortAddress})` : shortAddress)}
          </p>
        </div>
      </div>
      <button
        onClick={() => disconnect()}
        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Disconnect
      </button>
    </div>
  )
}
