import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      refId,
      title,
      category,
      severity,
      city,
      description,
      letterDraft,
      complaintDraft,
      reporterName,
      reporterEmail,
      recipientEmail
    } = body;

    const finalLetter = complaintDraft || letterDraft;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("Resend API Key is missing.");
      return NextResponse.json(
        { error: 'RESEND_API_KEY environment variable is not configured on the server.' },
        { status: 500 }
      );
    }

    // Resolve test recipient safeguard or production recipient
    const testRecipient = process.env.NEXT_PUBLIC_TEST_RECIPIENT;
    const toEmail = testRecipient || recipientEmail;

    if (!toEmail || toEmail.includes("Feature not available")) {
      return NextResponse.json(
        { error: 'No valid recipient email address could be resolved for this report.' },
        { status: 400 }
      );
    }

    // Construct a clean HTML email containing ONLY the main letter
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Community Hero Escalation Letter</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 20px;
            background-color: #ffffff;
            line-height: 1.6;
          }
          .letter-content {
            font-size: 14px;
            white-space: pre-wrap;
            color: #1e293b;
            max-width: 600px;
            margin: 0 auto;
          }
        </style>
      </head>
      <body>
        <div class="letter-content">${finalLetter}</div>
      </body>
      </html>
    `;

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Community Hero <onboarding@resend.dev>';
    const subject = `[Community Hero #${refId || 'CIVIC'}] Verified Issue Escalation: ${category} (${city || 'Local Area'})`;

    const resendPayload = {
      from: fromEmail,
      to: [toEmail],
      subject: subject,
      reply_to: `${reporterName} <${reporterEmail}>`,
      html: htmlContent
    };

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resendPayload)
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend API failed: ", resendData);
      return NextResponse.json(
        { error: resendData.message || 'Failed to dispatch email via Resend API gateway.' },
        { status: resendResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: resendData.id,
      recipient: toEmail
    });

  } catch (error) {
    console.error("Internal mail API error: ", error);
    return NextResponse.json(
      { error: 'Internal Server Error during email dispatch execution.' },
      { status: 500 }
    );
  }
}
