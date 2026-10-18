import { getAllUsers, getModerationLogs } from "@/lib/queries";
import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin & Partner Control Console",
  description: "User roles, partner verification, and moderation audit trail.",
};

export default async function AdminPage() {
  const [users, logs] = await Promise.all([
    getAllUsers(),
    getModerationLogs(),
  ]);

  return <AdminClient initialUsers={users} logs={logs} />;
}
