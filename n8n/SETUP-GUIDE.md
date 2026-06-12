# Setup Guide — Telegram → n8n → AI Prospecting (CRM)

This workflow lets you text a Telegram bot from your phone, answer 6 clarifying
questions, confirm with YES, and have n8n fire your CRM's AI Prospecting
workflow via webhook. Results come back to your phone as a Telegram message.

```
You (phone) ──▶ Telegram Bot ──▶ n8n Telegram Trigger
                                      │
                                Conversation Logic (asks 6 questions, one per reply)
                                      │
                                Ready to Fire? ──no──▶ Send next question to Telegram
                                      │ yes (you confirmed)
                                Send Launch Message ──▶ HTTP POST to CRM Webhook Trigger
                                                              │
                                CRM runs AI Prospecting, adds contacts
                                                              │
                                CRM POSTs results ──▶ n8n Results Webhook ──▶ Telegram summary
```

---

## Part 1 — Create the Telegram bot (5 min)

1. In Telegram, message **@BotFather**.
2. Send `/newbot`, pick a display name (e.g. *Prospecting Bot*) and a username
   (must end in `bot`, e.g. `MyProspectingXYZbot`).
3. BotFather replies with an **API token** like `7123456789:AAH...`. Copy it.
4. Open a chat with your new bot and press **Start** (bots can't message you first).

## Part 2 — Import the workflow into n8n (2 min)

1. In n8n, open your workflow → top-right **⋯ menu → Import from File**
   (or paste the JSON via **Import from Clipboard**).
2. Import `telegram-prospecting-workflow.json`. You'll see 9 nodes in two rows:
   the Telegram conversation flow on top, the results flow below.

## Part 3 — Add the Telegram credential (2 min)

1. Click the **Telegram Trigger** node → **Credential to connect with** →
   **Create new credential**.
2. Paste the BotFather token → Save.
3. Open each of the three **Telegram send** nodes (*Send Bot Reply*,
   *Send Launch Message*, *Send Results to Telegram*) and select that same
   credential.

## Part 4 — Point the HTTP node at your CRM (2 min)

1. In your CRM, create a **Workflow** with a **Webhook Trigger** (Inbound
   Webhook) as the first step and copy its URL.
2. In n8n, open **Call CRM Webhook** and replace
   `https://YOUR-CRM-WEBHOOK-URL-HERE` with that URL.

The JSON body n8n sends looks like this — map these fields in your CRM
workflow (most builders let you map inbound webhook fields to custom values):

```json
{
  "chat_id": "123456789",
  "requested_at": "2026-06-12T18:30:00.000Z",
  "targeting": "Roofing companies, owners, 5-50 employees, Texas",
  "goal": "Cold outreach for demo bookings",
  "tone": "Casual but professional",
  "volume": "50",
  "exclusions": "Existing clients, Houston metro",
  "channel": "Email"
}
```

> **Important:** keep `chat_id` flowing through your CRM workflow — it must be
> echoed back in the results callback (Part 5) so n8n knows which Telegram
> chat to reply to.

## Part 5 — Wire the results callback (5 min)

1. **Activate** the n8n workflow (toggle top-right). This is required — the
   conversation state only persists when the workflow is active.
2. Click the **CRM Results Webhook** node and copy its **Production URL**
   (ends in `/webhook/prospecting-results`).
3. At the END of your CRM prospecting workflow, add a **Custom Webhook /
   External Call** action that POSTs to that URL with this shape:

```json
{
  "chat_id": "{{inboundWebhook.chat_id}}",
  "count": 12,
  "prospects": [
    { "name": "Jane Doe", "title": "Owner", "company": "Doe Roofing" }
  ]
}
```

If your CRM can't easily build the prospect array, just send `chat_id` and
`count` — the Telegram summary still works.

## Part 6 — Test it 🚀

1. With the workflow **Active**, text your bot anything (or `/start`).
2. Answer the 6 questions one at a time:
   targeting → goal → tone → volume → exclusions → channel.
3. The bot shows a 📋 summary — reply **YES** to fire, **NO** to redo.
4. Watch the execution in n8n (**Executions** tab) and confirm the CRM
   workflow received the payload.
5. When the CRM calls back, you get the ✅ results message on your phone.

---

## Built-in behaviors & edge cases

| Situation | What happens |
|---|---|
| `/restart` (or "restart") at any point | Wipes answers, starts at question 1 |
| One-character / empty answer | Bot asks you to elaborate and repeats the question |
| Anything other than YES/NO at confirmation | Bot re-prompts for YES or NO |
| New message after firing | Starts a fresh session at question 1 |
| Multiple people use the bot | Sessions are tracked per chat ID, so they don't collide |

## Troubleshooting

- **Bot never replies** → workflow isn't Active, or the Telegram credential is
  missing on the send nodes. Only one n8n workflow can hold a bot's webhook at
  a time — if you tested the bot in another workflow, deactivate that one.
- **Questions repeat from #1 every message** → you're in *test* mode. Static
  data (conversation state) only persists on the **production** trigger, so
  activate the workflow and use it live rather than "Listen for test event".
- **CRM call fails** → open the failed execution, check the *Call CRM Webhook*
  node's error. Verify the URL and whether your CRM expects extra headers/auth
  (add them under the node's *Headers* options).
- **No results message** → confirm the CRM callback POSTs to the **production**
  webhook URL and includes `chat_id` as a string.

## Ideas for later

- Add an **AI Agent node** between trigger and logic for free-form natural
  conversation instead of a fixed question order (needs an LLM credential).
- Add a **Telegram "typing…" action** before each question for a natural feel.
- Swap the `volume` question for inline keyboard buttons (10 / 25 / 50 / 100).
