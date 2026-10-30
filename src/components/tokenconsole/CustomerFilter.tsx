import { useRef, useState, type FormEvent } from "react";
import { Search, X } from "lucide-react";
import { Button, Input } from "../../ui";
import { omniApi, type CustomerSummary } from "../../lib/omniApi";
import { queriesFor } from "../../lib/tokenConsole/customerSearch";
import { shortId } from "../../lib/tokenConsole/format";

/** The customer a report is narrowed to: their app profile id, and a name to show. */
export type ChosenCustomer = { profileId: string; name: string };

const nameOf = (c: CustomerSummary) => c.legalName ?? c.displayName ?? `Customer ${shortId(c.profileId)}`;

/**
 * Narrows something to one customer, found the way the Customer desk finds
 * them: a verified phone or email, or an investor or profile id. One match is
 * chosen at once; several are offered to pick from.
 */
export function CustomerFilter({ value, onChange, disabled }: {
  value: ChosenCustomer | null;
  onChange: (c: ChosenCustomer | null) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [choices, setChoices] = useState<CustomerSummary[] | null>(null);
  const searchId = useRef(0);

  const find = async (e: FormEvent) => {
    e.preventDefault();
    const queries = queriesFor(text);
    if (!queries) {
      setProblem("Enter a phone number (0712 345 678), an email, or an investor or profile id.");
      return;
    }
    const run = ++searchId.current;
    setProblem(null);
    setChoices(null);
    setSearching(true);
    try {
      let found: CustomerSummary[] = [];
      for (const q of queries) {
        found = await omniApi.findCustomers(q);
        if (found.length) break;
      }
      if (run !== searchId.current) return;
      if (found.length === 0) setProblem("No customer found. A phone number or email only matches once the customer has verified it.");
      else if (found.length === 1) choose(found[0]);
      else setChoices(found);
    } catch (err) {
      if (run === searchId.current) setProblem(err instanceof Error ? err.message : "The search did not go through.");
    } finally {
      if (run === searchId.current) setSearching(false);
    }
  };

  const choose = (c: CustomerSummary) => {
    onChange({ profileId: c.profileId, name: nameOf(c) });
    setChoices(null);
    setText("");
  };

  if (value) {
    return (
      <div className="flex flex-wrap items-center gap-2" data-testid="customer-filter">
        <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm">
          <span className="font-medium text-text">{value.name}</span>
          <span className="tabular text-xs text-text-faint">{shortId(value.profileId)}</span>
        </span>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange(null)}>
          <X size={14} /> All customers
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="customer-filter">
      <form onSubmit={(e) => void find(e)} className="flex max-w-2xl flex-wrap items-start gap-2" role="search">
        <div className="min-w-[240px] flex-1">
          <Input
            value={text}
            onChange={(e) => { setText(e.target.value); setProblem(null); }}
            placeholder="0712 345 678, name@example.com, or an investor or profile id"
            aria-label="Customer: phone, email, investor id or profile id"
            invalid={!!problem}
            disabled={disabled}
          />
          {problem && <p role="alert" className="mt-1.5 text-[12.5px] text-danger">{problem}</p>}
        </div>
        <Button type="submit" variant="outline" disabled={disabled || searching}>
          <Search size={15} /> {searching ? "Searching…" : "Find"}
        </Button>
      </form>
      {choices && (
        <div className="mt-2 max-w-2xl rounded-lg border border-border bg-surface p-1" role="listbox" aria-label="Matching customers">
          <p className="px-3 pt-2 pb-1 text-xs text-text-soft">{choices.length} customers match. Pick one:</p>
          {choices.map((c) => (
            <button
              key={c.profileId}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => choose(c)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 text-left text-sm hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            >
              <span className="font-medium text-text">{nameOf(c)}</span>
              <span className="tabular text-xs text-text-faint">{shortId(c.profileId)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
