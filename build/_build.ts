// This is a simple generic build script in TypeScript that should work for most projects without modification
// The script assumes that it is running from the repo root, and the directories are organized this way:
//  ./build/ - directory for build artifacts exists
//  ./contracts/*.fc - root contracts that are deployed separately are here
//  ./contracts/imports/*.fc - shared utility code that should be imported as compilation dependency is here
// if you need imports that are dedicated to one contract and aren't shared, place them in a directory with the contract name:
//  ./contracts/import/mycontract/*.fc

import fs from "fs";
import path from "path";
import process from "process";
import glob from "fast-glob";
import { Cell } from "ton-core";
import { compileFunc } from "@ton-community/func-js";

async function main() {
  console.log("=================================================================");
  console.log("Build script running, let's find some FunC contracts to compile..");

  // go over all the root contracts in the contracts directory
  const rootContracts = glob.sync(["contracts/*.fc", "contracts/*.func"]);
  for (const rootContract of rootContracts) {
    // compile a new root contract
    console.log(`\n* Found root contract '${rootContract}' - let's compile it:`);
    const contractName = path.parse(rootContract).name;

    const hexArtifact = `build/${contractName}.compiled.json`;
    if (fs.existsSync(hexArtifact)) {
      console.log(` - Deleting old build artifact '${hexArtifact}'`);
      fs.unlinkSync(hexArtifact);
    }

    // check if we have a tlb file
    const tlbFile = `contracts/${contractName}.tlb`;
    if (fs.existsSync(tlbFile)) {
      console.log(` - TL-B file '${tlbFile}' found, calculating crc32 on all ops..`);
      const tlbContent = fs.readFileSync(tlbFile).toString();
      const tlbOpMessages = tlbContent.match(/^(\w+).*=\s*InternalMsgBody$/gm) ?? [];
      for (const tlbOpMessage of tlbOpMessages) {
        const crc = crc32(tlbOpMessage);
        const asQuery = `0x${(crc & 0x7fffffff).toString(16)}`;
        const asResponse = `0x${((crc | 0x80000000) >>> 0).toString(16)}`;
        console.log(`   op '${tlbOpMessage.split(" ")[0]}': '${asQuery}' as query (&0x7fffffff), '${asResponse}' as response (|0x80000000)`);
      }
    } else {
      console.log(` - Warning: TL-B file for contract '${tlbFile}' not found, are your op consts according to standard?`);
    }

    // run the func compiler to create a fif file
    console.log(` - Trying to compile '${rootContract}' with 'func' compiler..`);

    const compileResult = await compileFunc({
      targets: [rootContract],
      sources: (x) => fs.readFileSync(x).toString("utf8"),
    });

    if (compileResult.status === "error") {
      console.log(" - OH NO! Compilation Errors! The compiler output was:");
      console.log(`\n${compileResult.message}`);
      process.exit(1);
    }

    console.log(" - Compilation successful!");

    fs.writeFileSync(
      hexArtifact,
      JSON.stringify({
        hex: Cell.fromBoc(Buffer.from(compileResult.codeBoc, "base64"))[0].toBoc().toString("hex"),
      })
    );

    // make sure hex artifact was created
    if (!fs.existsSync(hexArtifact)) {
      console.log(` - For some reason '${hexArtifact}' was not created!`);
      process.exit(1);
    } else {
      console.log(` - Build artifact created '${hexArtifact}'`);
    }
  }

  console.log("");
}

main();

// helpers

function crc32(r: string) {
  for (var a, o = [], c = 0; c < 256; c++) {
    a = c;
    for (let f = 0; f < 8; f++) a = 1 & a ? 3988292384 ^ (a >>> 1) : a >>> 1;
    o[c] = a;
  }
  for (var n = -1, t = 0; t < r.length; t++) n = (n >>> 8) ^ o[255 & (n ^ r.charCodeAt(t))];
  return (-1 ^ n) >>> 0;
}
