import { Suspense } from "react";
import Composer from "@/components/connector/app/Composer";

export default function CreatePostPage() {
  return (
    <Suspense>
      <Composer />
    </Suspense>
  );
}
