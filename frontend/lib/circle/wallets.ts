/**
 * Circle Programmable Wallets integration (server-side only).
 *
 * User-Controlled Wallets require a client-side PIN challenge for both
 * wallet creation and every transfer - the backend only ever prepares a
 * challenge (or verifies one that already completed); it never moves funds
 * or sets up a wallet unilaterally. The actual challenge execution happens
 * in the browser via @circle-fin/w3s-pw-web-sdk.
 *
 * See: https://developers.circle.com/wallets/user-controlled/build-a-wallet-app
 */
import { getUsdcContract } from "@/lib/contracts";

const CIRCLE_API = "https://api.circle.com/v1/w3s";

export class CircleApiError extends Error {
  constructor(
    public httpStatus: number,
    public code: number | undefined,
    message: string
  ) {
    super(message);
    this.name = "CircleApiError";
  }
}

function headers(extra?: Record<string, string>) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
    ...extra,
  };
}

async function circleFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CIRCLE_API}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers as Record<string, string> | undefined) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CircleApiError(res.status, json?.code, json?.message ?? JSON.stringify(json));
  }
  return json.data as T;
}

/** Register the user with Circle. Idempotent - "already exists" is not an error. */
export async function createCircleUser(userId: string): Promise<void> {
  try {
    await circleFetch(`/users`, { method: "POST", body: JSON.stringify({ userId }) });
  } catch (e) {
    if (e instanceof CircleApiError && e.code === 155101 /* userAlreadyExisted */) return;
    throw e;
  }
}

/** Mint a fresh short-lived session token for a Circle user. No PIN required. */
export async function getCircleUserToken(
  userId: string
): Promise<{ userToken: string; encryptionKey: string }> {
  return circleFetch(`/users/token`, { method: "POST", body: JSON.stringify({ userId }) });
}

/**
 * Start wallet creation. Returns a challengeId the client must complete via
 * the Web SDK (the user sets their PIN there) - or alreadyInitialized if
 * this user has already been through that step.
 */
export async function initializeUserWallet(
  userToken: string
): Promise<{ challengeId: string } | { alreadyInitialized: true }> {
  try {
    return await circleFetch<{ challengeId: string }>(`/user/initialize`, {
      method: "POST",
      headers: { "X-User-Token": userToken },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        accountType: "SCA",
        blockchains: [process.env.CIRCLE_BLOCKCHAIN ?? "ARC-TESTNET"],
      }),
    });
  } catch (e) {
    if (e instanceof CircleApiError && e.code === 155106 /* userWasInitialized */) {
      return { alreadyInitialized: true };
    }
    throw e;
  }
}

/** List a user's wallets (requires their session token). */
export async function listUserWallets(
  userToken: string
): Promise<{ id: string; address: string; blockchain: string }[]> {
  const { wallets } = await circleFetch<{
    wallets: { id: string; address: string; blockchain: string }[];
  }>(`/wallets`, { headers: { "X-User-Token": userToken } });
  return wallets;
}

/**
 * Same as listUserWallets, but retries a few times with a short delay -
 * a wallet a PIN challenge just created can take a moment to be indexed
 * and show up in this list, so calling listUserWallets once right after
 * the challenge completes can spuriously return an empty array.
 */
export async function listUserWalletsWithRetry(
  userToken: string,
  attempts = 5,
  delayMs = 1500
): Promise<{ id: string; address: string; blockchain: string }[]> {
  for (let i = 0; i < attempts; i++) {
    const wallets = await listUserWallets(userToken);
    if (wallets.length > 0) return wallets;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return [];
}

/** USDC balance of a Circle wallet, as a decimal string (e.g. "284.50"). */
export async function getUSDCBalance(walletId: string, userToken: string): Promise<string> {
  try {
    const { tokenBalances } = await circleFetch<{
      tokenBalances: { token: { symbol: string }; amount: string }[];
    }>(`/wallets/${walletId}/balances`, { headers: { "X-User-Token": userToken } });
    const usdc = tokenBalances.find((b) => b.token.symbol?.startsWith("USDC"));
    return usdc?.amount ?? "0";
  } catch {
    return "0";
  }
}

/**
 * Start a USDC transfer. Returns a challengeId - Circle does not move any
 * funds until the user approves with their PIN via the Web SDK.
 */
export async function createTransferChallenge(params: {
  userToken: string;
  walletId: string;
  destinationAddress: string;
  amountUsdc: string;
}): Promise<{ challengeId: string }> {
  return circleFetch(`/user/transactions/transfer`, {
    method: "POST",
    headers: { "X-User-Token": params.userToken },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      walletId: params.walletId,
      destinationAddress: params.destinationAddress,
      // Arc has two USDC representations (native 18-decimal gas token vs
      // ERC20 6-decimal token at the same logical asset) - Circle needs the
      // catalog tokenId to disambiguate, not a raw tokenAddress.
      tokenId: process.env.ARC_USDC_TOKEN_ID,
      amounts: [params.amountUsdc],
      feeLevel: "MEDIUM",
    }),
  });
}

const SETTLED_STATES = new Set(["COMPLETE", "CONFIRMED"]);
const FAILED_STATES = new Set(["FAILED", "DENIED", "CANCELLED"]);

/**
 * Fetch a transaction by id and verify it actually matches what we expect
 * before trusting a client's claim that a PIN-approved transfer completed.
 * Never record a payment based on client input alone - a client could
 * otherwise fabricate a transaction id and claim an unpaid transfer as done.
 *
 * Retries the "still pending" case a few times with a short delay - a
 * transaction can sit in SENT (submitted, not yet confirmed) for a moment
 * right after the PIN challenge completes, even with Arc's fast finality,
 * since confirmation still has to propagate through Circle's own indexing.
 * Mismatches and failed states are permanent and throw immediately.
 */
export async function verifyCompletedTransfer(params: {
  transactionId: string;
  expectedWalletId: string;
  expectedDestinationAddress: string;
  expectedAmountUsdc: number;
  attempts?: number;
  delayMs?: number;
}): Promise<{ txHash: string | null }> {
  const attempts = params.attempts ?? 6;
  const delayMs = params.delayMs ?? 1500;

  for (let i = 0; i < attempts; i++) {
    const { transaction } = await circleFetch<{
      transaction: {
        id: string;
        state: string;
        walletId: string;
        destinationAddress?: string;
        amounts?: string[];
        txHash?: string;
      };
    }>(`/transactions/${params.transactionId}`);

    if (transaction.walletId !== params.expectedWalletId) {
      throw new Error("Transaction wallet mismatch");
    }
    if (
      transaction.destinationAddress &&
      transaction.destinationAddress.toLowerCase() !==
        params.expectedDestinationAddress.toLowerCase()
    ) {
      throw new Error("Transaction destination mismatch");
    }
    const amount = Number(transaction.amounts?.[0] ?? "0");
    if (Math.abs(amount - params.expectedAmountUsdc) > 0.000001) {
      throw new Error("Transaction amount mismatch");
    }
    if (FAILED_STATES.has(transaction.state)) {
      throw new Error(`Transaction ${transaction.state.toLowerCase()}`);
    }
    if (SETTLED_STATES.has(transaction.state)) {
      return { txHash: transaction.txHash ?? null };
    }

    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error("Transaction is taking longer than usual to settle - check History shortly");
}

/**
 * Circle's transfer-challenge endpoint returns only a challengeId, not a
 * transaction id - so after a challenge completes we locate the resulting
 * transaction ourselves: recent transfers from this wallet to this
 * destination for this amount, newest first. More than one can match (two
 * identical payments in a row), so the caller decides which one is new.
 */
export async function findRecentTransactions(params: {
  userToken: string;
  walletId: string;
  destinationAddress: string;
  amountUsdc: number;
  withinMs?: number;
}): Promise<{ id: string }[]> {
  const q = new URLSearchParams({
    walletIds: params.walletId,
    destinationAddress: params.destinationAddress,
    order: "DESC",
    pageSize: "5",
  });
  const { transactions } = await circleFetch<{
    transactions: { id: string; amounts?: string[]; createDate: string }[];
  }>(`/transactions?${q.toString()}`, { headers: { "X-User-Token": params.userToken } });

  const cutoff = Date.now() - (params.withinMs ?? 5 * 60_000);
  return transactions
    .filter((t) => {
      const amount = Number(t.amounts?.[0] ?? "0");
      const recent = new Date(t.createDate).getTime() > cutoff;
      return recent && Math.abs(amount - params.amountUsdc) < 0.000001;
    })
    .map((t) => ({ id: t.id }));
}

/** Tells the verifiers whether a transaction hash has already been used to record something. */
export type IsRecorded = (txHash: string) => Promise<boolean>;

/**
 * Full post-challenge verification: mint a fresh session token, find the
 * transaction the just-approved challenge produced, and confirm it settled
 * with the expected wallet/destination/amount. Throws if no matching,
 * settled transaction is found - callers should not record a payment
 * unless this resolves.
 *
 * "Recent, same wallet, same destination, same amount" does not identify a
 * transaction, so a transfer that was already recorded would otherwise keep
 * matching for five minutes and could be claimed again. Candidates whose hash
 * `isRecorded` reports as used are skipped, which also lets two identical
 * payments in a row each be recorded once. A settled transfer without a
 * hash is refused, since nothing could then stop it being recorded twice.
 * The unique index on the hash is the final backstop against a race.
 */
export async function resolveAndVerifyRecentTransfer(params: {
  userId: string;
  walletId: string;
  destinationAddress: string;
  amountUsdc: number;
  isRecorded?: IsRecorded;
}): Promise<{ txHash: string }> {
  const { userToken } = await getCircleUserToken(params.userId);

  // The transaction can take a moment to appear in this list right after
  // the PIN challenge completes - same indexing lag as wallet creation.
  let candidates: { id: string }[] = [];
  for (let i = 0; i < 5 && candidates.length === 0; i++) {
    candidates = await findRecentTransactions({
      userToken,
      walletId: params.walletId,
      destinationAddress: params.destinationAddress,
      amountUsdc: params.amountUsdc,
    });
    if (candidates.length === 0 && i < 4) await new Promise((r) => setTimeout(r, 1500));
  }
  if (candidates.length === 0) {
    throw new Error("No matching completed transfer found - approve the PIN challenge first");
  }

  let firstError: Error | null = null;
  let sawRecorded = false;
  for (const candidate of candidates) {
    try {
      const verified = await verifyCompletedTransfer({
        transactionId: candidate.id,
        expectedWalletId: params.walletId,
        expectedDestinationAddress: params.destinationAddress,
        expectedAmountUsdc: params.amountUsdc,
      });
      if (!verified.txHash) throw new Error("Transaction has no hash yet - try again shortly");
      if (params.isRecorded && (await params.isRecorded(verified.txHash))) {
        sawRecorded = true;
        continue;
      }
      return { txHash: verified.txHash };
    } catch (e) {
      firstError ??= e instanceof Error ? e : new Error(String(e));
    }
  }
  if (firstError) throw firstError;
  throw new Error(sawRecorded ? "This transfer has already been recorded" : "No matching completed transfer found");
}

/**
 * Start a smart-contract call (e.g. USDC approve, or a GoalPool
 * contribute/requestWithdrawal/approveWithdrawal). Same challenge model as
 * transfers - Circle submits nothing on-chain until the user approves via
 * the Web SDK. Confirmed against Circle's API directly: idempotencyKey,
 * walletId, contractAddress, abiFunctionSignature, abiParameters, and a
 * flat feeLevel field (not the nested fee/config shape from the transfer
 * endpoint's docs, which turned out to be wrong there too).
 */
export async function createContractExecutionChallenge(params: {
  userToken: string;
  walletId: string;
  contractAddress: string;
  abiFunctionSignature: string;
  // Nested arrays are how array-typed ABI params (e.g. address[]) are passed.
  abiParameters: (string | number | string[])[];
}): Promise<{ challengeId: string }> {
  return circleFetch(`/user/transactions/contractExecution`, {
    method: "POST",
    headers: { "X-User-Token": params.userToken },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      walletId: params.walletId,
      contractAddress: params.contractAddress,
      abiFunctionSignature: params.abiFunctionSignature,
      abiParameters: params.abiParameters,
      feeLevel: "MEDIUM",
    }),
  });
}

/**
 * Read current USDC allowance from a wallet to a spender (e.g. GoalPool),
 * so we only ask for an approve challenge when actually needed. Plain RPC
 * read - no Circle call, no wallet signature required.
 */
export async function getUsdcAllowance(ownerAddress: string, spenderAddress: string): Promise<bigint> {
  const usdc = getUsdcContract();
  return usdc.allowance(ownerAddress, spenderAddress);
}

/**
 * Find recent contract-execution transactions from this wallet to a given
 * contract, newest first, created within the lookback window. Circle's
 * contract-execution transactions haven't been exercised through a real
 * PIN approval as part of building this - this mirrors findRecentTransactions'
 * matching approach (recency + address) defensively across the field names
 * Circle might use, but the exact shape should be double-checked the first
 * time this path runs against a live challenge.
 */
export async function findRecentContractExecutions(params: {
  userToken: string;
  walletId: string;
  contractAddress: string;
  withinMs?: number;
}): Promise<{ id: string }[]> {
  const q = new URLSearchParams({ walletIds: params.walletId, order: "DESC", pageSize: "10" });
  const { transactions } = await circleFetch<{
    transactions: {
      id: string;
      contractAddress?: string;
      destinationAddress?: string;
      createDate: string;
    }[];
  }>(`/transactions?${q.toString()}`, { headers: { "X-User-Token": params.userToken } });

  const cutoff = Date.now() - (params.withinMs ?? 5 * 60_000);
  const expected = params.contractAddress.toLowerCase();
  return transactions
    .filter((t) => {
      const recent = new Date(t.createDate).getTime() > cutoff;
      const addressMatches =
        t.contractAddress?.toLowerCase() === expected || t.destinationAddress?.toLowerCase() === expected;
      return recent && addressMatches;
    })
    .map((t) => ({ id: t.id }));
}

/**
 * Verify a contract-execution transaction settled before trusting a
 * client's claim that a PIN-approved contract call completed.
 */
export async function verifyCompletedContractExecution(params: {
  transactionId: string;
  expectedWalletId: string;
  expectedContractAddress: string;
  attempts?: number;
  delayMs?: number;
}): Promise<{ txHash: string | null }> {
  const attempts = params.attempts ?? 6;
  const delayMs = params.delayMs ?? 1500;

  for (let i = 0; i < attempts; i++) {
    const { transaction } = await circleFetch<{
      transaction: {
        id: string;
        state: string;
        walletId: string;
        contractAddress?: string;
        destinationAddress?: string;
        txHash?: string;
      };
    }>(`/transactions/${params.transactionId}`);

    if (transaction.walletId !== params.expectedWalletId) {
      throw new Error("Transaction wallet mismatch");
    }
    const expected = params.expectedContractAddress.toLowerCase();
    const addressMatches =
      transaction.contractAddress?.toLowerCase() === expected ||
      transaction.destinationAddress?.toLowerCase() === expected;
    if (!addressMatches) {
      throw new Error("Transaction contract address mismatch");
    }
    if (FAILED_STATES.has(transaction.state)) {
      throw new Error(`Transaction ${transaction.state.toLowerCase()}`);
    }
    if (SETTLED_STATES.has(transaction.state)) {
      return { txHash: transaction.txHash ?? null };
    }

    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error("Transaction is taking longer than usual to settle - check back shortly");
}

/**
 * Full post-challenge verification for a contract call: mint a fresh
 * session token, find the transaction the just-approved challenge
 * produced, and confirm it settled against the expected wallet/contract.
 *
 * Several recent transactions can match (only wallet and contract are
 * compared), so callers that record something per transaction pass
 * `isRecorded` and `requireHash`: candidates already recorded are skipped,
 * and a settled transaction without a hash is refused because it could not
 * be told apart from the next one. Callers that read the effect back from
 * the chain (and record nothing per transaction) need neither.
 */
export async function resolveAndVerifyRecentContractExecution(params: {
  userId: string;
  walletId: string;
  contractAddress: string;
  isRecorded?: IsRecorded;
  requireHash?: boolean;
}): Promise<{ txHash: string | null }> {
  const { userToken } = await getCircleUserToken(params.userId);

  let candidates: { id: string }[] = [];
  for (let i = 0; i < 5 && candidates.length === 0; i++) {
    candidates = await findRecentContractExecutions({
      userToken,
      walletId: params.walletId,
      contractAddress: params.contractAddress,
    });
    if (candidates.length === 0 && i < 4) await new Promise((r) => setTimeout(r, 1500));
  }
  if (candidates.length === 0) {
    throw new Error("No matching completed transaction found - approve the PIN challenge first");
  }

  let firstError: Error | null = null;
  let sawRecorded = false;
  for (const candidate of candidates) {
    try {
      const verified = await verifyCompletedContractExecution({
        transactionId: candidate.id,
        expectedWalletId: params.walletId,
        expectedContractAddress: params.contractAddress,
      });
      if (params.requireHash && !verified.txHash) {
        throw new Error("Transaction has no hash yet - try again shortly");
      }
      if (params.isRecorded && verified.txHash && (await params.isRecorded(verified.txHash))) {
        sawRecorded = true;
        continue;
      }
      return verified;
    } catch (e) {
      firstError ??= e instanceof Error ? e : new Error(String(e));
    }
  }
  if (firstError) throw firstError;
  throw new Error(sawRecorded ? "This transaction has already been recorded" : "No matching completed transaction found");
}
