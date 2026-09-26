import keycloak from "../auth/keycloak";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function notifySessionExpired() {
  window.dispatchEvent(new CustomEvent("auth:session-expired"));
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);

      if (keycloak.token) {
        headers.Authorization = `Bearer ${keycloak.token}`;
      }
    } catch (error) {
      console.error("Failed to refresh access token:", error);

      keycloak.clearToken();
      notifySessionExpired();

      throw new ApiError(
        "Your session has expired.",
        401
      );
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new ApiError(
      data?.title || "Request failed",
      response.status,
      data
    );

    if (response.status === 401) {
      keycloak.clearToken();
      notifySessionExpired();
    }

    throw error;
  }

  return data;
}

export function getCourts(params = "") {
  return request(`/courts${params}`);
}

export function getCourt(courtId) {
  return request(`/courts/${courtId}`);
}

export function getBookings(params = "") {
  return request(`/bookings${params}`);
}

export function getBooking(bookingId) {
  return request(`/bookings/${bookingId}`);
}

export function createBooking(body, idempotencyKey) {
  return request("/bookings", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
  });
}

export function cancelBooking(bookingId, body) {
  return request(`/bookings/${bookingId}/cancellation`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function retireCourt(courtId, body) {
  return request(`/courts/${courtId}/retirement`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}