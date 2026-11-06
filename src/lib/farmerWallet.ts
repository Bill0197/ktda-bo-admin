/* A farmer's wallet, from omnichannel, which reads it from the engine's ledger
 * and answers only for this back office's institution's farmers (404 for a
 * grower that is not its own). See journeyContract.ts for the contract. Where
 * this environment's omnichannel has no wallet read yet, the calls throw
 * NOT_AVAILABLE. */

import { OmniApiError, omniCall, type Page } from "./omniApi";
import { NOT_AVAILABLE, farmerPath, notBuiltYet, type FarmerWallet, type WalletMovement } from "./journeyContract";

async function available<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (e) {
    // The farmer was found a moment ago, so a 404 here is the endpoint, not the grower.
    if (e instanceof OmniApiError && notBuiltYet(e.status, e.message)) throw new OmniApiError(e.status, NOT_AVAILABLE);
    throw e;
  }
}

export const farmerWallet = {
  /** Whether the wallet is open, and its balance per currency (none before). */
  wallet: (growerNo: string) => available(omniCall.get<FarmerWallet>(`${farmerPath(growerNo)}/wallet`)),
  /** One page of movements in `currency`, newest first. */
  movements: (growerNo: string, currency: string, page: number, size = 20): Promise<Page<WalletMovement>> =>
    available(omniCall.page<WalletMovement>(`${farmerPath(growerNo)}/wallet/movements?currency=${encodeURIComponent(currency)}`, page, size)),
};
