import { redirect } from "next/navigation";

// Preserve bookmarks while keeping saved and live runs in a single workspace.
export default async function PipelineRedirect({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const { session } = await searchParams;
  redirect(session ? `/attack?session=${encodeURIComponent(session)}` : "/attack");
}
