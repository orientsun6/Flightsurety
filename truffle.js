var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "leg plunge sister achieve lava winner vessel talk unknown wear rocket jungle";
module.exports = {
  networks: {
    development: {
      network_id: '*',
      provider: function() {
        return new HDWalletProvider(mnemonic, "http://127.0.0.1:9545/", 0, 50);
      },
    }
  },
  compilers: {
    solc: {
      version: "^0.4.24"
    }
  }
};