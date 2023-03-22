// This is a simple generic deploy script in TypeScript that should work for most projects without modification
// Every contract you want to deploy should have a mycontract.deploy.ts script that returns its init data
// The script assumes that it is running from the repo root, and the directories are organized this way:
//  ./build/ - directory for build artifacts (mycontract.compiled.json) and deploy init data scripts (mycontract.deploy.ts)
//  ./.env - config file with DEPLOYER_MNEMONIC - secret mnemonic of deploying wallet (will be created if not found)

import { getHttpEndpoint } from "@orbs-network/ton-access";

import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import path from "path";
import glob from "fast-glob";
import { Address, Cell, fromNano, toNano, contractAddress, internal } from "ton-core";
import { TonClient, SendMode, WalletContractV3R2 } from "ton";
import { mnemonicNew, mnemonicToWalletKey } from "ton-crypto";

async function main() {
  console.log(`=================================================================`);
  console.log(`Deploy script running, let's find some contracts to deploy..`);

  const isTestnet = process.env.TESTNET || process.env.npm_lifecycle_event == "deploy:testnet";

  // check input arguments (given through environment variables)
  if (isTestnet) {
    console.log(`\n* We are working with 'testnet' (https://t.me/testgiver_ton_bot will give you test TON)`);
  } else {
    console.log(`\n* We are working with 'mainnet'`);
  }

  // initialize globals
  const endpoint = await getHttpEndpoint({ network: isTestnet ? "testnet" : "mainnet" });
  const client = new TonClient({ endpoint });
  const deployerWalletType = "org.ton.wallets.v3.r2"; // also see WalletV3R2Source class used below
  const newContractFunding = toNano("0.02"); // this will be (almost in full) the balance of a new deployed contract and allow it to pay rent
  const workchain = 0; // normally 0, only special contracts should be deployed to masterchain (-1)

  // make sure we have a wallet mnemonic to deploy from (or create one if not found)
  const deployConfigEnv = ".env";
  let deployerMnemonic;
  if (!fs.existsSync(deployConfigEnv) || !process.env.DEPLOYER_MNEMONIC) {
    console.log(`\n* Config file '${deployConfigEnv}' not found, creating a new wallet for deploy..`);
    deployerMnemonic = (await mnemonicNew(24)).join(" ");
    const deployWalletEnvContent = `DEPLOYER_WALLET=${deployerWalletType}\nDEPLOYER_MNEMONIC="${deployerMnemonic}"\n`;
    fs.writeFileSync(deployConfigEnv, deployWalletEnvContent);
    console.log(` - Created new wallet in '${deployConfigEnv}' - keep this file secret!`);
  } else {
    console.log(`\n* Config file '${deployConfigEnv}' found and will be used for deployment!`);
    deployerMnemonic = process.env.DEPLOYER_MNEMONIC;
  }

  // open the wallet and make sure it has enough TON
  const walletKey = await mnemonicToWalletKey(deployerMnemonic.split(" "));
  const wallet = client.open(
    WalletContractV3R2.create({
      publicKey: walletKey.publicKey,
      workchain: 0,
    })
  );

  console.log(` - Wallet address used to deploy from is: ${wallet.address.toString()}`);
  const walletBalance = await client.getBalance(wallet.address);
  if (walletBalance < toNano("0.2")) {
    console.log(` - ERROR: Wallet has less than 0.2 TON for gas (${fromNano(walletBalance)} TON), please send some TON for gas first`);
    process.exit(1);
  } else {
    console.log(` - Wallet balance is ${fromNano(walletBalance)} TON, which will be used for gas`);
  }

  // go over all the contracts we have deploy scripts for
  const rootContracts = glob.sync(["build/*.deploy.ts"]);
  for (const rootContract of rootContracts) {
    // deploy a new root contract
    console.log(`\n* Found root contract '${rootContract} - let's deploy it':`);
    const contractName = path.parse(path.parse(rootContract).name).name;

    // prepare the init data cell
    const deployInitScript = require(__dirname + "/../" + rootContract);
    if (typeof deployInitScript.initData !== "function") {
      console.log(` - ERROR: '${rootContract}' does not have 'initData()' function`);
      process.exit(1);
    }
    const initDataCell = deployInitScript.initData() as Cell;

    // prepare the init message
    if (typeof deployInitScript.initMessage !== "function") {
      console.log(` - ERROR: '${rootContract}' does not have 'initMessage()' function`);
      process.exit(1);
    }
    const initMessageCell = deployInitScript.initMessage() as Cell | null;

    // prepare the init code cell
    const hexArtifact = `build/${contractName}.compiled.json`;
    if (!fs.existsSync(hexArtifact)) {
      console.log(` - ERROR: '${hexArtifact}' not found, did you build?`);
      process.exit(1);
    }
    const initCodeCell = Cell.fromBoc(Buffer.from(JSON.parse(fs.readFileSync(hexArtifact).toString()).hex, "hex"))[0];

    // make sure the contract was not already deployed
    const newContractAddress = contractAddress(0, { code: initCodeCell, data: initDataCell });
    console.log(` - Based on your init code+data, your new contract address is: ${newContractAddress.toString()}`);
    if (await client.isContractDeployed(newContractAddress)) {
      console.log(` - Looks like the contract is already deployed in this address, skipping deployment`);
      await performPostDeploymentTest(rootContract, deployInitScript, wallet, client, newContractAddress, walletKey.secretKey);
      continue;
    }

    // deploy by sending an internal message to the deploying wallet
    console.log(` - Let's deploy the contract on-chain..`);
    const seqno = await wallet.getSeqno();
    const transfer = wallet.createTransfer({
      secretKey: walletKey.secretKey,
      seqno: seqno,
      sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
      messages: [
        internal({
          to: newContractAddress,
          value: newContractFunding,
          bounce: false,
          init: { data: initDataCell, code: initCodeCell },
          body: initMessageCell,
        }),
      ],
    });
    await client.sendExternalMessage(wallet, transfer);
    console.log(` - Deploy transaction sent successfully`);

    // make sure that the contract was deployed
    console.log(` - Block explorer link: https://${process.env.TESTNET ? "testnet." : ""}tonscan.org/address/${newContractAddress.toString()}`);
    console.log(` - Waiting up to 20 seconds to check if the contract was actually deployed..`);
    for (let attempt = 0; attempt < 10; attempt++) {
      await sleep(2000);
      const seqnoAfter = await wallet.getSeqno();
      if (seqnoAfter > seqno) break;
    }
    if (await client.isContractDeployed(newContractAddress)) {
      console.log(` - SUCCESS! Contract deployed successfully to address: ${newContractAddress.toString()}`);
      const contractBalance = await client.getBalance(newContractAddress);
      console.log(` - New contract balance is now ${fromNano(contractBalance)} TON, make sure it has enough to pay rent`);
      await performPostDeploymentTest(rootContract, deployInitScript, wallet, client, newContractAddress, walletKey.secretKey);
    } else {
      console.log(` - FAILURE! Contract address still looks uninitialized: ${newContractAddress.toString()}`);
    }
  }

  console.log(``);
}

main();

// helpers

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function performPostDeploymentTest(rootContract: string, deployInitScript: any, wallet: any, client: TonClient, newContractAddress: Address, secretKey: Buffer) {
  if (typeof deployInitScript.postDeployTest !== "function") {
    console.log(` - Not running a post deployment test, '${rootContract}' does not have 'postDeployTest()' function`);
    return;
  }
  console.log(` - Running a post deployment test:`);
  await deployInitScript.postDeployTest(wallet, client, newContractAddress, secretKey);
}
