/* Truffle Test and Test RPC objects */
const assert = require('chai').assert;
const sleep = require('sleep');
require('chai').use(require('chai-as-promised')).should();
const BigNumber = require('bignumber.js');

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

    const WEI = web3.utils.toWei(web3.utils.toBN(1), "ether"); // Conversion of ETHER to WEI

    // GTX Swap Constants
    const SWAP_RATE = 200; // 2.00 Swap Rate should be set in 2 decimal points
    const FIN = 20000 * WEI; // 20000 FIN Tokens
    const FIN_WITH_SWAP = 10000 * WEI; // 10000 FINs With Swap

    // GTX Token Constants
    const TOTAL_SUPPLY = 1000000000 * WEI; // 1 Billion Total GTX Token Supply
    const NAME = "GALLACTIC"; // Token Name GALLACTIC
    const SYMBOL = "GTX"; // Token Symbol GTX
    const DECIMALS = 18; // 18 Decimal Points Precision

    // GTX Auction Constants
    const MAX_TOKENS = 400000000 * WEI; // 400 Million GTX Tokens for Auction
    const BIDDING_PERIOD = 524160; // 91 Days
    const BIDDING_PERIOD_MIN = 240;
    const AUDIT_WAIT_PERIOD = 1; // 1 Block just for testing
    const BONUS_THRESHOLD = [9900, 15000, 35000, 50000, 100000, 1000000, 2500000, 5000000, 10000000, 25000000, 100000000]; // Threshold for bonus in dollars
    const BONUS_PERCENT = [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 32];

    const ETHER_PRICE = 22000; // 223.66 USD
    const HARDCAP = 10000000000; // 100 Million USD
    const CEILING = 500; // 5 USD
    const FLOOR = 33; // 0.33 USD

    const ETHER_PRICE_2 = 30000; // 300 USD
    const HARDCAP_2 = 5000000000; // 50 Million USD
    const CEILING_2 = 400; // 4 USD
    const FLOOR_2 = 20; // 0.2 USD

    // Auction Stages
    const AUCTION_DEPLOYED = 0; // Auction Deployed is Stage 0
    const AUCTION_SETUP = 1; // Auction Setup is Stage 1
    const AUCTION_STARTED = 2; // Auction Started is Stage 2
    const AUCTION_ENDED = 3; // Auction Ended is Stage 3

    //Presale contract variables
    const MAX_PRESALE_TOKENS = 200000000 * WEI;; //Maximum tokens to allocate to presale contract
    const BONUS_TOKENS_THRESHOLD = [300000000000000000000, 454545454545454560000, 1060606060606060500000, 1515151515151515200000, 3030303030303030500000, 30303030303030304000000, 75757575757575760000000, 151515151515151520000000, 303030303030303040000000, 757575757575757600000000, 3030303030303030300000000];
    const PRESALE_DEPLOYED = 0;

    describe('GTX Record Contract Tests', function () {

        before('Should return the deployed gtx record and presale contract instance', async function () {
            recordContract = await gtxRecord.deployed();
            presaleContract = await gtxPresale.new();
        });

        it('Should create some swap records and lock the gtxrecord update', async function () {
            await recordContract.setConversionRate(SWAP_RATE);
            await recordContract.recordUpdate(accounts[1], FIN, false, {
                from: accounts[0]
            });
            await recordContract.recordUpdate(accounts[2], FIN_WITH_SWAP, true, {
                from: accounts[0]
            });
            await recordContract.recordUpdate(accounts[16], FIN, false, {
                from: accounts[0]
            });
            await recordContract.recordUpdate(accounts[17], FIN, false, {
                from: accounts[0]
            });
            await recordContract.lock();
            let lockedState = await recordContract.lockRecords.call();
            assert.equal(lockedState, true, "lock state should be true")
        });

        it('Should get the total swap', async function () {
            totalSwapWei = await recordContract.totalClaimableGTX();
            let totalSwap = web3.utils.fromWei(web3.utils.toBN(totalSwapWei), 'ether');
            assert.equal(totalSwap, 80000, "Total Swap Tokens are correct");
        });

        it('Should set up the initial parameters', async function () {
            let stage = await presaleContract.getStage();
            assert.equal(stage, PRESALE_DEPLOYED, "Stage should be presale deployed")
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
            let maxPresaleTokens = await presaleContract.totalPresaleTokens()
            assert.equal(maxPresaleTokens.toNumber(), MAX_PRESALE_TOKENS, "Max presale tokens should be 200 Mil Tokens");
        })

    });

    describe('GTX Token Contract Tests', function () {

        before('Should return the deployed GTX Auction Contract instances ', async function () {
            await timeout(10000);
            tokenContract = await gtxToken.new(TOTAL_SUPPLY, recordContract.address, presaleContract.address, NAME, SYMBOL, DECIMALS);
            timeLockContract = await timeLock.new(tokenContract.address);
            migrateContract = await gtxMigrate.new(tokenContract.address);
            auctionContract = await gtxAuction.new(
                tokenContract.address, recordContract.address, presaleContract.address, BIDDING_PERIOD, AUDIT_WAIT_PERIOD
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
        let acc1Balance;
        acc1Balance = new BigNumber(acc1Balance);
        let swtokens;
        swtokens = new BigNumber(swtokens);
        let prtokens;
        prtokens = new BigNumber(prtokens);
        let maxTotalClaim;
        maxTotalClaim = new BigNumber(maxTotalClaim);
        let totalTokens;
        totalTokens = new BigNumber(totalTokens);
        let tokenPrice;
        tokenPrice = new BigNumber(tokenPrice);
        let maxClaimableTokens;
        let bids;
        let totalSupply;

        it('Should match the GTX ERC20 Token Contract from the GTX Auction contract', async function () {
            let erc20 = await auctionContract.ERC20();
            assert.equal(erc20, tokenContract.address);
            let stage = await auctionContract.stage.call();
            assert.equal(stage.toString(), AUCTION_DEPLOYED, "Auction Stage should be Auction Deployed");
        });

        it('Max tokens should be equal to gtx record toatal and presale total', async function () {
            swtokens = await recordContract.totalClaimableGTX()
            prtokens = await presaleContract.totalPresaleTokens()

            maxTotalClaim = await auctionContract.maxTotalClaim()
            maxClaimableTokens = prtokens.plus(swtokens);
            maxClaimableTokens = new BigNumber(maxClaimableTokens);
            assert.equal(maxClaimableTokens, maxTotalClaim.toNumber())
        })

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
            assert.equal(priceConstant.toNumber(), 14460167444, "Price Constant should be set");
            assert.equal(stage.toString(), AUCTION_SETUP, "Auction Stage should be Auction Setup");
            assert.equal(ethPrice, ETHER_PRICE_2, "Ether Price Should be 300 USD");
            assert.equal((hardCap.toNumber() / WEI) * ETHER_PRICE_2, HARDCAP_2, "Hard Cap Should be 200 Million USD");
            assert.equal((ceiling.toNumber() / WEI) * ETHER_PRICE_2, CEILING_2, "Ceiling Price Should be 4 USD");
            let calfloor = (floor.toNumber() / WEI) * ETHER_PRICE_2
            calfloor = Number((calfloor).toFixed(0));
            assert.equal(calfloor, FLOOR_2, "Floor Price Should be 0.2 USD");
        });

        it('Should pass Auction allocation only from the GTX Auction contract and check if the owner gets the remaining tokens', async function () {

            let maxtokens = await auctionContract.maxTokens()
            maxtokens = new BigNumber(maxtokens)
            calcAuctionTokens = swtokens.plus(prtokens).plus(maxtokens);
            calcAuctionTokens = new BigNumber(calcAuctionTokens)
            let auctionContractBalance = await tokenContract.balanceOf(auctionContract.address);
            assert.equal(calcAuctionTokens, auctionContractBalance.toNumber(),
                "Should be equal to the sum of gtx swap tokens and auctionAllocated tokens");

            totalSupply = await tokenContract.totalSupply();
            totalSupply = new BigNumber(totalSupply);
            let ownerTokens = await tokenContract.balanceOf(accounts[0])
            let calcOwnerBal = totalSupply.minus(calcAuctionTokens);
            assert.equal(totalSupply.toNumber(), TOTAL_SUPPLY, "Max tokens should be equal to the total supply")
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

            assert.equal(newPriceConstant.toNumber(), 19414401274, "New Price Constant should be set");
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
            let startblock = await auctionContract.startBlock.call();
            let endBlock = await auctionContract.endBlock.call();
            assert.equal(endBlock, startblock.toNumber() + BIDDING_PERIOD, "End block should be startBlock + bidding period")
        });

        it('Bidder1 Should place bid for hardcap ether', async function () {
            hardCap = await auctionContract.hardCap();
            await auctionContract.bid(accounts[1], {
                from: accounts[1],
                value: web3.utils.toBN(hardCap)
            });
            let totalReceived = await auctionContract.totalReceived();
            assert.equal(totalReceived.toNumber(), hardCap, "Total received should be equal to hardcap")
            let remainingCap = await auctionContract.remainingCap()
            assert.equal(remainingCap.toNumber(), 0, "remaining cap should be equal to 0");
        })

        it('MaxAccountClaim should add the bidTokens after bid', async function () {
            maxTotalClaim = await auctionContract.maxTotalClaim()
            maxTotalClaim = Number(maxTotalClaim).toFixed(4)


            //Calculating tokens for hardcap at the rate 33 cents
            bids = await auctionContract.bids.call(accounts[1])
            bids = new BigNumber(bids);
            let floor = await auctionContract.floor.call();
            let wei = new BigNumber(WEI)

            let bidTokens = bids.multipliedBy(wei).dividedBy(floor.toNumber())
            bidTokens = new BigNumber(bidTokens)

            let calcMaxClaimTokens = bidTokens.plus(bidTokens.multipliedBy(0.32))
            calcMaxClaimTokens = maxClaimableTokens.plus(calcMaxClaimTokens)
            calcMaxClaimTokens = Number(calcMaxClaimTokens).toFixed(4)

            console.log("contract maxTotalClaim", maxTotalClaim, " calcMaxClaimTokens", calcMaxClaimTokens)
            // assert.equal(maxTotalClaim,calcMaxClaimTokens,"max total claim should be equal to the calculated max total claim")
        })

        it('Should whitelist accounts', async function () {
            await auctionContract.addToWhitelist([accounts[1], accounts[2], accounts[3], accounts[4], accounts[16], accounts[17], accounts[18], accounts[19]]);
            let isWhitelisted = await auctionContract.whitelist(accounts[19]);
            assert.equal(isWhitelisted, true, "accounts[19] should be whitelisted")
            let participants = await auctionContract.participants.call();
            assert.equal(participants.toNumber(), 8, "whitelisted accounts should be equal no of participants ")
        })

        it('Should remove from whitelist', async function () {
            await auctionContract.removeFromWhitelist([accounts[19]]);
            let isWhitelisted = await auctionContract.whitelist(accounts[19]);
            assert.equal(isWhitelisted, false, "accounts[19] should be whitelisted")
            let participants = await auctionContract.participants.call();
            assert.equal(participants.toNumber(), 7, "whitelisted accounts should be equal no of participants ")
        })

        it('Should validate the token price and stage', async function () {
            tokenPrice = await auctionContract.finalPrice();
            assert.equal(((tokenPrice.toNumber() * ETHER_PRICE) / WEI), CEILING, "Token price should be 500 cents")

            let stage = await auctionContract.stage()
            assert.equal(stage, AUCTION_ENDED, "Stage should be auction ended");
        })

        it('accounts[1] should be able to claim tokens after locking presale contract', async function () {
            let bidTokens;
            let totalTokens;

            let calimedStatus = await auctionContract.claimedStatus(accounts[1]);
            let locked = await presaleContract.lockRecords();
            let stage = await auctionContract.stage()

            assert.equal(locked, true, "Presale record migration should be locked before claiming")
            assert.equal(calimedStatus, false, "Clalimed status should be false")
            assert.equal(stage, 3, "Stage should be claiming started")

            bids = await auctionContract.bids.call(accounts[1])
            await auctionContract.claimTokens({
                from: accounts[1]
            })
            let fundsClaimed = await auctionContract.fundsClaimed.call();
            assert.equal(bids.toNumber(), fundsClaimed.toNumber(), "fundsClaimed and the bids should be equal");

            bids = new BigNumber(bids);
            bidTokens = bids.dividedBy(tokenPrice).multipliedBy(WEI)
            bidTokens = new BigNumber(bidTokens)
            totalTokens = bidTokens.multipliedBy(0.32).plus(bidTokens)

            let calTokens = HARDCAP / CEILING;
            let calbonusTokens = 0.32 * calTokens;
            allTokens = (calbonusTokens + calTokens) * WEI;
            allTokens = new BigNumber(allTokens)
            assert.equal(allTokens, totalTokens.toNumber(), "Calculated tokens bid tokens should be equal")

            let account1Balance = await tokenContract.balanceOf(accounts[1]);

            let swap = new BigNumber(20000 * WEI)
            let presale = new BigNumber(303000000000000000000);
            acc1Balance = (swap).plus(presale).plus(allTokens)

            assert.equal(acc1Balance.toNumber(), account1Balance.toNumber(), "actual balance and total balance calculated should be equal for account1")

        })
        it('Recover tokens should fail when tried before claim ends', async function () {
            await auctionContract.recoverTokens(tokenContract.address).should.be.rejected;
        })

        it('Account1 should be able to transfer tokens to account2', async function () {
            let account2bal = await tokenContract.balanceOf(accounts[2]);
            assert.equal(account2bal.toNumber(), 0, "balance should be 0");
            await tokenContract.transfer(accounts[2], FIN)
            account2bal = await tokenContract.balanceOf(accounts[2]);
            assert.equal(account2bal.toNumber(), FIN, "Account2 balance should be equal to fin");
        })

        it('Should approve timelock tokens to transfer tokens', async function () {
            await tokenContract.approve(timeLockContract.address, FIN, {
                from: accounts[2]
            })
            let allowance = await tokenContract.allowance.call(accounts[2], timeLockContract.address)
            assert.equal(allowance.toNumber(), FIN, "account2 should allow timelock tokens to lock and transfer tokens")
        })

        it('Should lock tokens for 1 secs', async function () {
            await timeLockContract.timeLockTokens(1, {
                from: accounts[2]
            });
            balance = await tokenContract.balanceOf.call(timeLockContract.address);
            assert.equal(balance.toNumber(), FIN, "Transferred balance should be updated");
            acc2balance = await tokenContract.balanceOf.call(accounts[2]);
            assert.equal(acc2balance.toNumber(), 0, "Account2 balance should be zero after locking tokens");
        })

        it(" Should reject timelock release before 10 seconds", async function () {
            await timeLockContract.tokenRelease({
                from: accounts[2]
            }).should.be.rejected;
        })

        it(" Should release tokens after 10 seconds", async function () {
            await timeout(1000);
            await timeLockContract.tokenRelease({
                from: accounts[2]
            })
            var balance = await tokenContract.balanceOf.call(accounts[2])
            assert.equal(balance.toNumber(), FIN, "Account2 should get the tokens back after releasing")
        })

        it('Should start migration by owner', async function () {
            await tokenContract.startMigration({
                from: accounts[1]
            }).should.be.rejected;
            await tokenContract.startMigration() //default account is accounts[0] that is the owner
            let acc3Bal = await tokenContract.balanceOf(accounts[3]);
            assert.equal(acc3Bal.toNumber(), 0, "Account3 balance should be 0");
            await tokenContract.transfer(accounts[3], FIN, {
                from: accounts[2]
            }).should.be.rejected;
        })
    });

    /***
     * Auction test for reach hardcap at 33 cents/token
     */
    describe('Should return the newly deployed GTX Auction contract instance', async function () {

        before('Should return the deployed GTX Auction Contract instances ', async function () {
            await timeout(10);
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

        describe('GTX Auction contract tests to reach hardcap at end block', async function () {
            let startblock;
            let endBlock;

            it('Max tokens should be equal to gtx record toatal and presale total', async function () {
                swtokens = await recordContract.totalClaimableGTX()
                prtokens = await presaleContract.totalPresaleTokens()

                maxTotalClaim = await auctionContract.maxTotalClaim()
                maxClaimableTokens = prtokens.plus(swtokens);
                maxClaimableTokens = new BigNumber(maxClaimableTokens);
                assert.equal(maxClaimableTokens, maxTotalClaim.toNumber())
            })

            it('Should setup the auction parameters', async function () {
                await auctionContract.setup(MAX_TOKENS, ETHER_PRICE, HARDCAP, CEILING, FLOOR, BONUS_THRESHOLD, BONUS_PERCENT);
            })

            it('Should allow start auction by owner', async function () {
                await auctionContract.startAuction();
                let stage = await auctionContract.stage.call();
                assert.equal(stage.toString(), AUCTION_STARTED, "Auction Stage should be Auction Started");
                startblock = await auctionContract.startBlock.call();
                endBlock = await auctionContract.endBlock.call();
                assert.equal(endBlock, startblock.toNumber() + BIDDING_PERIOD_MIN, "End block should be startBlock + bidding period")
            })

            it('Should place bid by account2 for 5 ether less than hardcap', async function () {
                hardCap = await auctionContract.hardCap();
                hardCap = new BigNumber(hardCap)
                await auctionContract.bid(accounts[1], {
                    from: accounts[2],
                    value: web3.utils.toBN(hardCap.minus(500 * WEI))
                })
                let totalReceived = await auctionContract.totalReceived();
                assert.equal(totalReceived.toNumber(), hardCap.minus(500 * WEI), "Total received should be equal to bid amount")
                let remainingCap = await auctionContract.remainingCap()
                assert.equal(remainingCap.toNumber(), 500 * WEI, "remaining cap should be equal to 5 ether less than ether");
            })

            it('Recover tokens should fail when tried before bidding period ends', async function () {
                await auctionContract.recoverTokens(tokenContract.address).should.be.rejected;
            })

            it('Should end the bid at end block', async function () {

                let currentBlock = await web3.eth.getBlockNumber();
                endBlock = endBlock.toNumber() -1

                for (i = currentBlock; i < endBlock; i++) {
                    await auctionContract.startAuction().should.be.rejected; //dummy transaction to increase block number
                }
                await auctionContract.bid(accounts[1], {
                    from: accounts[2],
                    value: web3.utils.toBN(5 * WEI)
                });
                let remainingCap = await auctionContract.remainingCap()
                assert.equal(remainingCap.toNumber(),495 * WEI, "remaining cap should be equal to 495");
            })

            it('Should validate the token price and stage', async function () {
                tokenPrice = await auctionContract.finalPrice();
                tokenPrice = new BigNumber(tokenPrice);
                tokenPrice = tokenPrice.multipliedBy(ETHER_PRICE)
                tokenPrice = tokenPrice.dividedBy(WEI);
                assert.equal(Number(tokenPrice).toFixed(1), FLOOR, "Token price should be 33 cents")

                let stage = await auctionContract.stage()
                assert.equal(stage, AUCTION_ENDED, "Stage should be auction ended");
            })
        })
    })
});


function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}