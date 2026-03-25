import { createConfig, http } from "wagmi";
import { filecoinCalibration } from "viem/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [filecoinCalibration],
  connectors: [injected()],
  transports: {
    [filecoinCalibration.id]: http(
      process.env.NEXT_PUBLIC_FILECOIN_RPC_URL ??
      "https://api.calibration.node.glif.io/rpc/v1"
    ),
  },
});
