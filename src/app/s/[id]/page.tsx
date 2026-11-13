import { SharedSummary } from "@/components/shared-summary";
import { shareStore } from "@/lib/server/share-store";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function SharedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rec = await shareStore.get(id);
  return (
    <SharedSummary
      en={rec?.payload.language === "en"}
      summary={
        rec
          ? {
              type: rec.payload.type,
              dates: rec.payload.dates,
              nextSteps: rec.payload.nextSteps,
            }
          : null
      }
    />
  );
}
