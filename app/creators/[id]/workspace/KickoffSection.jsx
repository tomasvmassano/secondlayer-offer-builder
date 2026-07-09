"use client";

const ONBOARDING_SECTIONS = [
  { title: "Identidade de marca", fields: [
    { key: "logo", label: "Logo / nome da marca" },
    { key: "brandColors", label: "Cores da marca" },
    { key: "voice", label: "Voz em 3 palavras" },
    { key: "antiTone", label: "Anti-tom" },
    { key: "inspirations", label: "Inspirações" },
  ]},
  { title: "Audiência", fields: [
    { key: "topQuestions", label: "Principais perguntas em DM" },
    { key: "painPoints", label: "Dores" },
    { key: "customerQuotes", label: "Citações de clientes" },
    { key: "demographics", label: "Demografia" },
    { key: "antiPersona", label: "Anti-persona" },
    { key: "whyFollow", label: "Porque seguem" },
    { key: "explicitAsks", label: "Pedidos explícitos" },
  ]},
  { title: "Negócio existente", fields: [
    { key: "revenueStreams", label: "Fontes de receita" },
    { key: "emailList", label: "Lista de email" },
    { key: "pastProducts", label: "Produtos anteriores" },
    { key: "platforms", label: "Plataformas existentes" },
    { key: "team", label: "Equipa existente" },
    { key: "brandDeals", label: "Brand deals" },
  ]},
  { title: "Objectivos + Vida", fields: [
    { key: "revenueTarget", label: "Objectivo de receita (€/mês MRR)" },
    { key: "memberTarget", label: "Objectivo de membros" },
    { key: "launchDate", label: "Data de lançamento" },
    { key: "hoursPerWeek", label: "Horas/semana" },
    { key: "vacations", label: "Férias / indisponível" },
    { key: "winning", label: "Como é 'ganhar'" },
  ]},
  { title: "Restrições + Riscos", fields: [
    { key: "hardNos", label: "NÃOs absolutos" },
    { key: "pastFailures", label: "Falhas passadas" },
    { key: "personalConstraints", label: "Restrições pessoais" },
  ]},
  { title: "Comunicação + Ancoragem", fields: [
    { key: "preferredLanguage", label: "Língua preferida" },
    { key: "preferredComms", label: "Comunicação preferida" },
    { key: "secret", label: "Uma coisa que ninguém sabe" },
  ]},
];

const REQUIRED_KEYS = ['logo','topQuestions','painPoints','revenueStreams','emailList','revenueTarget','launchDate','hoursPerWeek','hardNos','preferredLanguage'];

const DECISION_FIELDS = [
  { key: "positioning", label: "Frase de posicionamento", textarea: true,
    hint: "Uma frase: para quem + transformação + como. Vai para o H1 da sales page, bio do IG, anúncios.",
    placeholder: "ex: A comunidade para cozinheiros caseiros portugueses que querem dominar receitas tradicionais — com aulas ao vivo semanais e um chat privado com chef." },
  { key: "communityName", label: "Nome da comunidade",
    hint: "Nome de marca final da comunidade/produto. Usado no Skool, checkout, emails.",
    placeholder: "ex: Cozinha do Rui · Mesa Portuguesa" },
  { key: "pricing", label: "Pricing (€/mês)",
    hint: "Preço mensal fechado. Ancora o revenue projector + checkout.",
    placeholder: "ex: 39" },
  { key: "launchDate", label: "Data de lançamento",
    hint: "Data pública de abertura de carrinho. Para trás daqui define a timeline de build.",
    placeholder: "ex: 2026-06-15" },
  { key: "techStack", label: "Stack técnica",
    hint: "Escolhe um por slot: Comunidade / Pagamentos / Email / Anúncios.",
    placeholder: "ex: Skool · Stripe · Resend · Meta Ads" },
  { key: "rolesSplit", label: "Divisão de papéis (Criadora vs Second Layer)",
    hint: "Quem faz o quê cada semana. Evita ambiguidade pós-lançamento.",
    placeholder: "ex: Criadora: 1 live/sem + DMs · SL: ops, ads, conteúdo, suporte" },
  { key: "commsCadence", label: "Cadência de comunicação",
    hint: "Com que frequência sincronizam, em que canal, quem é obrigatório.",
    placeholder: "ex: Semanal 30-min Seg 10h no Slack (Tomás + Raúl + Criadora)" },
];

const STATUS_LABELS = {
  not_started: { label: 'Não iniciado', color: '#666' },
  form_pending: { label: 'Formulário em curso', color: '#eab308' },
  form_complete: { label: 'Formulário completo', color: '#22c55e' },
  call_scheduled: { label: 'Call agendada', color: '#3b82f6' },
  brief_signed: { label: 'Brief assinado', color: '#a855f7' },
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
      <p style={{ fontSize: 12, color: "#555", margin: "0 0 28px" }}>Fase 1 — assinado → pronto para construir. 7 dias no máximo do contrato ao Kickoff Brief assinado.</p>

      {/* Status + onboarding link */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Estado da Fase 1</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: sLabel.color }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: '#f5f5f5' }}>{sLabel.label}</span>
              <span style={{ fontSize: 11, color: '#666' }}>· {requiredFilled}/10 obrigatórias · {totalFilled}/30 total</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {status === 'form_complete' && (
              <button onClick={() => advanceStatus('call_scheduled')} style={{ padding: '8px 14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar call agendada</button>
            )}
            {status === 'call_scheduled' && (
              <button onClick={() => advanceStatus('brief_signed')} style={{ padding: '8px 14px', background: '#a855f7', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Marcar brief assinado</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input readOnly value={onbUrl} style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11 }} />
          <button onClick={() => { navigator.clipboard.writeText(onbUrl); }} style={{ padding: '10px 16px', background: '#7A0E18', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Copiar link</button>
        </div>
        <div style={{ fontSize: 10, color: '#555', marginTop: 8 }}>Partilha com a criadora. Preenche 10 obrigatórias + 20 opcionais.</div>
      </div>

      {/* Form responses */}
      <div style={{ ...card, marginBottom: 16 }}>
        <h3 style={cardTitle}>Respostas do onboarding</h3>
        <p style={cardSub}>Vista só-de-leitura do que a criadora respondeu.</p>
        {totalFilled === 0 ? (
          <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>Ainda sem respostas. Partilha o link acima com a criadora.</div>
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
        <h3 style={cardTitle}>Decisões do kickoff</h3>
        <p style={cardSub}>Fecha estas na kickoff call. Guarda automaticamente ao sair do campo.</p>
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
            <h3 style={cardTitle}>Action items</h3>
            <p style={{ ...cardSub, margin: 0 }}>Responsáveis + prazos da kickoff call.</p>
          </div>
          <button onClick={addActionItem} style={{ padding: '8px 14px', background: 'transparent', color: '#aaa', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.06em' }}>+ Adicionar</button>
        </div>
        {actionItems.length === 0 ? (
          <div style={{ fontSize: 12, color: '#555', fontStyle: 'italic' }}>Ainda sem action items.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actionItems.map((it, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '24px 1fr 110px 140px 24px', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={!!it.done} onChange={(e) => updateActionItem(idx, { done: e.target.checked })} />
                <input defaultValue={it.task} placeholder="Tarefa" onBlur={(e) => updateActionItem(idx, { task: e.target.value })} style={{ ...inputStyle, textDecoration: it.done ? 'line-through' : 'none', color: it.done ? '#555' : '#f5f5f5' }} />
                <select defaultValue={it.owner || 'Tomas'} onBlur={(e) => updateActionItem(idx, { owner: e.target.value })} style={inputStyle}>
                  <option>Tomás</option>
                  <option>Raúl</option>
                  <option>Criadora</option>
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
        <p style={{ fontSize: 12, color: '#aaa', margin: '0 0 16px' }}>Quando todas as decisões estiverem fechadas, gera o PDF formal do Kickoff Brief para assinatura.</p>
        <a href={`/api/kickoff/${params?.id}/brief`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '12px 28px', background: '#7A0E18', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit' }}>
          Gerar Kickoff Brief
        </a>
        {kickoff.briefGeneratedAt && <div style={{ fontSize: 10, color: '#666', marginTop: 10 }}>Última geração: {new Date(kickoff.briefGeneratedAt).toLocaleString('pt-PT')}</div>}
      </div>
    </div>
  );
}
