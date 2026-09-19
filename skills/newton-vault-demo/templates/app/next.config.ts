import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@newton-xyz/vaultkit",
    "@newton-xyz/policy-pack-vaultsfyi",
    "@newton-xyz/policy-core",
    "@morpho-org/blue-sdk",
    "@morpho-org/blue-sdk-viem",
  ],
};

export default nextConfig;
