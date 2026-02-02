import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd(), "..");
const artifactPath = path.join(
  process.cwd(),
  "artifacts",
  "contracts",
  "MultiElectionVoting.sol",
  "MultiElectionVoting.json"
);
const contractTsPath = path.join(repoRoot, "frontend", "lib", "contract.ts");
const frontendEnvPath = path.join(repoRoot, "frontend", ".env");

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const entries = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      if (idx === -1) return null;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      return [key, value];
    })
    .filter(Boolean);
  return Object.fromEntries(entries);
}

const artifactRaw = fs.readFileSync(artifactPath, "utf8");
const artifact = JSON.parse(artifactRaw);
const abi = artifact.abi;

const contractTs = fs.readFileSync(contractTsPath, "utf8");
const addressMatch = contractTs.match(
  /VOTING_ADDRESS\\s*=\\s*\"(0x[a-fA-F0-9]{40})\"/
);
const envFromFile = readEnvFile(frontendEnvPath);
const envAddress =
  process.env.NEXT_PUBLIC_VOTING_ADDRESS ||
  process.env.VOTING_ADDRESS ||
  envFromFile.NEXT_PUBLIC_VOTING_ADDRESS ||
  envFromFile.VOTING_ADDRESS;
const votingAddress =
  envAddress ||
  (addressMatch ? addressMatch[1] : "0x0000000000000000000000000000000000000000");

const nextContent = `export const VOTING_ADDRESS =\n  \"${votingAddress}\" as const;\nexport const VOTING_CHAIN_ID = 31337 as const;\n\nexport const VOTING_ABI = ${JSON.stringify(
  abi,
  null,
  2
)} as const;\n`;

fs.writeFileSync(contractTsPath, nextContent, "utf8");
console.log("Synced ABI to frontend/lib/contract.ts");
