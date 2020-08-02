import 'babel-polyfill';
import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import Config from './config.json';
import Web3 from 'web3';
import express from 'express';


let config = Config['localhost'];
let web3 = new Web3(new Web3.providers.WebsocketProvider(config.url.replace('http', 'ws')));
web3.eth.defaultAccount = web3.eth.accounts[0];
let flightSuretyApp = new web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
let oracles = new Map();

const TEST_ORACLES_COUNT = 20;

const STATUS_CODE_UNKNOWN = 0;
const STATUS_CODE_ON_TIME = 10;
const STATUS_CODE_LATE_AIRLINE = 20;
const STATUS_CODE_LATE_WEATHER = 30;
const STATUS_CODE_LATE_TECHNICAL = 40;
const STATUS_CODE_LATE_OTHER = 50;

(async function(){
  try {
    let fee = await flightSuretyApp.methods.REGISTRATION_FEE().call();
    console.log(fee)
    let accounts = await web3.eth.getAccounts();
    console.log(accounts.length)
    // ACT
    for(let a=1; a<TEST_ORACLES_COUNT; a++) {  
      await flightSuretyApp.methods.registerOracle().send({ from: accounts[a], value: fee, gas: 6000000 });
      let result = await flightSuretyApp.methods.getMyIndexes().call({from: accounts[a]});
      console.log(`Oracle Registered: ${result[0]}, ${result[1]}, ${result[2]}`);
      oracles.set(`${accounts[a]}`, result);
    }
    console.log(oracles);

  } catch (e) {
    console.log(e);
  }
})();

function generateRandomStatusCode() {
  let n = Math.random() * 6 * 10; 
  if (n >= 50) return STATUS_CODE_LATE_OTHER;
  else if (n >= 40) return STATUS_CODE_LATE_TECHNICAL;
  else if (n >= 30) return STATUS_CODE_LATE_WEATHER;
  else if (n >= 20) return STATUS_CODE_LATE_AIRLINE;
  else if (n >= 10) return STATUS_CODE_ON_TIME;
  else if (n >= 0) return STATUS_CODE_UNKNOWN;
}

flightSuretyApp.events.OracleRequest({
    // fromBlock: 0
  }, function (error, result) {
    if (error) {
     console.log(error);
    } else {
      console.log(result);
      let curIndex = result.returnValues.index;
      for (let [key, value] of oracles.entries()) {
        let res;
        if (value.includes[curIndex]) {
          res = generateRandomStatusCode();
          flightSuretyApp.methods.submitOracleResponse(
            curIndex, 
            result.returnValues.airline, 
            result.returnValues.flight, 
            result.returnValues.timestamp,
            statusCode
          ).send({from: key});
          console.log('Sent status code' + statusCode);
        }
      }
    }
});



const app = express();
app.get('/api', (req, res) => {
    res.send({
      message: 'An API for use with your Dapp!'
    })
})

export default app;


