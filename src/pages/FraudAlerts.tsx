import { getFraudAlerts } from "../lib/api";
import { AlertsBoard } from "../components/AlertsBoard";

/** The fraud desk's queue — the Transaction Monitoring board, pointed at the
 * fraud indicators and the fraud case list. */
export default function FraudAlerts() {
  return (
    <AlertsBoard
      eyebrow="Fraud Reporting"
      title="Fraud alerts"
      tooltip="Fraud indicators rather than laundering typologies: account takeover (a new device just before a withdrawal), third-party payment (a payout account in someone else's name), mule patterns and replayed payment callbacks."
      subtitle="Fraud indicators raised across logins, payout instructions and the payment rails — opening a case moves an alert into the investigation workflow."
      fetchAlerts={getFraudAlerts}
      casesPath="/fraud-cases"
    />
  );
}
