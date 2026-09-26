import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MarginTradingModule", (m) => {
  const mockUSDT = m.contract("MockUSDT");
  const initialPrice = 100n * 1_000_000n; // 100 USD with 6 decimals

  const marginEngine = m.contract("MarginEngineUSDT", [mockUSDT, initialPrice]);

  return { mockUSDT, marginEngine };
});
