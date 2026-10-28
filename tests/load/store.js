import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://frontend:3000').replace(/\/$/, '');
const isProductionSmoke = __ENV.K6_PROFILE === 'production';

export const options = {
  scenarios: {
    store_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: isProductionSmoke
        ? [
            { duration: '10s', target: 1 },
            { duration: '20s', target: 2 },
            { duration: '10s', target: 0 },
          ]
        : [
            { duration: '20s', target: 1 },
            { duration: '30s', target: 3 },
            { duration: '30s', target: 5 },
            { duration: '15s', target: 0 },
          ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000'],
    checks: ['rate>0.99'],
  },
  tags: {
    testid: __ENV.TEST_ID || 'nexo-store',
  },
};

export default function () {
  const response = http.get(`${baseUrl}/store`, {
    tags: { page: 'store' },
    timeout: '10s',
  });

  check(response, {
    'la tienda responde 200': (result) => result.status === 200,
    'la respuesta es HTML': (result) => result.headers['Content-Type']?.includes('text/html'),
  });

  sleep(1);
}
