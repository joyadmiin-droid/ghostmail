import express from "express";

const app = express();

// Mailgun sends form-data → we must parse it
app.use(express.urlencoded({ extended: true }));

// Simple in-memory inbox (for testing)
const inbox = [];

// 📥 Mailgun webhook endpoint
app.post("/mailgun-webhook", (req, res) => {
  const email = {
    to: req.body.recipient,
    from: req.body.sender,
    subject: req.body.subject,
    text: req.body["body-plain"],
    date: new Date().toISOString(),
  };

  console.log("📩 New Email:", email);

  inbox.unshift(email); // add to inbox

  res.status(200).send("OK");
});

// 📬 Get inbox (for your website)
app.get("/inbox", (req, res) => {
  res.json(inbox);
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});