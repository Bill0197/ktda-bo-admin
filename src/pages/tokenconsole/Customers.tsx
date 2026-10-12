import { PageHeader } from "../../ui";
import { CustomerDesk } from "../../components/tokenconsole/CustomerDesk";

/* Any customer, found by phone, email or id: their standing, money timeline,
   messages and app activity. Applicants waiting on a decision are the KYC
   desk's; this is for everyone, before and after that decision. */
export default function TokenConsoleCustomers() {
  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Customer desk"
        subtitle="Find any customer by the phone or email they use, or by an id: their standing, every payment and movement, the messages we sent and what they did in the app. Every lookup is recorded against you."
      />
      <CustomerDesk />
    </div>
  );
}
