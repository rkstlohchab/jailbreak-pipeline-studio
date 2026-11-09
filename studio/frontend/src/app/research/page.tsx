import { redirect } from "next/navigation";

export default function ResearchRedirect() {
  redirect("/roadmap?tab=research");
}
