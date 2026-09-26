import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseUnits } from "viem";

describe("MarginTrading", async function () {
  const { viem } = await network.create();

  it("mints test USDT via faucet and opens a long position", async function () {
    const [ownerClient, traderClient] = await viem.getWalletClients();

    const mockUSDT = await viem.deployContract("MockUSDT");
    const initialPrice = parseUnits("100", 6); // $100

    const marginEngine = await viem.deployContract("MarginEngineUSDT", [
      mockUSDT.address,
      initialPrice,
    ]);

    // Trader gets 10,000 USDT from faucet
    await mockUSDT.write.faucet({ account: traderClient.account });
    const traderBal = await mockUSDT.read.balanceOf([traderClient.account.address]);
    assert.equal(traderBal, parseUnits("10000", 6));

    // Trader approves margin engine
    const collateral = parseUnits("100", 6); // 100 USDT
    await mockUSDT.write.approve([marginEngine.address, collateral], {
      account: traderClient.account,
    });

    // Trader opens 5x long
    await marginEngine.write.openLong([collateral, 5], {
      account: traderClient.account,
    });

    const position = await marginEngine.read.positions([traderClient.account.address]);
    assert.equal(position[0], collateral); // collateral
    assert.equal(position[1], collateral * 5n); // positionSize
    assert.equal(position[2], initialPrice); // entryPrice
    assert.equal(position[3], 5); // leverage
    assert.equal(position[4], true); // isOpen
  });

  it("allows trader to close position in profit", async function () {
    const [ownerClient, traderClient] = await viem.getWalletClients();

    const mockUSDT = await viem.deployContract("MockUSDT");
    const initialPrice = parseUnits("100", 6);

    const marginEngine = await viem.deployContract("MarginEngineUSDT", [
      mockUSDT.address,
      initialPrice,
    ]);

    // Seed contract with liquidity for profits
    await mockUSDT.write.faucet({ account: ownerClient.account });
    await mockUSDT.write.approve([marginEngine.address, parseUnits("5000", 6)], {
      account: ownerClient.account,
    });
    await marginEngine.write.depositLiquidity([parseUnits("5000", 6)], {
      account: ownerClient.account,
    });

    // Trader setup
    await mockUSDT.write.faucet({ account: traderClient.account });
    const collateral = parseUnits("100", 6);
    await mockUSDT.write.approve([marginEngine.address, collateral], {
      account: traderClient.account,
    });

    await marginEngine.write.openLong([collateral, 2], {
      account: traderClient.account,
    });

    // Price increases by 10% from 100 to 110
    const newPrice = parseUnits("110", 6);
    await marginEngine.write.setPrice([newPrice], { account: ownerClient.account });

    const [isLiquidatable, pnl] = await marginEngine.read.checkPosition([
      traderClient.account.address,
    ]);
    assert.equal(isLiquidatable, false);
    // PnL with 2x leverage on 10% price gain = 20 USDT profit
    assert.equal(pnl, parseUnits("20", 6));

    const balanceBefore = await mockUSDT.read.balanceOf([traderClient.account.address]);
    await marginEngine.write.closePosition({ account: traderClient.account });
    const balanceAfter = await mockUSDT.read.balanceOf([traderClient.account.address]);

    // Trader received collateral (100) + profit (20) = 120 USDT
    assert.equal(balanceAfter - balanceBefore, parseUnits("120", 6));

    const closedPos = await marginEngine.read.positions([traderClient.account.address]);
    assert.equal(closedPos[4], false);
  });

  it("allows liquidation when position drops beyond threshold", async function () {
    const [ownerClient, traderClient, liquidatorClient] = await viem.getWalletClients();

    const mockUSDT = await viem.deployContract("MockUSDT");
    const initialPrice = parseUnits("100", 6);

    const marginEngine = await viem.deployContract("MarginEngineUSDT", [
      mockUSDT.address,
      initialPrice,
    ]);

    await mockUSDT.write.faucet({ account: traderClient.account });
    const collateral = parseUnits("100", 6);
    await mockUSDT.write.approve([marginEngine.address, collateral], {
      account: traderClient.account,
    });

    // 10x leverage
    await marginEngine.write.openLong([collateral, 10], {
      account: traderClient.account,
    });

    // Price drops by 10% (100 -> 90), which with 10x leverage wipes out 100% of collateral (> 90% threshold)
    await marginEngine.write.setPrice([parseUnits("90", 6)], {
      account: ownerClient.account,
    });

    const [isLiquidatable] = await marginEngine.read.checkPosition([
      traderClient.account.address,
    ]);
    assert.equal(isLiquidatable, true);

    const liquidatorBefore = await mockUSDT.read.balanceOf([liquidatorClient.account.address]);
    await marginEngine.write.liquidate([traderClient.account.address], {
      account: liquidatorClient.account,
    });
    const liquidatorAfter = await mockUSDT.read.balanceOf([liquidatorClient.account.address]);

    // Liquidator receives 10% bounty of the 100 USDT collateral = 10 USDT
    assert.equal(liquidatorAfter - liquidatorBefore, parseUnits("10", 6));

    const position = await marginEngine.read.positions([traderClient.account.address]);
    assert.equal(position[4], false); // position is closed
  });
});
