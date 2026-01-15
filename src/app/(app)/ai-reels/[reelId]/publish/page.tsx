"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ReelPublishRedirect() {
  const router = useRouter();
  const params = useParams<{ reelId?: string }>();
  const reelId = params?.reelId ? params.reelId.toString() : "";

  useEffect(() => {
    if (reelId) {
      router.replace(`/ai-reels/${reelId}`);
    } else {
      router.replace("/ai-reels");
    }
  }, [reelId, router]);

  return null;
}
