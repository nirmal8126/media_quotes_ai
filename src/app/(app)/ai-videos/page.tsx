import type { Metadata } from "next";
import AiVideosClientPage from "./client";

export const metadata: Metadata = {
  title: "AI Videos",
};

export default function AiVideosPage() {
  return <AiVideosClientPage />;
}
