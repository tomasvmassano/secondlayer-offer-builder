"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

// ─── 30-question hybrid form ───
// 10 required (gates submission), 20 optional (encouraged for richer kickoff).
// Auto-saves every change (debounced 800ms).

const FIELD_GROUPS = [
  {
    title: 'Identidade da marca',
    titleEn: 'Brand identity',
    fields: [
      { key: 'logo', label: 'Logo', labelEn: 'Logo', type: 'text', placeholder: 'Cola um link para o teu logo (Drive, Dropbox, etc) — ou descreve o que tens', required: true },
      { key: 'colorsPrimary', label: 'Cor principal (hex)', labelEn: 'Primary color (hex)', type: 'text', placeholder: '#7A0E18 ou "verde militar"' },
      { key: 'voiceWords', label: 'Voz em 3 palavras', labelEn: 'Voice in 3 words', type: 'text', placeholder: 'direto, especialista, sem rodeios' },
      { key: 'antiTone', label: 'Tom que NÃO queres', labelEn: 'Anti-tone', type: 'text', placeholder: 'corporativo, fitness-bro, motivacional vazio' },
      { key: 'inspirations', label: 'Inspirações: 3 marcas/criadores que admiras', labelEn: 'Inspirations', type: 'textarea', placeholder: 'Lista 3 marcas e porquê' },
    ],
  },
  {
    title: 'Audiência',
    titleEn: 'Audience',
    fields: [
      { key: 'topQuestions', label: 'Top 5 perguntas que recebes em DM', labelEn: 'Top 5 DM questions', type: 'textarea', placeholder: 'Uma por linha. Mínimo 3.', required: true },
      { key: 'painPoints', label: 'Top 3 dores da tua audiência', labelEn: 'Top 3 pain points', type: 'textarea', placeholder: 'Uma por linha.', required: true },
      { key: 'customerQuotes', label: 'Citações reais de clientes/seguidores', labelEn: 'Real customer quotes', type: 'textarea', placeholder: 'Algo específico que alguém te disse, palavra por palavra' },
      { key: 'demographics', label: 'Demografia que acreditas verdadeira', labelEn: 'Demographics you believe true', type: 'textarea', placeholder: 'Idade, género, localização, rendimento' },
      { key: 'antiPersona', label: 'Quem a tua audiência NÃO é', labelEn: 'Anti-persona', type: 'text', placeholder: 'Quem não queres atrair' },
      { key: 'whyTheyFollow', label: 'Porque é que eles te seguem (palpite honesto)', labelEn: 'Why they follow you', type: 'textarea', placeholder: 'A tua melhor teoria' },
      { key: 'requestedContent', label: 'O que já te pediram explicitamente para criar', labelEn: 'What they asked you to create', type: 'textarea', placeholder: 'Cursos? Comunidade? Produto físico?' },
    ],
  },
  {
    title: 'Negócio actual',
    titleEn: 'Existing business',
    fields: [
      { key: 'revenueStreams', label: 'Fontes de receita actuais + €/mês', labelEn: 'Current revenue streams + €/month', type: 'textarea', placeholder: 'Brand deals: 3K€/mês\nCursos: 1K€/mês\nConsultoria: 2K€/mês', required: true },
      { key: 'emailList', label: 'Lista de email (tamanho + provider)', labelEn: 'Email list (size + provider)', type: 'text', placeholder: '5K em ConvertKit, ou "ainda não tenho"', required: true },
      { key: 'pastProducts', label: 'Produtos que já lançaste (resultado + lições)', labelEn: 'Past products launched', type: 'textarea', placeholder: 'O que funcionou, o que falhou, porquê' },
      { key: 'existingPlatforms', label: 'Plataformas que já tens', labelEn: 'Existing platforms', type: 'textarea', placeholder: 'Skool, Hotmart, Substack, Patreon, etc.' },
      { key: 'existingTeam', label: 'Equipa actual', labelEn: 'Existing team', type: 'textarea', placeholder: 'Designer, editor, manager, agência?' },
      { key: 'brandDeals', label: 'Brand deals: actuais + recusados recentemente', labelEn: 'Brand deals: current + recently declined', type: 'textarea', placeholder: 'O que aceitaste, o que recusaste e porquê' },
    ],
  },
  {
    title: 'Objectivos + vida',
    titleEn: 'Goals + life',
    fields: [
      { key: 'revenueTarget', label: 'Receita-alvo Ano 1 (€/mês MRR)', labelEn: 'Year 1 revenue target (€/month MRR)', type: 'number', placeholder: '15000', required: true },
      { key: 'memberTarget', label: 'Membros-alvo Ano 1', labelEn: 'Year 1 member count target', type: 'number', placeholder: '500' },
      { key: 'launchDate', label: 'Data de lançamento desejada', labelEn: 'Preferred launch date', type: 'text', placeholder: 'Setembro 2026, ou "Q4 2026"', required: true },
      { key: 'hoursPerWeek', label: 'Horas/semana que podes dedicar', labelEn: 'Hours/week you can commit', type: 'number', placeholder: '10', required: true },
      { key: 'knownVacations', label: 'Férias/datas indisponíveis nos próximos 6 meses', labelEn: 'Known vacations / unavailable dates', type: 'textarea', placeholder: '15-30 Agosto férias, 22-26 Outubro evento' },
      { key: 'winningLooksLike', label: 'O que parece "ganhar" em 6 meses', labelEn: 'What "winning" looks like in 6 months', type: 'textarea', placeholder: 'Não só €. Como te sentes? Que problemas estão resolvidos?' },
    ],
  },
  {
    title: 'Restrições + riscos',
    titleEn: 'Constraints + risks',
    fields: [
      { key: 'hardNos', label: 'NÃOS absolutos', labelEn: 'Hard NOs', type: 'textarea', placeholder: 'Ex: sem ads no Meta, não vendo a este nicho, etc.', required: true },
      { key: 'pastFailures', label: 'Falhas em lançamentos passados', labelEn: 'Past launch failures', type: 'textarea', placeholder: 'O que aprendeste à custa' },
      { key: 'personalConstraints', label: 'Restrições pessoais/familiares relevantes', labelEn: 'Personal/family constraints', type: 'textarea', placeholder: 'Filhos pequenos, casamento próximo, mudança de país, etc.' },
    ],
  },
  {
    title: 'Comunicação + ancoragem',
    titleEn: 'Comms + anchoring',
    fields: [
      { key: 'preferredLanguage', label: 'Idioma preferido para comunidade + conteúdo', labelEn: 'Preferred language for community + content', type: 'text', placeholder: 'Português, English, ambos, etc.', required: true },
      { key: 'preferredComms', label: 'Como queres comunicar connosco', labelEn: 'How you want to communicate with us', type: 'text', placeholder: 'Slack, WhatsApp, call semanal, etc.' },
      { key: 'secretAboutBusiness', label: 'Uma coisa sobre o teu negócio que ninguém sabe', labelEn: 'One thing about your business no one else knows', type: 'textarea', placeholder: 'Algo que ainda não disseste publicamente' },
    ],
  },
];

const ALL_FIELDS = FIELD_GROUPS.flatMap(g => g.fields);
const REQUIRED_KEYS = ALL_FIELDS.filter(f => f.required).map(f => f.key);

function isFilled(val) {
  if (val == null) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'number') return val > 0;
  return Boolean(val);
}

export default function OnboardingPage() {
  const params = useParams();
  const token = params?.token;

  const [creator, setCreator] = useState(null);
  const [responses, setResponses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(""); // "saving" | "saved" | "error"
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [missingFields, setMissingFields] = useState([]);
  const saveTimer = useRef(null);

  // Load creator + saved responses
  useEffect(() => {
    if (!token) return;
    fetch(`/api/onboarding/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setCreator(data);
          setResponses(data.onboarding?.responses || {});
          if (data.onboarding?.status === 'form_complete' || data.onboarding?.status === 'call_scheduled' || data.onboarding?.status === 'brief_signed') {
            setSubmitted(true);
          }
        }
      })
      .catch(() => setError('Could not load form'))
      .finally(() => setLoading(false));
  }, [token]);

  // Debounced auto-save
  const triggerSave = useCallback((newResponses) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => {
      fetch(`/api/onboarding/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: newResponses }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.ok) setSaveStatus('saved');
          else setSaveStatus('error');
        })
        .catch(() => setSaveStatus('error'));
    }, 800);
  }, [token]);

  const updateField = (key, value) => {
    const next = { ...responses, [key]: value };
    setResponses(next);
    triggerSave(next);
  };

  const handleSubmit = async () => {
    const missing = REQUIRED_KEYS.filter(k => !isFilled(responses[k]));
    if (missing.length > 0) {
      setMissingFields(missing);
      // Scroll to first missing field
      const el = document.querySelector(`[data-field="${missing[0]}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/onboarding/${token}/complete`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
      } else {
        setMissingFields(data.missing || []);
        alert(data.error || 'Erro ao submeter');
      }
    } catch {
      alert('Erro ao submeter');
    } finally {
      setSubmitting(false);
    }
  };

  // Lang
  const lang = creator?.primaryLanguage === 'en' ? 'en' : 'pt';
  const t = (pt, en) => lang === 'en' ? en : pt;

  const filledCount = ALL_FIELDS.filter(f => isFilled(responses[f.key])).length;
  const filledRequired = REQUIRED_KEYS.filter(k => isFilled(responses[k])).length;

  if (loading) {
    return (
      <div style={pageStyle}>
        <div style={{ color: '#888', fontSize: 14 }}>{t('A carregar...', 'Loading...')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 16px' }}>Link inválido</h1>
          <p style={{ color: '#888', fontSize: 15 }}>
            Este link de onboarding não é válido ou expirou. Contacta a equipa Second Layer.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={pageStyle}>
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: 'rgba(34,197,94,0.15)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 32 }}>
            <span style={{ color: '#22c55e', fontSize: 32 }}>✓</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.2 }}>
            {t('Recebido. ', 'Got it. ')}
            <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: '#7A0E18' }}>
              {t('Obrigado.', 'Thank you.')}
            </span>
          </h1>
          <p style={{ color: '#aaa', fontSize: 17, lineHeight: 1.7, margin: '0 0 32px' }}>
            {t(
              'Vamos rever as tuas respostas e preparar a chamada de kickoff. A equipa Second Layer vai marcar contigo nos próximos dias.',
              'We\'ll review your responses and prep the kickoff call. The Second Layer team will reach out to schedule within the next few days.'
            )}
          </p>
          <p style={{ color: '#666', fontSize: 13 }}>
            {t('Podes fechar esta página.', 'You can close this page.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f5f5', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", paddingBottom: 120 }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '16px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#7A0E18', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Second Layer</div>
            <div style={{ fontSize: 13, color: '#aaa' }}>{t('Onboarding', 'Onboarding')} · {creator.creatorName}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#888' }}>
              <strong style={{ color: filledRequired === REQUIRED_KEYS.length ? '#22c55e' : '#f5f5f5' }}>{filledRequired}/{REQUIRED_KEYS.length}</strong> {t('obrigatórios', 'required')} · {filledCount}/{ALL_FIELDS.length} {t('total', 'total')}
            </div>
            <div style={{ fontSize: 10, color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : '#666', marginTop: 2 }}>
              {saveStatus === 'saving' && t('A guardar...', 'Saving...')}
              {saveStatus === 'saved' && t('Guardado', 'Saved')}
              {saveStatus === 'error' && t('Erro', 'Error')}
            </div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 24px 40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 56, fontWeight: 700, margin: '0 0 24px', lineHeight: 1.1, letterSpacing: '-0.03em' }}>
          {t('Vamos construir isto ', 'Let\'s build this ')}
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', color: '#7A0E18' }}>
            {t('juntos', 'together')}.
          </span>
        </h1>
        <p style={{ fontSize: 17, color: '#aaa', lineHeight: 1.7, maxWidth: 540, margin: '0 auto 16px' }}>
          {t(
            'Antes da chamada de kickoff, precisamos de saber algumas coisas sobre ti, a tua audiência e os teus objectivos.',
            'Before the kickoff call, we need to know a few things about you, your audience, and your goals.'
          )}
        </p>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, maxWidth: 480, margin: '0 auto' }}>
          {t(
            '10 perguntas obrigatórias (~5 min) · 20 opcionais para uma chamada mais profunda. Auto-guarda à medida que escreves.',
            '10 required questions (~5 min) · 20 optional for a deeper call. Auto-saves as you type.'
          )}
        </p>
      </div>

      {/* Form */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
        {FIELD_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#7A0E18', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {t(`Secção ${String.fromCharCode(65 + gi)}`, `Section ${String.fromCharCode(65 + gi)}`)}
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 700, margin: '0 0 32px', letterSpacing: '-0.02em' }}>
              {lang === 'en' ? group.titleEn : group.title}
            </h2>
            {group.fields.map(field => {
              const isMissing = missingFields.includes(field.key);
              const isOk = field.required && isFilled(responses[field.key]);
              return (
                <div key={field.key} data-field={field.key} style={{ marginBottom: 28 }}>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#f5f5f5', marginBottom: 8 }}>
                    {lang === 'en' ? field.labelEn : field.label}
                    {field.required && <span style={{ color: '#7A0E18', marginLeft: 6 }}>*</span>}
                    {isOk && <span style={{ color: '#22c55e', marginLeft: 8, fontSize: 12 }}>✓</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={responses[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      style={{ ...inputStyle, ...(isMissing ? errorBorder : {}), resize: 'vertical' }}
                    />
                  ) : field.type === 'number' ? (
                    <input
                      type="number"
                      value={responses[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value ? Number(e.target.value) : '')}
                      placeholder={field.placeholder}
                      style={{ ...inputStyle, ...(isMissing ? errorBorder : {}) }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={responses[field.key] || ''}
                      onChange={e => updateField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      style={{ ...inputStyle, ...(isMissing ? errorBorder : {}) }}
                    />
                  )}
                  {isMissing && (
                    <div style={{ fontSize: 12, color: '#ef4444', marginTop: 6 }}>
                      {t('Este campo é obrigatório', 'This field is required')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* Submit */}
        <div style={{ marginTop: 64, padding: '32px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {missingFields.length > 0 && (
            <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, marginBottom: 4 }}>
                {t('Campos obrigatórios em falta', 'Required fields missing')}
              </div>
              <div style={{ fontSize: 12, color: '#aaa' }}>
                {t(`Faltam ${missingFields.length} campos obrigatórios para submeteres.`, `${missingFields.length} required fields are missing.`)}
              </div>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={submitting || filledRequired < REQUIRED_KEYS.length}
            style={{
              padding: '16px 32px',
              background: filledRequired === REQUIRED_KEYS.length ? '#7A0E18' : '#1a1a1a',
              border: 'none',
              borderRadius: 8,
              color: filledRequired === REQUIRED_KEYS.length ? '#fff' : '#555',
              fontSize: 15,
              fontWeight: 700,
              cursor: filledRequired === REQUIRED_KEYS.length ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              width: '100%',
            }}
          >
            {submitting ? t('A submeter...', 'Submitting...') : t('Submeter formulário', 'Submit form')}
          </button>
          <p style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 16 }}>
            {filledRequired < REQUIRED_KEYS.length
              ? t(`Preenche os ${REQUIRED_KEYS.length - filledRequired} campos obrigatórios em falta para submeteres.`, `Fill the ${REQUIRED_KEYS.length - filledRequired} remaining required fields to submit.`)
              : t('Tudo pronto. Podes submeter.', 'All set. You can submit.')
            }
          </p>
        </div>
      </div>
    </div>
  );
}

const pageStyle = {
  minHeight: '100vh',
  background: '#0a0a0a',
  color: '#f5f5f5',
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
};

const inputStyle = {
  width: '100%',
  padding: '12px 16px',
  background: '#141414',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8,
  color: '#f5f5f5',
  fontSize: 14,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const errorBorder = {
  borderColor: 'rgba(239,68,68,0.4)',
};
