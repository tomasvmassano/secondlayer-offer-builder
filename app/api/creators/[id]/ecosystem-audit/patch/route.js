import { NextResponse } from 'next/server';
import { getCreator, updateCreator } from '../../../../../lib/creators';
import { VALID_TIERS } from '../../../../../lib/schemas/ecosystemAudit';

// ─────────────────────────────────────────────────────────────────
// PATCH /api/creators/[id]/ecosystem-audit/patch
//
// Operator-facing manual override for the Phase 1 ecosystem audit. The
// audit is LLM-generated and occasionally:
//   - misses products (stan.store with many items, custom-domain communities)
//   - hallucinates wrong-creator results (a "Mariah Coz" community when
//     pitching "Mariah Brunner" — same first name, different creator)
//   - misclassifies tiers (low vs mid)
//   - misses prices (sets price_eur to null when there IS a public price)
//
// Rather than forcing a full re-run (slow, expensive, may produce different
// failures), let the operator FIX the audit data directly. The wizard
// reads from the same fields, so an accurate audit produces an accurate
// offer.
//
// Body shape — partial update; only the keys present overwrite:
//   {
//     products_found?: Array<Product>,
//     existing_communities?: Array<Community>,
//     community_cannibalization_risk?: 'high'|'medium'|'low'|'none',
//   }
//
// We re-derive has_high_ticket / has_mid_ticket / has_recurring from the
// products array on every PATCH so the flags stay consistent.
// ─────────────────────────────────────────────────────────────────

const VALID_RISKS = ['high', 'medium', 'low', 'none'];

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const creator = await getCreator(id);
    if (!creator) return NextResponse.json({ error: 'Creator not found' }, { status: 404 });

    const offer = creator.offer || {};
    const meta = offer.internal_metadata || {};
    const audit = meta.ecosystem_audit || {};
    const ecosystemMap = audit.ecosystem_map || {};

    // Validate + normalise products_found
    let nextProducts = ecosystemMap.products_found || [];
    if (Array.isArray(body.products_found)) {
      // Lightweight validation — operator is the source of truth, but we
      // still reject malformed entries that would crash the wizard.
      const errors = [];
      body.products_found.forEach((p, i) => {
        if (!p || typeof p !== 'object') { errors.push(`products_found[${i}]: must be an object`); return; }
        if (typeof p.name !== 'string' || !p.name.trim()) errors.push(`products_found[${i}].name: required non-empty string`);
        if (p.tier && !VALID_TIERS.includes(p.tier)) errors.push(`products_found[${i}].tier: must be one of ${VALID_TIERS.join('|')}`);
        if (p.price_eur != null && (typeof p.price_eur !== 'number' || !Number.isFinite(p.price_eur))) errors.push(`products_found[${i}].price_eur: must be number or null`);
      });
      if (errors.length > 0) return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
      nextProducts = body.products_found.map(p => ({
        name: p.name?.trim() || '',
        price_eur: p.price_eur ?? null,
        format: p.format?.trim() || 'other',
        tier: p.tier || 'low_ticket',
        url: p.url?.trim() || '',
        transformation_offered: p.transformation_offered?.trim() || '',
      }));
    }

    // Validate + normalise existing_communities
    let nextCommunities = ecosystemMap.existing_communities || [];
    if (Array.isArray(body.existing_communities)) {
      const errors = [];
      body.existing_communities.forEach((c, i) => {
        if (!c || typeof c !== 'object') { errors.push(`existing_communities[${i}]: must be an object`); return; }
        if (typeof c.name !== 'string' || !c.name.trim()) errors.push(`existing_communities[${i}].name: required non-empty string`);
        if (c.tier && !VALID_TIERS.includes(c.tier)) errors.push(`existing_communities[${i}].tier: must be one of ${VALID_TIERS.join('|')}`);
        if (c.price_eur != null && (typeof c.price_eur !== 'number' || !Number.isFinite(c.price_eur))) errors.push(`existing_communities[${i}].price_eur: must be number or null`);
      });
      if (errors.length > 0) return NextResponse.json({ error: 'Validation failed', errors }, { status: 400 });
      nextCommunities = body.existing_communities.map(c => ({
        name: c.name?.trim() || '',
        price_eur: c.price_eur ?? null,
        tier: c.tier || 'recurring',
        format: c.format?.trim() || 'community',
        url: c.url?.trim() || '',
      }));
    }

    // Recompute booleans from the (possibly updated) products list. Keeps
    // the audit shape internally consistent regardless of what the operator
    // edited.
    const tierSet = new Set(nextProducts.map(p => p.tier));
    const has_high_ticket = tierSet.has('high_ticket');
    const has_mid_ticket = tierSet.has('mid_ticket');
    const has_recurring = tierSet.has('recurring') || nextCommunities.length > 0;

    // Community cannibalization risk — accept operator override, otherwise
    // re-derive: if there's at least one existing community, default to
    // 'high' unless the operator says otherwise.
    let nextRisk = ecosystemMap.community_cannibalization_risk || 'none';
    if (body.community_cannibalization_risk && VALID_RISKS.includes(body.community_cannibalization_risk)) {
      nextRisk = body.community_cannibalization_risk;
    } else if (Array.isArray(body.existing_communities)) {
      // Operator just edited communities — re-derive based on the new list
      nextRisk = nextCommunities.length > 0 ? 'high' : 'none';
    }

    const updatedAudit = {
      ...audit,
      ecosystem_map: {
        ...ecosystemMap,
        products_found: nextProducts,
        existing_communities: nextCommunities,
        community_cannibalization_risk: nextRisk,
        has_high_ticket,
        has_mid_ticket,
        has_recurring,
      },
    };

    await updateCreator(id, {
      offer: {
        ...offer,
        internal_metadata: {
          ...meta,
          ecosystem_audit: updatedAudit,
          generation_timestamps: {
            ...(meta.generation_timestamps || {}),
            ecosystem_audit_manual_edit: new Date().toISOString(),
          },
        },
      },
    });

    return NextResponse.json({ ok: true, ecosystem_audit: updatedAudit });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Patch failed' }, { status: 500 });
  }
}
