import type { Metadata } from "next";
import PricingTable from "@/components/connector/site/PricingTable";
import { Container, CtaBand, Faq, PageIntro } from "@/components/connector/site/Sections";
import Icon from "@/components/connector/Icon";
import { socialPlans } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Pricing" };

const compare = [
  ["Social accounts", "7", "20", "50", "100"],
  ["Users", "1", "3", "6", "Unlimited"],
  ["Scheduled posts", "500", "Unlimited", "Unlimited", "Unlimited"],
  ["Bulk import", true, true, true, true],
  ["Content library", false, true, true, true],
  ["Unified inbox", false, true, true, true],
  ["Client management", false, false, true, true],
  ["White-label reports", false, false, true, true],
  ["MCP Server", false, false, false, true],
] as const;

export default function PlansPage() {
  return (
    <>
      <PageIntro eyebrow="Pricing" title="Pick the plan that fits your growth" sub="Every plan starts with a 14-day free trial. Prices in INR, excluding GST." />
      <section className="bg-primary-soft pb-24">
        <Container>
          <PricingTable plans={socialPlans} />
        </Container>
      </section>
      <section className="py-24">
        <Container>
          <h2 className="text-center text-3xl font-bold text-ink">Compare plans</h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-canvas">
                <tr>
                  <th className="p-4 font-bold text-ink">Feature</th>
                  {socialPlans.map((p) => (
                    <th key={p.name} className="p-4 text-center font-bold text-ink">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {compare.map(([label, ...vals]) => (
                  <tr key={label}>
                    <td className="p-4 font-medium text-ink-2">{label}</td>
                    {vals.map((v, k) => (
                      <td key={k} className="p-4 text-center">
                        {typeof v === "boolean" ? (
                          v ? <Icon name="checkCircle" className="mx-auto text-success" /> : <span className="text-muted">—</span>
                        ) : (
                          <span className="font-bold text-ink">{v}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Container>
      </section>
      <Faq />
      <CtaBand />
    </>
  );
}
