import { Button, NotePanel } from "../../ui";

/** Shown in place of the reports and alerts while omnichannel answers 503 for
 *  them: the reporting service is not switched on, cannot be reached, or
 *  refused omnichannel's key. Omnichannel's reason is shown as it came. */
export function ReportingUnavailable({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  const notConfigured = /not configured/i.test(reason);
  return (
    <NotePanel tone="warning" className="mb-6" title={notConfigured ? "Reporting is not switched on yet" : "Reporting is unavailable"}>
      <div className="flex flex-wrap items-center justify-between gap-3" data-testid="reporting-unavailable">
        <span>
          {notConfigured
            ? "Reports and surveillance alerts come from the reporting service, which is not set up in this environment yet. Nothing here can be read or run until it is."
            : reason}
        </span>
        <Button size="sm" variant="outline" onClick={onRetry}>Check again</Button>
      </div>
    </NotePanel>
  );
}
