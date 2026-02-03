#!/usr/bin/env node
/**
 * CallScope CLI - Fetch and process calls from CallRail
 * 
 * Usage:
 *   node index.mjs fetch --api-key=XXX --account-id=YYY
 *   node index.mjs download --api-key=XXX --account-id=YYY --output=./recordings
 *   node index.mjs analyze --input=./calls.json --output=./analysis.json
 */

import fs from 'fs';
import path from 'path';

const API_BASE = 'https://api.callrail.com/v3';

// Parse command line arguments
function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value || true;
    } else if (!args._command) {
      args._command = arg;
    }
  });
  return args;
}

// Fetch calls from CallRail
async function fetchCalls(apiKey, accountId, options = {}) {
  const { startDate, endDate, perPage = 250 } = options;
  let allCalls = [];
  let page = 1;
  let hasMore = true;

  console.log('📞 Fetching calls from CallRail...');

  while (hasMore) {
    const params = new URLSearchParams({
      per_page: perPage.toString(),
      page: page.toString(),
      fields: 'id,direction,duration,start_time,answered,voicemail,customer_phone_number,customer_city,customer_state,customer_name,recording,recording_player,tracking_phone_number,source_name'
    });

    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);

    const url = `${API_BASE}/a/${accountId}/calls.json?${params}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Token token=${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`CallRail API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.calls || data.calls.length === 0) {
        hasMore = false;
      } else {
        allCalls = allCalls.concat(data.calls);
        console.log(`  Page ${page}: ${data.calls.length} calls (total: ${allCalls.length})`);
        
        if (data.calls.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      console.error('Error fetching calls:', error.message);
      hasMore = false;
    }
  }

  console.log(`✅ Fetched ${allCalls.length} calls`);
  return allCalls;
}

// Download recordings for calls
async function downloadRecordings(calls, apiKey, outputDir) {
  const withRecording = calls.filter(c => c.recording);
  console.log(`🎙️ Downloading ${withRecording.length} recordings to ${outputDir}...`);
  
  fs.mkdirSync(outputDir, { recursive: true });
  
  let downloaded = 0;
  let failed = 0;

  for (const call of withRecording) {
    const filename = `${call.id}.mp3`;
    const filepath = path.join(outputDir, filename);
    
    // Skip if already exists
    if (fs.existsSync(filepath)) {
      downloaded++;
      continue;
    }

    try {
      // Get recording URL with auth
      const recordingUrl = `${call.recording}.json`;
      const response = await fetch(recordingUrl, {
        headers: { 'Authorization': `Token token=${apiKey}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      if (data.url) {
        // Download the actual audio file
        const audioResponse = await fetch(data.url);
        if (audioResponse.ok) {
          const buffer = Buffer.from(await audioResponse.arrayBuffer());
          fs.writeFileSync(filepath, buffer);
          downloaded++;
          process.stdout.write(`\r  Downloaded: ${downloaded}/${withRecording.length}`);
        }
      }
    } catch (error) {
      failed++;
    }
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n✅ Downloaded ${downloaded} recordings (${failed} failed)`);
  return downloaded;
}

// Transform calls to analysis format
function transformCalls(calls) {
  return calls.map(call => ({
    id: call.id,
    direction: call.direction,
    duration: call.duration,
    start_time: call.start_time,
    customer_phone: call.customer_phone_number,
    customer_name: call.customer_name,
    customer_city: call.customer_city,
    customer_state: call.customer_state,
    answered: call.answered,
    voicemail: call.voicemail,
    has_recording: !!call.recording,
    recording_url: call.recording_player,
    source: call.source_name,
    tracking_number: call.tracking_phone_number
  }));
}

// Main CLI handler
async function main() {
  const args = parseArgs();
  const command = args._command;

  if (!command || args.help) {
    console.log(`
CallScope CLI - Fetch and process calls from CallRail

Usage:
  node index.mjs fetch --api-key=XXX --account-id=YYY [--start-date=YYYY-MM-DD] [--end-date=YYYY-MM-DD] [--output=calls.json]
  node index.mjs download --api-key=XXX --account-id=YYY --input=calls.json --output=./recordings
  node index.mjs stats --input=calls.json

Options:
  --api-key      CallRail API key (required)
  --account-id   CallRail account ID (required)
  --start-date   Filter calls from this date
  --end-date     Filter calls to this date
  --input        Input JSON file
  --output       Output file/directory
  --help         Show this help
`);
    return;
  }

  if (command === 'fetch') {
    if (!args['api-key'] || !args['account-id']) {
      console.error('Error: --api-key and --account-id are required');
      process.exit(1);
    }

    const calls = await fetchCalls(args['api-key'], args['account-id'], {
      startDate: args['start-date'],
      endDate: args['end-date']
    });

    const transformed = transformCalls(calls);
    const output = args.output || 'calls.json';
    
    fs.writeFileSync(output, JSON.stringify(transformed, null, 2));
    console.log(`📁 Saved to ${output}`);
    
    // Print summary
    const inbound = transformed.filter(c => c.direction === 'inbound');
    const withRecording = transformed.filter(c => c.has_recording);
    console.log(`
Summary:
  Total calls: ${transformed.length}
  Inbound: ${inbound.length}
  Outbound: ${transformed.length - inbound.length}
  With recording: ${withRecording.length}
  Answered: ${transformed.filter(c => c.answered).length}
  Voicemail: ${transformed.filter(c => c.voicemail).length}
`);
  }

  else if (command === 'download') {
    if (!args['api-key'] || !args.input) {
      console.error('Error: --api-key and --input are required');
      process.exit(1);
    }

    const calls = JSON.parse(fs.readFileSync(args.input, 'utf-8'));
    const outputDir = args.output || './recordings';
    
    // Need to fetch full call details to get recording URLs
    console.log('Note: Download requires re-fetching call details for recording URLs');
    // This would need to be implemented with full recording URL fetching
  }

  else if (command === 'stats') {
    if (!args.input) {
      console.error('Error: --input is required');
      process.exit(1);
    }

    const calls = JSON.parse(fs.readFileSync(args.input, 'utf-8'));
    
    const stats = {
      total: calls.length,
      inbound: calls.filter(c => c.direction === 'inbound').length,
      outbound: calls.filter(c => c.direction === 'outbound').length,
      answered: calls.filter(c => c.answered).length,
      voicemail: calls.filter(c => c.voicemail).length,
      with_recording: calls.filter(c => c.has_recording).length,
      by_city: {}
    };

    // Count by city
    calls.forEach(c => {
      if (c.customer_city) {
        stats.by_city[c.customer_city] = (stats.by_city[c.customer_city] || 0) + 1;
      }
    });

    console.log('Call Statistics:');
    console.log(JSON.stringify(stats, null, 2));
  }

  else {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }
}

main().catch(console.error);
