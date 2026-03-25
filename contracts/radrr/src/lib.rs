use near_sdk::collections::{LookupMap, Vector};
use near_sdk::{
    env, log, near, AccountId, BorshStorageKey, NearToken, Promise,
};

/// Storage keys for LookupMaps (prevents key collisions).
#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Recordings,
    Identities,
    GpsIndex,
    GpsCluster { gps: String },
    Purchases,
    AllRecordings,
}

/// A single recording anchored by a witness.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Recording {
    pub recording_id: String,
    pub merkle_root: String,
    /// City-level GPS approximation, e.g. "-1.28,36.82"
    pub gps_approx: String,
    pub timestamp: u64,
    /// Storacha CID — added after upload
    pub cid: Option<String>,
    /// Encrypted CID (Lit Protocol) — added after encryption
    pub encrypted_cid: Option<String>,
    pub witness: AccountId,
    /// IDs of corroborated clips
    pub corroboration_bundle: Vec<String>,
    /// Whether this recording has been sold (simple bool for demo)
    pub sold: bool,
    /// Title/description set by witness
    pub title: String,
    /// Price in yoctoNEAR
    pub price_yocto: u128,
    /// Buyer if sold
    pub buyer: Option<AccountId>,
}

/// Pseudonymous ERC-8004 style identity.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Identity {
    pub account_id: AccountId,
    pub pseudonym: String,
    /// Nullifier hash from World ID to prevent Sybil attacks
    pub world_id_hash: String,
    pub world_id_verified: bool,
    pub credibility_score: u32,
    pub recording_count: u32,
    pub total_sales: u32,
}

/// Purchase record for Lit Protocol access control verification.
#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Purchase {
    pub recording_id: String,
    pub buyer: AccountId,
    pub amount_yocto: u128,
    pub timestamp: u64,
}

#[near(contract_state)]
pub struct Radrr {
    owner: AccountId,
    recordings: LookupMap<String, Recording>,
    identities: LookupMap<AccountId, Identity>,
    /// GPS cluster -> vector of recording IDs
    gps_index: LookupMap<String, Vector<String>>,
    purchases: LookupMap<String, Purchase>, // key: "recording_id:buyer"
    /// Ordered list of all recording IDs for marketplace pagination
    all_recording_ids: Vector<String>,
    /// Platform fee wallet (receives 10%)
    platform_wallet: AccountId,
    /// Journalist safety fund wallet (receives 5%)
    safety_fund_wallet: AccountId,
}

impl Default for Radrr {
    fn default() -> Self {
        Self {
            owner: env::current_account_id(),
            recordings: LookupMap::new(StorageKey::Recordings),
            identities: LookupMap::new(StorageKey::Identities),
            gps_index: LookupMap::new(StorageKey::GpsIndex),
            purchases: LookupMap::new(StorageKey::Purchases),
            all_recording_ids: Vector::new(StorageKey::AllRecordings),
            platform_wallet: env::current_account_id(),
            safety_fund_wallet: env::current_account_id(),
        }
    }
}

#[near]
impl Radrr {
    /// Initialise contract with platform and safety fund wallets.
    #[init]
    pub fn new(
        platform_wallet: AccountId,
        safety_fund_wallet: AccountId,
    ) -> Self {
        Self {
            owner: env::predecessor_account_id(),
            recordings: LookupMap::new(StorageKey::Recordings),
            identities: LookupMap::new(StorageKey::Identities),
            gps_index: LookupMap::new(StorageKey::GpsIndex),
            purchases: LookupMap::new(StorageKey::Purchases),
            all_recording_ids: Vector::new(StorageKey::AllRecordings),
            platform_wallet,
            safety_fund_wallet,
        }
    }

    // ─── Identity (ERC-8004 pattern) ────────────────────────────────────────

    /// Register a pseudonymous identity after World ID verification.
    pub fn register_identity(&mut self, pseudonym: String, world_id_hash: String) {
        let caller = env::predecessor_account_id();
        assert!(
            self.identities.get(&caller).is_none(),
            "Identity already registered"
        );
        assert!(!pseudonym.is_empty(), "Pseudonym cannot be empty");
        assert!(!world_id_hash.is_empty(), "World ID hash required");

        let identity = Identity {
            account_id: caller.clone(),
            pseudonym,
            world_id_hash,
            world_id_verified: true,
            credibility_score: 10,
            recording_count: 0,
            total_sales: 0,
        };
        self.identities.insert(&caller, &identity);
        log!("Identity registered for {}", caller);
    }

    // ─── Recording ──────────────────────────────────────────────────────────

    /// Anchor a recording's cryptographic proof on-chain.
    pub fn anchor_recording(
        &mut self,
        recording_id: String,
        merkle_root: String,
        gps_approx: String,
        title: String,
        price_near: String,
    ) {
        let caller = env::predecessor_account_id();
        assert!(
            self.identities.get(&caller).is_some(),
            "Must register identity before recording"
        );
        assert!(
            self.recordings.get(&recording_id).is_none(),
            "Recording ID already exists"
        );

        let price_yocto: u128 = (price_near.parse::<f64>().unwrap_or(1.0)
            * 1_000_000_000_000_000_000_000_000.0) as u128;

        let recording = Recording {
            recording_id: recording_id.clone(),
            merkle_root,
            gps_approx: gps_approx.clone(),
            timestamp: env::block_timestamp_ms(),
            cid: None,
            encrypted_cid: None,
            witness: caller.clone(),
            corroboration_bundle: vec![],
            sold: false,
            title,
            price_yocto,
            buyer: None,
        };

        self.recordings.insert(&recording_id, &recording);
        self.all_recording_ids.push(&recording_id);

        // Index by GPS for corroboration clustering
        let gps_key = Self::gps_cluster_key(&gps_approx);
        if let Some(mut cluster) = self.gps_index.get(&gps_key) {
            cluster.push(&recording_id);
            self.gps_index.insert(&gps_key, &cluster);
        } else {
            let mut cluster: Vector<String> = Vector::new(StorageKey::GpsCluster {
                gps: gps_key.clone(),
            });
            cluster.push(&recording_id);
            self.gps_index.insert(&gps_key, &cluster);
        }

        // Increment witness recording count
        if let Some(mut identity) = self.identities.get(&caller) {
            identity.recording_count += 1;
            self.identities.insert(&caller, &identity);
        }

        log!("Recording {} anchored by {}", recording_id, caller);
    }

    /// Update the Filecoin CID after upload.
    pub fn update_cid(&mut self, recording_id: String, cid: String) {
        let mut recording = self
            .recordings
            .get(&recording_id)
            .expect("Recording not found");
        assert_eq!(
            recording.witness,
            env::predecessor_account_id(),
            "Only the witness can update their recording"
        );
        recording.cid = Some(cid);
        self.recordings.insert(&recording_id, &recording);
    }

    /// Update the encrypted CID after Lit Protocol encryption.
    pub fn update_encrypted_cid(&mut self, recording_id: String, encrypted_cid: String) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only platform can update encrypted CID"
        );
        let mut recording = self
            .recordings
            .get(&recording_id)
            .expect("Recording not found");
        recording.encrypted_cid = Some(encrypted_cid);
        self.recordings.insert(&recording_id, &recording);
    }

    // ─── Purchase ───────────────────────────────────────────────────────────

    /// Purchase footage. Splits: 85% witness, 10% platform, 5% safety fund.
    #[payable]
    pub fn purchase(&mut self, recording_id: String) -> Promise {
        let caller = env::predecessor_account_id();
        let mut recording = self
            .recordings
            .get(&recording_id)
            .expect("Recording not found");

        assert!(!recording.sold, "Recording already sold");
        assert_ne!(
            recording.witness, caller,
            "Cannot purchase your own recording"
        );

        let attached = env::attached_deposit().as_yoctonear();
        assert!(
            attached >= recording.price_yocto,
            "Insufficient payment. Required: {} yoctoNEAR",
            recording.price_yocto
        );

        let price = recording.price_yocto;
        let witness_share = price * 85 / 100;
        let platform_share = price * 10 / 100;
        let safety_share = price - witness_share - platform_share;

        recording.sold = true;
        recording.buyer = Some(caller.clone());
        self.recordings.insert(&recording_id, &recording);

        let purchase_key = format!("{}:{}", recording_id, caller);
        self.purchases.insert(
            &purchase_key,
            &Purchase {
                recording_id: recording_id.clone(),
                buyer: caller.clone(),
                amount_yocto: price,
                timestamp: env::block_timestamp_ms(),
            },
        );

        if let Some(mut identity) = self.identities.get(&recording.witness) {
            identity.total_sales += 1;
            identity.credibility_score += 5;
            self.identities.insert(&recording.witness, &identity);
        }

        log!(
            "Purchase: {} by {} for {} yoctoNEAR",
            recording_id,
            caller,
            price
        );

        Promise::new(recording.witness.clone())
            .transfer(NearToken::from_yoctonear(witness_share))
            .and(
                Promise::new(self.platform_wallet.clone())
                    .transfer(NearToken::from_yoctonear(platform_share)),
            )
            .and(
                Promise::new(self.safety_fund_wallet.clone())
                    .transfer(NearToken::from_yoctonear(safety_share)),
            )
    }

    // ─── Corroboration ──────────────────────────────────────────────────────

    pub fn update_corroboration(
        &mut self,
        recording_id: String,
        bundle_ids: Vec<String>,
    ) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only platform can update corroboration"
        );
        let mut recording = self
            .recordings
            .get(&recording_id)
            .expect("Recording not found");
        recording.corroboration_bundle = bundle_ids;
        self.recordings.insert(&recording_id, &recording);
        log!("Corroboration updated for {}", recording_id);
    }

    pub fn increment_credibility(&mut self, account_id: AccountId, points: u32) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner,
            "Only platform can update credibility"
        );
        if let Some(mut identity) = self.identities.get(&account_id) {
            identity.credibility_score += points;
            self.identities.insert(&account_id, &identity);
        }
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    pub fn get_recording(&self, recording_id: String) -> Option<Recording> {
        self.recordings.get(&recording_id)
    }

    pub fn get_identity(&self, account_id: AccountId) -> Option<Identity> {
        self.identities.get(&account_id)
    }

    pub fn is_purchased(&self, recording_id: String, buyer: AccountId) -> bool {
        let key = format!("{}:{}", recording_id, buyer);
        self.purchases.get(&key).is_some()
    }

    pub fn get_recordings_by_gps(&self, gps_approx: String) -> Vec<String> {
        let key = Self::gps_cluster_key(&gps_approx);
        match self.gps_index.get(&key) {
            Some(cluster) => cluster.to_vec(),
            None => vec![],
        }
    }

    pub fn get_recordings(
        &self,
        from_index: Option<u64>,
        limit: Option<u64>,
    ) -> Vec<Recording> {
        let start = from_index.unwrap_or(0);
        let lim = limit.unwrap_or(20).min(50);
        let len = self.all_recording_ids.len();
        if start >= len {
            return vec![];
        }
        let end = (start + lim).min(len);
        (start..end)
            .filter_map(|i| {
                self.all_recording_ids
                    .get(i)
                    .and_then(|id| self.recordings.get(&id))
            })
            .collect()
    }

    pub fn get_recordings_by_witness(&self, witness: AccountId) -> Vec<Recording> {
        (0..self.all_recording_ids.len())
            .filter_map(|i| {
                self.all_recording_ids
                    .get(i)
                    .and_then(|id| self.recordings.get(&id))
                    .filter(|r| r.witness == witness)
            })
            .collect()
    }

    pub fn total_recordings(&self) -> u64 {
        self.all_recording_ids.len()
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    fn gps_cluster_key(gps: &str) -> String {
        let parts: Vec<&str> = gps.split(',').collect();
        if parts.len() == 2 {
            let lat: f64 = parts[0].trim().parse().unwrap_or(0.0);
            let lng: f64 = parts[1].trim().parse().unwrap_or(0.0);
            format!("{:.1},{:.1}", lat, lng)
        } else {
            gps.to_string()
        }
    }
}
