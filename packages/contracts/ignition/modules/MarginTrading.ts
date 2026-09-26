import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MarginTradingModule", (m) => {
  const mockUSDT = m.contract("MockUSDT");
  const initialPrice = 100_000n; // $0.10 per HSK, 6 decimals

  const marginEngine = m.contract("MarginEngineUSDT", [mockUSDT, initialPrice]);

  return { mockUSDT, marginEngine };
});
