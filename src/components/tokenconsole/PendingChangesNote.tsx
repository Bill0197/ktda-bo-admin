import { Link } from "react-router-dom";
import { NotePanel } from "../../ui";
import { CHANGE_TYPE_LABEL, type ConfigChange } from "../../lib/tokenConsole/configChanges";

/** "2 rates are awaiting approval": staged changes a screen's table does not
 *  show yet, with a link to the queue. Renders nothing when none are waiting. */
export function PendingChangesNote({
  changes, one, many, className = "mb-4",
}: {
  changes: ConfigChange[];
  /** Singular and plural noun: "rate" / "rates". */
  one: string;
  many: string;
  className?: string;
}) {
  if (changes.length === 0) return null;
  const n = changes.length;
  return (
    <NotePanel tone="info" className={className} title={`${n} ${n === 1 ? `${one} is` : `${many} are`} awaiting approval`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          {changes.slice(0, 2).map((c) => c.summary || CHANGE_TYPE_LABEL[c.changeType]).join(" · ")}
          {n > 2 ? ` · and ${n - 2} more` : ""}. {n === 1 ? "It is" : "They are"} not listed until someone else approves {n === 1 ? "it" : "them"}.
        </span>
        <Link to="/token-console/changes" className="text-[13px] font-medium text-primary-600 hover:text-primary-700">Review</Link>
      </div>
    </NotePanel>
  );
}
