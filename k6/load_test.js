import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'https://crealowebpage-production.up.railway.app/';

// Configuración de escenarios
const scenarios = {
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '10s',
  },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 500 }, // Subir a 500 usuarios
      { duration: '1m', target: 500 },  // Mantener 500 usuarios concurrentes
      { duration: '30s', target: 0 },   // Bajar a 0 usuarios
    ],
  },
};

export const options = {
  // Seleccionar escenario basado en la variable de entorno, por defecto 'smoke'
  scenarios: {
    default: scenarios[__ENV.SCENARIO || 'smoke'],
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],    // Menos del 1% de errores
    http_req_duration: ['p(95)<1000'], // 95% de las peticiones en menos de 1000ms
  },
};

export default function () {
  const res = http.get(BASE_URL);
  
  check(res, {
    'status es 200': (r) => r.status === 200,
    'tiempo de respuesta < 1000ms': (r) => r.timings.duration < 1000,
  });

  // Simular que el usuario lee la página entre 1 y 3 segundos
  sleep(Math.random() * 2 + 1);
}
