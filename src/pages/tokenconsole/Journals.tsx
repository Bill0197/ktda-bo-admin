import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button, DataTable, Field, Input, Modal, NotePanel, PageHeader, SearchInput, Select, useToast } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useAsyncData } from "../../lib/useAsyncData";
import { calendarDate, dateTime, label, money } from "../../lib/tokenConsole/format";
import { useAction } from "../../lib/tokenConsole/useAction";
import type { LedgerEntryView, PostEventRequest } from "../../lib/tokenConsole/types.gen";
import { Code, ConsoleTable, StatusBadge } from "../../components/tokenconsole/ConsoleTable";
import { ActionModal, blankToUndefined, isPositive, todayIso } from "../../components/tokenconsole/ActionModal";
import { ContractPicker } from "../../components/tokenconsole/Pickers";

const num = "tabular text-right whitespace-nowrap";

const EVENT_TYPES = [
  "SUBSCRIPTION", "ACCRUAL", "DISTRIBUTION_INCOME", "DISTRIBUTION_GROWTH", "TAX_WITHHELD_EVENT", "MANAGEMENT_FEE",
  "REDEMPTION", "REDEMPTION_GAIN", "REDEMPTION_LOSS", "TAX_REMITTANCE", "WITHDRAWAL", "INTEREST_WITHDRAWAL",
  "DISBURSEMENT", "LOAN_INTEREST_ACCRUAL", "PRINCIPAL_REPAYMENT", "INTEREST_REPAYMENT",
] as const satisfies readonly PostEventRequest["eventType"][];

/** The lines are the entry: a journal row without them is only a headline.
 * The service returns one amount and a side per line, split here into the
 * debit and credit columns an accountant reads. Read fresh from the service
 * so an approval here shows its result, not the list's stale copy. */
function EntryPanel({ journalId, onApproved }: { journalId: string; onApproved: () => void }) {
  const toast = useToast();
  const entry = useAsyncData(() => tokenConsole.journal(journalId));
  const approve = useAction(tokenConsole.approveJournal);
  const [confirming, setConfirming] = useState(false);
  const e = entry.data;
  const lines = (e?.lines ?? []).map((l, i) => ({ ...l, id: `${i}` }));
  const ccy = e?.currency;

  const runApprove = async () => {
    const receipt = await approve.run(journalId);
    if (!receipt) return;
    toast.push(receipt.status === "POSTED" ? "Approved and posted." : `Approved — now ${label(receipt.status)}.`);
    setConfirming(false);
    void entry.reload();
    onApproved();
  };

  return (
    <>
      {entry.error && <NotePanel tone="danger" className="mb-4">{entry.error}</NotePanel>}
      {e && (
        <div className="mb-4 grid gap-1 text-sm text-text-soft">
          {e.description && <p className="text-text">{e.description}</p>}
          <p>
            <span className="tabular">{calendarDate(e.valueDate)}</span> value date · posted{" "}
            <span className="tabular">{dateTime(e.postedAt)}</span> · <StatusBadge status={e.status} />
          </p>
          {(e.contractId || e.referenceTxId) && (
            <p className="text-xs">
              {e.contractId && <>Contract <Code>{e.contractId}</Code> </>}
              {e.referenceTxId && <>· ref <Code>{e.referenceTxId}</Code></>}
            </p>
          )}
        </div>
      )}
      <DataTable
        rows={lines}
        emptyLabel={entry.loading ? "Loading…" : "This entry has no lines"}
        columns={[
          { key: "account", header: "Account", render: (l) => (
            <div>
              <Code>{l.accountCode}</Code>
              <div className="text-xs text-text-soft">{l.accountName ?? "—"}</div>
            </div>
          ) },
          { key: "debit", header: "Debit", className: num, render: (l) => (l.side === "DEBIT" ? money(l.amount, ccy) : "—") },
          { key: "credit", header: "Credit", className: num, render: (l) => (l.side === "CREDIT" ? money(l.amount, ccy) : "—") },
        ]}
      />
      {e?.status === "PENDING_APPROVAL" && (
        <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
          <Button size="sm" onClick={() => { approve.reset(); setConfirming(true); }}>Approve entry</Button>
          <span className="text-[12.5px] text-text-soft">Held for a second pair of eyes; it moves no balance until approved.</span>
        </div>
      )}
      {confirming && (
        <ActionModal
          size="sm"
          title="Approve this entry?"
          description="It posts to the books and starts counting in every balance. A correction after this is a reversing entry, not an edit."
          submitLabel="Approve and post"
          pending={approve.pending}
          error={approve.error}
          onSubmit={() => void runApprove()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

/** A business event, turned into a balanced journal by the service's posting
 * rules. The idempotency key makes a double-click or a retry post once. */
function PostEventModal({ onClose, onPosted }: { onClose: () => void; onPosted: (journalId?: string) => void }) {
  const post = useAction(tokenConsole.postEvent);
  const [eventType, setEventType] = useState<PostEventRequest["eventType"]>("SUBSCRIPTION");
  const [contractId, setContractId] = useState("");
  const [amount, setAmount] = useState("");
  const [valueDate, setValueDate] = useState(todayIso());
  const [referenceTxId, setRef] = useState("");
  const [description, setDescription] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const problem = !contractId ? "Pick the contract the event belongs to."
    : !isPositive(amount) ? "Enter an amount above 0." : undefined;

  const submit = async () => {
    const receipt = await post.run({
      eventType, contractId, amount: Number(amount), valueDate: valueDate || undefined,
      referenceTxId: blankToUndefined(referenceTxId), description: blankToUndefined(description), idempotencyKey,
    });
    if (receipt) onPosted(receipt.journalId);
  };

  return (
    <ActionModal
      title="Post an event"
      description="The posting rules for the event type decide the accounts. An event on a product that needs approval is held as pending until someone approves it."
      submitLabel="Post event"
      pendingLabel="Posting…"
      problem={problem} showProblem={!!(contractId || amount)}
      pending={post.pending}
      error={post.error}
      onSubmit={() => void submit()}
      onClose={onClose}
      size="lg"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event type" required>
          <Select value={eventType} onChange={(e) => setEventType(e.target.value as PostEventRequest["eventType"])}>
            {EVENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </Select>
        </Field>
        <Field label="Contract" required group>
          <ContractPicker value={contractId} onChange={setContractId} />
        </Field>
        <Field label="Amount" required>
          <Input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Value date">
          <Input type="date" value={valueDate} onChange={(e) => setValueDate(e.target.value)} />
        </Field>
        <Field label="Reference" hint="The payment or source reference, for reconciliation.">
          <Input value={referenceTxId} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Description">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>
    </ActionModal>
  );
}

export default function TokenConsoleJournals() {
  const journals = useAsyncData(tokenConsole.journals);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const toast = useToast();
  const term = q.trim().toLowerCase();

  const rows = useMemo(
    () => (journals.data ?? []).filter((j) =>
      !term
      || (j.description ?? "").toLowerCase().includes(term)
      || (j.eventType ?? "").toLowerCase().includes(term)
      || (j.productId ?? "").toLowerCase().includes(term)),
    [journals.data, term],
  );

  return (
    <div>
      <PageHeader
        eyebrow="Tokenization Console"
        title="Journals"
        subtitle="Every posting to the books. Select an entry for the debits and credits it is made of."
        actions={<Button size="sm" onClick={() => setPosting(true)}><Plus size={14} /> Post event</Button>}
      />
      <ConsoleTable<LedgerEntryView>
        what="journal entries"
        source={journals}
        rows={rows}
        rowId={(r) => r.journalId}
        title="Entries"
        actions={<SearchInput value={q} onChange={setQ} placeholder="Event, description or product…" className="w-64" />}
        emptyLabel={term ? "No entry matches that" : "Nothing posted yet"}
        onRowClick={(r) => setOpen(r.journalId ?? null)}
        columns={[
          { key: "event", header: "Event", render: (r) => (
            <div>
              <div className="text-text font-medium">{r.eventType ?? "—"}</div>
              <div className="text-xs text-text-soft mt-0.5 max-w-sm leading-snug">{r.description ?? ""}</div>
            </div>
          ) },
          { key: "product", header: "Product", render: (r) => <Code>{r.productId}</Code>, hideOnMobile: true },
          { key: "amount", header: "Amount", className: num, render: (r) => money(r.amount, r.currency) },
          { key: "posted", header: "Posted", render: (r) => <span className="tabular text-xs text-text-soft">{dateTime(r.postedAt)}</span>, hideOnMobile: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />
      <Modal open={!!open} onClose={() => setOpen(null)} title="Journal entry" size="lg">
        {open && <EntryPanel key={open} journalId={open} onApproved={() => void journals.reload()} />}
      </Modal>
      {posting && (
        <PostEventModal
          onClose={() => setPosting(false)}
          onPosted={(journalId) => {
            setPosting(false);
            toast.push("Event posted.");
            void journals.reload();
            if (journalId) setOpen(journalId);
          }}
        />
      )}
    </div>
  );
}
