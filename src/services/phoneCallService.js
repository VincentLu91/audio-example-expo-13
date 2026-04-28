const NEXT_API_BASE_URL = "https://next-firebase-login-email.vercel.app";

async function readJsonResponse(response) {
  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    console.log("Phone API error response:", {
      status: response.status,
      data,
      text,
    });

    const serverError = data?.error || data?.message || data || text;

    const message =
      typeof serverError === "string"
        ? serverError
        : JSON.stringify(serverError);

    throw new Error(message || "Request failed.");
  }

  return data;
}

export async function startPhoneCall({ phoneNumber, customerId }) {
  if (!phoneNumber) {
    throw new Error("Phone number is required.");
  }

  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const url =
    `${NEXT_API_BASE_URL}/api/dialTwilio` +
    `?to=${encodeURIComponent(phoneNumber)}` +
    `&customer_id=${encodeURIComponent(customerId)}`;

  const response = await fetch(url);

  const data = await readJsonResponse(response);

  return {
    success: true,
    callSessionId: data.callSID,
    providerCallId: data.callSID,
    status: "call_start_requested",
    phoneNumber,
    customerId,
    startedAt: new Date().toISOString(),
    raw: data,
  };
}

export async function deductCallCreditAfterCompletedCall({ customerId }) {
  if (!customerId) {
    throw new Error("Customer ID is required.");
  }

  const url =
    `${NEXT_API_BASE_URL}/api/calls-token` +
    `?user=${encodeURIComponent(customerId)}`;

  const response = await fetch(url);
  const data = await readJsonResponse(response);

  return {
    success: true,
    callsAvailable: data?.data?.[0]?.num_calls ?? null,
    raw: data,
  };
}
