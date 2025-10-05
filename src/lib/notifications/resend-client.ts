import {
  type CreateEmailOptions,
  type CreateEmailResponse,
  Resend,
} from "resend";

import { env } from "@/env";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    client = new Resend(env.RESEND_API_KEY);
  }
  return client;
}

export async function sendWithResend(
  options: CreateEmailOptions,
): Promise<CreateEmailResponse> {
  const resend = getClient();
  const response = await resend.emails.send(options);

  if (response.error) {
    const message = response.error.message || "Failed to send email";
    const error = new Error(message);
    error.name = response.error.name;
    throw error;
  }

  return response;
}
