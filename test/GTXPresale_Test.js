let gtxPresale = artifacts.require('./GTXPresale');
const truffleAssert = require('truffle-assertions');
const assert = require("chai").assert;
require('chai')
    .use(require('chai-as-promised'))
    .should();

/* Web 3 Objects */
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');


/**
 * Global Variables
 */
let presaleContract;
let totalSoldTokens;

/**
 * Events
 */
let txSetup;
let txCreate;

contract('GTX Presale', function(accounts) {

    const WEI = web3.utils.toWei(web3.utils.toBN(1), "ether");  // Conversion of ETHER to WEI
    const tokenPrice = 33; //tokenPrice is in cents
    const maxPresaleTokens = 200000000 * WEI; ; //Maximum tokens to allocate to presale contract

    const bonus_percent = [1, 2, 3, 4, 5, 10, 15, 20, 25 , 30, 32];
    const bonus_threshold = [9901,15001,35001,50001,100001,1000001,2500001,5000001,10000001,25000001,100000000]; // Bonus threshold is in cents
    const bonus_tokens_threshold = [300000000000000000000,454545454545454560000,1060606060606060500000,1515151515151515200000,3030303030303030500000,30303030303030304000000,75757575757575760000000,151515151515151520000000,303030303030303040000000,757575757575757600000000,3030303030303030300000000];
    const stage_presale_deployed = 0;
    const stage_presale_setup = 1;
    const stage_claim_started = 2;

    describe('Gtx methods tests', async function() {
        before('Deploy GTX Presale Contract', async function() {
            presaleContract = await gtxPresale.new();
            let stage = await presaleContract.getStage();
            assert.equal(stage,stage_presale_deployed,"Stage should presale deployed")
        })

        it('Should reject before the setup stage', async function() {
            await presaleContract.recordCreate(accounts[1],100).should.be.rejected;
        })

        it('Should set up the initial parameters', async function() {
            txSetup= await presaleContract.setup(maxPresaleTokens,bonus_tokens_threshold,bonus_percent);
            let maxTokens=await presaleContract.totalPresaleTokens();
            let stage = await presaleContract.getStage();
            assert.equal(maxTokens , maxPresaleTokens , "Max Presale tokens should be equal")
            assert.equal(stage,stage_presale_setup,"Stage should presale_setup")
        })

        it('Should create a record for accounts[1] and calculate correct bonus', async function() {

            let calcBonus = bonus_tokens_threshold[0] * bonus_percent[0] /100
            txCreate = await presaleContract.recordCreate(accounts[1],bonus_tokens_threshold[0])
            let presaleTokens = await presaleContract.presaleGTX(accounts[1])
            let bonusTokens = await presaleContract.bonusGTX(accounts[1]);
            let claimabeTokens = await presaleContract.claimableGTX(accounts[1])
            SoldTokens = await presaleContract.totalClaimableGTX()
            totalSoldTokens = claimabeTokens;
            assert.equal(presaleTokens.toNumber(),bonus_tokens_threshold[0],"Created presale records should be equal to bonus_tokens_threshold[0]")
            assert.equal(bonusTokens.toNumber(),calcBonus,"Calculated bonus for the threshold1 should be equal  to 1% of bonus_tokens_threshold[0]")
            assert.equal(claimabeTokens.toNumber(),bonus_tokens_threshold[0]+calcBonus,"Created records should be equal to the sum of bonus_tokens_threshold[0] and its bonus")
            assert.equal(SoldTokens.toNumber(),totalSoldTokens,"The total sold tokens should  be bonus_tokens_threshold[0]")

        })

        it('Should add records to existing records for accounts[1]', async function() {

            let calcBonus = 2*bonus_tokens_threshold[0] * bonus_percent[1] /100
            await presaleContract.recordCreate(accounts[1],bonus_tokens_threshold[0])
            let presaleTokens = await presaleContract.presaleGTX(accounts[1])
            let bonusTokens = await presaleContract.bonusGTX(accounts[1]);
            let claimabeTokens = await presaleContract.claimableGTX(accounts[1])
            SoldTokens = await presaleContract.totalClaimableGTX()
            totalSoldTokens = claimabeTokens;
            assert.equal(presaleTokens.toNumber(),2*bonus_tokens_threshold[0],"finpoints in created presale records should be equal to 2*bonus_tokens_threshold[0]")
            assert.equal(bonusTokens.toNumber(),calcBonus,"Calculated bonus for the threshold1 should be equal  to 2% of bonus_tokens_threshold[0]")
            assert.equal(claimabeTokens.toNumber(),2*bonus_tokens_threshold[0]+calcBonus,"Created records should be equal to the sum of bonus_tokens_threshold[0] and its bonus")
            assert.equal(SoldTokens.toNumber(),totalSoldTokens,"The total sold tokens should  be total claimable tokens by account[1]")

        })

        it('Should reject if the token value is less than 6 decimal points', async function() {
            await presaleContract.recordCreate(accounts[1],100).should.be.rejected;
        })

        it('Should reject if the token value is exceeding the max tokens', async function() {
            await presaleContract.recordCreate(accounts[7],maxPresaleTokens).should.be.rejected;
        })

        it('Should update tokens for accounts[1]', async function() {
            let calcBonus = bonus_tokens_threshold[1] * bonus_percent[1] /100
            await presaleContract.recordUpdate(accounts[1],bonus_tokens_threshold[1])
            let presaleTokens = await presaleContract.presaleGTX(accounts[1])
            let bonusTokens = await presaleContract.bonusGTX(accounts[1]);
            let claimabeTokens = await presaleContract.claimableGTX(accounts[1])
            SoldTokens = await presaleContract.totalClaimableGTX()
            totalSoldTokens = claimabeTokens;
            assert.equal(presaleTokens.toNumber(),bonus_tokens_threshold[1],"finpoints in created presale records should be equal to bonus_tokens_threshold[1]")
            assert.equal(bonusTokens.toNumber(),calcBonus,"Calculated bonus for the threshold1 should be equal  to 2% of bonus_tokens_threshold[0]")
            assert.equal(claimabeTokens.toNumber(),bonus_tokens_threshold[1]+calcBonus,"Created records should be equal to the sum of bonus_tokens_threshold[0] and its bonus")
            assert.equal(SoldTokens.toNumber(),totalSoldTokens,"The total sold tokens should  be total claimable tokens by account[1]")
        })

        it('Should create records for accounts[2]', async function() {

            await presaleContract.recordCreate(accounts[2],bonus_tokens_threshold[5])
            let presaleTokens = await presaleContract.presaleGTX(accounts[2])
            let calcBonus = presaleTokens.toNumber() * bonus_percent[5] /100
            let bonusTokens = await presaleContract.bonusGTX(accounts[2]);
            let claimabeTokens = await presaleContract.claimableGTX(accounts[2])
            SoldTokens = await presaleContract.totalClaimableGTX()
            totalSoldTokens= claimabeTokens.toNumber() +totalSoldTokens.toNumber();
            assert.equal(presaleTokens.toNumber(),bonus_tokens_threshold[5],"Created presale records should be equal to bonus_tokens_threshold[5]")
            assert.equal(bonusTokens.toNumber(),calcBonus,"Calculated bonus for the threshold1 should be equal  to 1% of bonus_tokens_threshold[5]")
            assert.equal(claimabeTokens.toNumber(),bonus_tokens_threshold[5]+calcBonus,"Created records should be equal to the sum of bonus_tokens_threshold[5] and its bonus")
            assert.equal(SoldTokens.toNumber(),totalSoldTokens,"The total sold tokens should  be bonus_tokens_threshold[5]")
        })

        it('Should move records from accounts[2] to accounts[4]', async function() {
            await presaleContract.recordMove(accounts[2],accounts[4])
            let presaleTokens = await presaleContract.presaleGTX(accounts[4])
            let calcBonus = presaleTokens.toNumber() * bonus_percent[5] /100
            let bonusTokens = await presaleContract.bonusGTX(accounts[4]);
            let claimabeTokens = await presaleContract.claimableGTX(accounts[4])
            SoldTokens = await presaleContract.totalClaimableGTX()
            assert.equal(presaleTokens.toNumber(),bonus_tokens_threshold[5],"Created presale records should be equal to bonus_tokens_threshold[5]")
            assert.equal(bonusTokens.toNumber(),calcBonus,"Calculated bonus for the threshold1 should be equal  to 1% of bonus_tokens_threshold[5]")
            assert.equal(claimabeTokens.toNumber(),bonus_tokens_threshold[5]+calcBonus,"Created records should be equal to the sum of bonus_tokens_threshold[0] and its bonus")
            assert.equal(SoldTokens.toNumber(),totalSoldTokens,"The total sold tokens should  be bonus_tokens_threshold[5]")

            //Account2 records should be nulled
            let presaleTokens2 = await presaleContract.presaleGTX(accounts[2])
            let bonusTokens2 = await presaleContract.bonusGTX(accounts[2]);
            let claimabeTokens2 = await presaleContract.claimableGTX(accounts[2])
            assert.equal(presaleTokens2.toNumber(),0,"old address records should be nulled");
            assert.equal(bonusTokens2.toNumber(),0,"old address records should be nulled");
            assert.equal(claimabeTokens2.toNumber(),0,"old address records should be nulled");
        })

        it('Should create records for accounts[3] with zero bonus percentage', async function() {

            await presaleContract.recordCreate(accounts[3],"200000000000000000000")
            let presaleTokens = await presaleContract.presaleGTX(accounts[3])
            let bonusTokens = await presaleContract.bonusGTX(accounts[3]);
            let claimabeTokens = await presaleContract.claimableGTX(accounts[3])
            SoldTokens = await presaleContract.totalClaimableGTX()
            assert.equal(presaleTokens.toNumber(),"200000000000000000000","Created presale records should be less than bonus_tokens_threshold[0]")
            assert.equal(bonusTokens.toNumber(),0,"Calculated bonus for the threshold1 should be 0")
            assert.equal(claimabeTokens.toNumber(),"200000000000000000000","Created records should be equal presale tokens")
        })

        it('Should stop the presale by locking the contract and set the stage to claim started', async function() {
            txLock = await presaleContract.lock();
            let stage = await presaleContract.getStage();
            assert.equal(stage,stage_claim_started,"Stage should be set to claim started ");
        })

        it('Should reject creating records after claiming stage ', async function() {
            await presaleContract.recordCreate(accounts[5],bonus_tokens_threshold[6]).should.be.rejected;
        })
    })
})

