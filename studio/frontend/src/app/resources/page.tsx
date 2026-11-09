import { redirect } from "next/navigation";

export default function ResourcesRedirect() {
  redirect("/roadmap?tab=resources");
}
