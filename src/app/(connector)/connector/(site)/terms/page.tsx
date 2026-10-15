import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/connector/site/LegalPage";
import { BASE } from "@/lib/connector/data";

export const metadata: Metadata = { title: "Terms of Service" };

const CONTACT = "contact@satishkumar.net";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <div>
        <h2>Using the service</h2>
        <p>
          You may connect only social accounts you own or are authorised to manage. You are responsible for the content you publish, including content
          drafted by the AI Agent that you approve or allow it to publish.
        </p>
      </div>
      <div>
        <h2>Platform rules</h2>
        <p>Posts must follow the rules of each network (for example Meta’s Community Standards). We may suspend accounts used for spam or abuse.</p>
      </div>
      <div>
        <h2>AI features</h2>
        <p>AI-generated text can be wrong. Review captions before they go live. Daily AI usage is limited per account.</p>
      </div>
      <div id="data-deletion">
        <h2>Data deletion</h2>
        <p>
          Disconnect an account from Accounts → Manage accounts to delete its access token right away. To delete your entire account, email{" "}
          <a href={`mailto:${CONTACT}`} className="font-bold text-primary">{CONTACT}</a>. See our{" "}
          <Link href={`${BASE}/privacy#data-deletion`} className="font-bold text-primary">Privacy Policy</Link> for details.
        </p>
      </div>
      <div>
        <h2>Contact</h2>
        <p>
          <a href={`mailto:${CONTACT}`} className="font-bold text-primary">{CONTACT}</a>
        </p>
      </div>
    </LegalPage>
  );
}
