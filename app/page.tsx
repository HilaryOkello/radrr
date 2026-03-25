import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: "🔒",
    title: "Cryptographic Proof",
    body: "Every recording is SHA-256 hashed chunk-by-chunk. A Merkle root is anchored on NEAR Protocol — tamper-evident, forever.",
  },
  {
    icon: "🌍",
    title: "Decentralised Storage",
    body: "Footage lives on Filecoin via Storacha. Content-addressed CIDs link directly to your on-chain proof. No one can delete it.",
  },
  {
    icon: "🔑",
    title: "You Control Access",
    body: "Lit Protocol encrypts your footage. Only a confirmed buyer can decrypt. Exact GPS is hidden until you authorise disclosure.",
  },
  {
    icon: "🤖",
    title: "AI Corroboration",
    body: "SigLIP 2 matches your clip against other recordings of the same event. Corroborated bundles command higher prices.",
  },
  {
    icon: "👤",
    title: "Verified Human",
    body: "World ID proves you're a unique human — no bots flooding the network. Your pseudonymous identity stays protected.",
  },
  {
    icon: "💸",
    title: "85% Goes To You",
    body: "Smart contracts split every sale instantly: 85% to you, 10% platform, 5% journalist safety fund. No invoices. No 90-day waits.",
  },
];

const stats = [
  { value: "$0.01", label: "Max NEAR tx fee" },
  { value: "85%", label: "Witness revenue share" },
  { value: "600ms", label: "NEAR finality" },
  { value: "0", label: "Middlemen" },
];

export default function Home() {
  return (
    <main className="flex flex-col min-h-screen">
      {/* Nav */}
      <nav className="border-b-2 border-border px-6 py-4 flex items-center justify-between bg-secondary-background">
        <span className="text-2xl font-heading tracking-tight">radrr</span>
        <div className="flex gap-3">
          <Link href="/marketplace">
            <Button variant="neutral" size="sm">Browse Footage</Button>
          </Link>
          <Link href="/verify">
            <Button size="sm">Start Recording</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center border-b-2 border-border">
        <Badge className="mb-6 text-sm px-4 py-1">
          Community Truth Network
        </Badge>
        <h1 className="text-5xl md:text-7xl font-heading leading-tight max-w-4xl mb-6">
          Your footage.
          <br />
          <span className="bg-main px-2">Your proof.</span>
          <br />
          Your price.
        </h1>
        <p className="text-lg md:text-xl max-w-2xl mb-10 text-muted-foreground font-base">
          Eyewitnesses capture cryptographically verified footage directly from
          their browser and share or sell it on their own terms. No professional
          camera required.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/verify">
            <Button size="lg" className="text-base px-8">
              Start Recording →
            </Button>
          </Link>
          <Link href="/marketplace">
            <Button variant="neutral" size="lg" className="text-base px-8">
              Browse Marketplace
            </Button>
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b-2 border-border bg-main">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-border">
          {stats.map((s) => (
            <div key={s.label} className="px-8 py-10 text-center">
              <div className="text-4xl font-heading mb-1">{s.value}</div>
              <div className="text-sm font-base">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-b-2 border-border">
        <h2 className="text-3xl font-heading text-center mb-12">
          Every component is load-bearing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((f) => (
            <Card key={f.title} className="border-2 border-border">
              <CardContent className="pt-6">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-heading text-lg mb-2">{f.title}</h3>
                <p className="text-sm font-base text-muted-foreground leading-relaxed">
                  {f.body}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center bg-secondary-background border-b-2 border-border">
        <h2 className="text-4xl font-heading mb-4">
          Witnessed something important?
        </h2>
        <p className="text-lg mb-8 max-w-xl mx-auto font-base text-muted-foreground">
          Verify your identity once. Record. The blockchain handles the proof.
          You keep the revenue.
        </p>
        <Link href="/verify">
          <Button size="lg" className="text-base px-10">
            Verify &amp; Start Recording →
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t-2 border-border flex flex-col md:flex-row items-center justify-between gap-4 text-sm font-base">
        <span className="font-heading text-lg">radrr</span>
        <div className="flex gap-6 text-muted-foreground">
          <span>Built on NEAR · Filecoin · Lit Protocol · World ID · Hypercerts</span>
        </div>
        <div className="flex gap-4">
          <Link href="/marketplace" className="hover:underline">Marketplace</Link>
          <Link href="/record" className="hover:underline">Record</Link>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        </div>
      </footer>
    </main>
  );
}
