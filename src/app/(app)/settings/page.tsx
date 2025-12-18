import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import type { Metadata } from "next";
import { PersonalInfoForm } from "../pages/settings/_components/personal-info";
import { UploadPhotoForm } from "../pages/settings/_components/upload-photo";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1080px]">
      <Breadcrumb pageName="Settings" />

      <div className="grid grid-cols-5 gap-8">
        <div className="col-span-5 xl:col-span-3">
          <PersonalInfoForm />
        </div>
        <div className="col-span-5 xl:col-span-2">
          <UploadPhotoForm />
        </div>
      </div>
    </div>
  );
}
