import Link from "next/link";
import { Button } from "@/components/ui/button";
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
    body: "Your footage is encrypted end-to-end. Only a confirmed buyer can decrypt. GPS hidden until you authorise.",
  },
  {
    icon: "🤖",
    title: "AI Corroboration",
    body: "SigLIP 2 matches your clip against other recordings of the same event. Corroborated bundles command higher prices.",
  },
  {
    icon: "💸",
    title: "80% Goes To You",
    body: "Smart contracts split every sale instantly — 80% to you, 10% to a journalism fund for freely listed footage, 10% to the platform.",
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

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-2 border-border flex flex-col min-h-[280px] sm:min-h-[340px]">
        {/* Video background */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: "grayscale(1) brightness(0.45)" }}
        >
          <source src="/hero-footage.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/35 z-10 pointer-events-none" />

        {/* Centered content */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 text-center">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-heading leading-tight text-white max-w-3xl">
            Your footage.{" "}
            <span className="bg-main px-2 whitespace-nowrap">Your proof.</span>{" "}
            Your price.
          </h1>
          <p className="text-sm text-white/65 font-base mt-4 max-w-lg leading-relaxed text-pretty">
            Eyewitnesses capture cryptographically verified footage and sell it on their own terms. No professional camera. No middlemen. 80% direct to you.
          </p>
          <div className="flex flex-row gap-3 mt-6">
            <Link href="/record">
              <Button size="lg" className="text-sm px-6 animate-pulse-ring">
                Start Recording →
              </Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="neutral" size="lg" className="text-sm px-6">
                Browse
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Feed — the main event ───────────────────────────── */}
      <section className="relative overflow-hidden flex-1 px-4 sm:px-6 py-6 sm:py-10">
        {/* Animated blobs */}
        <div aria-hidden className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-chart-1 opacity-[0.12] blur-[100px] pointer-events-none animate-blob" />
        <div aria-hidden className="absolute top-1/3 -right-16 w-64 h-64 rounded-full bg-chart-2 opacity-[0.10] blur-[100px] pointer-events-none animate-blob blob-delay-2" />
        <div aria-hidden className="absolute bottom-0 left-1/2 w-56 h-56 rounded-full bg-chart-5 opacity-[0.10] blur-[100px] pointer-events-none animate-blob blob-delay-3" />
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
      <section className="relative overflow-hidden border-t-2 border-border px-4 sm:px-6 py-12 sm:py-16 bg-secondary-background">
        {/* Dot-grid background pattern */}
        <div aria-hidden className="absolute inset-0 bg-dot-pattern opacity-[0.06] pointer-events-none" />
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
      <section className="relative overflow-hidden border-t-2 border-b-2 border-border px-4 sm:px-6 py-12 sm:py-16 text-center bg-main">
        {/* Radial glow */}
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,white_0%,transparent_65%)] opacity-[0.15] pointer-events-none" />
        {/* Diagonal stripes */}
        <div aria-hidden className="absolute inset-0 bg-diagonal-stripes pointer-events-none" />
        <h2 className="text-3xl sm:text-4xl font-heading mb-3">
          Witnessed something important?
        </h2>
        <p className="text-base mb-8 max-w-md mx-auto font-base opacity-80">
          Record from your browser. The blockchain handles the proof. You keep 80% of the revenue.
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
        <span className="flex items-center gap-1.5 font-heading text-lg">
          <svg viewBox="0 0 20 20" width="24" height="24" fill="none" aria-hidden="true">
            <circle cx="2.5" cy="17.5" r="2" fill="oklch(28% 0.22 295)" />
            <path d="M2.5 12.5 A5 5 0 0 1 7.5 17.5" stroke="oklch(40% 0.24 295)" strokeWidth="2.4" strokeLinecap="round"/>
            <path d="M2.5 8 A9.5 9.5 0 0 1 12 17.5" stroke="oklch(52% 0.22 295)" strokeWidth="2.4" strokeLinecap="round"/>
            <path d="M2.5 3.5 A14 14 0 0 1 16.5 17.5" stroke="oklch(58% 0.22 160)" strokeWidth="2.4" strokeLinecap="round"/>
          </svg>
          Radrr
        </span>
        <span className="text-muted-foreground text-xs text-center">
          Built on Filecoin · Storacha · Hypercerts · ERC-8004
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
