import BN from "bn.js";
import { Address, Cell, internal, SendMode } from "ton-core";
import { SmartContract } from "ton-contract-executor";
import Prando from "prando";
import { WalletContractV3R2, TonClient } from "ton";

export const zeroAddress = new Address(0, Buffer.alloc(32, 0));

export function randomAddress(seed: string, workchain?: number) {
  const random = new Prando(seed);
  const hash = Buffer.alloc(32);
  for (let i = 0; i < hash.length; i++) {
    hash[i] = random.nextInt(0, 255);
  }
  return new Address(workchain ?? 0, hash);
}

// used with ton-contract-executor (unit tests) to sendInternalMessage easily
export function internalMessage(params: { from?: Address; to?: Address; value?: string; bounce?: boolean; body?: Cell }) {
  return internal({
    from: params.from ?? randomAddress("sender"),
    to: params.to ?? zeroAddress,
    value: params.value ?? "0",
    bounce: params.bounce ?? true,
    body: params.body,
  });
}

// temp fix until ton-contract-executor (unit tests) remembers c7 value between calls
export function setBalance(contract: SmartContract, balance: BN) {
  contract.setC7Config({
    balance: balance.toNumber(),
  });
}

// helper for end-to-end on-chain tests (normally post deploy) to allow sending InternalMessages to contracts using a wallet
export async function sendInternalMessageWithWallet(params: { wallet: any; client: TonClient; to: Address; value: bigint; bounce?: boolean; body?: Cell; secretKey: Buffer }) {
  const seqno = await params.wallet.getSeqno();
  const transfer = params.wallet.createTransfer({
    secretKey: params.secretKey,
    seqno: seqno,
    sendMode: SendMode.PAY_GAS_SEPARATLY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: params.to,
        value: params.value,
        bounce: params.bounce ?? false,
        body: params.body,
      }),
    ],
  });
  await params.client.sendExternalMessage(params.wallet, transfer);
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(2000);
    const seqnoAfter = await params.wallet.getSeqno();
    if (seqnoAfter > seqno) return;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
