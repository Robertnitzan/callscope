# CallScope 📊

AI-powered call analysis for businesses.

**Website:** https://callscope.vercel.app  
**Demo Dashboard:** https://rhino-call-analyzer.vercel.app

## What is CallScope?

CallScope analyzes your phone calls and shows you:
- 📵 **How much spam** you're receiving
- 💰 **Real customer calls** vs noise
- 🚨 **Missed opportunities** (customer voicemails)
- 📈 **Trends and insights** over time

## Quick Start

### 1. Fetch Calls from CallRail

```bash
node cli/index.mjs fetch \
  --api-key=YOUR_CALLRAIL_API_KEY \
  --account-id=YOUR_ACCOUNT_ID \
  --output=calls.json
```

### 2. View Stats

```bash
node cli/index.mjs stats --input=calls.json
```

### 3. Full Analysis

For full analysis with transcription and classification, use the [call-analysis-workflow](https://github.com/Robertnitzan/call-analysis-workflow) skill.

## CLI Commands

### `fetch`
Fetch calls from CallRail API.

```bash
node cli/index.mjs fetch \
  --api-key=XXX \
  --account-id=YYY \
  --start-date=2026-01-01 \
  --end-date=2026-01-31 \
  --output=calls.json
```

### `stats`
Show statistics for fetched calls.

```bash
node cli/index.mjs stats --input=calls.json
```

## Integration

CallScope works with:
- **CallRail** ✅ (supported)
- RingCentral (coming soon)
- Twilio (coming soon)
- Vonage (coming soon)

## How It Works

1. **Connect** - Link your CallRail account
2. **Fetch** - Download call metadata and recordings
3. **Transcribe** - AI converts recordings to text (via AssemblyAI)
4. **Classify** - Each call is categorized: Customer, Spam, Operations
5. **Dashboard** - See everything in an actionable interface

## Example Output

```
Summary:
  Total calls: 415
  Inbound: 333
  Outbound: 82
  With recording: 249
  Answered: 309
  Voicemail: 38
```

## License

MIT
