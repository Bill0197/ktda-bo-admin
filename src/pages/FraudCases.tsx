import Cases from "./Cases";

/** Fraud Reporting's case list — the same workspace as Transaction Monitoring,
 * scoped to fraud matters. Case detail stays on /cases/:id: a case has one
 * record and should have one URL, whichever board opened it. */
export default function FraudCases() {
  return <Cases scope="fraud" />;
}
