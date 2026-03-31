/**
 * Script to create Hypercerts for the 3 failed public recordings
 * Run: npx tsx scripts/create-missing-hypercerts.ts
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { mintSaleHypercert } from "../lib/hypercerts";

// Recordings that failed to get hypercerts
const failedRecordings = [
  {
    recordingId: "rec_1774936214215_esh3m9",
    title: "Public Video 1",
    gpsApprox: "-1.3,36.8",
    timestamp: 1774936350000,
    witness: "0xb81Ad6d45a468D69212131DE3Dc9cfdaD86367fE",
    isCorroborated: false,
  },
  {
    recordingId: "rec_1774936444348_9horcm",
    title: "Public Video 2",
    gpsApprox: "-1.3,36.8",
    timestamp: 1774936560000,
    witness: "0xb81Ad6d45a468D69212131DE3Dc9cfdaD86367fE",
    isCorroborated: false,
  },
  {
    recordingId: "rec_1774936656214_o2j1ro",
    title: "Public Video 3",
    gpsApprox: "-1.3,36.8",
    timestamp: 1774936770000,
    witness: "0xb81Ad6d45a468D69212131DE3Dc9cfdaD86367fE",
    isCorroborated: false,
  },
];

async function main() {
  console.log("Creating Hypercerts for 3 public recordings...\n");
  console.log("Using handle:", process.env.CERTIFIED_APP_HANDLE);
  console.log("Using PDS:", process.env.CERTIFIED_APP_PDS);
  console.log();

  for (const rec of failedRecordings) {
    try {
      console.log(`Creating hypercert for: ${rec.title}`);
      console.log(`  Recording ID: ${rec.recordingId}`);
      console.log(`  GPS: ${rec.gpsApprox}`);
      console.log(`  Witness: ${rec.witness}`);

      const atUri = await mintSaleHypercert({
        recordingId: rec.recordingId,
        witnessAddress: rec.witness,
        witnessCredibilityScore: 50,
        eventDescription: rec.title,
        gpsApprox: rec.gpsApprox,
        recordingTimestamp: rec.timestamp,
        isCorroborated: rec.isCorroborated,
        isPublicShare: true,
      });

      console.log(`✅ Success! AT-URI: ${atUri}\n`);
    } catch (err) {
      console.error(`❌ Failed for ${rec.recordingId}:`);
      console.error(err);
      console.log();
    }
  }

  console.log("Done!");
}

main().catch(console.error);
