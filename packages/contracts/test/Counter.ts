import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";

describe("Counter", async function () {
  const { viem } = await network.create();

  it("emits Increment when calling inc()", async function () {
    const counter = await viem.deployContract("Counter");

    await viem.assertions.emitWithArgs(
      counter.write.inc(),
      counter,
      "Increment",
      [1n],
    );
    assert.equal(await counter.read.x(), 1n);
  });

  it("increments by the given amount with incBy()", async function () {
    const counter = await viem.deployContract("Counter");

    await counter.write.incBy([5n]);
    await counter.write.incBy([7n]);

    assert.equal(await counter.read.x(), 12n);
  });

  it("reverts when incBy() is called with 0", async function () {
    const counter = await viem.deployContract("Counter");

    await viem.assertions.revertWith(
      counter.write.incBy([0n]),
      "incBy: increment should be positive",
    );
  });
});
