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
      <Link href="/" className="text-2xl font-heading tracking-tight shrink-0">
        radrr
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
              <SheetTitle className="text-xl font-heading tracking-tight text-left">
                radrr
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
