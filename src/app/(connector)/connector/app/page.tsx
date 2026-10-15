"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP } from "@/lib/connector/data";

/** Client-side redirect so it also works on static hosting. */
export default function AppIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace(`${APP}/launchpad/${window.location.search}`);
  }, [router]);
  return null;
}
