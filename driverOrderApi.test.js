require('dotenv').config();
const { expect } = require('@jest/globals');
const axios = require('axios');
const moment = require('moment');

const URL = process.env.API_URL;

const API_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  SERVICE_UNAVAILABLE: 503,
};

const ORDER_STATUS = {
  ASSIGNING: 'ASSIGNING',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const LOCATIONS = {
  VALID: [
    {
      lat: 22.344674,
      lng: 114.124651,
    },
    {
      lat: 22.375384,
      lng: 114.182446,
    },
    {
      lat: 22.385669,
      lng: 114.186962,
    },
  ],
  INVALID: [{ lat: 23.49069256622041, lng: 120.45595775037833 }], // Taiwan
};

const calculateFare = (distance, isNight = false) => {
  const baseFare = !isNight ? 20 : 30;
  let fare = baseFare;
  if (distance > 2000) {
    const extraDistance = distance - 2000;
    const chargePerMetre = !isNight ? 5 / 200 : 8 / 200;
    const extraCharge = Math.floor(extraDistance * chargePerMetre * 100) / 100;
    fare += extraCharge;
  }
  return fare.toFixed(2).toString();
};

const createAssigningOrder = async () => {
  const body = {
    stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
  };
  const res = await axios.post(URL + '/v1/orders', body);
  return res.data;
};
const createOngoingOrder = async (id) => {
  const res = await axios.put(`${URL}/v1/orders/${id}/take`);
  return res.data;
};
const createCompletedOrder = async (id) => {
  const res = await axios.put(`${URL}/v1/orders/${id}/complete`);
  return res.data;
};
const createCancelledOrder = async (id) => {
  const res = await axios.put(`${URL}/v1/orders/${id}/cancel`);
  return res.data;
};

describe('ping', () => {
  const endpoint = '/ping';

  it('returns pong', async () => {
    expect.assertions(2);
    const res = await axios.get(URL + endpoint);
    const expectedResponse = {
      msg: 'pong',
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.OK);
  });
});

describe('create order', () => {
  const endpoint = '/v1/orders';

  const distanceValidAB = 10605;
  let tomorrowAfternoon;
  let tonight;

  beforeAll(async () => {
    tomorrowAfternoon = moment()
      .utc()
      .add(1, 'day')
      .set('hour', 12)
      .toISOString();
    tonight = moment().utc().add(1, 'day').set('hour', 0).toISOString();
  });

  it('creates order - schema', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
    };
    const res = await axios.post(URL + endpoint, body);
    const expectedResponse = {
      id: expect.any(Number),
      drivingDistancesInMeters: expect.arrayContaining([expect.any(Number)]),
      fare: {
        amount: expect.stringMatching(/^\d+\.\d+$/),
        currency: expect.stringMatching(/^[A-Z]{3}$/),
      },
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('creates order - 2 stops', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
    };
    const res = await axios.post(URL + endpoint, body);
    expect(res.data.drivingDistancesInMeters).toHaveLength(1);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('creates order - 3 stops', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1], LOCATIONS.VALID[2]],
    };
    const res = await axios.post(URL + endpoint, body);
    expect(res.data.drivingDistancesInMeters).toHaveLength(2);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('schedules advanced order', async () => {
    expect.assertions(1);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
      orderAt: tomorrowAfternoon,
    };
    const res = await axios.post(URL + endpoint, body);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('gets correct driving distance', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
    };
    const res = await axios.post(URL + endpoint, body);
    const expectedDrivingDistance = [distanceValidAB];
    expect(res.data.drivingDistancesInMeters).toEqual(expectedDrivingDistance);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('gets correct currency', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
    };
    const res = await axios.post(URL + endpoint, body);
    const expectedCurrency = 'HKD';
    expect(res.data.fare.currency).toEqual(expectedCurrency);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('calculates correct price - day', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
      orderAt: tomorrowAfternoon,
    };
    const res = await axios.post(URL + endpoint, body);
    const distance = [distanceValidAB];
    const expectedFare = calculateFare(distance);
    expect(res.data.fare.amount).toEqual(expectedFare);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('calculates correct price - night', async () => {
    expect.assertions(2);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.VALID[1]],
      orderAt: tonight,
    };
    const res = await axios.post(URL + endpoint, body);
    const distance = [distanceValidAB];
    const expectedFare = calculateFare(distance, true);
    expect(res.data.fare.amount).toEqual(expectedFare);
    expect(res.status).toEqual(API_STATUS.CREATED);
  });

  it('cannot create order - distant location', async () => {
    expect.assertions(1);
    const body = {
      stops: [LOCATIONS.VALID[0], LOCATIONS.INVALID[0]],
    };
    await axios
      .post(URL + endpoint, body)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.SERVICE_UNAVAILABLE);
      });
  });

  it('cannot create order - missing body', async () => {
    expect.assertions(1);
    await axios
      .post(URL + endpoint, {})
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.BAD_REQUEST);
      });
  });

  it('cannot create order - invalid body', async () => {
    expect.assertions(1);
    const body = {
      stops: [],
    };
    await axios
      .post(URL + endpoint, body)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.BAD_REQUEST);
      });
  });
});

describe('fetch order', () => {
  const endpoint = '/v1/orders/';

  it('fetches order - schema', async () => {
    expect.assertions(2);
    const orderId = 1;
    const res = await axios.get(URL + endpoint + orderId);
    const expectedResponse = {
      id: expect.any(Number),
      stops: expect.arrayContaining([
        expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
        }),
      ]),
      drivingDistancesInMeters: expect.arrayContaining([expect.any(Number)]),
      fare: expect.objectContaining({
        amount: expect.stringMatching(/^\d+\.\d+$/),
        currency: expect.stringMatching(/^[A-Z]{3}$/),
      }),
      status: expect.any(String),
      createdTime: expect.any(String),
      orderDateTime: expect.any(String),
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.OK);
  });

  it('cannot fetch - order not found', async () => {
    expect.assertions(1);
    const orderId = 999999999999;
    await axios
      .get(URL + endpoint + orderId)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.NOT_FOUND);
      });
  });
});

describe('driver take order', () => {
  const endpoint1 = '/v1/orders/';
  const endpoint2 = '/take';

  it('takes assigning order - schema', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    const res = await axios.put(URL + endpoint1 + order.id + endpoint2);
    const expectedResponse = {
      id: expect.any(Number),
      status: ORDER_STATUS.ONGOING,
      ongoingTime: expect.any(String),
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.OK);
  });

  it('cannot take order - status ongoing', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    const ongoingOrder = await createOngoingOrder(order.id);
    expect(ongoingOrder.status).toBe(ORDER_STATUS.ONGOING);
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot take order - status completed', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    await createOngoingOrder(order.id);
    const completedOrder = await createCompletedOrder(order.id);
    expect(completedOrder.status).toBe(ORDER_STATUS.COMPLETED);
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot take order - status cancelled', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    const cancelledOrder = await createCancelledOrder(order.id);
    expect(cancelledOrder.status).toBe(ORDER_STATUS.CANCELLED);
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot take order - order not found', async () => {
    expect.assertions(1);
    const orderId = 999999999999;
    await axios
      .put(URL + endpoint1 + orderId + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.NOT_FOUND);
      });
  });
});

describe('driver complete order', () => {
  const endpoint1 = '/v1/orders/';
  const endpoint2 = '/complete';

  it('completes order - schema', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    await createOngoingOrder(order.id);
    const res = await axios.put(URL + endpoint1 + order.id + endpoint2);
    const expectedResponse = {
      id: expect.any(Number),
      status: ORDER_STATUS.COMPLETED,
      completedAt: expect.any(String),
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.OK);
  });

  it('cannot complete order - status assigning', async () => {
    expect.assertions(1);
    const order = await createAssigningOrder();
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot complete order - status completed', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    await createOngoingOrder(order.id);
    const completedOrder = await createCompletedOrder(order.id);
    expect(completedOrder.status).toBe(ORDER_STATUS.COMPLETED);
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot complete order - status cancelled', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    const cancelledOrder = await createCancelledOrder(order.id);
    expect(cancelledOrder.status).toBe(ORDER_STATUS.CANCELLED);
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot complete order - order not found', async () => {
    expect.assertions(1);
    const orderId = 999999999999;
    await axios
      .put(URL + endpoint1 + orderId + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.NOT_FOUND);
      });
  });
});

describe('cancel order', () => {
  const endpoint1 = '/v1/orders/';
  const endpoint2 = '/cancel';

  it('cancels order - status assigning ', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    const res = await axios.put(URL + endpoint1 + order.id + endpoint2);
    const expectedResponse = {
      id: expect.any(Number),
      status: ORDER_STATUS.CANCELLED,
      cancelledAt: expect.any(String),
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.OK);
  });

  it('cancels order - status ongoing ', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    await createOngoingOrder(order.id);
    const res = await axios.put(URL + endpoint1 + order.id + endpoint2);
    const expectedResponse = {
      id: expect.any(Number),
      status: ORDER_STATUS.CANCELLED,
      cancelledAt: expect.any(String),
    };
    expect(res.data).toEqual(expectedResponse);
    expect(res.status).toEqual(API_STATUS.OK);
  });

  it('cannot cancel order - status completed', async () => {
    expect.assertions(2);
    const order = await createAssigningOrder();
    await createOngoingOrder(order.id);
    const completedOrder = await createCompletedOrder(order.id);
    expect(completedOrder.status).toBe(ORDER_STATUS.COMPLETED);
    await axios
      .put(URL + endpoint1 + order.id + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.UNPROCESSABLE_ENTITY);
      });
  });

  it('cannot cancel order - order not found', async () => {
    expect.assertions(1);
    const orderId = 999999999999;
    await axios
      .put(URL + endpoint1 + orderId + endpoint2)
      .then(() => {})
      .catch((err) => {
        expect(err.response.status).toEqual(API_STATUS.NOT_FOUND);
      });
  });
});
