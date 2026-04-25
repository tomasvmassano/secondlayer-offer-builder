import { NextResponse } from 'next/server';
import { getAutopilotEnabled, setAutopilotEnabled } from '../../../lib/discovery';

export async function GET() {
  try {
    const enabled = await getAutopilotEnabled();
    return NextResponse.json({ enabled });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { enabled } = body;
    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled (boolean) required' }, { status: 400 });
    }
    const newValue = await setAutopilotEnabled(enabled);
    return NextResponse.json({ enabled: newValue });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
