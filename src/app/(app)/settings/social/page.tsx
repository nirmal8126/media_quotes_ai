import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { SocialIntegrations } from "../_components/social-integrations";

export const metadata: Metadata = {
  title: "Social Integrations",
};

export default function SocialSettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <Breadcrumb pageName="Social Integrations" />
      <SocialIntegrations />
    </div>
  );
}
