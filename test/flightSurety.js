
var Test = require('../config/testConfig.js');
var BigNumber = require('bignumber.js');

contract('Flight Surety Tests', async (accounts) => {

  var config;
  before('setup contract', async () => {
    config = await Test.Config(accounts);
    await config.flightSuretyData.authorizeCaller(config.flightSuretyApp.address);
  });
  

  /****************************************************************************************/
  /* Operations and Settings                                                              */
  /****************************************************************************************/

  it(`(multiparty) has correct initial isOperational() value`, async function () {
    // Get operating status
    let status = await config.flightSuretyData.isOperational.call();
    assert.equal(status, true, "Incorrect initial operating status value");

  });

  it(`(multiparty) can block access to setOperatingStatus() for non-Contract Owner account`, async function () {

      // Ensure that access is denied for non-Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false, { from: config.testAddresses[2] });
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, true, "Access not restricted to Contract Owner");  
  });

  it(`(multiparty) can allow access to setOperatingStatus() for Contract Owner account`, async function () {

      // Ensure that access is allowed for Contract Owner account
      let accessDenied = false;
      try 
      {
          await config.flightSuretyData.setOperatingStatus(false);
      }
      catch(e) {
          accessDenied = true;
      }
      assert.equal(accessDenied, false, "Access not restricted to Contract Owner");
      
  });

  it(`(multiparty) can block access to functions using requireIsOperational when operating status is false`, async function () {

      await config.flightSuretyData.setOperatingStatus(false);

      let reverted = false;
      try 
      {
          await config.flightSurety.setTestingMode(true);
      }
      catch(e) {
          reverted = true;
      }
      assert.equal(reverted, true, "Access not blocked for requireIsOperational");      

      // Set it back for other tests to work
      await config.flightSuretyData.setOperatingStatus(true);

  });

  it('(airline) cannot register an Airline using registerAirline() if it is not funded', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];
    let reverted = false;
    // ACT
    try {
        await config.flightSuretyApp.registerAirline(newAirline, 'Saga II', {from: config.firstAirline});
    }
    catch(e) {
        reverted = true
    }
    // ASSERT
    assert.equal(reverted, true, "Airline should not be able to register another airline if it hasn't provided funding");
  });


  it ('successfully funded an airline', async () => {
    let amount = web3.utils.toWei("11", "ether");

    await config.flightSuretyData.fund({from: config.firstAirline, value: amount});
    let funded = await config.flightSuretyData.isFunded(config.firstAirline);
    
    assert.equal(funded, true, "Airline is funded when funds exceeds minimun.")
  });

 
  it('Only existing airline may register a new airline until there are at least four airlines registered', async () => {
    
    // ARRANGE
    let newAirline = accounts[2];
    let success = false;
    let votes = 0;

    let amount = web3.utils.toWei("11", "ether");
    await config.flightSuretyData.fund({from: config.firstAirline, value: amount});
    // ACT
    try {
        let result = await config.flightSuretyApp.registerAirline.call(newAirline, 'Saga II', {from: config.firstAirline});
        await config.flightSuretyApp.registerAirline(newAirline, 'Saga II', {from: config.firstAirline});
        success = result[0];
        votes = result[1].toNumber();
        console.log(success, votes)
    }
    catch(e) {
        console.log(e);
        reverted = true
    }

    // let minAirlinesRequired = await config.flightSuretyApp.minAirlinesRequired();
    let registered = await config.flightSuretyData.isRegisteredAirline.call(newAirline);
    // ASSERT
    assert.equal(registered, true, "Airline not registered");
    assert.equal(success, true, "Airline should not be able to register another airline if it hasn't provided funding");
    assert.equal(votes, 0, "No votes is needed")
  });


  it('Registration of fifth and subsequent airlines requires multi-party consensus of 50% of registered airlines', async () => {
    
    // ARRANGE
    let airline2 = accounts[2];
    let airline3 = accounts[3];
    let airline4 = accounts[4];
    let airline5 = accounts[5];

    let amount = web3.utils.toWei("11", "ether");
    await config.flightSuretyData.fund({from: config.firstAirline, value: amount});

    await config.flightSuretyApp.registerAirline(airline3, '3', {from: config.firstAirline});
    await config.flightSuretyApp.registerAirline(airline4, '4', {from: config.firstAirline});

    await config.flightSuretyData.fund({from: airline2, value: amount});
    await config.flightSuretyData.fund({from: airline3, value: amount});
    await config.flightSuretyData.fund({from: airline4, value: amount});

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(airline5, '5', {from: config.firstAirline});
    }
    catch(e) {
        console.log(e);
    }

    let registered = await config.flightSuretyData.isRegisteredAirline.call(airline5);
    // ASSERT
    assert.equal(registered, false, "Need more than half of the airlines to reach consensus");


    try {
        await config.flightSuretyApp.registerAirline(airline5, '5', {from: airline2});
    }
    catch(e) {
        console.log(e);
    }

    registered = await config.flightSuretyData.isRegisteredAirline.call(airline5);
   
    let numOfAirlines = await config.flightSuretyData.numOfAirlines.call();
    // ASSERT
    assert.equal(registered, true, "Need more than half of the airlines to reach consensus");
    assert.equal(numOfAirlines, 5, "5 airlines should be registered")

  });

  it('Airline can be registered, but does not participate in contract until it submits funding of 10 ether', async () => {
    
    // ARRANGE
    let airline5 = accounts[5];
    let airline6 = accounts[6];
    let revert = false;

    // ACT
    try {
        await config.flightSuretyApp.registerAirline(airline6, '6', {from: airline5});
    }
    catch(e) {
        console.log(e);
        revert = true
    }
    let registered = await config.flightSuretyData.isRegisteredAirline.call(airline5);

    assert.equal(registered, true, "Airline is not registered");
    assert.equal(revert, true, "Airline must be funded to participate in contract");
  });
});
