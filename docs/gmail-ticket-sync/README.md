# team@ Gmail connection

This is a private, owner-run Google Apps Script bridge. It reads the team@luun.ca mailbox, imports recent sent/customer emails for existing real ticket customer addresses, and stores message IDs and Gmail thread IDs. It does not send, delete, mark read, or label mail. Inbox intake from Webflow remains unchanged. Instagram is not connected.

Setup under the team@luun.ca Google account:
1. Create a private Apps Script project called Luun Tickets Gmail Sync.
2. Paste Code.gs and enable/show appsscript.json in settings; paste the supplied manifest with Gmail read-only, external request and scheduled trigger permissions.
3. In Script Properties, enter BOT_TOKEN with the existing private Luun Grokbot key. Do not paste it into source code or a public URL. This key also has the existing bot's broader admin access; keep the project private and do not add collaborators.
4. Run connectLuunTickets and approve Google's explicit permissions. Confirm the account is team@luun.ca. No mail is read before authorization.
5. Confirm the minute trigger exists and a known conversation is visible in Tickets with Open in Gmail. The script refuses other mailbox accounts.

Import window: rolling 30 days, up to 20 customer addresses and 50 messages per customer page per run; additional pages continue on later runs. Polling is approximate once per minute; Apps Script scheduling/quotas can delay runs. Unknown customer addresses are skipped. Duplicate provider message IDs do not duplicate messages or change statuses. Each newest incoming message returns a ticket to New (Needs Tyson is preserved), and each newest outgoing team@ message sets Answered. Delayed historical messages do not overwrite newer conversation state. Gmail links require access to the correct mailbox.

Initial email matching chooses the newest active ticket for that customer, or newest closed ticket if none are active. Once linked, Gmail thread ID is preferred. For customers with multiple unrelated open tickets, review the initial link before relying on it. A ticket may have more than one conversation link; future replies use the stored message's thread ID.
