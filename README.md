## Important: This repo is deprecated in favor of https://github.com/ton-community/blueprint (the new all in one tool for creating new TON projects)

---

# TON Starter Template - Contracts

> Starter template for a new TON project - FunC contracts, JS tests, compilation and deployment scripts

## Overview

This project is part of a set of 3 typical repositories needed for a blockchain dapp running on TON blockchain:

* Smart contracts in FunC that are deployed on-chain (this repo)
* Web frontend for interacting with the dapp from a web browser (coming soon)
* Telegram bot for interacting with the [dapp from inside Telegram messenger](https://github.com/ton-defi-org/tonstarter-twa)

## What does this repo contain?

* `contracts/*.fc` - Smart contracts for TON blockchain written in [FunC](https://ton.org/docs/#/func) language
* `test/*.spec.ts` - Test suite for the contracts in TypeScript running on [Mocha](https://mochajs.org/) test runner
* `build/_build.ts` - Build script to compile the FunC code to [TVM](https://ton-blockchain.github.io/docs/tvm.pdf) opcodes
* `build/_deploy.ts` - Deploy script to deploy the compiled code to TON mainnet (or testnet)
* `build/_setup.ts` - Setup script to install build dependencies (used primarily for Glitch.com support)

There is no one official way to develop smart contracts for TON. Every developer has their own best practices. This setup is definitely opinionated and some developers may not appreciate the choices made. Nevertheless, we stand by every choice made here and believe that this is the optimal setup to develop fully tested contracts in the most seamless way possible.

Some of the opinionated choices made here include:

* Cross platform support - allow developers to work on Mac M1, Mac Intel, Windows or Linux
* Strong belief in tests - contracts often manage money - they must be developed under high scrutiny
* Clear and documented code to help users audit the contracts sources and understand what they do
* Reliance on modern TypeScript to develop clean and typed scripts and tests in a modern framework
* Reliance on TypeScript for deployment instead of working with `fift` CLI tools - it's simply easier
* Tests are executed in JavaScript with TVM in web-assembly - a great balance of speed and convenience
* Following of the TON contract [best practices](https://ton.org/docs/#/howto/smart-contract-guidelines) appearing in the official docs

## Dependencies and requirements

To setup your local machine for development, please make sure you have the following:

* A modern version of Node.js (version 16.15.0 or later)
  * Installation instructions can be found [here](https://nodejs.org/)
  * Run in terminal `node -v` to verify your installation, the project was tested on `v16.15.0`
* A decent IDE with FunC and TypeScript support
  * We recommend using [Visual Studio Code](https://code.visualstudio.com/) with the [FunC plugin](https://marketplace.visualstudio.com/items?itemName=tonwhales.func-vscode) installed

Once your local machine is ready, install the project:

* Git clone the repo locally and rename the directory to your own project name
* In the root repo dir, run in terminal `npm install`

### or.. work 100% online instead

Alternatively, you can ignore the above requirements and develop right inside a web browser with an online IDE and *zero* setup. Simply open this repo inside [Glitch](https://glitch.com/) without installing anything:

* Create your new Glitch workspace by opening [this link](https://glitch.com/edit/#!/remix/clone-from-repo?&REPO_URL=https%3A%2F%2Fgithub.com%2Fton-defi-org%2Ftonstarter-contracts.git) in your browser
* Wait about 60 seconds until installation completes <br>(click the "LOGS" button on the bottom of the IDE to see progress)
* Edit your contract files and tests in the online IDE
* To run terminal commands like `npm run build` click the "TERMINAL" button on the bottom of the online IDE
* Working online is slow! run on a local machine if you want a much faster experience

## Development instructions

* Write code
  * FunC contracts are located in `contracts/*.fc`
    * Standalone root contracts are located in `contracts/*.fc`
    * Shared imports (when breaking code to multiple files) are in `contracts/imports/*.fc`
    * Contract-specific imports that aren't shared are in `contracts/imports/mycontract/*.fc`
  * Each contract may have optional but recommended auxiliary files:
    * [TL-B](https://ton.org/docs/#/overviews/TL-B) file defining the encoding of its data and message ops in `contracts/mycontract.tld`
    * TypeScript file that implements the encoding of its data and message ops in `contracts/mycontract.ts`
  * Tests in TypeScript are located in `test/*.spec.ts`

* Build
  * In the root repo dir, run in terminal `npm run build`
  * Compilation errors will appear on screen
  * Resulting build artifacts include:
    * `mycontract.fif` - Fift file result of compilation (not very useful by itself)
    * `mycontract.compiled.json` - the binary code cell of the compiled contract (for deployment). Saved in a hex format within a json file to support webapp imports

* Test
  * In the root repo dir, run in terminal `npm run test`
  * Don't forget to build (or rebuild) before running tests
  * Tests are running inside Node.js by running TVM in web-assembly using `ton-contract-executor`

* Deploy
  * Make sure all contracts are built and your setup is ready to deploy:
    * Each contract to deploy should have a script `build/mycontract.deploy.ts` to return its init data cell
    * The deployment wallet is configured in `.env` (created automatically if not exists), with contents:<br>
      `DEPLOYER_MNEMONIC="mad nation chief flavor ..."` (24 secret words)
  * To deploy to mainnet (production), run in terminal `npm run deploy`
    * To deploy to testnet instead (where TON coins are free), run `npm run deploy:testnet`
    * Follow the on-screen instructions of the deploy script
  
# License
MIT
