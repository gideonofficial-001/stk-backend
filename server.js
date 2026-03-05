require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const { CONSUMER_KEY, CONSUMER_SECRET, PASSKEY, SHORTCODE } = process.env;
const baseUrl = 'https://sandbox.safaricom.co.ke';

/* =========================
   ACCESS TOKEN MIDDLEWARE
========================= */
async function getAccessToken(req, res, next) {
  try {
    const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');

    const response = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${auth}` },
      }
    );

    const data = await response.json();

    if (!data.access_token) {
      return res.status(400).json({ error: "Failed to generate access token" });
    }

    req.token = data.access_token;
    next();
  } catch (error) {
    console.error("Token Error:", error);
    res.status(500).json({ error: "Access token request failed" });
  }
}

/* =========================
   STK PUSH ENDPOINT
========================= */
app.post('/api/stkpush', getAccessToken, async (req, res) => {
  try {
    let { phone, amount } = req.body;

    if (!phone || !amount) {
      return res.status(400).json({ error: "Phone and amount are required" });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    // Format phone to 2547XXXXXXXX
    phone = phone.replace(/\s+/g, '');
    const formattedPhone = phone.startsWith('0')
      ? `254${phone.slice(1)}`
      : phone;

    // Generate timestamp YYYYMMDDHHmmss
    const now = new Date();
    const timestamp =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0') +
      String(now.getHours()).padStart(2, '0') +
      String(now.getMinutes()).padStart(2, '0') +
      String(now.getSeconds()).padStart(2, '0');

    const password = Buffer.from(
      `${SHORTCODE}${PASSKEY}${timestamp}`
    ).toString('base64');

    const payload = {
      BusinessShortCode: SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: SHORTCODE,
      PhoneNumber: formattedPhone,
      CallBackURL: `${process.env.BASE_URL}/api/callback`,
      AccountReference: "SleekTech",
      TransactionDesc: "Web Payment",
    };

    const response = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${req.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    res.status(200).json(data);

  } catch (error) {
    console.error("STK Push Error:", error);
    res.status(500).json({ error: "STK Push request failed" });
  }
});

/* =========================
   CALLBACK ENDPOINT
========================= */
app.post('/api/callback', (req, res) => {
  console.log("---- M-PESA CALLBACK RECEIVED ----");

  const callback = req.body.Body?.stkCallback;

  if (!callback) {
    return res.status(400).json({ error: "Invalid callback format" });
  }

  const { ResultCode, ResultDesc, CallbackMetadata } = callback;

  if (ResultCode === 0) {
    const metadata = CallbackMetadata?.Item || [];

    const receipt = metadata.find(i => i.Name === "MpesaReceiptNumber")?.Value;
    const amount = metadata.find(i => i.Name === "Amount")?.Value;
    const phone = metadata.find(i => i.Name === "PhoneNumber")?.Value;

    console.log("Payment Successful");
    console.log("Receipt:", receipt);
    console.log("Amount:", amount);
    console.log("Phone:", phone);

    // TODO: Save to database here
  } else {
    console.log("Payment Failed:", ResultDesc);
  }

  res.status(200).json({ message: "Callback received" });
});

/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
console.log("Safaricom response:", data);
