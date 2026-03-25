// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ERC-8004 Agent Registry — identity, reputation, and validation for autonomous agents
/// @notice Implements all three ERC-8004 registry types: identity, reputation, validation
contract AgentRegistry {

    // ─── ERC-8004 Identity Registry ─────────────────────────────────────────

    struct AgentIdentity {
        address agent;
        address operator;          // wallet responsible for/deploying the agent
        string  did;               // decentralized identifier, e.g. did:radrr:corroboration-agent
        string  name;
        string[] capabilities;     // e.g. ["corroboration", "embedding", "on-chain-write"]
        string  metadataUri;       // IPFS/Storacha CID pointing to agent.json
        uint256 registeredAt;
        bool    active;
    }

    // ─── ERC-8004 Reputation Registry ───────────────────────────────────────

    struct AgentReputation {
        uint256 score;             // 0–1000
        uint256 tasksCompleted;
        uint256 tasksFailed;
        uint256 lastUpdated;
    }

    // ─── ERC-8004 Validation Registry ───────────────────────────────────────

    struct ValidationCredential {
        address agent;
        address issuer;
        string  credentialType;    // e.g. "corroboration-verified", "world-id-checked"
        string  evidenceCid;       // CID of supporting evidence on Filecoin
        uint256 issuedAt;
        bool    revoked;
    }

    // ─── State ──────────────────────────────────────────────────────────────

    address public owner;

    mapping(address => AgentIdentity)   public identities;
    mapping(address => AgentReputation) public reputations;
    mapping(bytes32 => ValidationCredential) public credentials; // keccak256(agent, type) → cred

    address[] public registeredAgents;

    // ─── Events ─────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, address indexed operator, string did);
    event AgentDeactivated(address indexed agent);
    event ReputationUpdated(address indexed agent, uint256 newScore, string reason);
    event CredentialIssued(address indexed agent, address indexed issuer, string credentialType);
    event CredentialRevoked(address indexed agent, string credentialType);

    // ─── Constructor ────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyOperator(address agent) {
        require(
            msg.sender == identities[agent].operator || msg.sender == owner,
            "Not operator"
        );
        _;
    }

    // ─── Identity Registry ──────────────────────────────────────────────────

    /// @notice Register an agent identity linked to an operator wallet
    function registerAgent(
        address        agent,
        string calldata did,
        string calldata name,
        string[] calldata capabilities,
        string calldata metadataUri
    ) external {
        require(identities[agent].agent == address(0), "Agent already registered");
        require(bytes(did).length > 0, "DID required");

        identities[agent] = AgentIdentity({
            agent:        agent,
            operator:     msg.sender,
            did:          did,
            name:         name,
            capabilities: capabilities,
            metadataUri:  metadataUri,
            registeredAt: block.timestamp,
            active:       true
        });

        reputations[agent] = AgentReputation({
            score:          100,   // baseline score
            tasksCompleted: 0,
            tasksFailed:    0,
            lastUpdated:    block.timestamp
        });

        registeredAgents.push(agent);
        emit AgentRegistered(agent, msg.sender, did);
    }

    function deactivateAgent(address agent) external onlyOperator(agent) {
        identities[agent].active = false;
        emit AgentDeactivated(agent);
    }

    // ─── Reputation Registry ────────────────────────────────────────────────

    /// @notice Update agent reputation after task completion
    function recordTaskSuccess(address agent, string calldata reason) external onlyOwner {
        require(identities[agent].active, "Agent not active");
        AgentReputation storage rep = reputations[agent];
        rep.tasksCompleted++;
        rep.score = rep.score + 10 > 1000 ? 1000 : rep.score + 10;
        rep.lastUpdated = block.timestamp;
        emit ReputationUpdated(agent, rep.score, reason);
    }

    function recordTaskFailure(address agent, string calldata reason) external onlyOwner {
        AgentReputation storage rep = reputations[agent];
        rep.tasksFailed++;
        rep.score = rep.score < 20 ? 0 : rep.score - 20;
        rep.lastUpdated = block.timestamp;
        emit ReputationUpdated(agent, rep.score, reason);
    }

    // ─── Validation Registry ────────────────────────────────────────────────

    /// @notice Issue a verifiable credential to an agent
    function issueCredential(
        address        agent,
        string calldata credentialType,
        string calldata evidenceCid
    ) external {
        require(identities[agent].active, "Agent not active");
        bytes32 key = keccak256(abi.encodePacked(agent, credentialType));
        credentials[key] = ValidationCredential({
            agent:          agent,
            issuer:         msg.sender,
            credentialType: credentialType,
            evidenceCid:    evidenceCid,
            issuedAt:       block.timestamp,
            revoked:        false
        });
        emit CredentialIssued(agent, msg.sender, credentialType);
    }

    function revokeCredential(address agent, string calldata credentialType) external onlyOwner {
        bytes32 key = keccak256(abi.encodePacked(agent, credentialType));
        credentials[key].revoked = true;
        emit CredentialRevoked(agent, credentialType);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    function getAgentIdentity(address agent) external view returns (AgentIdentity memory) {
        return identities[agent];
    }

    function getAgentReputation(address agent) external view returns (AgentReputation memory) {
        return reputations[agent];
    }

    function hasCredential(address agent, string calldata credentialType) external view returns (bool) {
        bytes32 key = keccak256(abi.encodePacked(agent, credentialType));
        ValidationCredential memory cred = credentials[key];
        return cred.agent != address(0) && !cred.revoked;
    }

    function getCredential(address agent, string calldata credentialType)
        external view returns (ValidationCredential memory)
    {
        bytes32 key = keccak256(abi.encodePacked(agent, credentialType));
        return credentials[key];
    }

    function totalAgents() external view returns (uint256) {
        return registeredAgents.length;
    }
}
