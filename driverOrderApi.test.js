const axios = require('axios');

const url = 'http://localhost:51544';

const STATUS = {
  OK: 200,
  CREATED: 201,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
};

const locations = {
  valid: [
    {
      lat: 22.344674,
      lng: 114.124651,
    },
    {
      lat: 22.375384,
      lng: 114.182446,
    },
  ],
  invalid: [{ lat: 23.49069256622041, lng: 120.45595775037833 }], // Taiwan
};

describe('ping', () => {
  const endpoint = '/ping';

  it('returns pong', async () => {
    expect.assertions(2);
    const res = await axios.get(url + endpoint);
    const expectedResponse = {
      msg: 'pong',
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(STATUS.OK);
  });
});

describe('create order', () => {
  const endpoint = '/v1/orders';

  it('creates order - schema', async () => {
    expect.assertions(2);
    const body = {
      stops: [locations.valid[0], locations.valid[1]],
    };
    const res = await axios.post(url + endpoint, body);
    const expectedResponse = {
      id: expect.any(Number),
      drivingDistancesInMeters: expect.arrayContaining([expect.any(Number)]),
      fare: {
        amount: expect.stringMatching(/^\d+\.\d+$/),
        currency: expect.stringMatching(/^[A-Z]{3}$/),
      },
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(STATUS.CREATED);
  });

  it('creates order - 2 stops', async () => {});
  it('creates order - 3 stops', async () => {});
  it('schedules advanced order - 2 stops', async () => {});
  it('schedules advanced order - 3 stops', async () => {});
  it('gets correct driving distance', async () => {});
  it('gets correct currency', async () => {});
  it('calculates correct price - day', async () => {});
  it('calculates correct price - night', async () => {});
  it('cannot create order - distant location', async () => {});
  it('cannot create order - missing body', async () => {});
  it('cannot create order - invalid body', async () => {});
});
