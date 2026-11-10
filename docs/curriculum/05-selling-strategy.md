# 05. Selling strategy: getting the first paying customers for IntakeAgent and the first paid work for the platform

Selling is different from marketing. Marketing creates awareness at scale; selling is a conversation with one buyer who has a problem and a budget. Start selling before the product is perfect. Buyers forgive missing features; they do not forgive silence.

## Who to sell to first

Pick the narrowest buyer you can describe in one sentence, because narrow buyers are easy to find and easy to understand.

- Healthcare: independent clinics and DME (durable medical equipment) suppliers in the US with 1 to 5 locations, who take intake by phone and paper. Why them: no IT department to block you, the owner decides, and the pain is daily.
- Legal: personal injury and immigration firms with 2 to 10 lawyers. Why them: high volume of intakes, high value per client, and they already pay for intake tools like Clio Grow, so the budget exists.
- Gulf: private clinics and law firms in Dubai, Abu Dhabi, Riyadh and Jeddah that serve Arabic and Urdu speaking clients. Why them: Arabic voice intake barely exists, and you can run demos in the buyer's language.

## The offer

Sell a pilot, not a subscription. "Four weeks, one location, we set it up together, you pay 300 USD (or the local equivalent), and at the end you keep the records and decide." A pilot is easy to say yes to, gives you reference customers, and reveals what the product actually needs.

Pilot deliverables: configured intake for their specialty, a review screen their front desk uses, weekly 30-minute call, a one-page report at the end with time saved and records produced.

## Finding buyers with zero budget

1. LinkedIn Sales Navigator free trial for one month: search practice managers and office managers at clinics in one US state, and firm administrators at small law firms. Send 10 connection requests a day with a one-line note about intake.
2. Google Maps: list 50 clinics in one city, find the owner's name on the website, email them. Response rates are low, 2 to 5 percent, so volume matters.
3. Pakistani and Gulf diaspora networks: doctors and lawyers from Karachi now practising in the US, UK, UAE and KSA. A warm introduction converts ten times better than a cold email. Ask your community.
4. Existing relationships: your former employers served US healthcare clients. Ask for an introduction to one practice manager, not for a sale.

## The outreach message

Keep it under 60 words and about them, not you:

"Hi [name], I noticed [clinic] handles new patient intake by phone. I built a voice intake agent that asks the follow-up questions a coordinator would and writes the record straight into a FHIR-compatible format, with your staff approving every record. Would a 15-minute demo this week be useful? Here is a 3-minute video: [link]."

## Running the demo call

Fifteen minutes. First five: ask how intake works today, how long it takes, what goes wrong. Next seven: demo on their scenario using the words they just used. Last three: propose the pilot and ask for a date. Never demo first; you will demo the wrong thing.

## Pricing after the pilot

- Healthcare: 300 to 600 USD per month per location, annual contract after the pilot, 20 percent discount for annual prepay.
- Legal: 400 to 1,200 USD per month per firm, based on intakes per month.
- Gulf: price in local currency, invoice through a UAE free zone company or a payment processor that supports Pakistan; sort this out before the first yes so you do not lose the deal on paperwork.

Anchor on the cost of the human time you save. If intake takes 20 minutes of a coordinator's day per patient and they see 30 new patients a month, that is 10 hours of staff time; at 25 USD per hour that is 250 USD per month of direct savings before counting cleaner records and fewer callbacks.

## Selling the platform and your time

AgentMesh and OpenInfer sell as services, not subscriptions, in year one. The pitch to a company: "You want agents in production without lock-in. I built the open platform; I will deploy and adapt it for you." Price your time at 60 to 120 USD per hour for US and UK clients, 50 to 90 for the Gulf. Fixed-price packages convert better than hourly: "Agent platform foundation, 4 weeks, 8,000 USD" for example.

Find these clients where they complain: GitHub issues on LangGraph and vLLM about deployment, LinkedIn posts from CTOs saying agents are hard to productionise, and the job boards themselves. Every job posting for an agent platform engineer is also a company that might hire a contractor.

## The objections you will hear, and the answers

- "Is it HIPAA compliant?" Software is not certified HIPAA compliant; organisations are. Explain the technical safeguards you implement (see each repo's compliance doc), offer a Business Associate Agreement template, and keep PHI on local inference.
- "What if the AI gets it wrong?" A human approves every record, and every field shows the transcript evidence it came from. Nothing enters their system unreviewed.
- "You are one person." Yes, and the code is open source, so they are never dependent on you. Show them the repo, the tests and the CI.
- "We already use Clio or an EHR." Good; IntakeAgent writes into those, it does not replace them.

## Weekly selling routine

Monday: 20 outreach messages. Wednesday: follow up on last week's. Friday: review responses, book demos, update the spreadsheet. Two hours a week is enough to start; selling is a habit, not an event.
