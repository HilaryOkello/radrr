import {
  NearBindgen,
  near,
  call,
  view,
  initialize,
  LookupMap,
  Vector,
} from "near-sdk-js";

@NearBindgen({})
class Radrr {
  constructor() {
    this.owner = "";
    this.platformWallet = "";
    this.safetyFundWallet = "";
    this.recordings = new LookupMap("r");
    this.identities = new LookupMap("i");
    this.gpsIndex = new LookupMap("g");
    this.purchases = new LookupMap("p");
    this.allRecordingIds = new Vector("a");
  }

  @initialize({})
  init({ platform_wallet, safety_fund_wallet }) {
    this.owner = near.predecessorAccountId();
    this.platformWallet = platform_wallet;
    this.safetyFundWallet = safety_fund_wallet;
  }

  // ─── Identity ───────────────────────────────────────────────────────────

  @call({})
  register_identity({ pseudonym, world_id_hash }) {
    const caller = near.predecessorAccountId();
    if (this.identities.get(caller)) near.panicUtf8("Identity already registered");
    if (!pseudonym) near.panicUtf8("Pseudonym required");
    if (!world_id_hash) near.panicUtf8("World ID hash required");

    this.identities.set(caller, {
      account_id: caller,
      pseudonym,
      world_id_hash,
      world_id_verified: true,
      credibility_score: 10,
      recording_count: 0,
      total_sales: 0,
    });
  }

  // ─── Recording ──────────────────────────────────────────────────────────

  @call({})
  anchor_recording({ recording_id, merkle_root, gps_approx, title, price_near }) {
    const caller = near.predecessorAccountId();
    if (!this.identities.get(caller)) near.panicUtf8("Must register identity first");
    if (this.recordings.get(recording_id)) near.panicUtf8("Recording ID exists");

    const priceYocto = BigInt(Math.floor(parseFloat(price_near || "1") * 1e24)).toString();

    this.recordings.set(recording_id, {
      recording_id,
      merkle_root,
      gps_approx,
      timestamp: Number(near.blockTimestamp() / 1000000n),
      cid: null,
      encrypted_cid: null,
      witness: caller,
      corroboration_bundle: [],
      sold: false,
      title,
      price_yocto: priceYocto,
      buyer: null,
    });

    this.allRecordingIds.push(recording_id);

    // GPS clustering
    const gpsKey = this._gpsClusterKey(gps_approx);
    const cluster = this.gpsIndex.get(gpsKey) || [];
    cluster.push(recording_id);
    this.gpsIndex.set(gpsKey, cluster);

    // Increment recording count
    const identity = this.identities.get(caller);
    if (identity) {
      identity.recording_count += 1;
      this.identities.set(caller, identity);
    }
  }

  @call({})
  update_cid({ recording_id, cid }) {
    const recording = this.recordings.get(recording_id);
    if (!recording) near.panicUtf8("Recording not found");
    if (recording.witness !== near.predecessorAccountId()) near.panicUtf8("Not witness");
    recording.cid = cid;
    this.recordings.set(recording_id, recording);
  }

  @call({})
  update_encrypted_cid({ recording_id, encrypted_cid }) {
    if (near.predecessorAccountId() !== this.owner) near.panicUtf8("Platform only");
    const recording = this.recordings.get(recording_id);
    if (!recording) near.panicUtf8("Recording not found");
    recording.encrypted_cid = encrypted_cid;
    this.recordings.set(recording_id, recording);
  }

  // ─── Purchase ───────────────────────────────────────────────────────────

  @call({ payableFunction: true })
  purchase({ recording_id }) {
    const caller = near.predecessorAccountId();
    const recording = this.recordings.get(recording_id);
    if (!recording) near.panicUtf8("Recording not found");
    if (recording.sold) near.panicUtf8("Already sold");
    if (recording.witness === caller) near.panicUtf8("Cannot buy own recording");

    const attached = near.attachedDeposit();
    const price = BigInt(recording.price_yocto);
    if (attached < price) near.panicUtf8("Insufficient payment");

    const witnessShare = price * 85n / 100n;
    const platformShare = price * 10n / 100n;
    const safetyShare = price - witnessShare - platformShare;

    recording.sold = true;
    recording.buyer = caller;
    this.recordings.set(recording_id, recording);

    const purchaseKey = `${recording_id}:${caller}`;
    this.purchases.set(purchaseKey, {
      recording_id,
      buyer: caller,
      amount_yocto: price.toString(),
      timestamp: Number(near.blockTimestamp() / 1000000n),
    });

    const identity = this.identities.get(recording.witness);
    if (identity) {
      identity.total_sales += 1;
      identity.credibility_score += 5;
      this.identities.set(recording.witness, identity);
    }

    const promise1 = near.promiseBatchCreate(recording.witness);
    near.promiseBatchActionTransfer(promise1, witnessShare);

    const promise2 = near.promiseBatchCreate(this.platformWallet);
    near.promiseBatchActionTransfer(promise2, platformShare);

    const promise3 = near.promiseBatchCreate(this.safetyFundWallet);
    near.promiseBatchActionTransfer(promise3, safetyShare);
  }

  // ─── Corroboration ──────────────────────────────────────────────────────

  @call({})
  update_corroboration({ recording_id, bundle_ids }) {
    if (near.predecessorAccountId() !== this.owner) near.panicUtf8("Platform only");
    const recording = this.recordings.get(recording_id);
    if (!recording) near.panicUtf8("Recording not found");
    recording.corroboration_bundle = bundle_ids;
    this.recordings.set(recording_id, recording);
  }

  @call({})
  increment_credibility({ account_id, points }) {
    if (near.predecessorAccountId() !== this.owner) near.panicUtf8("Platform only");
    const identity = this.identities.get(account_id);
    if (identity) {
      identity.credibility_score += points;
      this.identities.set(account_id, identity);
    }
  }

  // ─── Views ──────────────────────────────────────────────────────────────

  @view({})
  get_recording({ recording_id }) {
    return this.recordings.get(recording_id);
  }

  @view({})
  get_identity({ account_id }) {
    return this.identities.get(account_id);
  }

  @view({})
  is_purchased({ recording_id, buyer }) {
    return this.purchases.get(`${recording_id}:${buyer}`) !== null;
  }

  @view({})
  get_recordings_by_gps({ gps_approx }) {
    const key = this._gpsClusterKey(gps_approx);
    return this.gpsIndex.get(key) || [];
  }

  @view({})
  get_recordings({ from_index = 0, limit = 20 }) {
    const lim = Math.min(limit, 50);
    const len = this.allRecordingIds.length;
    const results = [];
    for (let i = from_index; i < Math.min(from_index + lim, len); i++) {
      const id = this.allRecordingIds.get(i);
      if (id) {
        const r = this.recordings.get(id);
        if (r) results.push(r);
      }
    }
    return results;
  }

  @view({})
  get_recordings_by_witness({ witness }) {
    const results = [];
    for (let i = 0; i < this.allRecordingIds.length; i++) {
      const id = this.allRecordingIds.get(i);
      if (id) {
        const r = this.recordings.get(id);
        if (r && r.witness === witness) results.push(r);
      }
    }
    return results;
  }

  @view({})
  total_recordings() {
    return this.allRecordingIds.length;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  _gpsClusterKey(gps) {
    const parts = gps.split(",");
    if (parts.length === 2) {
      const lat = Math.round(parseFloat(parts[0]) * 10) / 10;
      const lng = Math.round(parseFloat(parts[1]) * 10) / 10;
      return `${lat.toFixed(1)},${lng.toFixed(1)}`;
    }
    return gps;
  }
}
