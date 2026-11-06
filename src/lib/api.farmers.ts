/* The institution's farmers and where each is in the journey, and the
 * single-farmer register, on omnichannel's operator API (scoped to this back
 * office's institution by the proxy). See journeyContract.ts. Where this
 * environment's omnichannel does not have them, a read answers
 * `{ available: false }` and the register throws NOT_AVAILABLE. */
import { OmniApiError, omniCall, type Page } from "./omniApi";
import {
  FARMERS_MAX_SIZE, FARMERS_PATH, FARMERS_SUMMARY_PATH, NOT_AVAILABLE, farmerPath, notBuiltYet,
  type Farmer, type FarmerState, type FarmersSummary, type RegisterFarmer,
} from "./journeyContract";

export type FarmersQuery = { state?: FarmerState | null; q?: string; page?: number; size?: number };
export type Maybe<T> = { available: true; data: T } | { available: false };
/** A register call's answer: `created` false when the farmer was already
 *  registered with the same phone (200 rather than 201). */
export type Registered = { created: boolean; farmer: Farmer };

const notBuilt = (e: unknown) => e instanceof OmniApiError && notBuiltYet(e.status, e.message);

async function maybe<T>(call: Promise<T>): Promise<Maybe<T>> {
  try {
    return { available: true, data: await call };
  } catch (e) {
    if (notBuilt(e)) return { available: false };
    throw e;
  }
}

export const farmersApi = {
  /** One page, newest registered first as omnichannel orders it. */
  list: ({ state, q, page = 1, size = 20 }: FarmersQuery = {}): Promise<Maybe<Page<Farmer>>> => {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (q?.trim()) params.set("q", q.trim());
    const query = params.toString();
    return maybe(omniCall.page<Farmer>(`${FARMERS_PATH}${query ? `?${query}` : ""}`, page, Math.min(size, FARMERS_MAX_SIZE)));
  },
  /** How many of the institution's farmers are at each stage. */
  summary: (): Promise<Maybe<FarmersSummary>> => maybe(omniCall.get<FarmersSummary>(FARMERS_SUMMARY_PATH)),
  /** One farmer; a 404 here is "no such grower", not a missing endpoint. */
  one: (growerNo: string): Promise<Farmer> => omniCall.get<Farmer>(farmerPath(growerNo)),
  register: async (body: RegisterFarmer): Promise<Registered> => {
    try {
      const { status, data } = await omniCall.postWithStatus<Farmer>(FARMERS_PATH, body);
      return { created: status === 201, farmer: data };
    } catch (e) {
      if (notBuilt(e)) throw new OmniApiError((e as OmniApiError).status, NOT_AVAILABLE);
      throw e;
    }
  },
};
