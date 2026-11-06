// Milestone 3: the standalone "Memory" section was removed to avoid two
// places for uploading the same information.
//   - Clinical documents  → /clinical
//   - Personal memories   → the avatar's page (/avatars/[id])
// Old links/bookmarks to /memory are redirected.
import { redirect } from "next/navigation";

export default function MemoryRedirect() {
  redirect("/clinical");
}
