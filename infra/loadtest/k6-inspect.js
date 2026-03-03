import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 200,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<2500"]
  }
};

const API = __ENV.API_BASE || "http://localhost:8080";

export default function () {
  const payload = JSON.stringify({ url: "https://www.tiktok.com/@example/video/1234567890" });
  const params = { headers: { "Content-Type": "application/json" } };
  const res = http.post(`${API}/v1/link/inspect`, payload, params);
  check(res, {
    "status is 200 or 400": (r) => r.status === 200 || r.status === 400
  });
  sleep(0.2);
}
