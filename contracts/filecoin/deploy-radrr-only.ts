import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Radrr with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "tFIL");

  // Deploy Radrr only (platform + safety fund = deployer for testnet)
  const Radrr = await ethers.getContractFactory("Radrr");
  const radrr = await Radrr.deploy(deployer.address, deployer.address);
  
  console.log("Radrr deployment transaction:", radrr.deploymentTransaction()?.hash);
  console.log("Waiting for deployment...");
  
  await radrr.waitForDeployment();
  const radrrAddr = await radrr.getAddress();
  console.log("\n✓ Radrr deployed:", radrrAddr);

  console.log("\n─── UPDATE .env.local ───");
  console.log(`FILECOIN_CONTRACT_ADDRESS=${radrrAddr}`);
  console.log(`NEXT_PUBLIC_FILECOIN_CONTRACT_ADDRESS=${radrrAddr}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});