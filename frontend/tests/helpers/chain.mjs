// A throwaway local chain (anvil) with the real contracts deployed from contract/out, so route tests
// can run the exact calls the app builds and read back what the contracts actually did.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { createRequire } from "node:module";
import { FRONTEND } from "./fakes.mjs";

const { ethers } = createRequire(new URL("package.json", FRONTEND))("ethers");
export { ethers };

const CONTRACTS = new URL("../contract/", FRONTEND);

export function foundryAvailable() {
  return spawnSync("anvil", ["--version"]).status === 0 && spawnSync("forge", ["--version"]).status === 0;
}

export const SKIP_REASON = "needs Foundry (anvil and forge) on PATH: https://getfoundry.sh";

function artifact(sourceFile, name) {
  const path = new URL(`out/${sourceFile}/${name}.json`, CONTRACTS);
  if (!existsSync(path)) {
    const built = spawnSync("forge", ["build"], { cwd: CONTRACTS.pathname, encoding: "utf8" });
    if (built.status !== 0) throw new Error(`forge build failed:\n${built.stdout}\n${built.stderr}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

/**
 * Start anvil on a free port. Returns { rpc, provider, signers, addresses, deploy, increaseTime, stop }.
 * `signers[i]` are anvil's unlocked accounts; `addresses[i]` are theirs.
 */
export async function startChain() {
  const port = await freePort();
  const child = spawn("anvil", ["--port", String(port), "--silent"], { stdio: "ignore" });
  const stop = () => child.kill();
  process.on("exit", stop);

  const rpc = `http://127.0.0.1:${port}`;
  const provider = new ethers.JsonRpcProvider(rpc);
  for (let i = 0; ; i++) {
    try {
      await provider.getBlockNumber();
      break;
    } catch {
      if (i > 100) throw new Error("anvil did not start");
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const signers = await Promise.all(Array.from({ length: 8 }, (_, i) => provider.getSigner(i)));
  const addresses = await Promise.all(signers.map((s) => s.getAddress()));

  async function deploy(sourceFile, name, ...args) {
    const { abi, bytecode } = artifact(sourceFile, name);
    const contract = await new ethers.ContractFactory(abi, bytecode.object, signers[0]).deploy(...args);
    await contract.waitForDeployment();
    return contract.getAddress();
  }

  async function increaseTime(seconds) {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine", []);
  }

  return { rpc, provider, signers, addresses, deploy, increaseTime, stop: async () => { stop(); provider.destroy(); } };
}
