/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require("crypto-js/sha256");
const { Block } = require("./block.js");
const bitcoinMessage = require("bitcoinjs-message");

class Blockchain {
  /**
   * Constructor of the class, you will need to setup your chain array and the height
   * of your chain (the length of your chain array).
   * Also everytime you create a Blockchain class you will need to initialized the chain creating
   * the Genesis Block.
   * The methods in this class will always return a Promise to allow client applications or
   * other backends to call asynchronous functions.
   */
  constructor() {
    this.chain = [];
    this.height = 0;
    this.initializeChain();
  }

  /**
   * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
   * You should use the `addBlock(block)` to create the Genesis Block
   * Passing as a data `{data: 'Genesis Block'}`
   */
  async initializeChain() {
    if (this.height === 0) {
      let block = new Block({ data: "Genesis Block" });
      await this._addBlock(block);
    }
  }

  /**
   * _addBlock(block) will store a block in the chain
   * @param {*} block
   * The method will return a Promise that will resolve with the block added
   * or reject if an error happen during the execution.
   * You will need to check for the height to assign the `previousBlockHash`,
   * assign the `timestamp` and the correct `height`...At the end you need to
   * create the `block hash` and push the block into the chain array. Don't for get
   * to update the `this.height`
   * Note: the symbol `_` in the method name indicates in the javascript convention
   * that this method is a private method.
   */
  _addBlock(block) {
    const self = this;
    return new Promise(async (resolve, reject) => {
      try {
        const height = self.height;
        block.height = height;
        if (height > 0) block.previousBlockHash = self.chain[height - 1].hash;
        block.time = new Date().getTime().toString().slice(0, -3);
        // Omit the hash attribute from the hashing procedure
        const { hash, ...hashableParams } = block;
        block.hash = SHA256(JSON.stringify(hashableParams)).toString();
        self.chain.push(block);

        self.validateChain().then((errors) => {
          if (errors.length > 0) {
            self.chain.pop();
            reject("The chain has been broken. Rollback operation is performed");
          } else {
            self.height++;
            resolve(block);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * The requestMessageOwnershipVerification(address) method
   * will allow you  to request a message that you will use to
   * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
   * This is the first step before submit your Block.
   * The method return a Promise that will resolve with the message to be signed
   * @param {*} address
   */
  requestMessageOwnershipVerification(address) {
    return new Promise((resolve) => {
      resolve(`${address}:${new Date().getTime().toString().slice(0, -3)}:starRegistry`);
    });
  }

  /**
   * The submitStar(address, message, signature, star) method
   * will allow users to register a new Block with the star object
   * into the chain. This method will resolve with the Block added or
   * reject with an error.
   * Algorithm steps:
   * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
   * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
   * 3. Check if the time elapsed is less than 5 minutes
   * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
   * 5. Create the block and add it to the chain
   * 6. Resolve with the block added.
   * @param {*} address
   * @param {*} message
   * @param {*} signature
   * @param {*} star
   */
  submitStar(address, message, signature, star) {
    const self = this;
    return new Promise(async (resolve, reject) => {
      const time = parseInt(message.split(":")[1]);
      const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));

      if (currentTime - time > 300) reject(Error("The time ellapsed is greater than 5 min."));
      if (!bitcoinMessage.verify(message, address, signature)) reject(Error("Invalid message."));

      const block = new Block({ address, star });
      self._addBlock(block).then(resolve).catch(reject);
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block
   *  with the hash passed as a parameter.
   * Search on the chain array for the block that has the hash.
   * @param {*} hash
   */
  getBlockByHash(hash) {
    let self = this;
    return new Promise((resolve, reject) => {
      resolve(
        self.chain.find((block) => {
          return block.hash == hash;
        })
      );
    });
  }

  /**
   * This method will return a Promise that will resolve with the Block object
   * with the height equal to the parameter `height`
   * @param {*} height
   */
  getBlockByHeight(height) {
    let self = this;
    return new Promise((resolve, reject) => {
      let block = self.chain.filter((p) => p.height === height)[0];
      if (block) {
        resolve(block);
      } else {
        resolve(null);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
   * and are belongs to the owner with the wallet address passed as parameter.
   * Remember the star should be returned decoded.
   * @param {*} address
   */
  getStarsByWalletAddress(address) {
    let self = this;
    let stars = [];
    return new Promise((resolve, reject) => {
      try {
        stars = self.chain
          .filter((block) => {
            return block.getBData()?.address === address;
          })
          .map((block) => {
            return block.getBData()?.star;
          });
        resolve(stars);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * This method will return a Promise that will resolve with the list of errors when validating the chain.
   * Steps to validate:
   * 1. You should validate each block using `validateBlock`
   * 2. Each Block should check the with the previousBlockHash
   */
  validateChain() {
    let self = this;
    let errorLog = [];
    return new Promise(async (resolve, reject) => {
      for (let i = 0; i < self.chain.length; i++) {
        const currentBlock = self.chain[i];
        if (!(await currentBlock.validate())) errorLog.push(`Invalid block at height: ${currentBlock.height}`);
        if (i > 0 && currentBlock.previousBlockHash !== self.chain[i - 1].hash)
          errorLog.push(`Invalid previous block hash at height: ${currentBlock.height}`);
      }
      resolve(errorLog);
    });
  }
}

module.exports.Blockchain = Blockchain;
