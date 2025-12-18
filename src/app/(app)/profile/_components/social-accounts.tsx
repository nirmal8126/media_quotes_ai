import Link from "next/link";
import {
  DribbleIcon,
  FacebookIcon,
  GitHubIcon,
  LinkedInIcon,
  XIcon,
} from "./icons";

type SocialLinks = Partial<Record<"facebook" | "twitter" | "x" | "linkedin" | "github" | "dribbble", string>>;

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  facebook: FacebookIcon,
  x: XIcon,
  twitter: XIcon,
  linkedin: LinkedInIcon,
  github: GitHubIcon,
  dribbble: DribbleIcon,
};

export function SocialAccounts({ links }: { links?: SocialLinks }) {
  const entries = Object.entries(links || {}).filter(([, url]) => typeof url === "string" && url.trim());

  if (!entries.length) {
    return (
      <div className="mt-4.5 text-sm text-gray-600 dark:text-gray-300">
        Add social links in settings to show them here.
      </div>
    );
  }

  return (
    <div className="mt-4.5">
      <h4 className="mb-3.5 font-medium text-dark dark:text-white">
        Follow me on
      </h4>
      <div className="flex items-center justify-center gap-3.5">
        {entries.map(([platform, url]) => {
          const Icon = ICONS[platform] || XIcon;
          return (
            <Link
              key={platform}
              href={url}
              className="hover:text-primary"
              target="_blank"
              rel="noreferrer"
            >
              <span className="sr-only">View {platform} account</span>

              <Icon />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
