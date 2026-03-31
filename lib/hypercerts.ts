/**
 * Hypercerts integration via AT Protocol (certified.app).
 * Creates org.hypercerts.claim.activity records on the platform's PDS.
 * Uses app password auth — no OAuth flow needed server-side.
 */

import { AtpAgent } from "@atproto/api";

// PDS URL — set CERTIFIED_APP_PDS in .env.local (e.g. https://certified.one)
const PDS_URL = process.env.CERTIFIED_APP_PDS ?? "https://certified.one";

async function getAgent(): Promise<AtpAgent> {
  const handle = process.env.CERTIFIED_APP_HANDLE;
  const password = process.env.CERTIFIED_APP_PASSWORD;
  if (!handle || !password) {
    throw new Error("CERTIFIED_APP_HANDLE and CERTIFIED_APP_PASSWORD must be set");
  }
  const agent = new AtpAgent({ service: PDS_URL });
  await agent.login({ identifier: handle, password });
  return agent;
}

export interface HypercertParams {
  recordingId: string;
  witnessAddress: string;
  witnessCredibilityScore: number;
  eventDescription: string;
  gpsApprox: string;
  recordingTimestamp: number;
  isCorroborated: boolean;
  isPublicShare?: boolean;
}

/**
 * Create a Hypercert activity record for a footage event.
 * Returns the AT-URI of the created record (e.g. at://did:plc:.../org.hypercerts.claim.activity/...).
 */
export async function mintSaleHypercert(params: HypercertParams): Promise<string> {
  const agent = await getAgent();

  const isPublicShare = params.isPublicShare ?? false;
  const verificationLevel = isPublicShare
    ? "public"
    : params.isCorroborated
    ? "corroborated"
    : params.witnessCredibilityScore > 50
    ? "verified"
    : "unverified";

  const startDate = new Date(params.recordingTimestamp).toISOString();
  const endDate = new Date(params.recordingTimestamp + 3600 * 1000).toISOString();

  const result = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: "org.hypercerts.claim.activity",
    record: {
      $type: "org.hypercerts.claim.activity",
      title: isPublicShare
        ? `Radrr Public Documentation — ${params.eventDescription.slice(0, 60)}`
        : `Radrr Witness Documentation — ${params.eventDescription.slice(0, 60)}`,
      shortDescription: `Citizen journalism footage documented at ${params.gpsApprox}`,
      description: [
        isPublicShare
          ? "Freely shared citizen journalism footage on Radrr — no purchase required."
          : "Citizen journalism footage documented by a verified Radrr witness.",
        `Event: ${params.eventDescription}`,
        `Location: ${params.gpsApprox} (approximate)`,
        `Recording ID: ${params.recordingId}`,
        `Verification level: ${verificationLevel}`,
        `Witness credibility score: ${params.witnessCredibilityScore}`,
      ].join("\n"),
      workScope: {
        $type: "org.hypercerts.claim.activity#workScopeString",
        scope: "citizen-journalism",
      },
      startDate,
      endDate,
      contributors: [
        {
          contributorIdentity: {
            $type: "org.hypercerts.claim.activity#contributorIdentity",
            identity: params.witnessAddress,
          },
          contributionWeight: "100",
          contributionDetails: {
            $type: "org.hypercerts.claim.activity#contributorRole",
            role: "Witness",
          },
        },
      ],
      createdAt: new Date().toISOString(),
      // Radrr-specific fields stored alongside standard lexicon fields
      recordingId: params.recordingId,
      witnessAddress: params.witnessAddress,
      verificationLevel,
      gpsApprox: params.gpsApprox,
      isCorroborated: params.isCorroborated,
      isPublicShare,
      platform: "radrr",
    },
  });

  return result.data.uri;
}
