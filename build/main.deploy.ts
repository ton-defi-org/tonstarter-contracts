import * as main from "../contracts/main";
import { Address, toNano, TupleReader } from "ton-core";
import { WalletContractV3R2, TonClient } from "ton";
import { sendInternalMessageWithWallet } from "../test/helpers";

// return the init Cell of the contract storage (according to load_data() contract method)
export function initData() {
  return main.data({
    ownerAddress: Address.parseFriendly("EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N").address,
    counter: 10,
  });
}

// return the op that should be sent to the contract on deployment, can be "null" to send an empty message
export function initMessage() {
  return main.increment();
}

// optional end-to-end sanity test for the actual on-chain contract to see it is actually working on-chain
export async function postDeployTest(wallet: any, client: TonClient, contractAddress: Address, secretKey: Buffer) {
  const call = await client.callGetMethod(contractAddress, "counter");

  const counter = call.stack.readBigNumber();
  console.log(`   # Getter 'counter' = ${counter.toString()}`);

  const message = main.increment();
  await sendInternalMessageWithWallet({ wallet, client, to: contractAddress, value: toNano("0.02"), body: message, secretKey });
  console.log(`   # Sent 'increment' op message`);

  const call2 = await client.callGetMethod(contractAddress, "counter");
  const counter2 = call2.stack.readBigNumber();
  console.log(`   # Getter 'counter' = ${counter2.toString()}`);
}
