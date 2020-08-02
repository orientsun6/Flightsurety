import FlightSuretyApp from '../../build/contracts/FlightSuretyApp.json';
import FlightSuretyData from '../../build/contracts/FlightSuretyData.json';
import Config from './config.json';
import Web3 from 'web3';

export default class Contract {
    constructor(network, callback) {
        let config = Config[network];
        this.web3 = new Web3(new Web3.providers.HttpProvider(config.url));
        this.flightSuretyApp = new this.web3.eth.Contract(FlightSuretyApp.abi, config.appAddress);
        this.flightSuretyData = new this.web3.eth.Contract(FlightSuretyData.abi, config.dataAddress);
        this.owner = null;
        this.airlines = [];
        this.passengers = [];
        this.flights = [
        {
            name: 'AZ100',
            departureTime:  Math.trunc(new Date().getTime() +3*3600 / 1000)
        }, 
        {
            name: 'AZ200',
            departureTime:  Math.trunc(new Date().getTime() +5*3600 / 1000)
        }];

        for (let i = 0; i < this.flights.length; i++ ) {
            let option = document.createElement('option');
            option.text = this.flights[i].name;
            document.querySelector('#flightsDropdown').add(option);
        }

        this.initialize(callback);
        
    }

     initialize(callback) {
        this.web3.eth.getAccounts((error, accts) => {
           
            this.owner = accts[0];
            console.log(accts);
            let counter = 1;
            
            while(this.airlines.length < 5) {
                this.airlines.push(accts[counter++]);
            }

            while(this.passengers.length < 5) {
                this.passengers.push(accts[counter++]);
            }
            
            this.setup();
          
            callback();
        });
    }

    isOperational(callback) {
       let self = this;
       self.flightSuretyApp.methods
            .isOperational()
            .call({ from: self.owner}, callback);
    }

    fetchFlightStatus(flight, callback) {
        let self = this;
        let payload = {
            airline: self.airlines[0],
            flight: flight,
            timestamp: Math.floor(Date.now() / 1000)
        } 
        self.flightSuretyApp.methods
            .fetchFlightStatus(payload.airline, payload.flight, payload.timestamp)
            .send({ from: self.owner}, (error, result) => {
                callback(error, payload);
            });
    }

    registerAirline(airline, name, callback) {
        let self = this;
        let payload = {
            airline: airline,
            name: name
        }
        console.log(payload)
        self.flightSuretyApp.methods.registerAirline(airline, name)
            .send({from: self.owner}, (error, result) => {
            console.log(error);
            callback(error, payload);
        });
    }

    setup() {
        let self = this;
        self.flightSuretyData.methods.registerAirline(self.airlines[0], 'Airline 1')
        .send({from: self.owner, gas: 6000000}, (error, result) => {
            console.log(error);
            self.fund(20, (error, result) => {
                console.log(error);
                self.registerFlights((error, result) => {
                    console.log(error);
                });
            });
        });
    }

    fund(value, callback) {
        let self = this;
        let amount = web3.toWei(value, 'ether');
        let payload = {
            airline: self.airlines[0],
            amount: amount
        }
        console.log(payload)
        self.flightSuretyData.methods.fund()
            .send({from: payload.airline, value: amount, gas: 6000000}, (error, result) => {
            callback(error, payload);
        });
    }

    registerFlights(callback) {
        let self = this;
        for (let i = 0; i < this.flights.length; i++ ) {
            self.flightSuretyApp.methods
            .registerFlight(this.flights[i].name, this.flights[i].departureTime)
            .send({from: this.airlines[0], gas: 6000000}, (error, result) => {
                console.log(error);
                callback(error, result);
            });
        }
    }



    buyInsurance(flight, value, callback) {
        let self = this;
        let flightInfo = this.flights.find(f => f.name == flight);
        let amount = web3.toWei(value, 'ether');

        let payload = {
            airline: self.airlines[0],
            flightNumber: flightInfo.name,
            departureTime: flightInfo.departureTime
        }

        self.flightSuretyData.methods.isRegisteredAirline(self.airlines[0]).call( (error, result) => {
            console.log(result);
        })

        console.log(payload);

        self.flightSuretyApp.methods
        .buyInsurance(payload.airline, payload.flightNumber, payload.departureTime)
        .send({from: self.passengers[0], value: amount, gas: 6000000}, (error, result) => {
            console.log(error);
            callback(error, payload);
        });

    }
}