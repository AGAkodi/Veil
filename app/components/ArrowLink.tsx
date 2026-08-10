import Link from "next/link";
import { ArrowIcon } from "./ArrowIcon";

/** The small dark link with a north-east arrow, used to close a passage. */
export function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="link-arrow inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink underline-offset-4 hover:underline"
    >
      {children}
      <ArrowIcon />
    </Link>
  );
}
