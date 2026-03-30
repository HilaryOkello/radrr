import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PublicVideos } from "@/components/PublicVideos";
import { Navbar } from "@/components/Navbar";

const features = [
  {
    icon: "🔒",
    title: "Cryptographic Proof",
    body: "Merkle root anchored on Filecoin FVM at the moment of capture — tamper-evident, forever.",
  },
  {
    icon: "🌍",
    title: "Decentralised Storage",
    body: "Footage lives on Filecoin via Storacha. Content-addressed CIDs link to your on-chain proof. No one can delete it.",
  },
  {
    icon: "🔑",
    title: "You Control Access",
    body: "Lit Protocol encrypts your footage. Only a confirmed buyer can decrypt. GPS hidden until you authorise.",
  },
  {
    icon: "🤖",
    title: "AI Corroboration",
    body: "SigLIP 2 matches your clip against other recordings of the same event. Corroborated bundles command higher prices.",
  },
  {
    icon: "💸",
    title: "85% Goes To You",
    body: "Smart contracts split every sale instantly. No invoices. No 90-day waits. No platform taking the majority.",
  },
  {
    icon: "📜",
    title: "Hypercerts on Purchase",
    body: "Every buyer receives a permanent on-chain Hypercert — proof they funded verified public-interest journalism.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      <Navbar />

      {/* ── Hero — compact, lets the feed breathe ─────────── */}
      <section className="border-b-2 border-border bg-secondary-background">
        {/* Mobile: stacked minimal */}
        <div className="flex flex-col sm:hidden px-4 py-6 gap-4">
          <div>
            <Badge className="mb-3 text-xs px-3 py-0.5">Community Truth Network</Badge>
            <h1 className="text-3xl font-heading leading-tight">
              Your footage.{" "}
              <span className="bg-main px-1">Your proof.</span>{" "}
              Your price.
            </h1>
            <p className="text-sm text-muted-foreground font-base mt-2">
              Record. Verify. Sell — directly from your browser.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/record" className="flex-1">
              <Button className="w-full animate-pulse-ring">
                Record now →
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="neutral">Browse</Button>
            </Link>
          </div>
        </div>

        {/* Desktop: split layout */}
        <div className="hidden sm:grid grid-cols-2 divide-x-2 divide-border min-h-[260px]">
          <div className="flex flex-col justify-center px-10 py-10 gap-5">
            <Badge className="self-start text-sm px-4 py-1">Community Truth Network</Badge>
            <h1 className="text-5xl lg:text-6xl font-heading leading-tight">
              Your footage.
              <br />
              <span className="bg-main px-2">Your proof.</span>
              <br />
              Your price.
            </h1>
            <p className="text-base text-muted-foreground font-base max-w-md">
              Eyewitnesses capture cryptographically verified footage and sell it on their own terms.
              No professional camera. No middlemen. 85% direct to you.
            </p>
            <div className="flex gap-3">
              <Link href="/record">
                <Button size="lg" className="text-base px-8 animate-pulse-ring">
                  Start Recording →
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="neutral" size="lg" className="text-base px-8">
                  Browse Marketplace
                </Button>
              </Link>
            </div>
          </div>

          {/* Right: stats */}
          <div className="grid grid-cols-2 divide-x-2 divide-y-2 divide-border">
            {[
              { value: "85%", label: "Witness revenue" },
              { value: "$0.01", label: "Max tx fee" },
              { value: "0", label: "Middlemen" },
              { value: "∞", label: "Storage life" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <span className="text-4xl font-heading">{s.value}</span>
                <span className="text-sm text-muted-foreground font-base mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Feed — the main event ───────────────────────────── */}
      <section className="flex-1 px-4 sm:px-6 py-6 sm:py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-heading">Live Feed</h2>
              <p className="text-xs sm:text-sm text-muted-foreground font-base">
                Verified footage · free to watch ·{" "}
                <Link href="/marketplace" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  full marketplace →
                </Link>
              </p>
            </div>
            <Link href="/record">
              <Button size="sm" className="animate-pulse-ring hidden sm:inline-flex">
                + Record
              </Button>
            </Link>
          </div>
          <PublicVideos />
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="border-t-2 border-border px-4 sm:px-6 py-12 sm:py-16 bg-secondary-background">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading text-center mb-2">
            Every component is load-bearing
          </h2>
          <p className="text-center text-muted-foreground font-base text-sm mb-10">
            Decentralisation isn't decoration here. Remove any piece and you're back to trusting a company.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`border-2 border-border rounded-base p-5 bg-background hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_var(--border)] transition-all duration-200 animate-slide-up stagger-${Math.min(i, 5)}`}
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-heading text-base mb-1.5">{f.title}</h3>
                <p className="text-sm font-base text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="border-t-2 border-b-2 border-border px-4 sm:px-6 py-12 sm:py-16 text-center bg-main">
        <h2 className="text-3xl sm:text-4xl font-heading mb-3">
          Witnessed something important?
        </h2>
        <p className="text-base mb-8 max-w-md mx-auto font-base opacity-80">
          Record from your browser. The blockchain handles the proof. You keep 85% of the revenue.
        </p>
        <Link href="/record">
          <Button
            size="lg"
            variant="neutral"
            className="text-base px-10 shadow-[4px_4px_0px_0px_var(--border)] hover:shadow-[6px_6px_0px_0px_var(--border)] hover:-translate-y-0.5 transition-all"
          >
            Start Recording →
          </Button>
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm font-base">
        <span className="font-heading text-lg">radrr</span>
        <span className="text-muted-foreground text-xs text-center">
          Built on Filecoin · Lit Protocol · Storacha · Hypercerts · ERC-8004
        </span>
        <div className="flex gap-4 text-muted-foreground">
          <Link href="/marketplace" className="hover:text-foreground transition-colors">Marketplace</Link>
          <Link href="/record" className="hover:text-foreground transition-colors">Record</Link>
          <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        </div>
      </footer>
    </main>
  );
}
