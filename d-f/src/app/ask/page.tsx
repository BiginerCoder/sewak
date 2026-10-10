"use client";

import { AskAssistant } from "@/components/AskAssistant";
import { SewakChat } from "@/components/SewakChat";
import { PageHead } from "@/components/ui";
import { getIssues } from "@/lib/queries";
import { useDemoData } from "@/lib/demo-store";

export default function AskPage() {
  const { data } = useDemoData();
  const issues = getIssues(data);
  const cases = issues.filter((i) => i.kind === "problem");
  return (
    <>
      <PageHead title="Ask for help" eyebrow="Guided assistance">
        Describe a problem in your own words. We will check existing community cases, find government service pages for your ward, and help you prepare a complaint.
      </PageHead>
      <SewakChat cases={cases} />
      <AskAssistant cases={cases} />
    </>
  );
}
