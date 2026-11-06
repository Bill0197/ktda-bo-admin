/* The institution's farmers and where each is in the journey, and the
 * single-farmer register, on omnichannel's operator API (scoped to this back
 * office's institution by the proxy). Both endpoints are proposals
 * (journeyContract.ts): where this omnichannel does not have them, the call
 * answers `unavailable` (list) or throws NOT_AVAILABLE (register). */
import { OmniApiError, omniCall } from "./omniApi";
import {
  FARMERS_PATH, NOT_AVAILABLE, notBuiltYet,
  type FarmerState, type FarmersPage, type RegisterFarmer, type RegisteredFarmer,
} from "./journeyContract";

export type FarmersQuery = { state?: FarmerState | null; q?: string; page?: number; size?: number };
export type FarmersResult = { available: true; page: FarmersPage } | { available: false };

const notBuilt = (e: unknown) => e instanceof OmniApiError && notBuiltYet(e.status, e.message);

export const farmersApi = {
  list: async ({ state, q, page = 1, size = 20 }: FarmersQuery = {}): Promise<FarmersResult> => {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (q?.trim()) params.set("q", q.trim());
    params.set("page", String(page));
    params.set("size", String(size));
    try {
      return { available: true, page: await omniCall.get<FarmersPage>(`${FARMERS_PATH}?${params}`) };
    } catch (e) {
      if (notBuilt(e)) return { available: false };
      throw e;
    }
  },
  register: async (body: RegisterFarmer): Promise<RegisteredFarmer> => {
    try {
      return await omniCall.post<RegisteredFarmer>(FARMERS_PATH, body);
    } catch (e) {
      if (notBuilt(e)) throw new OmniApiError((e as OmniApiError).status, NOT_AVAILABLE);
      throw e;
    }
  },
};
