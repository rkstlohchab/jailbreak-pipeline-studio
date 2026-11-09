import { redirect } from "next/navigation";

export default function LearnRedirect() {
  redirect("/roadmap?tab=lessons");
}
