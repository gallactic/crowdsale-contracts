//Tests for gtx records
let gtxRecord = artifacts.require('./GTXRecord')
const truffleAssert = require('truffle-assertions');
const assert = require("chai").assert;
require('chai')
    .use(require('chai-as-promised'))
    .should();


contract('GTX Record', function (accounts) {
    let gtxInstance;
    const fin = 700 * 10e18;
    const finWithSwapRate = 900 * 10e18;
    const finWithSwapRate1 = 1000 * 10e18;
    const invalidfin = 100;
    const swapRate = 200 //2.00 swap rate should be set in 2 decimal points

    //EVENTS
    let txUpdate;
    let txMove;

    before(async function () {
        gtxInstance = await gtxRecord.deployed();
    })

    describe('Record update before setting swap rate', async function(){

        it('Should be rejected before swap rate is set', async function () {
            await gtxInstance.recordCreate(accounts[1], finWithSwapRate, true, { from: accounts[0] }).should.be.rejected;
        })
    })
    describe('set gtx swap rate',async function(){

        it('Should set the swap rate by owner', async function(){
            await gtxInstance.setConversionRate(swapRate)
        })
        it('Should reject if swap rate is not set by the owner',async function(){
            gtxInstance.setConversionRate(swapRate,{from:accounts[1]}).should.be.rejected;
        })
    })
    describe('record Create', async function () {

        it('Should create with swap rate', async function () {
            await gtxInstance.recordCreate(accounts[1], finWithSwapRate, true, { from: accounts[0] })
            let balance = await gtxInstance.claimableGTX.call(accounts[1])
            assert.equal(balance.toNumber(), (finWithSwapRate *swapRate)/100 , "balance should be 1800*10e18")
        })

        it('Should create with swap rate', async function () {
            await gtxInstance.recordCreate(accounts[2], fin, false, { from: accounts[0] })
            balance = await gtxInstance.claimableGTX.call(accounts[2])
            assert.equal(balance.toNumber(), fin, "balance should be 700 *10e18")
        })

        it('Should add finpoints for the same record', async function () {
            await gtxInstance.recordCreate(accounts[1], finWithSwapRate, true, { from: accounts[0] })
            balance = await gtxInstance.claimableGTX.call(accounts[1])
            assert.equal(balance.toNumber(), (finWithSwapRate*2)*swapRate/100, "balance should be (18 *10e18)")
        })

        it('Should return the total gtx', async function(){
            let total = await gtxInstance.totalClaimableGTX.call()
            assert.equal(total.toNumber(), ((finWithSwapRate*2*swapRate)/100)+fin , "balance should be 18.5")
        })

        it('Should be rejected for finPointAmount >= 100000', async function () {
            gtxInstance.recordCreate(accounts[3], invalidfin, true, { from: accounts[0] }).should.be.rejected;
        })

        it('it should be called only by the contract owner', async function () {
            gtxInstance.recordCreate(accounts[1], 5000000000000000000, true, { from: accounts[1] }).should.be.rejected;
        })

        it('Should fail if the tokens are exceeding the max tokens', async function() {
            await gtxInstance.recordCreate(accounts[7],8997100*10e18,false).should.be.rejected;
        })
    })

    describe('record update', function(){

        it('Should update for existing record', async function() {
            txUpdate = await gtxInstance.recordUpdate(accounts[1],finWithSwapRate1,true,{from: accounts[0]})
            balance = await gtxInstance.claimableGTX.call(accounts[1]);
            assert.equal(balance.toNumber(),finWithSwapRate1*swapRate/100,"balance should be equal to 10 *10e18")
        })
    })
    describe('record move', function () {

        it('Should move record for an existing "from" address and non-existing "to" address', async function () {
            txMove = await gtxInstance.recordMove(accounts[2], accounts[4], { from: accounts[0] })
            balance = await gtxInstance.claimableGTX.call(accounts[4])
            assert.equal(balance.toNumber(), fin, "balance should be 7 *10e18")
            balance = await gtxInstance.claimableGTX.call(accounts[2])
            assert.equal(balance.toNumber(), 0, "balance should be 0")
        })

        it('Should reject for non existing "from" address', async function () {
            gtxInstance.recordMove(accounts[2], accounts[3],{ from: accounts[0] }).should.be.rejected;
        })

        it('Should reject for existing "to" address', async function () {
            gtxInstance.recordMove(accounts[1], accounts[4],{ from: accounts[0] }).should.be.rejected;
        })

        it('Should reject for an invalid new address ', async function () {
            gtxInstance.recordMove(accounts[1], " ",{ from: accounts[0] }).should.be.rejected;
        })

        it('it should be called only by the contract owner', async function () {
            gtxInstance.recordMove(accounts[1], accounts[3], { from: accounts[1] }).should.be.rejected;
        })
    })
    describe('total gtx swapped ', function(){

        it('Should return the total gtx', async function(){
            let total = await gtxInstance.totalClaimableGTX.call()
            let computedTotal = fin+finWithSwapRate1*swapRate/100;
            assert.equal(computedTotal,total.toNumber(),"balance should be equal")
        })
    })
    describe('Testing lock function', function() {

        it('Record creation should be locked by the owner', async function() {
            await gtxInstance.lock();
        })
        it('Lock state should return true', async function() {
            let locked = await gtxInstance.lockRecords.call();
            assert.equal(locked,true,"lock state should be true")
        })
        it('Should not be able to able to create records after locking', async function() {
            await gtxInstance.recordMove(accounts[2], accounts[4], { from: accounts[0] }).should.be.rejected;
        })

    })
    describe('Testing Events',function(){

        it('Should emit record update event for account[1]',async function(){
            truffleAssert.eventEmitted(txUpdate, 'GTXRecordUpdate', (ev) => {
                return ev._recordAddress === accounts[1] && ev._gtxAmount.eq(finWithSwapRate1*swapRate / 100);
            });
        })

        it('Should emit record move event for account[1]',async function(){
            truffleAssert.eventEmitted(txMove, 'GTXRecordMove', (ev) => {
                return ev._oldAddress === accounts[2] && ev._newAddress === accounts[4] && ev._gtxAmount.eq(fin);
            });
        })
    })
})