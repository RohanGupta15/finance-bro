// Usage: pnpm parser:try "<sms text>" [--sender VM-HDFCBK-S]
import { normalise } from '../normalise';
import { classify } from '../classify';
import { parseSms } from '../parse';

const args = process.argv.slice(2);
const senderFlag = args.indexOf('--sender');
const sender = senderFlag >= 0 ? (args.splice(senderFlag, 2)[1] ?? 'UNKNOWN') : 'UNKNOWN';
const body = args.join(' ');

if (!body) {
  console.error('Usage: pnpm parser:try "<sms text>" [--sender VM-HDFCBK-S]');
  process.exit(1);
}

const raw = { sender, body, receivedAt: Date.now() };
const sms = normalise(raw);
console.log(JSON.stringify({ sender: sms.senderInfo, text: sms.text, classification: classify(sms), result: parseSms(raw) }, null, 2));
