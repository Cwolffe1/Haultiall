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

## Part 4 — GoHighLevel: receive the n8n payload (10 min)

> **Prerequisite:** Inbound Webhook is a *Premium Trigger*. Enable premium
> workflow actions first: **Agency view → Settings → Company → enable
> "Premium Triggers & Actions" (LC Premium)**. They're billed per execution
> (fractions of a cent).

1. In your **sub-account (location)**: **Automation → Workflows → + Create
   Workflow → Start from Scratch**.
2. **Add New Trigger → search "Inbound Webhook"** and select it. GHL generates
   a unique URL — copy it.
3. In n8n, open **Call CRM Webhook** and replace
   `https://YOUR-CRM-WEBHOOK-URL-HERE` with that URL.
4. **Map the fields:** with the GHL trigger panel open, run one pass through
   Telegram (answer the 6 questions, reply YES) so n8n POSTs a real sample.
   In GHL click **"Check for new requests"** — the payload appears and every
   field becomes a mappable reference. Save the trigger.
5. Downstream in the GHL workflow, reference the data as
   `{{inboundWebhookRequest.targeting}}`, `{{inboundWebhookRequest.volume}}`,
   `{{inboundWebhookRequest.chat_id}}`, etc.

The JSON body n8n sends:

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

> **Important:** keep `chat_id` flowing through the GHL workflow — it must be
> echoed back in the results callback (Part 5) so n8n knows which Telegram
> chat to reply to.

### ⚠️ Reality check: launching GHL's Prospecting tool

GHL's AI Prospecting tool lives at the **agency level** and has **no workflow
action or public API to launch a search programmatically**. So the Inbound
Webhook workflow can't literally "run" the Prospecting tool. Pick one of
these patterns for the middle step:

- **A. Human-in-the-loop (simplest):** the GHL workflow sends an *Internal
  Notification* (or SMS/email to you) containing the criteria. You run the
  Prospecting search manually; new prospects land as contacts and Part 5's
  callback workflow reports back to Telegram automatically.
- **B. Fully automated (recommended):** let **n8n do the lead sourcing**
  instead — add an Apollo / Google Maps / LinkedIn data node between
  *Ready to Fire?* and the GHL call, then create each lead in GHL using
  n8n's built-in **HighLevel node** (Contact → Create, tag `new prospect`).
  GHL workflows take over from the tag for outreach. This is the only path
  with zero manual steps.
- **C. AI Employee / Workflow AI:** if your plan includes GHL's AI actions,
  use the inbound criteria to drive whatever AI prospecting automation you've
  built in the location.

## Part 5 — GHL → n8n results callback (5 min)

1. **Activate** the n8n workflow (toggle top-right). This is required — the
   conversation state only persists when the workflow is active.
2. Click the **CRM Results Webhook** node and copy its **Production URL**
   (ends in `/webhook/prospecting-results`).
3. Create a **second GHL workflow** in the location:
   - **Trigger:** *Contact Tag Added* → tag `new prospect` (or the
     *Prospecting* trigger if your plan has it).
   - **Action:** **Custom Webhook** (Premium Action) → Method `POST` →
     URL = your n8n production URL. Under **Custom Data**, add:

   | Key | Value |
   |---|---|
   | `chat_id` | your Telegram chat ID (see note below) |
   | `count` | `1` |
   | `prospects` | leave out — or send name/company via `name`: `{{contact.name}}` |

   This fires once per new prospect, so you get a Telegram ping per contact.
   If you'd rather get one batch summary, put the Custom Webhook at the end
   of the Part 4 workflow instead, after a *Wait* step, sending
   `chat_id = {{inboundWebhookRequest.chat_id}}` and a `count` custom value.

> **chat_id note:** the tag-triggered workflow has no memory of your Telegram
> chat, so hard-code your own chat ID there (text your bot, look at any n8n
> execution — `message.chat.id` — and paste that number). If you're the only
> user, this is fine. The Part 4 workflow *does* know it via
> `{{inboundWebhookRequest.chat_id}}`.

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
- **Can't find "Inbound Webhook" / "Custom Webhook" in GHL** → Premium
  Triggers & Actions isn't enabled. Agency view → Settings → Company →
  enable LC Premium Triggers & Actions (rebilling toggle).
- **GHL "Check for new requests" shows nothing** → the sample POST must hit
  the trigger URL *after* the panel is open; re-run the Telegram flow and
  click it again.
- **No results message** → confirm the CRM callback POSTs to the **production**
  webhook URL and includes `chat_id` as a string.

## Ideas for later

- Add an **AI Agent node** between trigger and logic for free-form natural
  conversation instead of a fixed question order (needs an LLM credential).
- Add a **Telegram "typing…" action** before each question for a natural feel.
- Swap the `volume` question for inline keyboard buttons (10 / 25 / 50 / 100).
