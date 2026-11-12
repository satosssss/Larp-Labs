import { Suspense } from "react";
import { NoticeFlow } from "@/components/notice-flow";
export default function NoticePage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="workspace">
          <p role="status">Inihahanda ang dokumento…</p>
        </main>
      }
    >
      <NoticeFlow />
    </Suspense>
  );
}
