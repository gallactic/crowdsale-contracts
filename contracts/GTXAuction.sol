pragma solidity 0.4.25;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./GTXToken.sol";
import "./GTXRecord.sol";
import "./GTXPresale.sol";
import "./ERC20Interface.sol";
/**
    The MIT License (MIT)

    Copyright (c) 2018 Finterra Ventures Ltd.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be included
    in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**/

/// @title GTX Dutch Auction Smart Contract - Distribution of GTX tokens using a modified Dutch Auction with threshold based bonus tokens
/// @author Terry Wilkinson <terry.wilkinson@finterra.org, & Toniya Sundaram <toniya.sundaram@finterra.org>
contract GTXAuction is Ownable {
    using SafeMath for uint256;

    // Map of whitelisted address for participation in the Auction
    mapping (address => bool) public whitelist;
    // Current number of participants in the Auction
    uint256 public participants;

    /*
     *  Events
     */
    event Setup(uint256 etherPrice, uint256 hardCap, uint256 ceiling, uint256 floor, uint256[] bonusThreshold, uint256[] bonusPercent);
    event BidSubmission(address indexed sender, uint256 amount);
    event ClaimedTokens(address indexed recipient, uint sent_amount);

    /*
     *  Storage
     */
    // GTX Contract objects required to allocate GTX Tokens and FIN converted GTX Tokens
    GTXToken public ERC20;
    GTXRecord public gtxRecord;
    GTXPresale public gtxPresale;

    // Auction specific uint256 Bid variables
    uint256 public maxTokens; // the maximum number of tokens for distribution during the auction
    uint256 public remainingCap; // Remaining amount in wei to reach the hardcap target
    uint256 public totalReceived; // Keep track of total ETH in Wei received during the bidding phase
    uint256 public maxTotalClaim; // a running total of the maximum possible tokens that can be claimed by bidder (including bonuses)
    uint256 public totalAuctionTokens; // Total tokens for the accumulated bid amount and the bonus
    uint256 public fundsClaimed;  // Keep track of cumulative ETH funds for which the tokens have been claimed

    // Auction specific uint256 Time variables
    uint256 public startBlock; // the number of the block when the auction bidding period was started
    uint256 public biddingPeriod; // the number of blocks for the bidding period of the auction
    uint256 public endBlock; // the last possible block of the bidding period
    uint256 public waitingPeriod; // the number of days of the cooldown/audit period after the bidding phase has ended

    // Auction specific uint256 Price variables
    uint256 public etherPrice; // 2 decimal precision, e.g., $1.00 = 100
    uint256 public ceiling; // entered as a paremeter in USD cents; calculated as the equivalent "ceiling" value in ETH - given the etherPrice
    uint256 public floor; // entered as a paremeter in USD cents; calculated as the equivalent "floor" value in ETH - given the etherPrice
    uint256 public hardCap; // entered as a paremeter in USD cents; calculated as the equivalent "hardCap" value in ETH - given the etherPrice
    uint256 public priceConstant; // price calculation factor to generate the price curve per block
    uint256 public finalPrice; // the final Bid Price achieved
    uint256 constant public WEI_FACTOR = 10**18; // wei conversion factor

    // Auction maps to calculate Bids and Bonuses
    mapping (address => uint256) public bids; // total bids in wei per account
    mapping (address => uint256) public bidTokens; // tokens calculated for the submitted bids
    mapping (address => uint256) public totalTokens; // total tokens is the accumulated tokens of bidTokens, presaleTokens, gtxrecordTokens and bonusTokens
    mapping (address => bool) public claimedStatus; // claimedStatus is the claimed status of the user

    // Auction arrays for bid amount based Bonus calculation
    uint256[11] public bonusPercent; // 11 possible bonus percentages (with values 0 - 100 each)
    uint256[11] public bonusThresholdWei; // 11 thresholds values to calculate bonus based on the bid amount in wei.

    // Enums for Stages
    Stages public stage;

    /*
     *  Enums
     */
    enum Stages {
        AuctionDeployed,
        AuctionSetUp,
        AuctionStarted,
        AuctionEnded,
        ClaimingStarted,
        ClaimingEnded
    }

    /*
     *  Modifiers
     */
    modifier atStage(Stages _stage) {
        require(stage == _stage, "not the expected stage");
        _;
    }

    modifier timedTransitions() {
        if (stage == Stages.AuctionStarted && block.number >= endBlock) {
            finalizeAuction();
            msg.sender.transfer(msg.value);
            return;
        }
        if (stage == Stages.AuctionEnded && block.number >= endBlock.add(waitingPeriod)) {
            stage = Stages.ClaimingStarted;
        }
        _;
    }

    modifier onlyWhitelisted(address _participant) {
        require(whitelist[_participant] == true, "account is not white listed");
        _;
    }

    /// GTXAuction Contract Constructor
    /// @dev Constructor sets the basic auction information
    /// @param _gtxToken the GTX ERC20 token contract address
    /// @param _gtxRecord the GTX Record contract address
    /// @param _gtxPresale the GTX presale contract address
    /// @param _biddingPeriod the number of blocks the bidding period of the auction will run - Initial decision of 524160 (~91 Days)
    /// @param _waitingPeriod the waiting period post Auction End before claiming - Initial decision of 80640 (-14 days)


    constructor (
        GTXToken _gtxToken,
        GTXRecord _gtxRecord,
        GTXPresale _gtxPresale,
        uint256 _biddingPeriod,
        uint256 _waitingPeriod
    )
       public
    {
        require(_gtxToken != address(0), "Must provide a Token address");
        require(_gtxRecord != address(0), "Must provide a Record address");
        require(_gtxPresale != address(0), "Must provide a PreSale address");
        require(_biddingPeriod > 0, "The bidding period must be a minimum 1 block");
        require(_waitingPeriod > 0, "The waiting period must be a minimum 1 block");

        // validate that this contract's GTXRecord has been locked - true
        require(_gtxRecord.lockRecords(), "Records have not been locked");
        // validate that this contract's GTXRecord is the same deployment referenced by the ERC20 token contract
        require(address(_gtxRecord) == _gtxToken.getGTXRecord(), "Incorrect Record address provided");

        ERC20 = _gtxToken;
        gtxRecord = _gtxRecord;
        gtxPresale = _gtxPresale;
        waitingPeriod = _waitingPeriod;
        biddingPeriod = _biddingPeriod;

        uint256 gtxSwapTokens = gtxRecord.totalClaimableGTX();
        uint256 gtxPresaleTokens = gtxPresale.totalPresaleTokens();
        maxTotalClaim = maxTotalClaim.add(gtxSwapTokens).add(gtxPresaleTokens);

        // Set the contract stage to Auction Deployed
        stage = Stages.AuctionDeployed;
    }

    // fallback to revert ETH sent to this contract
    function () public payable {
        bid(msg.sender);
    }

    /**
    * @dev Safety function for reclaiming ERC20 tokens
    * @param _token address of the ERC20 contract
    */
    function recoverTokens(ERC20Interface _token) external onlyOwner {
        if(address(_token) == address(ERC20)) {
            require(uint(stage) >= 3, "auction bidding must be ended to recover");
            if(currentStage() == 3 || currentStage() == 4) {
                _token.transfer(owner(), _token.balanceOf(address(this)).sub(maxTotalClaim));
            } else {
                _token.transfer(owner(), _token.balanceOf(address(this)));
            }
        } else {
            _token.transfer(owner(), _token.balanceOf(address(this)));
        }
    }

    ///  @dev Function to whitelist participants during the crowdsale
    ///  @param _bidder_addresses Array of addresses to whitelist
    function addToWhitelist(address[] _bidder_addresses) external onlyOwner {
        for (uint32 i = 0; i < _bidder_addresses.length; i++) {
            if(_bidder_addresses[i] != address(0) && whitelist[_bidder_addresses[i]] == false){
                whitelist[_bidder_addresses[i]] = true;
                participants = participants.add(1);
            }
        }
    }

    ///  @dev Function to remove the whitelististed participants
    ///  @param _bidder_addresses is an array of accounts to remove form the whitelist
    function removeFromWhitelist(address[] _bidder_addresses) external onlyOwner {
        for (uint32 i = 0; i < _bidder_addresses.length; i++) {
            if(_bidder_addresses[i] != address(0) && whitelist[_bidder_addresses[i]] == true){
                whitelist[_bidder_addresses[i]] = false;
                participants = participants.sub(1);
            }
        }
    }

    /// @dev Setup function sets eth pricing information and the floor and ceiling of the Dutch auction bid pricing
    /// @param _maxTokens the maximum public allocation of tokens - Initial decision for 400 Million GTX Tokens to be allocated for ICO
    /// @param _etherPrice for calculating Gallactic Auction price curve - Should be set 1 week before the auction starts, denominated in USD cents
    /// @param _hardCap Gallactic Auction maximum accepted total contribution - Initial decision to be $100,000,000.00 or 10000000000 (USD cents)
    /// @param _ceiling Gallactic Auction Price curve ceiling price - Initial decision to be 500 (USD cents)
    /// @param _floor Gallactic Auction Price curve floor price - Initial decision to be 30 (USD cents)
    /// @param _bonusThreshold is an array of thresholds for the bid amount to set the bonus% (thresholds entered in USD cents, converted to ETH equivalent based on ETH price)
    /// @param _bonusPercent is an array of bonus% based on the threshold of bid

    function setup(
        uint256 _maxTokens,
        uint256 _etherPrice,
        uint256 _hardCap,
        uint256 _ceiling,
        uint256 _floor,
        uint256[] _bonusThreshold,
        uint256[] _bonusPercent
    )
        external
        onlyOwner
        atStage(Stages.AuctionDeployed)
        returns (bool)
    {
        require(_maxTokens > 0,"Max Tokens should be > 0");
        require(_etherPrice > 0,"Ether price should be > 0");
        require(_hardCap > 0,"Hard Cap should be > 0");
        require(_floor < _ceiling,"Floor must be strictly less than the ceiling");
        require(_bonusPercent.length == 11 && _bonusThreshold.length == 11, "Length of bonus percent array and bonus threshold should be 11");

        maxTokens = _maxTokens;
        etherPrice = _etherPrice;

        // Allocate Crowdsale token amounts (Permissible only to this GTXAuction Contract)
        // Address needs to be set in GTXToken before Auction Setup)
        ERC20.passAuctionAllocation(maxTokens);

        // Validate allocation amount
        require(ERC20.balanceOf(address(this)) == ERC20.getAuctionAllocation(), "Incorrect balance assigned by auction allocation");

        // ceiling, floor, hardcap and bonusThreshholds in Wei and priceConstant setting
        ceiling = _ceiling.mul(WEI_FACTOR).div(_etherPrice); // result in WEI
        floor = _floor.mul(WEI_FACTOR).div(_etherPrice); // result in WEI
        hardCap = _hardCap.mul(WEI_FACTOR).div(_etherPrice); // result in WEI
        for (uint32 i = 0; i<_bonusPercent.length; i++) {
            bonusPercent[i] = _bonusPercent[i];
            bonusThresholdWei[i] = _bonusThreshold[i].mul(WEI_FACTOR).div(_etherPrice);
        }
        remainingCap = hardCap.sub(remainingCap);
        // used for the bidding price curve
        priceConstant = (biddingPeriod**3).div((biddingPeriod.add(1).mul(ceiling).div(floor)).sub(biddingPeriod.add(1)));

        // Initializing Auction Setup Stage
        stage = Stages.AuctionSetUp;
        emit Setup(_etherPrice,_hardCap,_ceiling,_floor,_bonusThreshold,_bonusPercent);
    }

    /// @dev Changes auction price curve variables before auction is started.
    /// @param _etherPrice New Ether Price in Cents.
    /// @param _hardCap New hardcap amount in Cents.
    /// @param _ceiling New auction ceiling price in Cents.
    /// @param _floor New auction floor price in Cents.
    /// @param _bonusThreshold is an array of thresholds for the bid amount to set the bonus%
    /// @param _bonusPercent is an array of bonus% based on the threshold of bid

    function changeSettings(
        uint256 _etherPrice,
        uint256 _hardCap,
        uint256 _ceiling,
        uint256 _floor,
        uint256[] _bonusThreshold,
        uint256[] _bonusPercent
    )
        external
        onlyOwner
        atStage(Stages.AuctionSetUp)
    {
        require(_etherPrice > 0,"Ether price should be > 0");
        require(_hardCap > 0,"Hard Cap should be > 0 ");
        require(_floor < _ceiling,"floor must be strictly less than the ceiling");
        require(_bonusPercent.length == _bonusThreshold.length, "Length of bonus percent array and bonus threshold should be equal");
        etherPrice = _etherPrice;
        ceiling = _ceiling.mul(WEI_FACTOR).div(_etherPrice); // recalculate ceiling, result in WEI
        floor = _floor.mul(WEI_FACTOR).div(_etherPrice); // recalculate floor, result in WEI
        hardCap = _hardCap.mul(WEI_FACTOR).div(_etherPrice); // recalculate hardCap, result in WEI
        for (uint i = 0 ; i<_bonusPercent.length; i++) {
            bonusPercent[i] = _bonusPercent[i];
            bonusThresholdWei[i] = _bonusThreshold[i].mul(WEI_FACTOR).div(_etherPrice);
        }
        remainingCap = hardCap.sub(remainingCap);
        // recalculate price constant
        priceConstant = (biddingPeriod**3).div((biddingPeriod.add(1).mul(ceiling).div(floor)).sub(biddingPeriod.add(1)));
        emit Setup(_etherPrice,_hardCap,_ceiling,_floor,_bonusThreshold,_bonusPercent);
    }

    /// @dev Starts auction and sets startBlock and endBlock.
    function startAuction()
        public
        onlyOwner
        atStage(Stages.AuctionSetUp)
    {
        // set the stage to Auction Started and bonus stage to First Stage
        stage = Stages.AuctionStarted;
        startBlock = block.number;
        endBlock = startBlock.add(biddingPeriod);
    }

    /// @dev Implements a moratorium on claiming so that company can eventually recover all remaining tokens (in case of lost accounts who can/will never claim) - any remaining claims must contact the company directly
    function endClaim()
        public
        onlyOwner
        atStage(Stages.ClaimingStarted)
    {
        require(block.number >= endBlock.add(biddingPeriod),"Owner can end claim only after 3 months");   //Owner can force end the claim only after 3 months. This is to protect the owner from ending the claim before users could claim
        // set the stage to Claiming Ended
        stage = Stages.ClaimingEnded;
    }

    /// @dev Allows to send a bid to the auction.
    /// @param _receiver Bid will be assigned to this address if set.
    function bid(address _receiver)
        public
        payable
        timedTransitions
        atStage(Stages.AuctionStarted)
    {
        require(msg.value > 0, "bid must be larger than 0");
        require(block.number <= endBlock ,"Auction has ended");
        if (_receiver == 0x0) {
            _receiver = msg.sender;
        }
        assert(bids[_receiver].add(msg.value) >= msg.value);

        uint256 maxWei = hardCap.sub(totalReceived); // remaining accetable funds without the current bid value
        require(msg.value <= maxWei, "Hardcap limit will be exceeded");

        bids[_receiver] = bids[_receiver].add(msg.value);

        uint256 maxAcctClaim = bids[_receiver].div(calcTokenPrice(endBlock)).mul(WEI_FACTOR); // max claimable tokens given bids total amount
        maxAcctClaim = maxAcctClaim.add(bonusPercent[10].mul(maxAcctClaim).div(100)); // max claimable tokens (including bonus)
        maxTotalClaim = maxTotalClaim.add(maxAcctClaim); // running total of max claim liability

        totalReceived = totalReceived.add(msg.value);

        remainingCap = hardCap.sub(totalReceived);
        if(remainingCap == 0 || block.number == endBlock){
            finalizeAuction(); // When maxWei is equal to the hardcap the auction will end and finalizeAuction is triggered.
        }
        assert(totalReceived >= msg.value);
        emit BidSubmission(_receiver, msg.value);
    }

    /// @dev Claims tokens for bidder after auction.
    function claimTokens()
        public
        timedTransitions
        onlyWhitelisted(msg.sender)
        atStage(Stages.ClaimingStarted)
    {
        require(!claimedStatus[msg.sender], "User already claimed");
        // validate that GTXPresale contract has been locked - set to true
        require(gtxPresale.lockRecords(), "presale record updating must be locked");

        // Update the total amount of ETH funds for which tokens have been claimed
        fundsClaimed = fundsClaimed.add(bids[msg.sender]);

        //total tokens accumulated for an user
        uint256 accumulatedTokens = calculateTokens(msg.sender);

        // Set receiver bid to 0 before assigning tokens
        bids[msg.sender] = 0;
        totalTokens[msg.sender] = 0;

        require(ERC20.transfer(msg.sender, accumulatedTokens), "transfer failed");
        claimedStatus[msg.sender] = true;

        emit ClaimedTokens(msg.sender, accumulatedTokens);
        assert(bids[msg.sender] == 0);
    }

    /// @dev calculateTokens calculates the sum of GTXRecord Tokens, Presale Tokens, BidTokens and Bonus Tokens
    /// @param _receiver is the address of the receiver to calculate the tokens.
    function calculateTokens(address _receiver) private returns(uint256){
        // Check for GTX Record Tokens
        uint256 gtxRecordTokens = gtxRecord.claimableGTX(_receiver);

        // Check for Presale Record Tokens
        uint256 gtxPresaleTokens = gtxPresale.claimableGTX(_receiver);

        //Calculate the total bid tokens
        bidTokens[_receiver] = bids[_receiver].mul(WEI_FACTOR).div(finalPrice);

        //Calculate the total bonus tokens for the bids
        uint256 bonusTokens = calculateBonus(_receiver);

        uint256 auctionTokens = bidTokens[_receiver].add(bonusTokens);

        totalAuctionTokens = totalAuctionTokens.add(auctionTokens);

        //Sum all the tokens accumulated
        totalTokens[msg.sender] = gtxRecordTokens.add(gtxPresaleTokens).add(auctionTokens);
        return totalTokens[msg.sender];
    }

    /// @dev Finalize the Auction and set the final token price
    /// no more bids allowed
    function finalizeAuction()
        private
    {
        // remainingFunds should be 0 at this point
        require(remainingCap == 0 || block.number >= endBlock, "cap or block condition not met");

        stage = Stages.AuctionEnded;
        if (block.number < endBlock){
            finalPrice = calcTokenPrice(block.number);
            endBlock = block.number;
        } else {
            finalPrice = calcTokenPrice(endBlock);
        }
    }

    /// @dev calculates the bonus for the total bids
    /// @param _receiver is the address of the bidder to calculate the bonus
    /// @return returns the calculated bonus tokens
    function calculateBonus(address _receiver) private view returns(uint256 bonusTokens){
        for (uint256 i=0; i < bonusThresholdWei.length; i++) {
            if(bids[_receiver] >= bonusThresholdWei[i]){
                bonusTokens = bonusPercent[i].mul(bidTokens[_receiver]).div(100); // bonusAmount is calculated in wei
            }
        }
        return bonusTokens;
    }

    // public getters
    /// @dev Calculates the token price (WEI per GTX) at the given block number
    /// @param _bidBlock is the block number
    /// @return Returns the token price - Wei per GTX
    function calcTokenPrice(uint256 _bidBlock) public view returns(uint256){

        require(_bidBlock >= startBlock && _bidBlock <= endBlock, "pricing only given in the range of startBlock and endBlock");

        uint256 currentBlock = _bidBlock.sub(startBlock);
        uint256 decay = (currentBlock ** 3).div(priceConstant);
        return ceiling.mul(currentBlock.add(1)).div(currentBlock.add(decay).add(1));
    }

    /// @dev Returns correct stage, even if a function with a timedTransitions modifier has not been called yet
    /// @return Returns current auction stage.
    function currentStage()
        public
        view
        returns (uint)
    {
        return uint(stage);
    }

}