import { AskAssistant } from "@/components/AskAssistant";
import { PageHead } from "@/components/ui";
import { getIssues } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ask for help" };

export default async function AskPage() {
  const issues = await getIssues();
  const cases = issues
    .filter((i) => i.kind === "problem")
    .map((i) => ({ id: i.id, title: i.title, category: i.category, stage: i.stage, affectedCount: i.affectedCount }));
  return (
    <>
      <PageHead title="Ask for help" eyebrow="Guided assistance">
        Describe a problem in your own words. We will check existing community cases, find government service pages for your ward, and help you prepare a complaint.
      </PageHead>
      <AskAssistant cases={cases} />
    </>
  );
}
