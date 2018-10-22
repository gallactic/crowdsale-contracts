pragma solidity 0.4.25;
/**
    The MIT License (MIT)

    Copyright (c) 2018 Gallactic

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

/**
 * This is an ERC-20 standard contract used for the Gallactic Auction and Gallactic Network token migration
 * GTXRecord is used here to fetch the total claimable GTX Tokens as per the FIN points converted for GTX Tokens
*/
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./StandardToken.sol";
import "./GTXRecord.sol";
import "./GTXERC20Migrate.sol";
import "./GTXAuction.sol";
import "./TimeLock.sol";
import "./GTXPresale.sol";

    /**
     * @title GTXToken
     * @author Terry Wilkinson <terry.wilkinson@finterra.org> && Tonyia Sundaram <toniya.sundaram#finterra.org>
     * @dev An ERC20 Token Contract based on the ERC20 StandardToken
     * with permissions given to Migration and Auction contracts for certain methods
     * This ERC20 Token is used for the GTX Blockchain Auction and token migration.
    */
contract GTXToken is StandardToken, Ownable{
    using SafeMath for uint256;
    event SetMigrationAddress(address GTXERC20MigrateAddress);
    event SetAuctionAddress(address GTXAuctionContractAddress);
    event SetTimeLockAddress(address _timeLockAddress);
    event Migrated(address indexed account, uint256 amount);
    event MigrationStarted();


    //global variables
    GTXRecord public gtxRecord;
    GTXPresale public gtxPresale;
    uint256 public totalAllocation;
    bool public migrationStart;

    // var for storing the the GTXRC20Migrate contract deployment address (for migration to the GALLACTIC network)
    TimeLock timeLockContract;
    GTXERC20Migrate gtxMigrationContract;
    GTXAuction gtxAuctionContract;

    /**
     * @dev Modifier for only GTX migration contract address
    */
    modifier onlyMigrate {
        require(msg.sender == address(gtxMigrationContract));
        _;
    }

    /**
     * @dev Modifier for only gallactic Auction contract address
    */
    modifier onlyAuction {
        require(msg.sender == address(gtxAuctionContract));
        _;
    }

    /**
     * @dev Constructor to pass the GTX ERC20 arguments
     * @param _totalSupply the total token supply (Initial Proposal is 1,000,000,000)
     * @param _gtxRecord the GTXRecord contract address to use for records keeping
     * @param _gtxPresale the GTXPresale contract address to use for records keeping
     * @param _name ERC20 Token Name (Gallactic Token)
     * @param _symbol ERC20 Token Symbol (GTX)
     * @param _decimals ERC20 Token Decimal precision value (18)
    */
    constructor(uint256 _totalSupply, GTXRecord _gtxRecord, GTXPresale _gtxPresale, string _name, string _symbol, uint8 _decimals)
    StandardToken(_name,_symbol,_decimals) public {
        require(_gtxRecord != address(0), "Must provide a Record address");
        require(_gtxPresale != address(0), "Must provide a PreSale address");
        require(_gtxPresale.getStage() > 0, "Presale must have already set its allocation");
        require(_gtxRecord.maxRecords().add(_gtxPresale.totalPresaleTokens()) <= _totalSupply, "Records & PreSale allocation exceeds the proposed total supply");
        
        totalSupply_ = _totalSupply; // unallocated until passAuctionAllocation is called
        gtxRecord = _gtxRecord;
        gtxPresale = _gtxPresale;
    }

    /**
    * @dev Fallback reverts any ETH payment 
    */
    function () public payable {
        revert (); 
    }  

    /**
    * @dev Safety function for reclaiming ERC20 tokens
    * @param _token address of the ERC20 contract
    */
    function recoverLost(ERC20Interface _token) public onlyOwner {
        _token.transfer(owner(), _token.balanceOf(this));
    }

    /**
    * @dev Function to set the migration contract address
    * @return True if the operation was successful.
    */
    function setMigrationAddress(GTXERC20Migrate _gtxMigrateContract) public onlyOwner returns (bool) {
        require(_gtxMigrateContract != address(0), "Must provide a Migration address");
        // check that this GTX ERC20 deployment is the migration contract's attached ERC20 token
        require(_gtxMigrateContract.ERC20() == address(this), "Migration contract does not have this token assigned");

        gtxMigrationContract = _gtxMigrateContract;
        emit SetMigrationAddress(_gtxMigrateContract);
        return true;
    }

    /**
    * @dev Function to set the Auction contract address
    * @return True if the operation was successful.
    */
    function setAuctionAddress(GTXAuction _gtxAuctionContract) public onlyOwner returns (bool) {
        require(_gtxAuctionContract != address(0), "Must provide an Auction address");
        // check that this GTX ERC20 deployment is the Auction contract's attached ERC20 token
        require(_gtxAuctionContract.ERC20() == address(this), "Auction contract does not have this token assigned");

        gtxAuctionContract = _gtxAuctionContract;
        emit SetAuctionAddress(_gtxAuctionContract);
        return true;
    }

    /**
    * @dev Function to set the TimeLock contract address
    * @return True if the operation was successful.
    */
    function setTimeLockAddress(TimeLock _timeLockContract) public onlyOwner returns (bool) {
        require(_timeLockContract != address(0), "Must provide a TimeLock address");
        // check that this FIN ERC20 deployment is the TimeLock contract's attached ERC20 token
        require(_timeLockContract.ERC20() == address(this), "TimeLock contract does not have this token assigned");

        timeLockContract = _timeLockContract;
        emit SetTimeLockAddress(_timeLockContract);
        return true;
    }

    /**
    * @dev Function to start the migration period
    * @return True if the operation was successful.
    */
    function startMigration() onlyOwner public returns (bool) {
        require(migrationStart == false, "startMigration has already been run");
        // check that the FIN migration contract address is set
        require(gtxMigrationContract != address(0), "Migration contract address must be set");
        // check that the GTX Auction contract address is set
        require(gtxAuctionContract != address(0), "Auction contract address must be set");
        // check that the TimeLock contract address is set
        require(timeLockContract != address(0), "TimeLock contract address must be set");

        migrationStart = true;
        emit MigrationStarted();

        return true;
    }

    /**
     * @dev Function to pass the Auction Allocation to the Auction Contract Address
     * @dev modifier onlyAuction Permissioned only to the Gallactic Auction Contract Owner
     * @param _auctionAllocation The GTX Auction Allocation Amount (Initial Proposal 400,000,000 tokens)
    */

    function passAuctionAllocation(uint256 _auctionAllocation) public onlyAuction {
        //check GTX Record creation has stopped.
        require(gtxRecord.lockRecords() == true, "GTXRecord contract lock state should be true");

        uint256 gtxRecordTotal = gtxRecord.totalClaimableGTX();
        uint256 gtxPresaleTotal = gtxPresale.totalPresaleTokens();

        totalAllocation = _auctionAllocation.add(gtxRecordTotal).add(gtxPresaleTotal);
        require(totalAllocation <= totalSupply_, "totalAllocation must be less than totalSupply");
        balances[gtxAuctionContract] = totalAllocation;
        emit Transfer(address(0), gtxAuctionContract, totalAllocation);
        uint256 remainingTokens = totalSupply_.sub(totalAllocation);
        balances[owner()] = remainingTokens;
        emit Transfer(address(0), owner(), totalAllocation);
    }

    /**
     * @dev Function to modify the GTX ERC-20 balance in compliance with migration to GTX network tokens on the GALLACTIC Network
     *      - called by the GTX-ERC20-MIGRATE GTXERC20Migrate.sol Migration Contract to record the amount of tokens to be migrated
     * @dev modifier onlyMigrate - Permissioned only to the deployed GTXERC20Migrate.sol Migration Contract
     * @param _account The Ethereum account which holds some GTX ERC20 balance to be migrated to Gallactic
     * @param _amount The amount of GTX ERC20 to be migrated
    */
    function migrateTransfer(address _account, uint256 _amount) onlyMigrate public returns (uint256) {
        require(migrationStart == true);
        uint256 userBalance = balanceOf(_account);
        require(userBalance >= _amount);

        emit Migrated(_account, _amount);
        balances[_account] = balances[_account].sub(_amount);
        return _amount;
    }

    /**
     * @dev Function to get the GTX Record contract address
    */
    function getGTXRecord() public view returns (address) {
        return address(gtxRecord);
    }

    /**
     * @dev Function to get the total auction allocation
    */
    function getAuctionAllocation() public view returns (uint256){
        require(totalAllocation != 0, "Auction allocation has not been set yet");
        return totalAllocation;
    }
}