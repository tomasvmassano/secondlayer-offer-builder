import { NextResponse } from 'next/server';
import { getCreator, updateCreator, deleteCreator } from '../../../lib/creators';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const creator = await getCreator(id);
    if (!creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    return NextResponse.json(creator);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const updated = await updateCreator(id, body);
    if (!updated) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const deleted = await deleteCreator(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
