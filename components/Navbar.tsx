"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectWallet } from "@/components/ConnectWallet";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/marketplace", label: "Browse" },
  { href: "/record", label: "Record" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b-2 border-border px-4 sm:px-6 py-4 flex items-center justify-between bg-secondary-background">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <svg viewBox="0 0 20 20" width="34" height="34" fill="none" aria-hidden="true">
          <circle cx="2.5" cy="17.5" r="2" fill="oklch(28% 0.22 295)" />
          <path d="M2.5 12.5 A5 5 0 0 1 7.5 17.5" stroke="oklch(40% 0.24 295)" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M2.5 8 A9.5 9.5 0 0 1 12 17.5" stroke="oklch(52% 0.22 295)" strokeWidth="2.4" strokeLinecap="round"/>
          <path d="M2.5 3.5 A14 14 0 0 1 16.5 17.5" stroke="oklch(58% 0.22 160)" strokeWidth="2.4" strokeLinecap="round"/>
        </svg>
        <span className="text-2xl font-heading tracking-tight">Radrr</span>
      </Link>

      {/* Desktop links */}
      <div className="hidden sm:flex items-center gap-3">
        {NAV_LINKS.map(({ href, label }) => (
          <Link key={href} href={href}>
            <Button
              variant="neutral"
              size="sm"
              className={cn(
                pathname === href && "bg-main text-main-foreground"
              )}
            >
              {label}
            </Button>
          </Link>
        ))}
        <ConnectWallet />
      </div>

      {/* Mobile: wallet + hamburger */}
      <div className="flex sm:hidden items-center gap-2">
        <ConnectWallet />
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="neutral" size="sm" className="px-2">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64 p-0">
            <SheetHeader className="px-6 py-4 border-b-2 border-border">
              <SheetTitle className="text-xl font-heading tracking-tight text-left flex items-center gap-2">
                <svg viewBox="0 0 20 20" width="26" height="26" fill="none" aria-hidden="true">
                  <circle cx="2.5" cy="17.5" r="2" fill="oklch(28% 0.22 295)" />
                  <path d="M2.5 12.5 A5 5 0 0 1 7.5 17.5" stroke="oklch(40% 0.24 295)" strokeWidth="2.4" strokeLinecap="round"/>
                  <path d="M2.5 8 A9.5 9.5 0 0 1 12 17.5" stroke="oklch(52% 0.22 295)" strokeWidth="2.4" strokeLinecap="round"/>
                  <path d="M2.5 3.5 A14 14 0 0 1 16.5 17.5" stroke="oklch(58% 0.22 160)" strokeWidth="2.4" strokeLinecap="round"/>
                </svg>
                Radrr
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-4 gap-2">
              {NAV_LINKS.map(({ href, label }) => (
                <SheetClose asChild key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "px-4 py-3 rounded-base border-2 border-border font-base text-sm font-medium transition-colors hover:bg-secondary-background",
                      pathname === href
                        ? "bg-main text-main-foreground"
                        : "bg-background"
                    )}
                  >
                    {label}
                  </Link>
                </SheetClose>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
