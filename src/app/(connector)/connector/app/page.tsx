import { redirect } from "next/navigation";
import { APP } from "@/lib/connector/data";

export default function AppIndex() {
  redirect(`${APP}/launchpad`);
}
