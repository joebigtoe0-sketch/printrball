import { PageChrome } from "@/components/site/PageChrome";
import { AdminClient } from "./AdminClient";

export const metadata = {
  title: "Admin · PRINTRBALL",
};

export default function AdminPage() {
  return (
    <PageChrome>
      <AdminClient />
    </PageChrome>
  );
}
