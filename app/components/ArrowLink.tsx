import Link from "next/link";

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
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1.5 8.5L8.5 1.5M8.5 1.5H3.2M8.5 1.5V6.8"
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
