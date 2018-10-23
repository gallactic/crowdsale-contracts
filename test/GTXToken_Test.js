//Import all ABI for testing the contracts
const GTXRecord = artifacts.require('./GTXRecord');
const GTXPresale = artifacts.require('./GTXPresale');
const GTXToken = artifacts.require("./GTXToken");
const GTXMigrate = artifacts.require("./GTXERC20Migrate");
const TimeLock = artifacts.require("./TimeLock");
const GTXAuction = artifacts.require("./GTXAuction");


const assert = require("chai").assert;
require("chai")
    .use(require("chai-as-promised"))
    .should();

const multiSigWallet = '0x75fb86fc5663a2fbdee1ddb3862eba4af2a9d1cd'

contract('Tests for GTX Token contracts ', function (accounts) {
    //Global variables
    let gtxRecordIns;
    let gtxPresaleIns;
    let gtxTokenIns;
    let gtxMigrateIns;
    let timelockIns;
    let gtxAuctionIns;
    const WEI = 10e18;

    let swapRate = 200 //2.00 swap rate should be set in 2 decimal points
    let fin = 20000 * WEI;
    let finWithSwap = 10000 * WEI;

    // GTX Token Constants
    const TOTAL_SUPPLY = 1000000000 * WEI;  // 1 Billion Total GTX Token Supply
    const NAME = "GALLACTIC";               // Token Name GALLACTIC
    const SYMBOL = "GTX";                   // Token Symbol GTX
    const DECIMALS = 18;                    // 18 Decimal Points Precision

    // GTX Auction Constants
    const MAX_TOKENS = 400000000 * WEI;     // 400 Million GTX Tokens for Auction
    const BIDDING_PERIOD = 518400;          // 60 Days
    const AUDIT_WAIT_PERIOD = 80640;        // 14 Days
    const ETHER_PRICE = 22400;              // 223.66 USD
    const HARDCAP = 10000000000;            // 100 Million USD
    const CEILING = 500;                    // 5 USD
    const FLOOR = 33;                       // 0.33 USD
    const BONUS_THRESHOLD= [9900,15000,35000,50000,100000,1000000,2500000,5000000,10000000,25000000,100000000]; // Threshold for bonus in dollars

     //Presale contract variables
     const MAX_PRESALE_TOKENS = 200000000 * WEI; ; //Maximum tokens to allocate to presale contract
     const BONUS_PERCENT = [1, 2, 3, 4, 5, 10, 15, 20, 25 , 30, 32];
     const BONUS_TOKENS_THRESHOLD = [300000000000000000000,454545454545454560000,1060606060606060500000,1515151515151515200000,3030303030303030500000,30303030303030304000000,75757575757575760000000,151515151515151520000000,303030303030303040000000,757575757575757600000000,3030303030303030300000000];

    describe('GTX Swap contract', function () {
        before('Should return the deployed gtx record and presale contract instance', async function () {
            gtxRecordIns = await GTXRecord.deployed();
            gtxPresaleIns = await GTXPresale.new();
        });
        it("Should create 2 gtx records ", async function () {
            gtxRecordIns.setConversionRate(swapRate);
            await gtxRecordIns.recordCreate(accounts[1], finWithSwap, true, { from: accounts[0] })
            await gtxRecordIns.recordCreate(accounts[2], fin, false, { from: accounts[0] })
            await gtxRecordIns.lock();
        })
        it('Should get the total swap', async function () {
            let totalSwapWei = await gtxRecordIns.totalClaimableGTX.call();
            assert.equal(+totalSwapWei, 40000 * 10e18, "Total Swap Tokens are correct");
        });
        it('Should set up the initial parameters', async function() {
            await gtxPresaleIns.setup(MAX_PRESALE_TOKENS,BONUS_TOKENS_THRESHOLD,BONUS_PERCENT);
            let stage = await gtxPresaleIns.getStage();
            assert.equal(stage.toNumber(),1,"Stage is in setup")
        })
    })

    describe('GTX Token contract tests', function () {
        before('should deploy dependant contracts for gtx token ', async function () {
            gtxTokenIns = await GTXToken.new(TOTAL_SUPPLY, gtxRecordIns.address, gtxPresaleIns.address, NAME, SYMBOL, DECIMALS);
            gtxMigrateIns = await GTXMigrate.new(gtxTokenIns.address);
            timelockIns = await TimeLock.new(gtxTokenIns.address);
            gtxAuctionIns = await GTXAuction.new(
                gtxTokenIns.address, gtxRecordIns.address, gtxPresaleIns.address, BIDDING_PERIOD, AUDIT_WAIT_PERIOD
            );
        })

        it('Should update GTX migrate, timelock and ICO contract address in GTX ERC20', async function () {
            await gtxTokenIns.setMigrationAddress(gtxMigrateIns.address)
            await gtxTokenIns.setTimeLockAddress(timelockIns.address)
            await gtxTokenIns.setAuctionAddress(gtxAuctionIns.address)
        })
        it('Should return the balance of the GTX Token contract', async function() {
            let balance = await gtxTokenIns.totalSupply();
            assert.equal(balance.toNumber(),TOTAL_SUPPLY,"Total supply and token contract balance should be equal")
        })
        it('Should start migration', async function() {
            await gtxTokenIns.startMigration();
        })
        it('Should reject if already migrated', async function() {
            await gtxTokenIns.startMigration().should.be.rejected;
        })
        it("Should reject migration if it is not the owner", async function() {
            await gtxTokenIns.startMigration({from:accounts[1]}).should.be.rejected;
        })

    })

    describe('GTX ICO contract tests', function() {
        it('should passICOAllocation function from auction contract ', async function() {
            await gtxAuctionIns.setup(MAX_TOKENS, ETHER_PRICE, HARDCAP, CEILING, FLOOR, BONUS_THRESHOLD,BONUS_PERCENT);
            let balance = await gtxTokenIns.balanceOf(gtxAuctionIns.address);
            let calBalance = 40000 * WEI + MAX_PRESALE_TOKENS + MAX_TOKENS
            assert.equal(calBalance,balance.toNumber(),"Calculated balance and the other balance should be equal")
        })

    })
})
