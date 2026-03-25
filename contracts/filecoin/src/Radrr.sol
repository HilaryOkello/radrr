// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Radrr — on-chain evidence registry for citizen journalism
/// @notice Witnesses anchor cryptographic proofs; buyers purchase access; funds split 85/10/5
contract Radrr {
    // ─── Structs ────────────────────────────────────────────────────────────

    struct Recording {
        string  recordingId;
        string  merkleRoot;
        string  gpsApprox;       // city-level, e.g. "-1.28,36.82"
        uint256 timestamp;
        string  cid;             // Storacha/Filecoin CID
        string  encryptedCid;    // Lit Protocol encrypted CID
        address witness;
        string  title;
        uint256 priceWei;
        bool    sold;
        address buyer;
        string[] corroborationBundle;
    }

    struct Identity {
        address account;
        string  pseudonym;
        uint256 credibilityScore;
        uint256 recordingCount;
        uint256 totalSales;
    }

    struct Purchase {
        string  recordingId;
        address buyer;
        uint256 amountWei;
        uint256 timestamp;
    }

    // ─── State ──────────────────────────────────────────────────────────────

    address public owner;
    address public platformWallet;
    address public safetyFundWallet;

    mapping(string  => Recording) private _recordings;
    mapping(address => Identity)  private _identities;
    mapping(string  => string[])  private _gpsIndex;     // cluster key → recording IDs
    mapping(bytes32 => Purchase)  private _purchases;    // keccak256(id,buyer) → Purchase
    string[] private _allRecordingIds;

    // ─── Events ─────────────────────────────────────────────────────────────

    event IdentityRegistered(address indexed account, string pseudonym);
    event RecordingAnchored(string indexed recordingId, address indexed witness, uint256 priceWei);
    event CidUpdated(string indexed recordingId, string cid);
    event EncryptedCidUpdated(string indexed recordingId);
    event RecordingPurchased(string indexed recordingId, address indexed buyer, uint256 amount);
    event CorroborationUpdated(string indexed recordingId, uint256 bundleSize);
    event CredibilityUpdated(address indexed account, uint256 newScore);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor(address _platformWallet, address _safetyFundWallet) {
        owner             = msg.sender;
        platformWallet    = _platformWallet;
        safetyFundWallet  = _safetyFundWallet;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only platform");
        _;
    }

    // ─── Identity ───────────────────────────────────────────────────────────

    /// @notice Register a pseudonymous identity linked to a wallet address.
    function registerIdentity(string calldata pseudonym) external {
        require(_identities[msg.sender].account == address(0), "Already registered");
        require(bytes(pseudonym).length > 0, "Pseudonym required");

        _identities[msg.sender] = Identity({
            account:          msg.sender,
            pseudonym:        pseudonym,
            credibilityScore: 10,
            recordingCount:   0,
            totalSales:       0
        });

        emit IdentityRegistered(msg.sender, pseudonym);
    }

    // ─── Recording ──────────────────────────────────────────────────────────

    function anchorRecording(
        string calldata recordingId,
        string calldata merkleRoot,
        string calldata gpsApprox,
        string calldata title,
        uint256         priceWei
    ) external {
        require(_identities[msg.sender].account != address(0), "Register identity first");
        _anchorFor(recordingId, merkleRoot, gpsApprox, title, priceWei, msg.sender);
    }

    /// @notice Platform anchors a recording on behalf of a user wallet.
    /// Auto-registers the witness identity if not already registered.
    function anchorRecordingFor(
        string calldata recordingId,
        string calldata merkleRoot,
        string calldata gpsApprox,
        string calldata title,
        uint256         priceWei,
        address         witness
    ) external onlyOwner {
        require(witness != address(0), "Invalid witness");
        if (_identities[witness].account == address(0)) {
            _identities[witness] = Identity({
                account:          witness,
                pseudonym:        "",
                credibilityScore: 10,
                recordingCount:   0,
                totalSales:       0
            });
            emit IdentityRegistered(witness, "");
        }
        _anchorFor(recordingId, merkleRoot, gpsApprox, title, priceWei, witness);
    }

    function _anchorFor(
        string calldata recordingId,
        string calldata merkleRoot,
        string calldata gpsApprox,
        string calldata title,
        uint256         priceWei,
        address         witness
    ) internal {
        require(bytes(_recordings[recordingId].recordingId).length == 0, "ID already exists");

        _recordings[recordingId] = Recording({
            recordingId:          recordingId,
            merkleRoot:           merkleRoot,
            gpsApprox:            gpsApprox,
            timestamp:            block.timestamp,
            cid:                  "",
            encryptedCid:         "",
            witness:              witness,
            title:                title,
            priceWei:             priceWei,
            sold:                 false,
            buyer:                address(0),
            corroborationBundle:  new string[](0)
        });

        _allRecordingIds.push(recordingId);
        string memory gpsKey = _gpsClusterKey(gpsApprox);
        _gpsIndex[gpsKey].push(recordingId);
        _identities[witness].recordingCount++;

        emit RecordingAnchored(recordingId, witness, priceWei);
    }

    function updateCid(string calldata recordingId, string calldata cid) external {
        require(
            _recordings[recordingId].witness == msg.sender || msg.sender == owner,
            "Only witness or owner"
        );
        _recordings[recordingId].cid = cid;
        emit CidUpdated(recordingId, cid);
    }

    function updateEncryptedCid(string calldata recordingId, string calldata encryptedCid) external onlyOwner {
        require(bytes(_recordings[recordingId].recordingId).length > 0, "Not found");
        _recordings[recordingId].encryptedCid = encryptedCid;
        emit EncryptedCidUpdated(recordingId);
    }

    // ─── Purchase — 85% witness / 10% platform / 5% safety fund ────────────

    function purchase(string calldata recordingId) external payable {
        Recording storage rec = _recordings[recordingId];
        require(bytes(rec.recordingId).length > 0, "Not found");
        require(!rec.sold,              "Already sold");
        require(rec.witness != msg.sender, "Cannot buy own recording");
        require(msg.value >= rec.priceWei, "Insufficient payment");

        uint256 price         = rec.priceWei;
        uint256 witnessShare  = price * 85 / 100;
        uint256 platformShare = price * 10 / 100;
        uint256 safetyShare   = price - witnessShare - platformShare;

        rec.sold  = true;
        rec.buyer = msg.sender;

        bytes32 key = keccak256(abi.encodePacked(recordingId, msg.sender));
        _purchases[key] = Purchase({
            recordingId: recordingId,
            buyer:       msg.sender,
            amountWei:   price,
            timestamp:   block.timestamp
        });

        _identities[rec.witness].totalSales++;
        _identities[rec.witness].credibilityScore += 5;

        payable(rec.witness).transfer(witnessShare);
        payable(platformWallet).transfer(platformShare);
        payable(safetyFundWallet).transfer(safetyShare);

        // Refund overpayment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }

        emit RecordingPurchased(recordingId, msg.sender, price);
    }

    // ─── Corroboration ──────────────────────────────────────────────────────

    function updateCorroboration(
        string calldata   recordingId,
        string[] calldata bundleIds
    ) external onlyOwner {
        require(bytes(_recordings[recordingId].recordingId).length > 0, "Not found");
        _recordings[recordingId].corroborationBundle = bundleIds;
        emit CorroborationUpdated(recordingId, bundleIds.length);
    }

    function incrementCredibility(address account, uint256 points) external onlyOwner {
        _identities[account].credibilityScore += points;
        emit CredibilityUpdated(account, _identities[account].credibilityScore);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getRecording(string calldata recordingId) external view returns (Recording memory) {
        return _recordings[recordingId];
    }

    function getIdentity(address account) external view returns (Identity memory) {
        return _identities[account];
    }

    function isPurchased(string calldata recordingId, address buyer) external view returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(recordingId, buyer));
        return _purchases[key].buyer != address(0);
    }

    function getRecordingsByGps(string calldata gpsApprox) external view returns (string[] memory) {
        return _gpsIndex[_gpsClusterKey(gpsApprox)];
    }

    function getRecordings(uint256 fromIndex, uint256 limit) external view returns (Recording[] memory) {
        uint256 lim = limit > 50 ? 50 : limit;
        uint256 len = _allRecordingIds.length;
        if (fromIndex >= len) return new Recording[](0);
        uint256 end = fromIndex + lim > len ? len : fromIndex + lim;
        Recording[] memory result = new Recording[](end - fromIndex);
        for (uint256 i = fromIndex; i < end; i++) {
            result[i - fromIndex] = _recordings[_allRecordingIds[i]];
        }
        return result;
    }

    function getRecordingsByWitness(address witness) external view returns (Recording[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < _allRecordingIds.length; i++) {
            if (_recordings[_allRecordingIds[i]].witness == witness) count++;
        }
        Recording[] memory result = new Recording[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < _allRecordingIds.length; i++) {
            if (_recordings[_allRecordingIds[i]].witness == witness) {
                result[idx++] = _recordings[_allRecordingIds[i]];
            }
        }
        return result;
    }

    function totalRecordings() external view returns (uint256) {
        return _allRecordingIds.length;
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /// @dev GPS normalization is done off-chain; this just trims to avoid duplicates
    function _gpsClusterKey(string memory gps) internal pure returns (string memory) {
        return gps;
    }
}
