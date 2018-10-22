pragma solidity 0.4.25;
/**
    The MIT License (MIT)

    Copyright (c) 2018 Finterra Technologies Sdn Bhd.

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

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title GTXPresale
 * @author Terry Wilkinson <terry.wilkinson@finterra.org> && Tonyia Sundaram <toniya.sundaram#finterra.org>
 * @dev The GTXPresale contract is used for current GTX point holders
 * which will be claimable after the GALLACTIC sale. This contract in particular is for onboarding and
 * storing the GTX Token records.
 * These records will be used as reference during the claiming period of the GALLACTIC sale.
 */

contract GTXPresale is Ownable {
    using SafeMath for uint256;

    // a flag for locking record changes, lockRecords is only settable by the owner
    bool public lockRecords;

    // Total GTX allocated for presale
    uint256 public totalPresaleTokens;

    // Total Claimable GTX which is the Amount of GTX sold during presale
    uint256 public totalClaimableGTX;

    // an address map used to store the per account claimable GTX and their bonus
    mapping (address => uint256) public presaleGTX;
    mapping (address => uint256) public bonusGTX;
    mapping (address => uint256) public claimableGTX;

    // Bonus Arrays for presale amount based Bonus calculation
    uint256[11] public bonusPercent; // 11 possible bonus percentages (with values 0 - 100 each)
    uint256[11] public bonusThreshold; // 11 thresholds values to calculate bonus based on the presale tokens (in cents).

    // Enums for Stages
    Stages public stage;

    /*
     *  Enums
     */
    enum Stages {
        PresaleDeployed,
        Presale,
        ClaimingStarted
    }

    /*
     *  Modifiers
     */
    modifier atStage(Stages _stage) {
        require(stage == _stage, "function not allowed at current stage");
        _;
    }

    event Setup(
        uint256 _maxPresaleTokens,
        uint256[] _bonusThreshold,
        uint256[] _bonusPercent
    );

    event GTXRecordCreate(
        address indexed _recordAddress,
        uint256 _gtxTokens
    );

    event GTXRecordUpdate(
        address indexed _recordAddress,
        uint256 _gtxTokens
    );

    event GTXRecordMove(
        address indexed _oldAddress,
        address indexed _newAddress,
        uint256 _gtxTokens
    );

    event LockRecords();

    constructor() public{
        stage = Stages.PresaleDeployed;
    }

   /**
    * @dev Function to lock record changes on this contract
    * @return True if the operation was successful.
    */
    function lock() public onlyOwner returns (bool) {
        lockRecords = true;
        stage = Stages.ClaimingStarted;
        emit LockRecords();
        return true;
    }

    /**
     * @dev setup function sets up the bonus percent and bonus thresholds for MD module tokens
     * @param _maxPresaleTokens is the maximum tokens allocated for presale
     * @param _bonusThreshold is an array of thresholds of GTX Tokens in dollars to calculate bonus%
     * @param _bonusPercent is an array of bonus% from 0-100
    */
    function setup(uint256 _maxPresaleTokens, uint256[] _bonusThreshold, uint256[] _bonusPercent) external onlyOwner atStage(Stages.PresaleDeployed) {
        require(_bonusPercent.length == _bonusThreshold.length, "Length of bonus percent array and bonus threshold should be equal");
        totalPresaleTokens =_maxPresaleTokens;
        for(uint256 i=0; i< _bonusThreshold.length; i++) {
            bonusThreshold[i] = _bonusThreshold[i];
            bonusPercent[i] = _bonusPercent[i];
        }
        stage = Stages.Presale; //Once the inital parameters are set the Presale Record Creation can be started
        emit Setup(_maxPresaleTokens,_bonusThreshold,_bonusPercent);
    }

    /**
    * @dev Used to store the amount of Presale GTX tokens for those who purchased Tokens during the presale
    * @param _recordAddress - the registered address where GTX can be claimed from
    * @param _gtxTokens - the amount of presale GTX tokens, this param should always be entered as Boson (base units)
    * i.e., 1 GTX = 10**18 Boson
    */
    function recordCreate(address _recordAddress, uint256 _gtxTokens) public onlyOwner atStage(Stages.Presale) {
        // minimum allowed GTX 0.000000000001 (in Boson) to avoid large rounding errors
        require(_gtxTokens >= 100000, "Minimum allowed GTX tokens is 100000 Bosons");
        totalClaimableGTX = totalClaimableGTX.sub(claimableGTX[_recordAddress]);
        presaleGTX[_recordAddress] = presaleGTX[_recordAddress].add(_gtxTokens);
        bonusGTX[_recordAddress] = calculateBonus(_recordAddress);
        claimableGTX[_recordAddress] = presaleGTX[_recordAddress].add(bonusGTX[_recordAddress]);

        totalClaimableGTX = totalClaimableGTX.add(claimableGTX[_recordAddress]);
        require(totalClaimableGTX <= totalPresaleTokens, "total token record (presale GTX + bonus GTX) cannot exceed presale token limit");
        emit GTXRecordCreate(_recordAddress, claimableGTX[_recordAddress]);
    }


    /**
    * @dev Used to calculate and update the amount of claimable GTX for those who purchased Tokens during the presale
    * @param _recordAddress - the registered address where GTX can be claimed from
    * @param _gtxTokens - the amount of presale GTX tokens, this param should always be entered as Boson (base units)
    * i.e., 1 GTX = 10**18 Boson
    */
    function recordUpdate(address _recordAddress, uint256 _gtxTokens) public onlyOwner atStage(Stages.Presale){
        // minimum allowed GTX 0.000000000001 (in Boson) to avoid large rounding errors
        require(_gtxTokens >= 100000, "Minimum allowed GTX tokens is 100000 Bosons");
        totalClaimableGTX = totalClaimableGTX.sub(claimableGTX[_recordAddress]);
        presaleGTX[_recordAddress] = _gtxTokens;
        bonusGTX[_recordAddress] = calculateBonus(_recordAddress);
        claimableGTX[_recordAddress] = presaleGTX[_recordAddress].add(bonusGTX[_recordAddress]);
        
        totalClaimableGTX = totalClaimableGTX.add(claimableGTX[_recordAddress]);
        require(totalClaimableGTX <= totalPresaleTokens, "total token record (presale GTX + bonus GTX) cannot exceed presale token limit");
        emit GTXRecordUpdate(_recordAddress, claimableGTX[_recordAddress]);
    }

    /**
    * @dev Used to move GTX records from one address to another, primarily in case a user has lost access to their originally registered account
    * @param _oldAddress - the original registered address
    * @param _newAddress - the new registerd address
    */
    function recordMove(address _oldAddress, address _newAddress) public onlyOwner atStage(Stages.Presale){
        require(claimableGTX[_oldAddress] != 0, "cannot move a zero record");
        require(claimableGTX[_newAddress] == 0, "destination must not already have a claimable record");

        //Moving the Presale GTX
        presaleGTX[_newAddress] = presaleGTX[_oldAddress];
        presaleGTX[_oldAddress] = 0;

        //Moving the Bonus GTX
        bonusGTX[_newAddress] = bonusGTX[_oldAddress];
        bonusGTX[_oldAddress] = 0;

        //Moving the claimable GTX
        claimableGTX[_newAddress] = claimableGTX[_oldAddress];
        claimableGTX[_oldAddress] = 0;

        emit GTXRecordMove(_oldAddress, _newAddress, claimableGTX[_newAddress]);
    }


    /**
     * @dev calculates the bonus percentage based on the total number of GTX tokens
     * @param _receiver is the registered address for which bonus is calculated
     * @return returns the calculated bonus tokens
    */
    function calculateBonus(address _receiver) public view returns(uint256 bonus) {
        uint256 gtxTokens = presaleGTX[_receiver];
        for(uint256 i=0; i < bonusThreshold.length; i++) {
            if(gtxTokens >= bonusThreshold[i]) {
                bonus = (bonusPercent[i].mul(gtxTokens)).div(100);
            }
        }
        return bonus;
    }

    /**
    * @dev Used to retrieve the total GTX tokens for GTX claiming after the GTX ICO
    * @return uint256 - Presale stage
    */
    function getStage() public view returns (uint256) {
        return uint(stage);
    }

}