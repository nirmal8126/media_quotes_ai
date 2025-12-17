import type { Metadata } from "next";
import AiVideoEditorClient from "./client";

export const metadata: Metadata = {
  title: "AI Video Editor",
};

export default function AiVideoEditorPage() {
  return <AiVideoEditorClient />;
}
