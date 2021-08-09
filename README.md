# driver-orders-api-tests

A set of API tests for a driver order and transport service.

### Setup

Clone the repository and from the directory run `npm install`  
Create a .env file and update according to the template  
To run the tests, use `npm run test`  
Jest options can be added after `--`, e.g. to run only 'ping' tests use `npm run test -- -t=ping`

### Assumptions

- orderAt time passed in as ISO string is used as local time, not UTC time
- fare is calculated per meter for distances over 2 km
- fare is rounded down for any incomplete meter

### Improvements

Ideally, tests should not have dependencies on other APIs.  
Currently, some tests require other API calls to setup the test, e.g. to create an order with status='cancelled'.  
Rather than creating test records via API calls, they could instead be created directly in the database, to allow only the specific API call under test to be called during the test.
