import { PageChrome } from "@/components/site/PageChrome";
import { VerifyRoundClient } from "./VerifyRoundClient";

export default async function RoundVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageChrome>
      <VerifyRoundClient id={id} />
    </PageChrome>
  );
}
