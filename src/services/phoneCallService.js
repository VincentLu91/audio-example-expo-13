export async function startPhoneCall({ phoneNumber, filename }) {
  const cleanedPhoneNumber = phoneNumber?.trim();
  const cleanedFilename = filename?.trim();

  if (!cleanedPhoneNumber) {
    throw new Error("Phone number is required.");
  }

  console.log("Placeholder startPhoneCall called:", {
    phoneNumber: cleanedPhoneNumber,
    filename: cleanedFilename,
  });

  // Temporary fake delay.
  // Later this function will call your Next.js API,
  // and the Next.js API will trigger Twilio.
  await new Promise((resolve) => setTimeout(resolve, 800));

  return {
    success: true,
    callSessionId: "placeholder-call-session-id",
    providerCallId: "placeholder-twilio-call-id",
    status: "call_start_requested",
    phoneNumber: cleanedPhoneNumber,
    filename: cleanedFilename || null,
    startedAt: new Date().toISOString(),
  };
}
