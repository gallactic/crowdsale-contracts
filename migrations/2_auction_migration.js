var SafeMath = artifacts.require("./SafeMath.sol");
var GTXRecord = artifacts.require("./GTXRecord.sol");
var GTXPresale = artifacts.require("./GTXPresale.sol");
var GTXToken = artifacts.require("./GTXToken.sol");
var GTXMigrate = artifacts.require("./GTXERC20Migrate.sol");
var GTXAuction = artifacts.require("./GTXAuction.sol");
var TimeLock = artifacts.require("./TimeLock.sol");


const WEI = 1000000000000000000; // Conversion of ETHER to WEI
const MAXRECORDTOKENS = 10000000 * WEI; ; //Maximum tokens record tokens
const TOTAL_SUPPLY = 1000000000 * WEI; // 1 Billion Total GTX Token Supply
const NAME = "GALLACTIC"; // Token Name GALLACTIC
const SYMBOL = "GTX"; // Token Symbol GTX
const DECIMALS = 18; // 18 Decimal Points Precision
const MAX_TOKENS = 400000000 * WEI; // 400 Million GTX Tokens for Auction
const BIDDING_PERIOD = 345600; // 60 Days
const AUDIT_WAIT_PERIOD = 80640; // 14 Days
const RECORD_TOKENS = 4000000 *WEI

module.exports = function(deployer) {
  // Deploy SafeMath Library
  deployer.deploy(SafeMath);

  // Link SafeMath library to Contracts
  deployer.link(SafeMath, GTXRecord);
  deployer.link(SafeMath, GTXToken);
  deployer.link(SafeMath, GTXMigrate);
  deployer.link(SafeMath, GTXAuction);

  // Deploy GTX Swap Contract
  deployer
    .deploy(GTXRecord,MAXRECORDTOKENS)
    .then(function(gtxRecord) {
      deployer.deploy(GTXPresale).then(function(gtxPresale) {
        // Deploy GTX ERC-20 Token Contract
        deployer
          .deploy(
            GTXToken,
            TOTAL_SUPPLY,
            gtxRecord.address,
            gtxPresale.address,
            NAME,
            SYMBOL,
            DECIMALS
          )
          .then(function(gtxToken) {
            // Deploy TimeLock Contract
            deployer.deploy(TimeLock, gtxToken.address);

            // Deploy GTX Migration Contract
            deployer
              .deploy(GTXMigrate, gtxToken.address)
              .then(function() {
                // Deploy GTX Auction Contract
                deployer
                  .deploy(
                    GTXAuction,
                    gtxToken.address,
                    gtxRecord.address,
                    gtxPresale.address,
                    BIDDING_PERIOD,
                    AUDIT_WAIT_PERIOD
                  )
                  .then(function() {})
                  .catch(ex => {
                    console.log(ex);
                  });
              })
              .catch(ex => {
                console.log(ex);
              });
          })
          .catch(ex => {
            console.log(ex);
          });
      });
    })
    .catch(ex => {
      console.log(ex);
    });
};
