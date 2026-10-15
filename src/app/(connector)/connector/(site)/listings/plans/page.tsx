import type { Metadata } from "next";
import PricingTable from "@/components/connector/site/PricingTable";
import { Container, CtaBand, PageIntro } from "@/components/connector/site/Sections";
import { listingPlans } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Listings pricing" };

export default function ListingPlansPage() {
  return (
    <>
      <PageIntro eyebrow="Listings pricing" title="Be found everywhere customers search" sub="Sync your business details to 40+ directories and grow your star rating." />
      <section className="bg-primary-soft pb-24">
        <Container>
          <PricingTable plans={listingPlans} buy={false} />
        </Container>
      </section>
      <div className="pt-24" />
      <CtaBand title="Put your business on the map" />
    </>
  );
}
