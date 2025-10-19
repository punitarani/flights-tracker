import { stripHtml } from "../formatters";

export type RenderEmailOptions = {
  subject: string;
  previewText?: string;
  html: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export function renderEmail(options: RenderEmailOptions): RenderedEmail {
  const { subject, html } = options;
  const text = stripHtml(html);
  return { subject, html, text };
}
