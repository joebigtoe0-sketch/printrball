import Link from "next/link";
import { PageChrome } from "@/components/site/PageChrome";

export default function VerifyIndexPage() {
  return (
    <PageChrome>
      <main className="shell verify-page">
        <div className="how-eyebrow">Verify</div>
        <h1 className="how-headline" style={{ marginTop: 8, marginBottom: 0, fontSize: "clamp(28px, 4vw, 44px)" }}>
          Verify a round
        </h1>
        <p className="verify-index-lead">
          Open any completed or void round by id. Each page shows the published seed, the sorted eligible list, and the
          mod-N walkthrough so you can reproduce the winner offline.
        </p>
        <div className="verify-index-actions">
          <Link href="/round/1">Example: /round/1 →</Link>
          <Link href="/">← Back to home</Link>
        </div>
      </main>
    </PageChrome>
  );
}
