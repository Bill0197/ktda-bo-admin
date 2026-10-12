import { useSearchParams } from "react-router-dom";
import { PageHeader, Tabs } from "../../ui";
import { tokenConsole } from "../../lib/api";
import { useSharedSource } from "../../lib/tokenConsole/sharedList";
import { PackagesTab } from "./config/PackagesTab";
import { ChartTab, ClassifiersTab, SubtypesTab } from "./config/ReferenceTabs";
import { SchemesTab } from "./config/SchemesTab";

const TABS = ["schemes", "packages", "subtypes", "chart", "classifiers"] as const;
type Tab = (typeof TABS)[number];

/** The reference data everything else is defined against, one tab per kind.
 * Lists share the entity pickers' cache (same keys), so a scheme created from
 * the product form is already here, and the counts cost no extra requests. */
export default function TokenConsoleConfiguration() {
  // The tab lives in the URL, so a link or a reload lands on the same one.
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab: Tab = (TABS as readonly string[]).includes(requested ?? "") ? (requested as Tab) : "schemes";

  const schemes = useSharedSource("tok:scheme", tokenConsole.schemes);
  const packages = useSharedSource("tok:servicePackage", tokenConsole.servicePackages);
  const subtypes = useSharedSource("tok:contractSubtype", tokenConsole.contractSubtypes);
  const chart = useSharedSource("tok:chartOfAccount", tokenConsole.chart);
  const classifierTypes = useSharedSource("tok:classifierType", tokenConsole.classifierTypes);

  return (
    <div>
      <PageHeader
        eyebrow="Baracel Unyt"
        title="Configuration"
        subtitle="The reference data everything else is defined against: schemes, packages, subtypes, the chart and classifiers."
      />
      <Tabs
        className="mb-5"
        active={tab}
        onChange={(key) => setParams({ tab: key }, { replace: true })}
        tabs={[
          { key: "schemes", label: "Accounting schemes", count: schemes.data?.length },
          { key: "packages", label: "Service packages", count: packages.data?.length },
          { key: "subtypes", label: "Contract subtypes", count: subtypes.data?.length },
          { key: "chart", label: "Chart of accounts", count: chart.data?.length },
          { key: "classifiers", label: "Classifiers", count: classifierTypes.data?.length },
        ]}
      />
      <div role="tabpanel">
        {tab === "schemes" && <SchemesTab schemes={schemes} />}
        {tab === "packages" && <PackagesTab packages={packages} />}
        {tab === "subtypes" && <SubtypesTab subtypes={subtypes} />}
        {tab === "chart" && <ChartTab chart={chart} />}
        {tab === "classifiers" && <ClassifiersTab types={classifierTypes} />}
      </div>
    </div>
  );
}
