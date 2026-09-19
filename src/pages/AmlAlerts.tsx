import { getAmlAlerts } from "../lib/api";
import { AlertsBoard } from "../components/AlertsBoard";

export default function AmlAlerts() {
  return (
    <AlertsBoard
      eyebrow="Transaction Monitoring"
      title="Alerts"
      tooltip="AML = Anti-Money Laundering. 'Structuring' means splitting a large sum into many small transactions to avoid detection — this queue flags that kind of pattern for manual review."
      subtitle="Monitoring alerts across deposits, investments and redemptions — opening a case moves an alert into the investigation workflow."
      fetchAlerts={getAmlAlerts}
      casesPath="/cases"
    />
  );
}
