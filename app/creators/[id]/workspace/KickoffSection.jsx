"use client";

const ONBOARDING_SECTIONS = [
  { title: "Brand Identity", fields: [
    { key: "logo", label: "Logo / brand name" },
    { key: "brandColors", label: "Brand colors" },
    { key: "voice", label: "Voice in 3 words" },
    { key: "antiTone", label: "Anti-tone" },
    { key: "inspirations", label: "Inspirations" },
  ]},
  { title: "Audience", fields: [
    { key: "topQuestions", label: "Top DM questions" },
    { key: "painPoints", label: "Pain points" },
    { key: "customerQuotes", label: "Customer quotes" },
    { key: "demographics", label: "Demographics" },
    { key: "antiPersona", label: "Anti-persona" },
    { key: "whyFollow", label: "Why they follow" },
    { key: "explicitAsks", label: "Explicit asks" },
  ]},
  { title: "Existing Business", fields: [
    { key: "revenueStreams", label: "Revenue streams" },
    { key: "emailList", label: "Email list" },
    { key: "pastProducts", label: "Past products" },
    { key: "platforms", label: "Existing platforms" },
    { key: "team", label: "Existing team" },
    { key: "brandDeals", label: "Brand deals" },
  ]},
  { title: "Goals + Life", fields: [
    { key: "revenueTarget", label: "Revenue target (€/mo MRR)" },
    { key: "memberTarget", label: "Member target" },
    { key: "launchDate", label: "Launch date" },
    { key: "hoursPerWeek", label: "Hours/week" },
    { key: "vacations", label: "Vacations / unavailable" },
    { key: "winning", label: "What 'winning' looks like" },
  ]},
  { title: "Constraints + Risks", fields: [
    { key: "hardNos", label: "Hard NOs" },
    { key: "pastFailures", label: "Past failures" },
    { key: "personalConstraints", label: "Personal constraints" },
  ]},
  { title: "Comms + Anchoring", fields: [
    { key: "preferredLanguage", label: "Preferred language" },
    { key: "preferredComms", label: "Preferred comms" },
    { key: "secret", label: "One thing nobody knows" },
  ]},
];

const REQUIRED_KEYS = ['logo','topQuestions','painPoints','revenueStreams','emailList','revenueTarget','launchDate','hoursPerWeek','hardNos','preferredLanguage'];

const DECISION_FIELDS = [
  { key: "positioning", label: "Positioning sentence", textarea: true,
    hint: "One sentence: who it's for + transformation + how. Goes on sales page H1, IG bio, ads.",
    placeholder: "e.g. The community for Portuguese home cooks who want to master traditional recipes — with weekly live classes and a private chef chat." },
  { key: "communityName", label: "Community name",
    hint: "Final brand name for the community/product. Used on Skool, checkout, emails.",
    placeholder: "e.g. Cozinha do Rui · Mesa Portuguesa" },
  { key: "pricing", label: "Pricing (€/month)",
    hint: "Locked monthly price. Anchors revenue projector + checkout.",
    placeholder: "e.g. 39" },
  { key: "launchDate", label: "Launch date",
    hint: "Public open-cart date. Backwards from here drives the build timeline.",
    placeholder: "e.g. 2026-06-15" },
  { key: "techStack", label: "Tech stack",
    hint: "Pick one per slot: Community / Payments / Email / Ads.",
    placeholder: "e.g. Skool · Stripe · Resend · Meta Ads" },
  { key: "rolesSplit", label: "Roles split (Creator vs Second Layer)",
    hint: "Who does what each week. Avoids ambiguity post-launch.",
    placeholder: "e.g. Creator: 1 live/wk + DMs · SL: ops, ads, content, support" },
  { key: "commsCadence", label: "Comms cadence",
    hint: "How often you sync, on which channel, who's required.",
    placeholder: "e.g. Weekly 30-min Mon 10h on Slack (Tomas + Raul + Creator)" },
];

const STATUS_LABELS = {
  not_started: { label: 'Not started', color: '#666' },
  form_pending: { label: 'Form in progress', color: '#eab308' },
  form_complete: { label: 'Form complete', color: '#22c55e' },
  call_scheduled: { label: 'Call scheduled', color: '#3b82f6' },
  brief_signed: { label: 'Brief signed', color: '#a855f7' },
};

function isFilled(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(x => x);
  return Boolean(v);
}

function renderVal(v) {
  if (!isFilled(v)) return null;
  if (Array.isArray(v)) return v.filter(Boolean).join(', ');
  if (typeof v === 'object') return Object.entries(v).filter(([,x])=>x).map(([k,x])=>`${k}: ${x}`).join(' · ');
  return String(v);
}

export default function KickoffSection({ creator, params, patchCreator }) {
  const onb = creator.onboarding || {};
  const responses = onb.responses || {};
  const kickoff = onb.kickoff || {};
  const decisions = kickoff.decisions || {};
  const actionItems = kickoff.actionItems || [];
  const status = onb.status || 'not_started';
  const sLabel = STATUS_LABELS[status] || STATUS_LABELS.not_started;
  const onbUrl = typeof window !== 'undefined' && onb.token
    ? `${window.location.origin}/onboarding/${onb.token}`
    : '';
  const requiredFilled = REQUIRED_KEYS.filter(k => isFilled(responses[k])).length;
  const totalFilled = Object.keys(responses).filter(k => isFilled(responses[k])).length;

  const saveDecision = (key, value) => patchCreator({ onboarding: { kickoff: { decisions: { [key]: value } } } });
  const saveKickoffField = (key, value) => patchCreator({ onboarding: { kickoff: { [key]: value } } });
  const addActionItem = () => saveKickoffField('actionItems', [...actionItems, { task: '', owner: 'Tomas', deadline: '', done: false }]);
  const updateActionItem = (idx, patch) => saveKickoffField('actionItems', actionItems.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeActionItem = (idx) => saveKickoffField('actionItems', actionItems.filter((_, i) => i !== idx));
  const advanceStatus = (next) => patchCreator({ onboarding: { status: next } });

  const inputStyle = { width: '100%', padding: '10px 12px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, color: '#f5f5f5', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
  const card = { padding: '24px 22px', background: '#141414', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12 };
  const cardTitle = { fontSize: 13, fontWeight: 700, margin: '0 0 4px', color: '#f5f5f5' };
  const cardSub = { fontSize: 11, color: '#555', margin: '0 0 16px' };

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Kickoff</h2>
      <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Phase 1 — signed → ready to build. 7 days max from contract to signed Kickoff Brief.</p>

      {/* Status + onboarding link */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Phase 1 Status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: sLabel.color }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5' }}>{sLabel.label}</span>
              <span style={{ fontSize: 11, color: '#666' }}>· {requiredFilled}/10 required · {totalFilled}/30 total</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {status === 'form_complete' && (
              <button onClick={() => advanceStatus('call_scheduled')} style={{ padding: '8px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mark call scheduled</button>
            )}
            {status === 'call_scheduled' && (
              <button onClick={() => advanceStatus('brief_signed')} style={{ padding: '8px 14px', background: '#a855f7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Mark brief signed</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input readOnly value={onbUrl} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
          <button onClick={() => { navigator.clipboard.writeText(onbUrl); }} style={{ padding: '10px 16px', background: '#7A0E18', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Copy link</button>
        </div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 8 }}>Share with the creator. They fill 10 required + 20 optional questions.</div>
      </div>

      {/* Form responses */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={cardTitle}>Onboarding Responses</h3>
        <p style={cardSub}>Read-only view of what the creator has answered.</p>
        {totalFilled === 0 ? (
          <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>No responses yet. Share the link above with the creator.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {ONBOARDING_SECTIONS.map(sec => {
              const filled = sec.fields.filter(f => isFilled(responses[f.key]));
              if (filled.length === 0) return null;
              return (
                <div key={sec.title}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{sec.title}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {filled.map(f => (
                      <div key={f.key} style={{ padding: '10px 12px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 6 }}>
                        <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</div>
                        <div style={{ fontSize: 12, color: '#ccc', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderVal(responses[f.key])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Decision tracker */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={cardTitle}>Kickoff Decisions</h3>
        <p style={cardSub}>Lock these on the kickoff call. Auto-saves on blur.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {DECISION_FIELDS.map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{f.label}</label>
              {f.hint && <div style={{ fontSize: 11, color: '#555', marginBottom: 6, lineHeight: 1.5 }}>{f.hint}</div>}
              {f.textarea ? (
                <textarea defaultValue={decisions[f.key] || ''} placeholder={f.placeholder} onBlur={(e) => saveDecision(f.key, e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
              ) : (
                <input defaultValue={decisions[f.key] || ''} placeholder={f.placeholder} onBlur={(e) => saveDecision(f.key, e.target.value)} style={inputStyle} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action items */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={cardTitle}>Action Items</h3>
            <p style={{ ...cardSub, margin: 0 }}>Owners + deadlines from the kickoff call.</p>
          </div>
          <button onClick={addActionItem} style={{ padding: '8px 14px', background: 'transparent', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Add item</button>
        </div>
        {actionItems.length === 0 ? (
          <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>No action items yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actionItems.map((it, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 110px 140px 24px', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={!!it.done} onChange={(e) => updateActionItem(idx, { done: e.target.checked })} />
                <input defaultValue={it.task} placeholder="Task" onBlur={(e) => updateActionItem(idx, { task: e.target.value })} style={{ ...inputStyle, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? '#555' : '#f5f5f5' }} />
                <select defaultValue={it.owner || 'Tomas'} onBlur={(e) => updateActionItem(idx, { owner: e.target.value })} style={inputStyle}>
                  <option>Tomas</option>
                  <option>Raul</option>
                  <option>Creator</option>
                </select>
                <input type="date" defaultValue={it.deadline || ''} onBlur={(e) => updateActionItem(idx, { deadline: e.target.value })} style={inputStyle} />
                <button onClick={() => removeActionItem(idx)} style={{ background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate brief */}
      <div style={{ padding: '24px 22px', background: '#0f0a0a', border: '1px solid rgba(122,14,24,0.3)', borderRadius: 12, textAlign: 'center' }}>
        <h3 style={{ ...cardTitle, marginBottom: 6 }}>Kickoff Brief</h3>
        <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 16px' }}>When all decisions are locked, generate the formal Kickoff Brief PDF for sign-off.</p>
        <a href={`/api/kickoff/${params?.id}/brief`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 28px', background: '#7A0E18', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit' }}>
          Generate Kickoff Brief
        </a>
        {kickoff.briefGeneratedAt && <div style={{ fontSize: 10, color: '#666', marginTop: 10 }}>Last generated: {new Date(kickoff.briefGeneratedAt).toLocaleString('pt-PT')}</div>}
      </div>
    </div>
  );
}
