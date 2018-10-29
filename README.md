## Gallactic crowdsale contracts

Collection of smart contracts for the gallactic crowdsale follows a Dutch Auction model similar to Gnosis and Raiden projects.

#### Prerequisite

Nodejs v8+

#### Installation

1. Install truffle

```
npm i truffle -g
```

Node: If your truffle version is less then v4.1.14, you need to manually [update solidity to v0.4.25.](https://www.google.com)

```
cd /usr/local/lib/node_modules/truffle
npm install solc@0.4.25
```

2. Install all dependencies

```
npm i
```

3. Install [ganache-cli or GUI](https://truffleframework.com/docs/ganache/quickstart)

```
npm install -g ganache-cli
```

You should have Ganache running in the background

```
ganache-cli -e 5000000 -a 20
```

4. Compile, deploy and test smart contracts

```
truffle compile
truffle migrate
truffle test
```

These commands apply to the RPC provider running on port 8545.

### Solidity Dependencies

For standard smart contracts like Ownable, SafeMath we use OpenZeppelin's library for secure implementation.

[![NPM Version][npm-image]][npm-url]

### License

All smart contracts are released under [MIT](LICENSE).

[npm-image]: https://img.shields.io/npm/v/openzeppelin-solidity.svg
[npm-url]: https://www.npmjs.com/package/openzeppelin-solidity
