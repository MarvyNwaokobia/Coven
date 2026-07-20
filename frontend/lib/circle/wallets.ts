/**
 * Circle Programmable Wallets integration (server-side only).
 *
 * Uses Circle's REST API directly. Every PayCircle user gets a
 * user-controlled wallet on Arc — no seed phrase, no extension.
 */

const CIRCLE_API = "https://api.circle.com/v1/w3s";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
  };
}

async function circleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CIRCLE_API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Circle API ${res.status} on ${path}: ${body}`);
  }
  const json = await res.json();
  return json.data as T;
}

/**
 * Create a Circle wallet for a new PayCircle user.
 * Called during signup, before username selection completes.
 */
export async function createUserWallet(userId: string): Promise<{
  walletId: string;
  walletAddress: string;
}> {
  // 1. Register the user with Circle (idempotent — 409 means already exists)
  const res = await fetch(`${CIRCLE_API}/users`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ userId }),
  });
  if (!res.ok && res.status !== 409) {
    throw new Error(`Circle createUser failed: ${res.status} ${await res.text()}`);
  }

  // 2. Acquire a user token for wallet creation
  const { userToken } = await circleFetch<{ userToken: string }>(`/users/token`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });

  // 3. Create the Arc wallet
  const { wallets } = await circleFetch<{
    wallets: { id: string; address: string }[];
  }>(`/user/wallets`, {
    method: "POST",
    headers: { "X-User-Token": userToken },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      blockchains: [process.env.CIRCLE_BLOCKCHAIN ?? "ARC-TESTNET"],
    }),
  });

  const wallet = wallets[0];
  return { walletId: wallet.id, walletAddress: wallet.address };
}

/** USDC balance of a Circle wallet, as a decimal string (e.g. "284.50"). */
export async function getUSDCBalance(walletId: string): Promise<string> {
  try {
    const { tokenBalances } = await circleFetch<{
      tokenBalances: { token: { symbol: string }; amount: string }[];
    }>(`/wallets/${walletId}/balances`);
    const usdc = tokenBalances.find((b) => b.token.symbol?.startsWith("USDC"));
    return usdc?.amount ?? "0";
  } catch {
    return "0";
  }
}

/**
 * Direct wallet-to-wallet USDC transfer on Arc (free P2P path).
 * Returns the Circle transaction id; the tx hash lands asynchronously.
 */
export async function transferUSDC(params: {
  fromWalletId: string;
  toAddress: string;
  amountUsdc: string;
  userId: string;
}): Promise<{ transactionId: string }> {
  const { userToken } = await circleFetch<{ userToken: string }>(`/users/token`, {
    method: "POST",
    body: JSON.stringify({ userId: params.userId }),
  });

  const { id } = await circleFetch<{ id: string }>(`/user/transactions/transfer`, {
    method: "POST",
    headers: { "X-User-Token": userToken },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      walletId: params.fromWalletId,
      destinationAddress: params.toAddress,
      tokenAddress: process.env.ARC_USDC_ADDRESS,
      amounts: [params.amountUsdc],
      fee: { type: "level", config: { feeLevel: "MEDIUM" } },
    }),
  });

  return { transactionId: id };
}
