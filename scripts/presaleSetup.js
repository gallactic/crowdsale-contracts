// importing all the libraries
const keythereum = require("keythereum");
const Tx = require('ethereumjs-tx');
const BigNumber = require('bignumber.js');
const ethUtil = require('ethereumjs-util');
require('dotenv').load();
let Web3 = require("web3");

//Initializing contract Objects
let abiArray = JSON.parse('[ { "constant": true, "inputs": [ { "name": "", "type": "address" } ], "name": "bonusGTX", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "totalPresaleTokens", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [], "name": "renounceOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "owner", "outputs": [ { "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "isOwner", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "totalClaimableGTX", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "address" } ], "name": "claimableGTX", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "uint256" } ], "name": "bonusThreshold", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "stage", "outputs": [ { "name": "", "type": "uint8" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "address" } ], "name": "presaleGTX", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [ { "name": "newOwner", "type": "address" } ], "name": "transferOwnership", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "lockRecords", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [ { "name": "", "type": "uint256" } ], "name": "bonusPercent", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "inputs": [], "payable": false, "stateMutability": "nonpayable", "type": "constructor" }, { "anonymous": false, "inputs": [ { "indexed": false, "name": "_maxPresaleTokens", "type": "uint256" }, { "indexed": false, "name": "_bonusThreshold", "type": "uint256[]" }, { "indexed": false, "name": "_bonusPercent", "type": "uint256[]" } ], "name": "Setup", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_recordAddress", "type": "address" }, { "indexed": false, "name": "_gtxTokens", "type": "uint256" } ], "name": "GTXRecordCreate", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_recordAddress", "type": "address" }, { "indexed": false, "name": "_gtxTokens", "type": "uint256" } ], "name": "GTXRecordUpdate", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "_oldAddress", "type": "address" }, { "indexed": true, "name": "_newAddress", "type": "address" }, { "indexed": false, "name": "_gtxTokens", "type": "uint256" } ], "name": "GTXRecordMove", "type": "event" }, { "anonymous": false, "inputs": [], "name": "LockRecords", "type": "event" }, { "anonymous": false, "inputs": [ { "indexed": true, "name": "previousOwner", "type": "address" }, { "indexed": true, "name": "newOwner", "type": "address" } ], "name": "OwnershipTransferred", "type": "event" }, { "constant": false, "inputs": [], "name": "lock", "outputs": [ { "name": "", "type": "bool" } ], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_maxPresaleTokens", "type": "uint256" }, { "name": "_bonusThreshold", "type": "uint256[]" }, { "name": "_bonusPercent", "type": "uint256[]" } ], "name": "setup", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_recordAddress", "type": "address" }, { "name": "_gtxTokens", "type": "uint256" } ], "name": "recordCreate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_recordAddress", "type": "address" }, { "name": "_gtxTokens", "type": "uint256" } ], "name": "recordUpdate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [ { "name": "_oldAddress", "type": "address" }, { "name": "_newAddress", "type": "address" } ], "name": "recordMove", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [ { "name": "_receiver", "type": "address" } ], "name": "calculateBonus", "outputs": [ { "name": "bonus", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "getStage", "outputs": [ { "name": "", "type": "uint256" } ], "payable": false, "stateMutability": "view", "type": "function" } ]')

//conecting to rospten
let web3 = new Web3("https://ropsten.infura.io/qe93eRW1ZLx44WsdN2wh");

const datadir = "./";
const address = "633642c036db81fb7a726a37a8b42254556b56f0"; //without the initial '0x'
const password = process.env.PASSWORD;
let BN = web3.utils.BN;
const owner = "0x633642c036db81fb7a726a37a8b42254556b56f0"


let contractAddress = '0x23729eea12f8b624a1824bbd2d29b6db0cfa372b'
const contractObj = new web3.eth.Contract(abiArray, contractAddress);

let privateKey;
keythereum.importFromFile(address, datadir, function (keyObject) {
    privateKey = keythereum.recover(password, keyObject);
});
 
//Custom Error message
let ENOUGH_ETHER = "Account doesn't have enough ether to make this transaction";

/**
 * @dev signTransaction function signs and sends a transaction to the blockchain network
 * @param {*String} functionData [payload of the transaction]
 * @param {*Promise} resolve [successful promise]
 * @param {*Promise} reject [unsuccessful promise]
 */
async function signTransaction(from, to, functionData, resolve, reject) {
    try {
        var gasObj = {
            to: to,
            from: from,
            data: functionData
        };
        var nonce;
        var gasPrice;
        var gasEstimate;
        var balance;
        try {
            var nonce = await web3.eth.getTransactionCount(from);
            var gasPrice = await web3.eth.getGasPrice();
            gasPrice = new BigNumber(gasPrice);
            var gasEstimate = await web3.eth.estimateGas({ gasObj });
            gasEstimate = new BigNumber(gasEstimate);
            var balance = await web3.eth.getBalance(from);
            balance = new BigNumber(balance);
        } catch (e) {
            console.log(e);
            reject(e);
        }
        if (balance.isLessThan(gasEstimate.times(gasPrice))) {
            reject(ENOUGH_ETHER);
        } else {
            var tx = new Tx({
                to: to,
                nonce: nonce,
                value: '0x',
                gasPrice: web3.utils.toHex(gasPrice.toString()),
                gasLimit: web3.utils.toHex(gasEstimate.plus(200000).toString()),
                data: functionData
            });
            tx.sign(privateKey);
            web3.eth.sendSignedTransaction('0x' + tx.serialize().toString('hex'))
                .on('transactionHash', function (hash) {
                    console.log("transaction hash",hash)
                })
                .on('receipt', function (receipt) {
                    console.log("receipt", receipt)
                    resolve([receipt]);
                })
                .on('error', function (error) {
                    try {
                        console.log(error);
                        var data = error.message.split(':\n', 2);
                        if (data.length == 2) {
                            var transaction = JSON.parse(data[1]);
                            transaction.messesge = data[0];
                            return resolve([transaction]);
                        }
                        reject(error);
                    } catch (e) {
                        reject(e);
                    }
                });
        }
    } catch (e) {
        reject(e);
    }
}


async function setupPresale(maxPresale,bonusThresholdTokens,bonusPercent) {
    return new Promise (async (resolve,reject) =>  {
        try {

            let data = contractObj.methods.setup(maxPresale,bonusThresholdTokens,bonusPercent).encodeABI();
            signTransaction(owner,contractAddress,data, resolve, reject).then(function (error, response) {
                if (error) {
                    reject(error);
                } else {
                    return resolve("Successful", response)
                }
            })

        } catch (error) {
            reject(error)
        }
    })
}


setupPresale("200000000000000000000000000",["300000000000000000000","454545454545454560000","1060606060606060500000","1515151515151515200000","3030303030303030500000","30303030303030304000000","75757575757575760000000","151515151515151520000000","303030303030303040000000","757575757575757600000000","3030303030303030300000000"],["1","2","3","4","5","10","15","20","25","30","32"])
