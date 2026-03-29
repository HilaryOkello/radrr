const { ethers } = require("hardhat");

async function main() {
  const Multicall3 = await ethers.getContractFactory("Multicall3");
  const mc = await Multicall3.deploy();
  await mc.waitForDeployment();
  const addr = await mc.getAddress();
  console.log("Multicall3 deployed to:", addr);
}

main().catch((e) => { console.error(e); process.exit(1); });
