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
 * @title GTXRecord
 * @author Terry Wilkinson <terry.wilkinson@finterra.org> && Tonyia Sundaram <toniya.sundaram#finterra.org>
 * @dev The GTXRecord contract is used for current FIN point holders
 * to convert and record a portion of thier held points to GTX tokens which will be
 * claimable after the GALLACTIC sale. This contract in particular is for onboarding and
 * storing the resulting GTX amount records.
 * These records will be used as reference during the claiming period of the GALLACTIC sale.
 */

contract GTXRecord is Ownable {
    using SafeMath for uint256;

    // conversionRate is the multiplier to calculate the number of GTX claimable per FIN Point converted
    // e.g., 100 = 1:1 conversion ratio
    uint256 public conversionRate;

    // a flag for locking record changes, lockRecords is only settable by the owner
    bool public lockRecords;

    // Maximum amount of recorded GTX able to be stored on this contract
    uint256 public maxRecords;

    // Total number of claimable GTX converted from FIN Points
    uint256 public totalClaimableGTX;

    // an address map used to store the per account claimable GTX
    // as a result of converted FIN Points
    mapping (address => uint256) public claimableGTX;

    event GTXRecordCreate(
        address indexed _recordAddress,
        uint256 _finPointAmount,
        uint256 _gtxAmount
    );

    event GTXRecordUpdate(
        address indexed _recordAddress,
        uint256 _finPointAmount,
        uint256 _gtxAmount
    );

    event GTXRecordMove(
        address indexed _oldAddress,
        address indexed _newAddress,
        uint256 _gtxAmount
    );

    event LockRecords();

    /**
     * Throws if conversionRate is not set or if the lockRecords flag has been set to true
    */
    modifier canRecord() {
        require(conversionRate > 0);
        require(!lockRecords);
        _;
    }

    /**
     * @dev GTXRecord constructor
     * @param _maxRecords is the maximum numer of GTX records this contract can store (used for sanity checks on GTX ERC20 totalsupply)
    */
    constructor (uint256 _maxRecords) public {
        maxRecords = _maxRecords;
    }

    /**
     * @dev sets the GTX Conversion rate
     * @param _conversionRate is the rate applied during FIN Point to GTX conversion
    */
    function setConversionRate(uint256 _conversionRate) external onlyOwner{
        require(_conversionRate <= 1000); // maximum 10x conversion rate
        require(_conversionRate > 0); // minimum .01x conversion rate
        conversionRate = _conversionRate;
    }

   /**
    * @dev Function to lock record changes on this contracts
    * @return True if the operation was successful.
    */
    function lock() public onlyOwner returns (bool) {
        lockRecords = true;
        emit LockRecords();
        return true;
    }

    /**
    * @dev Used to calculate and store the amount of claimable GTX for those exsisting FIN point holders
    * who opt to convert FIN points for GTX
    * @param _recordAddress - the registered address where GTX can be claimed from
    * @param _finPointAmount - the amount of FINs to be converted for GTX, this param should always be entered as base units
    * i.e., 1 FIN = 10**18 base units
    * @param _applyConversionRate - flag to apply conversion rate or not, any Finterra Technologies company GTX conversion allocations
    * are strictly covnerted at one to one and do not recive the conversion bonus applied to FIN point user balances
    */
    function recordCreate(address _recordAddress, uint256 _finPointAmount, bool _applyConversionRate) public onlyOwner canRecord {
        require(_finPointAmount >= 100000, "cannot be less than 100000 FIN (in WEI)"); // minimum allowed FIN 0.000000000001 (in base units) to avoid large rounding errors
        uint256 afterConversionGTX;
        if(_applyConversionRate == true) {
            afterConversionGTX = _finPointAmount.mul(conversionRate).div(100);
        } else {
            afterConversionGTX = _finPointAmount;
        }
        claimableGTX[_recordAddress] = claimableGTX[_recordAddress].add(afterConversionGTX);
        totalClaimableGTX = totalClaimableGTX.add(afterConversionGTX);
        require(totalClaimableGTX <= maxRecords, "total token record (contverted GTX) cannot exceed GTXRecord token limit");
        emit GTXRecordCreate(_recordAddress, _finPointAmount, claimableGTX[_recordAddress]);
    }

    /**
    * @dev Used to calculate and update the amount of claimable GTX for those exsisting FIN point holders
    * who opt to convert FIN points for GTX
    * @param _recordAddress - the registered address where GTX can be claimed from
    * @param _finPointAmount - the amount of FINs to be converted for GTX, this param should always be entered as base units
    * i.e., 1 FIN = 10**18 base units
    * @param _applyConversionRate - flag to apply conversion rate or do one for one conversion, any Finterra Technologies company FIN point allocations
    * are strictly converted at one to one and do not recive the cnversion bonus applied to FIN point user balances
    */
    function recordUpdate(address _recordAddress, uint256 _finPointAmount, bool _applyConversionRate) public onlyOwner canRecord {
        require(_finPointAmount >= 100000, "cannot be less than 100000 FIN (in WEI)"); // minimum allowed FIN 0.000000000001 (in base units) to avoid large rounding errors
        uint256 afterConversionGTX;
        totalClaimableGTX = totalClaimableGTX.sub(claimableGTX[_recordAddress]);
        if(_applyConversionRate == true) {
            afterConversionGTX  = _finPointAmount.mul(conversionRate).div(100);
        } else {
            afterConversionGTX  = _finPointAmount;
        }
        claimableGTX[_recordAddress] = afterConversionGTX;
        totalClaimableGTX = totalClaimableGTX.add(claimableGTX[_recordAddress]);
        require(totalClaimableGTX <= maxRecords, "total token record (contverted GTX) cannot exceed GTXRecord token limit");
        emit GTXRecordUpdate(_recordAddress, _finPointAmount, claimableGTX[_recordAddress]);
    }

    /**
    * @dev Used to move GTX records from one address to another, primarily in case a user has lost access to their originally registered account
    * @param _oldAddress - the original registered address
    * @param _newAddress - the new registerd address
    */
    function recordMove(address _oldAddress, address _newAddress) public onlyOwner canRecord {
        require(claimableGTX[_oldAddress] != 0, "cannot move a zero record");
        require(claimableGTX[_newAddress] == 0, "destination must not already have a claimable record");

        claimableGTX[_newAddress] = claimableGTX[_oldAddress];
        claimableGTX[_oldAddress] = 0;

        emit GTXRecordMove(_oldAddress, _newAddress, claimableGTX[_newAddress]);
    }

}