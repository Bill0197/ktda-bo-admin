import { tokenConsole } from "../api";
import { useSharedList } from "./sharedList";
import type { ConfigChange } from "./configChanges";

export const PENDING_CHANGES_KEY = "tok:pendingChanges";

/** Change requests still awaiting a checker, shared by every screen that stages
 *  one — so the product list, a product's status and its limits all say what is
 *  already waiting. Staging or deciding a change invalidates PENDING_CHANGES_KEY. */
export function usePendingChanges() {
  return useSharedList<ConfigChange[]>(PENDING_CHANGES_KEY, () => tokenConsole.configChanges("PENDING"));
}
