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
import "./GTXToken.sol";

/**
 * @title GTXMigrate
 * @author Terry Wilkinson <terry.wilkinson@finterra.org>
 * @dev The GTXMigrate contract is used for storing records of ERC-20 GTX
 * token holders to migrate their held GTX ERC-20 tokens to GTX Network Tokens.
 * These records will be used as reference for claiming GTX Network Tokens on
 * the Gallactic network.
 */

contract GTXERC20Migrate is Ownable {
    using SafeMath for uint256;

    // Address map used to store the per account claimable GTX Network Tokens
    // as per the user's GTX ERC20 on the Ethereum Network

    mapping (address => uint256) public migratableGTX;

    GTXToken public ERC20;

    constructor(GTXToken _ERC20) public {
        ERC20 = _ERC20;
    }

    // Note: _totalMigratableGTX is a running total of GTX, migratable in this contract,
    // but does not represent the actual amount of GTX migrated to the Gallactic network
    event GTXRecordUpdate(
        address indexed _recordAddress,
        uint256 _totalMigratableGTX
    );

    /**
    * @dev Used to calculate and store the amount of GTX ERC20 token balances to be migrated to the Gallactic network
    * i.e., 1 GTX = 10**18 base units
    * @param _balanceToMigrate - the requested balance to reserve for migration (in most cases this should be the account's total balance)
    * primarily included as a parameter for simple validation on the Gallactic side of the migration
    */
    function initiateGTXMigration(uint256 _balanceToMigrate) public {
        uint256 migratable = ERC20.migrateTransfer(msg.sender,_balanceToMigrate);
        migratableGTX[msg.sender] = migratableGTX[msg.sender].add(migratable);
        emit GTXRecordUpdate(msg.sender, migratableGTX[msg.sender]);
    }

}
