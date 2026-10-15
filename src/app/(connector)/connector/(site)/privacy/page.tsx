import type { Metadata } from "next";
import LegalPage from "@/components/connector/site/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

const CONTACT = "contact@satishkumar.net";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <div>
        <h2>Who we are</h2>
        <p>
          Social Media Connector lets you plan, create and publish posts to the social accounts you own. Questions about this policy:{" "}
          <a href={`mailto:${CONTACT}`} className="font-bold text-primary">{CONTACT}</a>.
        </p>
      </div>
      <div>
        <h2>What we collect</h2>
        <ul>
          <li>Your name, email address and a hashed password when you create an account.</li>
          <li>
            When you connect Facebook or Instagram: the names and IDs of the Pages and Instagram accounts you choose, and the access tokens Meta gives us
            to publish on your behalf.
          </li>
          <li>The posts, captions, images and schedules you create, and your chats with the AI Agent.</li>
        </ul>
      </div>
      <div>
        <h2>How we use it</h2>
        <ul>
          <li>To publish and schedule the posts you create or approve, only to the accounts you connected.</li>
          <li>To send account emails such as email verification and password reset.</li>
          <li>To generate captions and post ideas with our AI provider (Anthropic) when you use the AI features.</li>
        </ul>
        <p className="mt-3">We do not sell your data and we do not use your social accounts for anything you did not ask for.</p>
      </div>
      <div>
        <h2>Sharing</h2>
        <p>
          Data is shared only with the services needed to run the product: Meta (to publish posts), Anthropic (AI text generation) and our hosting
          provider.
        </p>
      </div>
      <div id="data-deletion">
        <h2>Deleting your data</h2>
        <ul>
          <li>Remove a connected account any time from Accounts → Manage accounts; its access token is deleted immediately.</li>
          <li>You can also remove our app in Facebook → Settings → Business integrations.</li>
          <li>
            To delete your whole account and all its data, email <a href={`mailto:${CONTACT}`} className="font-bold text-primary">{CONTACT}</a> from your
            account email. We delete everything within 30 days.
          </li>
        </ul>
      </div>
    </LegalPage>
  );
}
