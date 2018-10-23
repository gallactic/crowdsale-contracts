## Gallactic crowdsale contracts
Collection of smart contracts for the gallactic crowdsale follows a Dutch Auction model similar to Gnosis and Raiden projects.

#### Prerequisite
Nodejs v8+

#### Installation
1. Install truffle
```
npm i truffle
```
2. Install all dependencies
```
npm i
```
4. Install ganache cli or GUI at https://truffleframework.com/docs/ganache/quickstart
```
npm install -g ganache-cli
```

3. Compile, deploy and test smart contracts
```
truffle compile
truffle migrate
truffle test
```
These commands apply to the RPC provider running on port 8545. You may want to have Ganache running in the background.

### Solidity Dependencies

For standard smart contracts like Ownable, SafeMath we use OpenZeppelin's library for secure implementation.

[![NPM Version][npm-image]][npm-url]

### License
All smart contracts are released under [MIT](LICENSE).

[npm-image]: https://img.shields.io/npm/v/openzeppelin-solidity.svg
[npm-url]: https://www.npmjs.com/package/openzeppelin-solidity