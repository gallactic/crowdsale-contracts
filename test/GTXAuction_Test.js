/* Truffle Test and Test RPC objects */
const assert = require('chai').assert;
const sleep = require('sleep');
require('chai').use(require('chai-as-promised')).should();

/* Web 3 Objects */
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

/* Contract Objects */
const gtxRecord = artifacts.require('./GTXRecord');
const gtxPresale = artifacts.require('./GTXPresale');
const gtxToken = artifacts.require('./GTXToken');
const gtxMigrate = artifacts.require('./GTXERC20Migrate');
const gtxAuction = artifacts.require('./GTXAuction');
const timeLock = artifacts.require('./TimeLock');

/* Global Test Variables */
let recordContract;
let presaleContract;
let tokenContract;
let timeLockContract;
let migrateContract;
let auctionContract;
let hardCap;
let presaleTotal;
let totalSwapWei;

/* MultiSigWallet Address */
const multiSigWallet = '0xff5f6a455eb48b3475d11a6db686935aaa36d31c';

contract('Tests for GTX Auction contract ', function (accounts) {

    const WEI = web3.utils.toWei(web3.utils.toBN(1), "ether");  // Conversion of ETHER to WEI

    // GTX Swap Constants
    const SWAP_RATE = 200;                  // 2.00 Swap Rate should be set in 2 decimal points
    const FIN = 20000 * WEI;                // 20000 FIN Tokens
    const FIN_WITH_SWAP = 10000 * WEI;      // 10000 FINs With Swap

    // GTX Token Constants
    const TOTAL_SUPPLY = 1000000000 * WEI;  // 1 Billion Total GTX Token Supply
    const NAME = "GALLACTIC";               // Token Name GALLACTIC
    const SYMBOL = "GTX";                   // Token Symbol GTX
    const DECIMALS = 18;                    // 18 Decimal Points Precision

    // GTX Auction Constants
    const MAX_TOKENS = 400000000 * WEI;     // 400 Million GTX Tokens for Auction
    const BIDDING_PERIOD = 524160;          // 91 Days
    const BIDDING_PERIOD_MIN = 8;           // 2 Minutes
    const AUDIT_WAIT_PERIOD = 80640;        // 14 Days
    const BONUS_THRESHOLD = [9900, 15000, 35000, 50000, 100000, 1000000, 2500000, 5000000, 10000000, 25000000, 100000000]; // Threshold for bonus in dollars
    const BONUS_PERCENT = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 32];

    const ETHER_PRICE = 22000;              // 223.66 USD
    const HARDCAP = 10000000000;            // 100 Million USD
    const CEILING = 500;                    // 5 USD
    const FLOOR = 33;                       // 0.33 USD

    const ETHER_PRICE_2 = 30000;            // 300 USD
    const HARDCAP_2 = 5000000000;           // 50 Million USD
    const CEILING_2 = 400;                  // 4 USD
    const FLOOR_2 = 20;                     // 0.2 USD

    // Auction Stages
    const AUCTION_DEPLOYED = 0;             // Auction Deployed is Stage 0
    const AUCTION_SETUP = 1;                // Auction Setup is Stage 1
    const AUCTION_STARTED = 2;              // Auction Started is Stage 2
    const AUCTION_ENDED = 3;                // Auction Ended is Stage 3
    const CLAIM_STARTED = 4;                // Claim Started is Stage 4

    //Presale contract variables
    const MAX_PRESALE_TOKENS = 200000000 * WEI;; //Maximum tokens to allocate to presale contract
    const BONUS_TOKENS_THRESHOLD = [300000000000000000000, 454545454545454560000, 1060606060606060500000, 1515151515151515200000, 3030303030303030500000, 30303030303030304000000, 75757575757575760000000, 151515151515151520000000, 303030303030303040000000, 757575757575757600000000, 3030303030303030300000000];


    describe('GTX Record Contract Tests', function () {

        before('Should return the deployed gtx record and presale contract instance', async function () {
            recordContract = await gtxRecord.deployed();
            presaleContract = await gtxPresale.new();
        });

        it('Should create some swap records and lock the gtxrecord update', async function () {
            await recordContract.setConversionRate(SWAP_RATE);
            await recordContract.recordUpdate(accounts[1], FIN_WITH_SWAP, true, { from: accounts[0] });
            await recordContract.recordUpdate(accounts[2], FIN, false, { from: accounts[0] });
            await recordContract.recordUpdate(accounts[16], FIN, false, { from: accounts[0] });
            await recordContract.recordUpdate(accounts[17], FIN, false, { from: accounts[0] });
            await recordContract.lock();
        });

        it('Should get the total swap', async function () {
            totalSwapWei = await recordContract.totalClaimableGTX();
            let totalSwap = web3.utils.fromWei(web3.utils.toBN(totalSwapWei), 'ether');
            assert.equal(totalSwap, 80000, "Total Swap Tokens are correct");
        });

        it('Should set up the initial parameters', async function () {
            let stage = await presaleContract.getStage();
            await presaleContract.setup(MAX_PRESALE_TOKENS, BONUS_TOKENS_THRESHOLD, BONUS_PERCENT);
        })

        it('Should create some presale records and lock the gtxpresale', async function () {
            await presaleContract.recordCreate(accounts[1], BONUS_TOKENS_THRESHOLD[0]);
            await presaleContract.recordCreate(accounts[2], BONUS_TOKENS_THRESHOLD[4]);
            await presaleContract.lock();
        })

        it('Should calculate the total Presale tokens', async function () {
            presaleTotal = await presaleContract.totalClaimableGTX();
            let calcTotal = (BONUS_TOKENS_THRESHOLD[0] + ((BONUS_PERCENT[0] * BONUS_TOKENS_THRESHOLD[0]) / 100)) + (BONUS_TOKENS_THRESHOLD[4] + ((BONUS_PERCENT[4] * BONUS_TOKENS_THRESHOLD[4]) / 100))
            assert.equal(calcTotal, presaleTotal, "Total should be equal for presale claimable")
        })

    });

    describe('GTX Token Contract Tests', function () {

        before('Should return the deployed GTX Token Contract instance ', async function () {
            await timeout(10000);
            tokenContract = await gtxToken.new(TOTAL_SUPPLY, recordContract.address, presaleContract.address, NAME, SYMBOL, DECIMALS);
            timeLockContract = await timeLock.new(tokenContract.address);
            migrateContract = await gtxMigrate.new(tokenContract.address);
            auctionContract = await gtxAuction.new(
                tokenContract.address, recordContract.address, presaleContract.address, BIDDING_PERIOD_MIN, AUDIT_WAIT_PERIOD
            );
        });

        it('Should update GTX ERC20 Migrate and GTX Auction contract address in GTX Token contract', async function () {
            await tokenContract.setMigrationAddress(migrateContract.address);
            await tokenContract.setTimeLockAddress(timeLockContract.address)
            await tokenContract.setAuctionAddress(auctionContract.address);
        });

        it('Should return the balance of the GTX Token contract', async function () {
            let balance = await tokenContract.totalSupply();
            assert.equal(balance.toNumber(), TOTAL_SUPPLY,
                "Total supply and token contract balance should be equal")
        });
    })

    describe('GTX Auction contract tests', function () {

        it('Should match the GTX ERC20 Token Contract from the GTX Auction contract', async function () {
            let erc20 = await auctionContract.ERC20();
            assert.equal(erc20, tokenContract.address);
            let stage = await auctionContract.stage.call();
            assert.equal(stage.toString(), AUCTION_DEPLOYED, "Auction Stage should be Auction Deployed");
        });

        it('Should allow the owner to Setup the Auction', async function () {
            let presalestage = await presaleContract.stage()
            assert.equal(presalestage, 2, "Stage should be greater than 1")
            await auctionContract.setup(MAX_TOKENS, ETHER_PRICE_2, HARDCAP_2, CEILING_2, FLOOR_2, BONUS_THRESHOLD, BONUS_PERCENT);
            let ethPrice = await auctionContract.etherPrice.call();
            let hardCap = await auctionContract.hardCap.call();
            let ceiling = await auctionContract.ceiling.call();
            let floor = await auctionContract.floor.call();
            let stage = await auctionContract.stage.call();
            let priceConstant = await auctionContract.priceConstant.call();
            assert.equal(priceConstant.toNumber(), 2, "Price Constant should be set");
            assert.equal(stage.toString(), AUCTION_SETUP, "Auction Stage should be Auction Setup");
            assert.equal(ethPrice, ETHER_PRICE_2, "Ether Price Should be 300 USD");
            assert.equal((hardCap.toNumber() / WEI) * ETHER_PRICE_2, HARDCAP_2, "Hard Cap Should be 200 Million USD");
            assert.equal((ceiling.toNumber() / WEI) * ETHER_PRICE_2, CEILING_2, "Ceiling Price Should be 4 USD");
            assert.equal((floor.toNumber() / WEI) * ETHER_PRICE_2, 19.99999999999998, "Floor Price Should be 0.2 USD");
        });

        it('Should pass Auction allocation only from the GTX Auction contract and check if the owner gets the remaining tokens', async function () {

            let auctionAllocatedTokens = await tokenContract.getAuctionAllocation();
            let auctionContractBalance = await tokenContract.balanceOf(auctionContract.address);
            assert.equal(auctionAllocatedTokens.toNumber(), auctionContractBalance.toNumber(),
                "Should be equal to the sum of gtx swap tokens and auctionAllocated tokens");

            let swtokens = await recordContract.totalClaimableGTX()
            let prtokens = await presaleContract.totalPresaleTokens()
            let maxtokens = await auctionContract.maxTokens()
            calcAuctionTokens = swtokens.toNumber() + prtokens.toNumber() + maxtokens.toNumber()


            let maxTokens = await tokenContract.totalSupply();
            let ownerTokens = await tokenContract.balanceOf(accounts[0])
            let calcOwnerBal = TOTAL_SUPPLY - calcAuctionTokens;
            assert.equal(maxTokens.toNumber(), TOTAL_SUPPLY, "Max tokens should be equal to the total supply")
            assert.equal(ownerTokens.toNumber(), calcOwnerBal, "Remaining tokens should be allocated to owner")

        });

        it('Should allow change in settings by the owner of the auction contract', async function () {

            await auctionContract.changeSettings(ETHER_PRICE, HARDCAP, CEILING, FLOOR, BONUS_THRESHOLD, BONUS_PERCENT);
            let newEthPrice = await auctionContract.etherPrice.call();
            let newHardCap = await auctionContract.hardCap.call();
            let newCeiling = await auctionContract.ceiling.call();
            let newFloor = await auctionContract.floor.call();
            let stage = await auctionContract.stage.call();
            let newPriceConstant = await auctionContract.priceConstant.call();

            assert.equal(newPriceConstant.toNumber(), 4, "New Price Constant should be set");
            assert.equal(stage.toString(), AUCTION_SETUP, "Auction Stage should be Auction Setup");
            assert.equal(newEthPrice, ETHER_PRICE, "New Ether Price Should be 250 USD");
            assert.equal((newHardCap.toNumber() / WEI) * ETHER_PRICE, HARDCAP, "New Hard Cap Should be 100 Million USD");
            assert.equal(Number(((newCeiling.toNumber() / WEI) * ETHER_PRICE).toFixed(0)), 500, "New Ceiling Price Should be 5 USD");
            assert.equal(Number(((newFloor.toNumber() / WEI) * ETHER_PRICE).toFixed(0)), FLOOR, "New Floor Price Should be 0.3 USD");
        });

        it('Should allow the auction owner to start the auction', async function () {
            await auctionContract.startAuction();
            let stage = await auctionContract.stage.call();
            assert.equal(stage.toString(), AUCTION_STARTED, "Auction Stage should be Auction Started");
        });

        it('Should whitelist account1 and account2 ', async function () {
            await auctionContract.addToWhitelist([accounts[1], accounts[2], accounts[3], accounts[4], accounts[16], accounts[17], accounts[18], accounts[19]]);
            let isWhitelisted = await auctionContract.whitelist(accounts[1]);
            assert.equal(isWhitelisted, true, "accounts[1] should be whitelisted")
        })

        it('Bidder1 Should place bid for 446428 ether', async function () {
            hardCap = await auctionContract.hardCap();
            await auctionContract.bid(accounts[1], { from: accounts[1], value: web3.utils.toBN(hardCap) });
            let remainingCap = await auctionContract.remainingCap()
            assert.equal(remainingCap.toNumber(), 0, "remaining cap should be equal to 0");
        })
        let blockNumber;
        let tokenPrice;
        it('Should validate the token price and stage', async function () {
            blockNumber = await web3.eth.getBlockNumber();
            console.log("blockNumber",blockNumber)
            sb = await auctionContract.startBlock();
            cp = await auctionContract.calcTokenPrice(blockNumber);
            console.log("jblocknumber",cp.toNumber() *ETHER_PRICE/WEI)
            cb = blockNumber - sb;
            console.log("cb",cb)
            cp = await auctionContract.calcTokenPrice(cb);
            console.log("current",cp.toNumber() *ETHER_PRICE/WEI)
            tokenPrice = await auctionContract.finalPrice();
            console.log("tokenPrice", (tokenPrice.toNumber() *ETHER_PRICE)/WEI)
            if (tokenPrice > 0.33) {
                assert.notEqual(tokenPrice, 0, "Tokens price should not be equal to 0")
            } else {
                console.log("error")
            }

            let stage = await auctionContract.stage()
            assert.equal(stage, AUCTION_ENDED, "Stage should be auction ended");
        })

        it('accounts[1] should be able to claim tokens after locking presale contract', async function () {
            let Priceconstant =  await auctionContract.priceConstant();
            console.log("Priceconstant",Priceconstant)
            let calimedStatus = await auctionContract.calimedStatus(accounts[1]);
            let locked = await presaleContract.lockRecords();
            let stage = await auctionContract.stage()

            assert.equal(calimedStatus, false, "Clalimed status should be false")
            assert.equal(stage, 3, "Stage should be claiming started")

            let bids = await auctionContract.bids.call(accounts[1])
            console.log("bids", bids / tokenPrice *10^18)

            assert.equal(locked, true, "Presale record migration should be locked before claiming")

            await auctionContract.claimTokens({ from: accounts[1] })
            let fundsClaimed = await auctionContract.fundsClaimed.call();
            console.log("fundsClaimed",fundsClaimed)

        })

    });
});


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
