pragma solidity ^0.4.25;

import "../node_modules/openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FlightSuretyData {
    using SafeMath for uint256;

    /********************************************************************************************/
    /*                                       DATA VARIABLES                                     */
    /********************************************************************************************/

    address private contractOwner; // Account used to deploy contract
    bool private operational = true; // Blocks all state changes throughout the contract if false
    uint256 private counter = 1;

    uint256 public numOfAirlines = 0;
    uint256 public minFunds = 10 ether;
    uint256 public insuranceLimit = 1 ether;
    uint256 public payoutPecentage = 150;

    mapping(address => Airline) private airlines;
    mapping(bytes32 => mapping (address => FlightInsurance)) private insurances;
    mapping(address => uint256) payoutLedger;
    mapping(address => bool) private authorizedCallers;

    struct Airline {
        address id;
        string name;
        bool registered;
        uint256 funds;
    }

    struct FlightInsurance {
        address insuree;
        address airline;
        string flightNumber;
        uint256 departureTime;
        uint256 amount;
    }

    /********************************************************************************************/
    /*                                       EVENT DEFINITIONS                                  */
    /********************************************************************************************/

    event AirlineRegistered(address airLineAddress, string airlineName);
    event AirlineFunded(address airLineAddress, string airlineName, uint amount);
    event InsurancePurchased(address passenger, address airLineAddress, string airlineName, uint amount);
    event InsureeCredited(address passenger);
    event InsureePaid(address passenger, uint256 payout);
    /**
     * @dev Constructor
     *      The deploying account becomes contractOwner
     */
    constructor(address airLineAddress, string memory airlineName) public {
        contractOwner = msg.sender;
        _register(airLineAddress, airlineName);
    }

    /********************************************************************************************/
    /*                                       FUNCTION MODIFIERS                                 */
    /********************************************************************************************/

    // Modifiers help avoid duplication of code. They are typically used to validate something
    // before a function is allowed to be executed.

    /**
     * @dev Modifier that requires the "operational" boolean variable to be "true"
     *      This is used on all state changing functions to pause the contract in
     *      the event there is an issue that needs to be fixed
     */
    modifier requireIsOperational() {
        require(operational, "Contract is currently not operational");
        _; // All modifiers require an "_" which indicates where the function body will be added
    }

    /**
     * @dev Modifier that requires the "ContractOwner" account to be the function caller
     */
    modifier requireContractOwner() {
        require(msg.sender == contractOwner, "Caller is not contract owner");
        _;
    }

     modifier requireIsCallerAuthorized() {
        require(authorizedCallers[msg.sender] == true, "Caller is not contract owner");
        _;
    }

    modifier entrancyGuard() {
        counter = counter.add(1);
        uint256 guard = counter;
        _;
        require(guard == counter, 'This is not allowed');
    }

    /********************************************************************************************/
    /*                                       UTILITY FUNCTIONS                                  */
    /********************************************************************************************/

    /**
     * @dev Get operating status of contract
     *
     * @return A bool that is the current operating status
     */

    function isOperational() public view returns (bool) {
        return operational;
    }

    /**
     * @dev Sets contract operations on/off
     *
     * When operational mode is disabled, all write transactions except for this one will fail
     */

    function setOperatingStatus(bool mode) external requireContractOwner {
        operational = mode;
    }

    function authorizeCaller(address contractAddress) external requireContractOwner {
        authorizedCallers[contractAddress] = true;
    }

    function deauthorzieCaller(address contractAddress) external requireContractOwner {
        delete authorizedCallers[contractAddress];
    }

    function setMinFunds(uint256 amount) public requireContractOwner requireIsOperational {
        minFunds = amount;
    }

    function setInsuranceLimit(uint256 amount) public requireContractOwner requireIsOperational {
        insuranceLimit = amount;
    }

    function setPayoutPecentage(uint256 percentage) public requireContractOwner requireIsOperational {
        payoutPecentage = percentage;
    }

    function isInsured(address passenger, bytes32 flightKey) public view returns(bool) {
        return insurances[flightKey][passenger].insuree == passenger;
    }

    /********************************************************************************************/
    /*                                     SMART CONTRACT FUNCTIONS                             */
    /********************************************************************************************/

    /**
     * @dev Add an airline to the registration queue
     *      Can only be called from FlightSuretyApp contract
     *
     */

    function registerAirline(address airLineAddress, string airlineName) external requireIsOperational {
        _register(airLineAddress, airlineName);
    }

    /**
     * @dev Buy insurance for a flight
     *
     */

    function buy(address passenger, address airline, string flightNumber, uint256 departureTime) external payable requireIsOperational {
        require(isRegisteredAirline(airline), 'You are not a registered airline!');
        require(msg.value < insuranceLimit && msg.value > 0, 'Value must be greater than 0 and less than the insurance limit!');

        bytes32 flightKey = getFlightKey(airline, flightNumber, departureTime);
        require(isInsured(passenger, flightKey) == false,
            'You can only insure once for this flight');

        insurances[flightKey][passenger] = FlightInsurance({
            insuree: passenger,
            airline: airline,
            flightNumber: flightNumber,
            departureTime: departureTime,
            amount: msg.value
        });
        emit InsurancePurchased(passenger, airline, flightNumber, msg.value);
    }

    /**
     *  @dev Credits payouts to insurees
     */
    function creditInsurees(address passenger, address airline, string flightNumber, uint256 departureTime)
        external requireIsOperational entrancyGuard {
        require(isRegisteredAirline(airline), 'You are not a registered airline!');
        bytes32 flightKey = getFlightKey(airline, flightNumber, departureTime);
        require(isInsured(passenger, flightKey) == true,
            'Passenger not insured once for this flight');
        uint256 credit = insurances[flightKey][passenger].amount.mul(payoutPecentage).div(100);
        airlines[airline].funds = airlines[airline].funds.sub(credit);
        payoutLedger[passenger] = payoutLedger[passenger].add(credit);
        delete insurances[flightKey][passenger];
        emit InsureeCredited(passenger);
    }

    /**
     *  @dev Transfers eligible payout funds to insuree
     *
     */
    function pay(address insuree) external requireIsOperational entrancyGuard {
        require(payoutLedger[insuree] > 0, 'No funds to payout');
        uint256 payout = payoutLedger[insuree];
        payoutLedger[insuree] = 0;
        insuree.transfer(payout);
        emit InsureePaid(insuree, payout);
    }

    /**
     * @dev Initial funding for the insurance. Unless there are too many delayed flights
     *      resulting in insurance payouts, the contract should be self-sustaining
     *
     */

    function fund() public payable requireIsOperational{
        require(isRegisteredAirline(msg.sender), 'You are not a registered airline!');
        require(msg.value > 0, 'You must send money.');
        _fundAirline(msg.sender, msg.value);
    }

    function getFlightKey(
        address airline,
        string memory flight,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(airline, flight, timestamp));
    }

    function isRegisteredAirline(address account) public view returns(bool) {
        return airlines[account].registered == true;
    }

    function isFunded(address account) public view returns(bool) {
        return airlines[account].funds > minFunds;
    }

    function _register(address airLineAddress, string airlineName) internal requireIsOperational {
        numOfAirlines = numOfAirlines.add(1);
        airlines[airLineAddress] = Airline({
            id: airLineAddress,
            name: airlineName,
            registered: true,
            funds: 0
        });
        emit AirlineRegistered(airLineAddress, airlineName);
    }

    function _fundAirline(address airLineAddress, uint256 amount) internal requireIsOperational entrancyGuard {
        airlines[airLineAddress].funds = airlines[airLineAddress].funds.add(amount);
        emit AirlineFunded(airLineAddress, airlines[airLineAddress].name, amount);
    }


    /**
     * @dev Fallback function for funding smart contract.
     *
     */
    function() external payable {
        require(msg.data.length == 0, "Message data msut be empty!");
        require(isRegisteredAirline(msg.sender), "You must be a registered airline");
        fund();
    }
}
