import { escapeHtml, stripHtml } from "../formatters";

type RenderEmailOptions = {
  title: string;
  previewText?: string;
  body: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function buildHtml({ title, previewText, body }: RenderEmailOptions): string {
  const escapedPreview = previewText ? escapeHtml(previewText) : "";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; background-color: #f4f6fb; color: #0f172a; }
      .wrapper { width: 100%; padding: 24px 0; }
      .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; box-shadow: 0 12px 36px rgba(15, 23, 42, 0.08); overflow: hidden; }
      .header { padding: 24px 28px; border-bottom: 1px solid #e2e8f0; background: linear-gradient(135deg, #eef2ff 0%, #fff 100%); }
      .header h1 { margin: 0; font-size: 20px; font-weight: 700; }
      .content { padding: 28px; line-height: 1.6; font-size: 15px; }
      .footer { padding: 24px 28px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; }
      .badge { display: inline-block; padding: 4px 10px; font-size: 12px; border-radius: 9999px; background: #eef2ff; color: #4338ca; margin-right: 6px; }
      .divider { height: 1px; background: #e2e8f0; margin: 24px 0; }
    </style>
  </head>
  <body>
    <div style="display:none;max-height:0;overflow:hidden">${escapedPreview}</div>
    <div class="wrapper">
      <div class="container">
        ${body}
        <div class="footer">
          You are receiving this update because you subscribed to flight alerts.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function renderEmail(
  subject: string,
  options: RenderEmailOptions,
): RenderedEmail {
  const html = buildHtml(options);
  const text = stripHtml(html);
  return { subject, html, text };
}
