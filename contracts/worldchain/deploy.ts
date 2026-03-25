import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // Deploy AgentRegistry first (no dependencies)
  const AgentRegistry = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistry.deploy();
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log("AgentRegistry deployed:", agentRegistryAddr);

  // Deploy Radrr (platform + safety fund = deployer for testnet)
  const Radrr = await ethers.getContractFactory("Radrr");
  const radrr = await Radrr.deploy(deployer.address, deployer.address);
  await radrr.waitForDeployment();
  const radrrAddr = await radrr.getAddress();
  console.log("Radrr deployed:", radrrAddr);

  // Register the corroboration agent in ERC-8004 registry
  const agentWallet = ethers.Wallet.createRandom();
  console.log("Corroboration agent address:", agentWallet.address);

  const tx = await agentRegistry.registerAgent(
    agentWallet.address,
    `did:radrr:corroboration-agent`,
    "Radrr Corroboration Agent",
    ["corroboration", "siglip-embedding", "gps-clustering", "on-chain-write"],
    ""  // metadataUri — will update with agent.json CID after upload
  );
  await tx.wait();
  console.log("Corroboration agent registered in ERC-8004 registry, tx:", tx.hash);

  // Issue initial validation credential
  const credTx = await agentRegistry.issueCredential(
    agentWallet.address,
    "corroboration-verified",
    ""  // evidenceCid populated after first run
  );
  await credTx.wait();
  console.log("Initial credential issued, tx:", credTx.hash);

  console.log("\n─── Deployment complete ───");
  console.log(`WORLDCHAIN_CONTRACT_ADDRESS=${radrrAddr}`);
  console.log(`WORLDCHAIN_AGENT_REGISTRY_ADDRESS=${agentRegistryAddr}`);
  console.log(`WORLDCHAIN_AGENT_PRIVATE_KEY=${agentWallet.privateKey}`);
  console.log(`WORLDCHAIN_AGENT_ADDRESS=${agentWallet.address}`);
  console.log(`WORLDCHAIN_RPC_URL=https://worldchain-sepolia.g.alchemy.com/public`);
  console.log(`WORLDCHAIN_CHAIN_ID=4801`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
