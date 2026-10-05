/* ==========================================================================
   Bacley Chatbot · Interface de atendimento (protótipo interativo)
   --------------------------------------------------------------------------
   Arquitetura simples orientada a estado:
     state  →  render*()  →  DOM
   Todos os dados abaixo são MOCKS para validar o design. Na implementação
   real, `state.convs` virá da API/WebSocket e as funções `simulate*`
   serão substituídas pelos eventos do backend.
   ========================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------------------
     1. UTILIDADES
     ------------------------------------------------------------------------ */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const MIN = 60_000;
  const secsAgo = (s) => new Date(Date.now() - s * 1000);
  const minsAgo = (m) => new Date(Date.now() - m * MIN);
  const uid = () => Math.random().toString(36).slice(2, 10);
  const pad = (n) => String(n).padStart(2, '0');

  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = (s = '') => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const stripTags = (s = '') => s.replace(/<[^>]+>/g, '');

  const icon = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
  const refreshIcons = () => { if (window.lucide) window.lucide.createIcons(); };

  const hueOf = (str) => { let h = 0; for (const ch of str) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
  const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const firstName = (name) => name.split(' ')[0];

  const hhmm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const dayLabel = (d) => {
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    if (sameDay(d, today)) return 'Hoje';
    if (sameDay(d, yesterday)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  };
  const elapsed = (since) => {
    const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}h${pad(m)}` : `${pad(m)}:${pad(sec)}`;
  };
  const fmtDur = (s) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
  const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1048576 ? `${Math.round(b / 1024)} KB` : `${(b / 1048576).toFixed(1).replace('.', ',')} MB`;
  const slaClass = (since) => {
    const m = (Date.now() - since) / MIN;
    return m < 5 ? 'ok' : m < 10 ? 'warn' : 'danger';
  };
  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
  const isOverlayDetails = () => window.matchMedia('(max-width: 1280px)').matches;

  /* ------------------------------------------------------------------------
     2. DADOS (mock)
     ------------------------------------------------------------------------ */
  const AGENT = { name: 'Atendente' };
  const IMG = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=96&h=96&q=80`;

  const CHANNELS = {
    whatsapp: { label: 'WhatsApp', icon: 'message-circle' },
    webchat: { label: 'Site', icon: 'globe' },
    email: { label: 'E-mail', icon: 'mail' },
  };

  const QUICK_REPLIES = [
    { cmd: 'saudacao', title: 'Saudação', text: 'Olá, {nome}! Meu nome é {atendente} e vou dar continuidade ao seu atendimento. Como posso ajudar?' },
    { cmd: 'aguarde', title: 'Pedir para aguardar', text: 'Só um instante, {nome}, estou verificando essas informações para você. 🔎' },
    { cmd: 'boleto', title: '2ª via de boleto', text: '{nome}, a 2ª via do boleto já foi enviada para o seu e-mail cadastrado. Você também pode acessá-la em bacley.com/boletos' },
    { cmd: 'planos', title: 'Apresentar planos', text: 'Temos 3 planos: *Essencial*, *Profissional* e *Enterprise*. Posso te enviar a comparação completa por aqui mesmo?' },
    { cmd: 'demo', title: 'Agendar demonstração', text: 'Que tal uma demonstração gratuita de 15 minutos? É só escolher o melhor horário: bacley.com/demo' },
    { cmd: 'horario', title: 'Horário de atendimento', text: 'Nosso atendimento humano funciona de segunda a sexta, das 8h às 20h, e aos sábados, das 9h às 14h.' },
    { cmd: 'encerrar', title: 'Encerramento', text: 'Posso ajudar em algo mais, {nome}? Caso não, vou encerrar este atendimento. Obrigado pelo contato! 💙' },
  ];

  const EMOJIS = ['😀', '😁', '😂', '🙂', '😉', '😊', '😍', '🤩', '🤔', '😅', '😢', '😮', '😎', '🙏', '👏', '👍',
    '👎', '👌', '🤝', '💪', '🙌', '👋', '✌️', '🔥', '✨', '🎉', '✅', '❌', '⚠️', '💡', '📌', '📎',
    '📞', '💬', '💙', '❤️', '⭐', '🚀', '⏰', '📅'];
  const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '✅'];

  const DEPARTMENTS = [
    { id: 'dep-sup', name: 'Suporte Técnico', icon: 'wrench', meta: '3 atendentes online', load: '2 na fila' },
    { id: 'dep-fin', name: 'Financeiro', icon: 'landmark', meta: '2 atendentes online', load: '0 na fila' },
    { id: 'dep-com', name: 'Comercial', icon: 'briefcase-business', meta: '4 atendentes online', load: '1 na fila' },
  ];
  const TEAM = [
    { id: 'ag-ana', name: 'Ana Lima', role: 'Supervisora', presence: 'online', load: '2 atend.' },
    { id: 'ag-bruno', name: 'Bruno Costa', role: 'Suporte N2', presence: 'online', load: '4 atend.' },
    { id: 'ag-camila', name: 'Camila Rocha', role: 'Comercial', presence: 'away', load: 'Ausente' },
    { id: 'ag-diego', name: 'Diego Alves', role: 'Financeiro', presence: 'offline', load: 'Offline', disabled: true },
  ];

  /** Cria mensagem com id. `from`: customer | bot | agent | note | system */
  const M = (from, data) => ({ id: uid(), from, reactions: [], ...data });

  const yesterday = (h, m) => { const d = new Date(); d.setDate(d.getDate() - 1); d.setHours(h, m, 0, 0); return d; };

  function buildConversations() {
    const john = [
      M('system', { text: 'Conversa iniciada via <b>WhatsApp</b>', icon: 'message-circle', time: minsAgo(9.2) }),
      M('customer', { text: 'Olá! Gostaria de saber mais informações sobre os planos disponíveis.', time: minsAgo(9) }),
      M('bot', { text: 'Olá John! Com certeza. Temos soluções personalizadas para o seu modelo de negócio. Você prefere *atendimento automatizado* ou *consultoria técnica*?', time: minsAgo(8.9), status: 'read' }),
      M('customer', { text: 'Consultoria técnica, por favor. Quero entender a integração com o nosso CRM.', time: minsAgo(5) }),
      M('system', { text: 'Bacley IA transferiu a conversa para <b>você</b> · intenção: consultoria técnica', icon: 'bot', time: minsAgo(4.25) }),
      M('note', { text: 'Lead da campanha de outubro — vale oferecer a demo gratuita de 14 dias. 😉', author: 'Ana Lima · Supervisora', time: minsAgo(4) }),
    ];
    const agentMsg = M('agent', { text: 'Perfeito, John! Meu nome é Atendente e vou te acompanhar a partir daqui. Qual CRM vocês utilizam hoje?', time: minsAgo(3.5), status: 'read', reactions: [{ emoji: '👍', by: 'customer' }] });
    john.push(
      agentMsg,
      M('customer', { text: 'Usamos o HubSpot. Segue o documento com o nosso fluxo atual de atendimento:', time: minsAgo(2.5) }),
      M('customer', { attachment: { name: 'fluxo-atendimento-v3.pdf', size: 1258291, ext: 'pdf' }, time: minsAgo(2.4) }),
      M('customer', { text: 'E vocês conseguem integrar sem precisar de desenvolvedor?', replyTo: agentMsg.id, time: minsAgo(1.2) }),
    );

    return [
      /* ----------------------------- FILA ----------------------------- */
      {
        id: 'carlos', name: 'Carlos Eduardo', avatar: IMG('photo-1535713875002-d1d0cf377fde'),
        presence: 'online', channel: 'whatsapp', stage: 'queue', since: secsAgo(165), unread: 2, priority: 'Alta',
        phone: '+55 11 98765-4321', email: 'carlos.edu@email.com', city: 'São Paulo, SP', customerSince: 'mar/2023', plan: 'Profissional', protocol: '20261004-0192',
        tags: ['Financeiro', 'Urgente'],
        summary: 'Cliente pediu a 2ª via do boleto com vencimento hoje. A IA não conseguiu validar o CPF e encaminhou para atendimento humano.',
        intent: '2ª via de boleto', sentiment: 'Ansioso',
        history: [{ title: 'Alteração da forma de pagamento', date: '12 set', icon: 'credit-card', rating: 5 }],
        messages: [
          M('system', { text: 'Conversa iniciada via <b>WhatsApp</b>', icon: 'message-circle', time: secsAgo(260) }),
          M('bot', { text: 'Olá, Carlos! 👋 Sou a Bacley IA. Como posso ajudar hoje?', time: secsAgo(255), status: 'read' }),
          M('customer', { text: 'Preciso da 2ª via do boleto', time: secsAgo(230) }),
          M('bot', { text: 'Claro! Para sua segurança, informe os 3 primeiros dígitos do seu CPF.', time: secsAgo(228), status: 'read' }),
          M('system', { text: 'Bacley IA encaminhou para a <b>fila humana</b> · validação não concluída', icon: 'bot', time: secsAgo(200) }),
          M('customer', { text: 'Já tentei pelo site e não consegui.', time: secsAgo(180) }),
          M('customer', { text: 'É urgente, vence hoje! 😟', time: secsAgo(170) }),
        ],
        suggestOnTake: 'Já estou gerando a 2ª via do seu boleto, só preciso confirmar o e-mail cadastrado. 😊',
      },
      {
        id: 'mariana', name: 'Mariana Souza', avatar: IMG('photo-1494790108377-be9c29b29330'),
        presence: 'online', channel: 'webchat', stage: 'queue', since: secsAgo(378), unread: 1, priority: 'Normal',
        phone: '+55 21 99812-3344', email: 'mariana@agenciaflow.com.br', city: 'Rio de Janeiro, RJ', customerSince: 'Novo lead', plan: '—', protocol: '20261004-0188',
        tags: ['Comercial', 'Lead quente'],
        summary: 'Lead vindo da página de planos. Quer agendar uma reunião com um consultor para apresentar a plataforma ao time (agência com ~15 pessoas).',
        intent: 'Agendar reunião', sentiment: 'Positivo',
        history: [],
        messages: [
          M('system', { text: 'Conversa iniciada pelo <b>chat do site</b> · página /planos', icon: 'globe', time: secsAgo(420) }),
          M('bot', { text: 'Oi! Eu sou a Bacley IA. Posso tirar dúvidas sobre planos, preços ou agendar uma conversa com nosso time. 🙂', time: secsAgo(415), status: 'read' }),
          M('customer', { text: 'Gostaria de agendar uma reunião com um consultor para apresentar a plataforma ao meu time.', time: secsAgo(380) }),
        ],
        suggestOnTake: 'Será um prazer apresentar a plataforma para o seu time! Qual o melhor dia e horário para vocês?',
      },
      {
        id: 'tech', name: 'Tech Solutions', avatar: null,
        presence: 'offline', lastSeen: minsAgo(9), channel: 'email', stage: 'queue', since: secsAgo(842), unread: 3, priority: 'Normal',
        phone: '+55 31 3333-4400', email: 'contato@techsolutions.com', city: 'Belo Horizonte, MG', customerSince: 'Novo lead', plan: '—', protocol: '20261004-0175',
        tags: ['Comercial'],
        summary: 'Empresa com 40 colaboradores avaliando a contratação. Perguntou sobre período de teste e condições para pagamento anual.',
        intent: 'Contratação', sentiment: 'Neutro',
        history: [],
        messages: [
          M('customer', { text: 'Bom dia! Somos uma empresa de 40 colaboradores e estamos avaliando ferramentas de atendimento.', time: secsAgo(900) }),
          M('customer', { text: 'Dúvida sobre contratação: vocês oferecem período de teste? Há desconto no plano anual?', time: secsAgo(880) }),
          M('customer', { text: 'Aguardo retorno.\nObrigado,\nMarcos — Tech Solutions', time: secsAgo(860) }),
        ],
        suggestOnTake: 'Oferecemos 14 dias de teste gratuito e 20% de desconto no plano anual. Posso enviar a proposta?',
      },

      /* -------------------------- ATENDIMENTOS -------------------------- */
      {
        id: 'john', name: 'John Doe', avatar: IMG('photo-1534528741775-53994a69daeb'),
        presence: 'online', channel: 'whatsapp', stage: 'active', since: secsAgo(255), unread: 0, pinned: true, priority: 'Alta',
        phone: '+55 11 91234-5678', email: 'john.doe@acme.com', city: 'Campinas, SP', customerSince: 'jan/2024', plan: 'Essencial', protocol: '20261004-0201',
        tags: ['Planos', 'Integração', 'Campanha Out'],
        summary: 'John quer entender os planos e a integração com o HubSpot. Enviou o fluxo atual de atendimento (PDF) e perguntou se a integração exige desenvolvedor.',
        intent: 'Consultoria técnica', sentiment: 'Positivo',
        history: [
          { title: 'Dúvida sobre faturamento', date: '28 ago', icon: 'receipt', rating: 5 },
          { title: 'Configuração inicial do bot', date: '15 jan', icon: 'settings', rating: 4 },
        ],
        messages: john,
        aiSuggestion: 'Sim, John! A integração com o HubSpot é nativa: basta conectar sua conta em Configurações → Integrações, sem precisar de desenvolvedor. Quer que eu agende uma demonstração de 15 minutos?',
        autoReplies: ['Que ótimo! Pode agendar a demonstração para amanhã às 10h?', 'Perfeito, muito obrigado pela ajuda! 🙌'],
        suggestions: ['Agendado! ✅ Amanhã às 10h você receberá o link da reunião no seu e-mail. Posso ajudar em algo mais?', 'Eu que agradeço, John! Qualquer dúvida é só chamar por aqui. Tenha um ótimo dia! 💙'],
      },
      {
        id: 'ana', name: 'Ana Paula', avatar: null,
        presence: 'offline', lastSeen: minsAgo(3), channel: 'webchat', stage: 'active', since: secsAgo(690), unread: 3, priority: 'Normal',
        phone: '+55 41 98877-6655', email: 'anapaula@studioap.com', city: 'Curitiba, PR', customerSince: 'jun/2022', plan: 'Profissional', protocol: '20261003-0954',
        tags: ['Suporte', 'Relatórios'],
        summary: 'Cliente não conseguia acessar os relatórios mensais. Problema resolvido após limpeza de permissões; ela confirmou que está tudo funcionando.',
        intent: 'Suporte · relatórios', sentiment: 'Satisfeita',
        history: [{ title: 'Treinamento de equipe', date: '02 mai', icon: 'graduation-cap', rating: 5 }],
        messages: [
          M('system', { text: 'Conversa iniciada pelo <b>chat do site</b>', icon: 'globe', time: yesterday(17, 40) }),
          M('customer', { text: 'Boa tarde! Não consigo acessar os relatórios mensais, aparece "sem permissão".', time: yesterday(17, 41) }),
          M('agent', { text: 'Oi, Ana! Vou verificar as permissões da sua conta. Pode me mandar um áudio explicando quando começou?', time: yesterday(17, 45), status: 'read' }),
          M('customer', { audio: { duration: 14 }, time: yesterday(17, 47) }),
          M('agent', { text: 'Ajustei as permissões do seu perfil. Pode tentar novamente, por favor? 🙏', time: minsAgo(12), status: 'read' }),
          M('customer', { text: 'Consegui acessar!', time: minsAgo(3.4) }),
          M('customer', { text: 'Os relatórios já aparecem certinhos.', time: minsAgo(3.3) }),
          M('customer', { text: 'Muito obrigada pelas orientações!', time: minsAgo(3.2) }),
        ],
        aiSuggestion: 'Que ótimo, Ana! Fico feliz que deu certo. 😊 Posso ajudar em algo mais ou posso encerrar o atendimento?',
      },
      {
        id: 'roberto', name: 'Roberto Santos', avatar: null,
        presence: 'online', channel: 'whatsapp', stage: 'active', since: secsAgo(1190), unread: 2, priority: 'Alta',
        phone: '+55 51 99654-1122', email: 'roberto@lojasantos.com.br', city: 'Porto Alegre, RS', customerSince: 'nov/2021', plan: 'Enterprise', protocol: '20261004-0143',
        tags: ['Suporte N2', 'Webhook'],
        summary: 'O chatbot do cliente parou de responder desde ontem à noite. Foi identificada falha no webhook; aguardando o suporte técnico N2.',
        intent: 'Incidente técnico', sentiment: 'Frustrado',
        history: [
          { title: 'Upgrade para Enterprise', date: '10 jul', icon: 'rocket', rating: 5 },
          { title: 'Instabilidade na API', date: '03 mar', icon: 'triangle-alert', rating: 3 },
        ],
        messages: [
          M('customer', { text: 'Meu chatbot parou de responder desde ontem à noite.', time: minsAgo(20) }),
          M('agent', { text: 'Vou verificar os logs, Roberto. Um instante.', time: minsAgo(19.5), status: 'read' }),
          M('agent', { text: 'Identifiquei uma falha no webhook. Estou acionando o suporte técnico de nível 2 para corrigir.', time: minsAgo(15), status: 'read' }),
          M('customer', { text: 'Ok, aguardo.', time: minsAgo(2) }),
          M('customer', { text: 'Vocês têm alguma previsão?', time: minsAgo(1) }),
        ],
        aiSuggestion: 'Roberto, o time N2 já está atuando e a previsão de normalização é de até 30 minutos. Te aviso assim que estiver resolvido.',
      },
    ];
  }

  /* ------------------------------------------------------------------------
     3. ESTADO
     ------------------------------------------------------------------------ */
  const state = {
    convs: buildConversations(),
    activeId: 'john',
    filter: 'all',
    query: '',
    mode: 'reply',          // reply | note
    replyTo: null,
    attachments: [],
    drafts: {},
    agentStatus: 'online',
    detailsOpen: window.innerWidth > 1280,
    recording: null,
    playing: null,
    quick: { open: false, items: [], index: 0 },
    search: { open: false, q: '', index: 0, total: 0 },
    fabCount: 0,
  };

  const byId = (id) => state.convs.find((c) => c.id === id);
  const active = () => byId(state.activeId);

  /* ------------------------------------------------------------------------
     4. REFERÊNCIAS DO DOM
     ------------------------------------------------------------------------ */
  const el = {
    app: $('#app'),
    search: $('#search-input'),
    listQueue: $('#list-queue'),
    listActive: $('#list-active'),
    badgeQueue: $('#badge-queue'),
    badgeActive: $('#badge-active'),
    countUnread: $('#count-unread'),
    chat: $('#chat'),
    empty: $('#chat-empty'),
    view: $('#chat-view'),
    headerAvatar: $('#header-avatar'),
    headerName: $('#header-name'),
    headerSub: $('#header-sub'),
    messages: $('#messages'),
    inner: $('#messages-inner'),
    fab: $('#scroll-fab'),
    fabBadge: $('#scroll-fab-badge'),
    composerWrap: $('#composer-wrap'),
    composer: $('#composer'),
    takeover: $('#takeover'),
    takeoverTimer: $('#takeover-timer'),
    input: $('#composer-input'),
    send: $('#btn-send'),
    aiSuggest: $('#ai-suggest'),
    aiSuggestText: $('#ai-suggest-text'),
    quick: $('#quick-replies'),
    emoji: $('#emoji-picker'),
    replyPreview: $('#reply-preview'),
    attachments: $('#attachments'),
    recording: $('#recording'),
    recTime: $('#rec-time'),
    fileInput: $('#file-input'),
    noteHint: $('#note-hint'),
    details: $('#details-content'),
    chatSearch: $('#chat-search'),
    chatSearchInput: $('#chat-search-input'),
    chatSearchCount: $('#chat-search-count'),
    toasts: $('#toasts'),
    finish: $('#btn-finish'),
  };

  /* ------------------------------------------------------------------------
     5. COMPONENTES (HTML)
     ------------------------------------------------------------------------ */
  function avatarHTML(c, size = 'sm', { badge = false } = {}) {
    const img = c.avatar
      ? `<img src="${c.avatar}" alt="" loading="lazy" onerror="this.remove()">`
      : '';
    const unread = badge && c.unread ? `<span class="avatar__badge">${c.unread}</span>` : '';
    return `<span class="avatar avatar--${size}" style="--hue:${hueOf(c.name)}">${initials(c.name)}${img}<span class="presence presence--${c.presence}"></span>${unread}</span>`;
  }

  function channelHTML(c) {
    const ch = CHANNELS[c.channel];
    return `<span class="channel channel--${c.channel}">${icon(ch.icon)}${ch.label}</span>`;
  }

  const lastMessage = (c) => [...c.messages].reverse().find((m) => ['customer', 'bot', 'agent'].includes(m.from));

  function receiptHTML(status, cls = '') {
    switch (status) {
      case 'sending': return icon('loader-circle', `is-sending ${cls}`);
      case 'sent': return icon('check', cls);
      case 'delivered': return icon('check-check', cls);
      case 'read': return icon('check-check', `is-read ${cls}`);
      default: return '';
    }
  }

  function previewHTML(c) {
    if (c.typing) return '<em>digitando…</em>';
    const draft = c.id !== state.activeId && state.drafts[c.id];
    if (draft) return `<span><em class="draft">Rascunho:</em> ${esc(draft)}</span>`;
    const m = lastMessage(c);
    if (!m) return '';
    const prefix = m.from === 'agent' ? 'Você: ' : '';
    const botIcon = m.from === 'bot' ? icon('bot') : '';
    if (m.audio) return `${botIcon}${icon('mic')}<span>${prefix}Áudio (${fmtDur(m.audio.duration)})</span>`;
    if (m.attachment) return `${botIcon}${icon('paperclip')}<span>${prefix}${esc(m.attachment.name)}</span>`;
    return `${botIcon}<span>${prefix}${esc(m.text)}</span>`;
  }

  function convHTML(c) {
    const isActive = c.id === state.activeId;
    const sla = c.stage === 'queue' ? slaClass(c.since) : '';
    const last = lastMessage(c);
    const right = c.unread
      ? `<span class="conv__unread" aria-label="${c.unread} não lidas">${c.unread}</span>`
      : (last && last.from !== 'customer' ? receiptHTML(last.status, `conv__receipt${last.status === 'read' ? ' is-read' : ''}`) : '');
    const classes = ['conv', isActive && 'is-active', c.unread && 'has-unread', c.isNew && 'is-new'].filter(Boolean).join(' ');
    return `
      <li>
        <button class="${classes}" data-id="${c.id}" title="${esc(c.name)}" ${isActive ? 'aria-current="true"' : ''}>
          ${avatarHTML(c, 'sm', { badge: true })}
          <span class="conv__body">
            <span class="conv__row">
              <span class="conv__name">${esc(c.name)}${c.pinned ? icon('pin', 'conv__pin') : ''}</span>
              <span class="timer ${sla ? `timer--${sla}` : ''}" data-since="${+c.since}" data-sla="${c.stage === 'queue'}"
                    title="${c.stage === 'queue' ? 'Tempo de espera' : 'Tempo em atendimento'}">
                ${icon(c.stage === 'queue' ? 'timer' : 'clock')}<span class="timer__value">${elapsed(c.since)}</span>
              </span>
            </span>
            <span class="conv__row">
              <span class="conv__preview">${previewHTML(c)}</span>
              ${right}
            </span>
          </span>
        </button>
      </li>`;
  }

  function formatText(text, q, counter) {
    let h = esc(text);
    h = h.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>')
      .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, '$1<em>$2</em>')
      .replace(/\b((?:https?:\/\/)?[\w-]+(?:\.[\w-]+)+\/[^\s<]*)/g, (url) => {
        const href = url.startsWith('http') ? url : `https://${url}`;
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
      });
    if (q) {
      const re = new RegExp(escRe(esc(q)), 'gi');
      h = h.split(/(<[^>]+>)/).map((part) => part.startsWith('<')
        ? part
        : part.replace(re, (m) => `<mark data-match="${counter.n++}">${m}</mark>`)).join('');
    }
    return h;
  }

  const authorName = (m) => ({ customer: active()?.name, bot: 'Bacley IA', agent: m.author || 'Você', note: m.author || 'Você' }[m.from] || '');
  const snippet = (m) => m.text || (m.attachment ? `📎 ${m.attachment.name}` : m.audio ? `🎤 Áudio (${fmtDur(m.audio.duration)})` : '');

  function waveBars(seed, n = 34) {
    let x = hueOf(seed) + 7;
    let html = '';
    for (let i = 0; i < n; i++) {
      x = (x * 9301 + 49297) % 233280;
      const h = 20 + Math.round((x / 233280) * 80 * Math.sin((i / n) * Math.PI) + 10);
      html += `<i style="height:${Math.min(100, h)}%"></i>`;
    }
    return html;
  }

  function messageHTML(m, first, last, q, counter, msgs) {
    const out = m.from !== 'customer';
    const cls = ['msg', out ? 'msg--out' : 'msg--in', m.from === 'bot' && 'msg--bot', m.from === 'note' && 'msg--note',
      first && 'is-first', last && 'is-last', m.enter && 'is-enter'].filter(Boolean).join(' ');

    let author = '';
    if (first && out) {
      if (m.from === 'bot') author = `${icon('bot')}Bacley IA <span class="ai-tag">IA</span>`;
      else if (m.from === 'note') author = `${icon('lock')}Nota interna · ${esc(m.author || 'Você')}`;
      else author = `${icon('headset')}${esc(m.author || 'Você')}`;
      author = `<span class="msg__author">${author}</span>`;
    }

    let quote = '';
    if (m.replyTo) {
      const r = msgs.find((x) => x.id === m.replyTo);
      if (r) quote = `<span class="quote" data-jump="${r.id}" role="button" tabindex="0" aria-label="Ir para a mensagem citada"><span class="quote__author">${esc(authorName(r))}</span><span class="quote__text">${esc(snippet(r))}</span></span>`;
    }

    let file = '';
    if (m.attachment) {
      const a = m.attachment;
      const kind = /png|jpe?g|gif|webp|svg/.test(a.ext) ? 'file__icon--img' : /docx?|xlsx?|csv|txt/.test(a.ext) ? 'file__icon--doc' : '';
      file = `<div class="file"><span class="file__icon ${kind}">${esc(a.ext.slice(0, 4).toUpperCase())}</span><span class="file__info"><span class="file__name" title="${esc(a.name)}">${esc(a.name)}</span><span class="file__size">${fmtSize(a.size)}</span></span><button class="icon-btn icon-btn--sm" data-act="download" aria-label="Baixar ${esc(a.name)}">${icon('download')}</button></div>`;
    }

    let audio = '';
    if (m.audio) {
      audio = `<div class="audio" data-duration="${m.audio.duration}"><button class="audio__play" data-act="play" aria-label="Reproduzir áudio">${icon('play')}</button><span class="audio__wave">${waveBars(m.id)}</span><span class="audio__time">${fmtDur(m.audio.duration)}</span></div>`;
    }

    const text = m.text ? `<span class="msg__text">${formatText(m.text, q, counter)}</span>` : '';
    const receipt = out && m.from !== 'note' ? receiptHTML(m.status) : '';
    const meta = `<span class="msg__meta"><time datetime="${m.time.toISOString()}">${hhmm(m.time)}</time>${receipt}</span>`;

    let reactions = '';
    if (m.reactions.length) {
      const groups = {};
      m.reactions.forEach((r) => { (groups[r.emoji] ||= []).push(r.by); });
      reactions = `<div class="msg__reactions">${Object.entries(groups).map(([e, by]) =>
        `<button class="reaction ${by.includes('me') ? 'is-mine' : ''}" data-act="toggle-reaction" data-emoji="${e}" aria-label="Reação ${e}">${e}${by.length > 1 ? `<small>${by.length}</small>` : ''}</button>`).join('')}</div>`;
    }

    const actions = `
      <div class="msg__actions" role="toolbar" aria-label="Ações da mensagem">
        <button class="icon-btn" data-act="reply" aria-label="Responder" data-tooltip="Responder" data-tooltip-pos="top">${icon('reply')}</button>
        <button class="icon-btn" data-act="react" aria-label="Reagir" data-tooltip="Reagir" data-tooltip-pos="top">${icon('smile-plus')}</button>
        <button class="icon-btn" data-act="copy" aria-label="Copiar" data-tooltip="Copiar" data-tooltip-pos="top">${icon('copy')}</button>
      </div>`;

    return `<div class="${cls}" data-id="${m.id}">${author}<div class="msg__bubble">${quote}${file}${audio}${text}${meta}</div>${reactions}${actions}</div>`;
  }

  /* ------------------------------------------------------------------------
     6. RENDERIZAÇÃO
     ------------------------------------------------------------------------ */
  function sortedConvs(stage) {
    const q = norm(state.query.trim());
    return state.convs
      .filter((c) => c.stage === stage)
      .filter((c) => state.filter !== 'unread' || c.unread > 0)
      .filter((c) => !q || norm([c.name, c.phone, c.email, lastMessage(c)?.text || ''].join(' ')).includes(q))
      .sort((a, b) => stage === 'queue'
        ? a.since - b.since // fila: quem espera há mais tempo primeiro (FIFO)
        : (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (lastMessage(b)?.time || 0) - (lastMessage(a)?.time || 0));
  }

  function renderSidebar() {
    const focusedId = document.activeElement?.closest?.('.conv')?.dataset.id;
    const emptyMsg = (stage) => state.query || state.filter !== 'all'
      ? 'Nenhuma conversa encontrada'
      : stage === 'queue' ? 'Fila vazia — bom trabalho! 🎉' : 'Nenhum atendimento em andamento';

    const queue = sortedConvs('queue');
    const act = sortedConvs('active');
    el.listQueue.innerHTML = queue.length ? queue.map(convHTML).join('') : `<li class="conv-list__empty">${emptyMsg('queue')}</li>`;
    el.listActive.innerHTML = act.length ? act.map(convHTML).join('') : `<li class="conv-list__empty">${emptyMsg('active')}</li>`;

    $('[data-group="queue"]').hidden = state.filter === 'mine';

    el.badgeQueue.textContent = state.convs.filter((c) => c.stage === 'queue').length;
    el.badgeActive.textContent = state.convs.filter((c) => c.stage === 'active').length;
    const unreadConvs = state.convs.filter((c) => ['queue', 'active'].includes(c.stage) && c.unread).length;
    el.countUnread.textContent = unreadConvs || '';

    refreshIcons();
    if (focusedId) $(`.conv[data-id="${focusedId}"]`)?.focus();
    updateTitle();
  }

  function renderHeader(c) {
    el.headerAvatar.innerHTML = avatarHTML(c, 'lg');
    el.headerName.textContent = c.name;
    let status;
    if (c.typing) status = '<span class="is-typing">digitando…</span>';
    else if (c.channel === 'email') status = `<span>${esc(c.email)}</span>`;
    else if (c.presence === 'online') status = '<span class="is-online">online</span>';
    else status = `<span>visto por último às ${hhmm(c.lastSeen || new Date())}</span>`;
    el.headerSub.innerHTML = `${channelHTML(c)}<span class="sep"></span>${status}`;
    el.finish.hidden = c.stage !== 'active';
  }

  function renderMessages() {
    const c = active();
    if (!c) return;
    stopAudio();
    const q = state.search.open ? state.search.q.trim() : '';
    const counter = { n: 0 };
    const msgs = c.messages;
    const groupable = (a, b) => a && b && a.from === b.from && a.from !== 'system'
      && sameDay(a.time, b.time) && (b.time - a.time) < 5 * MIN
      && (a.author || '') === (b.author || '') && c.unreadMarker !== b.id;

    let html = '';
    let lastDay = null;
    msgs.forEach((m, i) => {
      if (!lastDay || !sameDay(lastDay, m.time)) {
        html += `<div class="day-sep">${dayLabel(m.time)}</div>`;
        lastDay = m.time;
      }
      if (c.unreadMarker === m.id) {
        const n = c.unreadMarkerCount;
        html += `<div class="unread-sep" id="unread-sep">${n} ${n > 1 ? 'mensagens não lidas' : 'mensagem não lida'}</div>`;
      }
      if (m.from === 'system') {
        // Texto de sistema é gerado internamente (HTML confiável).
        html += `<div class="sys">${icon(m.icon || 'info')}<span>${m.text}</span><time>${hhmm(m.time)}</time></div>`;
        return;
      }
      html += messageHTML(m, !groupable(msgs[i - 1], m), !groupable(m, msgs[i + 1]), q, counter, msgs);
      delete m.enter;
    });

    if (c.typing) {
      html += '<div class="msg msg--in typing is-first is-last is-enter" aria-label="digitando"><div class="msg__bubble"><span></span><span></span><span></span></div></div>';
    }

    el.inner.innerHTML = html;
    refreshIcons();
    if (state.search.open) updateSearchMatches();
  }

  function renderComposerState() {
    const c = active();
    const isQueue = c?.stage === 'queue';
    el.takeover.hidden = !isQueue;
    el.composer.hidden = isQueue;

    // Sugestão IA
    const showAI = c && !isQueue && c.aiSuggestion && state.mode === 'reply' && !el.input.value.trim();
    el.aiSuggest.hidden = !showAI;
    if (showAI) el.aiSuggestText.textContent = c.aiSuggestion;

    // Resposta (citação)
    if (state.replyTo && c) {
      const r = c.messages.find((m) => m.id === state.replyTo);
      el.replyPreview.hidden = !r;
      if (r) {
        el.replyPreview.innerHTML = `${icon('reply')}<div><strong>Respondendo a ${esc(authorName(r))}</strong><span>${esc(snippet(r))}</span></div><button class="icon-btn icon-btn--sm" data-act="cancel-reply" aria-label="Cancelar resposta">${icon('x')}</button>`;
      }
    } else {
      el.replyPreview.hidden = true;
    }

    // Anexos
    el.attachments.hidden = !state.attachments.length;
    el.attachments.innerHTML = state.attachments.map((a, i) =>
      `<span class="att-chip">${icon('file')}<span>${esc(a.name)}</span><small>${fmtSize(a.size)}</small><button class="icon-btn" data-remove-att="${i}" aria-label="Remover ${esc(a.name)}">${icon('x')}</button></span>`).join('');

    updateSendState();
    refreshIcons();
  }

  function renderChat() {
    const c = active();
    el.empty.hidden = !!c;
    el.view.hidden = !c;
    if (!c) return;
    renderHeader(c);
    renderMessages();
    renderComposerState();
    updateTakeoverTimer();
  }

  function infoRow(ic, label, value, copy = false) {
    return `<div class="info">${icon(ic)}<dt>${label}</dt><dd title="${esc(value)}">${value.startsWith?.('<') ? value : esc(value)}</dd>${copy ? `<button class="icon-btn icon-btn--sm copy-btn" data-copy="${esc(value)}" aria-label="Copiar ${label}">${icon('copy')}</button>` : ''}</div>`;
  }

  function renderDetails() {
    const c = active();
    if (!c) { el.details.innerHTML = ''; return; }
    const ch = CHANNELS[c.channel];
    const tags = c.tags.map((t, i) => `<span class="tag" style="--hue:${hueOf(t)}">${esc(t)}<button data-remove-tag="${i}" aria-label="Remover etiqueta ${esc(t)}">${icon('x')}</button></span>`).join('');
    const history = c.history.length
      ? c.history.map((h) => `<a href="#" class="history__item"><span class="history__icon">${icon(h.icon)}</span><span class="history__info"><span class="history__title">${esc(h.title)}</span><span class="history__meta">${h.date} · Resolvido</span></span><span class="stars" aria-label="${h.rating} de 5 estrelas">${'★'.repeat(h.rating)}${'☆'.repeat(5 - h.rating)}</span></a>`).join('')
      : '<p class="history__meta">Primeiro contato deste cliente. 👋</p>';

    el.details.innerHTML = `
      <div class="profile">
        ${avatarHTML(c, 'xl')}
        <div class="profile__name">${esc(c.name)}</div>
        <div class="profile__sub">${channelHTML(c)}<span>${esc(c.city)}</span></div>
        <div class="profile__actions">
          <button class="icon-btn" data-act="simulate" data-label="Ligação" aria-label="Ligar" data-tooltip="Ligar">${icon('phone')}</button>
          <button class="icon-btn" data-act="simulate" data-label="E-mail" aria-label="Enviar e-mail" data-tooltip="Enviar e-mail">${icon('mail')}</button>
          <button class="icon-btn" data-act="simulate" data-label="CRM" aria-label="Abrir no CRM" data-tooltip="Abrir no CRM">${icon('external-link')}</button>
          <button class="icon-btn" data-act="simulate" data-label="Edição" aria-label="Editar contato" data-tooltip="Editar contato">${icon('pencil')}</button>
        </div>
      </div>

      <details class="panel" open>
        <summary>${icon('sparkles')}Resumo da IA${icon('chevron-down', 'panel__chev')}</summary>
        <div class="panel__body">
          <div class="ai-card" id="ai-card">
            <p>${esc(c.summary)}</p>
            <div class="ai-card__signals">
              <span class="signal">${icon('target')}${esc(c.intent)}</span>
              <span class="signal">${icon('heart-pulse')}${esc(c.sentiment)}</span>
              <span class="signal">${icon('languages')}Português</span>
            </div>
            <div class="ai-card__foot">
              <span>Gerado pela Bacley IA</span>
              <button class="btn btn--soft" data-act="regen">${icon('refresh-cw')}Atualizar</button>
            </div>
          </div>
        </div>
      </details>

      <details class="panel" open>
        <summary>${icon('contact-round')}Contato${icon('chevron-down', 'panel__chev')}</summary>
        <div class="panel__body">
          <dl class="info-list">
            ${infoRow('phone', 'Telefone', c.phone, true)}
            ${infoRow('mail', 'E-mail', c.email, true)}
            ${infoRow('map-pin', 'Local', c.city)}
            ${infoRow('calendar', 'Cliente desde', c.customerSince)}
            ${infoRow('gem', 'Plano', c.plan)}
          </dl>
        </div>
      </details>

      <details class="panel" open>
        <summary>${icon('tag')}Etiquetas${icon('chevron-down', 'panel__chev')}</summary>
        <div class="panel__body">
          <div class="tags" id="tags">${tags}<button class="tag-add" data-act="add-tag">${icon('plus')}Adicionar</button></div>
        </div>
      </details>

      <details class="panel">
        <summary>${icon('ticket')}Atendimento${icon('chevron-down', 'panel__chev')}</summary>
        <div class="panel__body">
          <dl class="info-list">
            ${infoRow('hash', 'Protocolo', c.protocol, true)}
            ${infoRow(ch.icon, 'Canal', ch.label)}
            ${infoRow('user-round-check', 'Responsável', c.stage === 'queue' ? 'Aguardando na fila' : 'Você')}
            ${infoRow('flag', 'Prioridade', `<span class="priority ${c.priority === 'Alta' ? 'priority--high' : ''}">${esc(c.priority)}</span>`)}
          </dl>
        </div>
      </details>

      <details class="panel">
        <summary>${icon('history')}Histórico <span class="badge">${c.history.length}</span>${icon('chevron-down', 'panel__chev')}</summary>
        <div class="panel__body"><div class="history">${history}</div></div>
      </details>`;
    refreshIcons();
  }

  function renderAll() {
    renderSidebar();
    renderChat();
    renderDetails();
  }

  function updateTitle() {
    const total = state.convs.filter((c) => ['queue', 'active'].includes(c.stage)).reduce((s, c) => s + (c.unread || 0), 0);
    document.title = `${total ? `(${total}) ` : ''}Bacley Chatbot · Atendimento`;
  }

  /* ------------------------------------------------------------------------
     7. NAVEGAÇÃO ENTRE CONVERSAS
     ------------------------------------------------------------------------ */
  function openConversation(id, { focus = true } = {}) {
    const c = byId(id);
    if (!c) return;

    // Salva rascunho da conversa anterior
    if (state.activeId && state.activeId !== id) {
      const draft = el.input.value.trim();
      if (draft) state.drafts[state.activeId] = el.input.value; else delete state.drafts[state.activeId];
    }

    state.activeId = id;
    state.replyTo = null;
    state.attachments = [];
    state.fabCount = 0;
    if (state.recording) stopRecording(false);
    setMode('reply', { silent: true });
    closeChatSearch({ silent: true });
    closeQuick();
    closeEmoji();

    // Marcador de "não lidas"
    if (c.unread) {
      const customerMsgs = c.messages.filter((m) => m.from === 'customer');
      const marker = customerMsgs[Math.max(0, customerMsgs.length - c.unread)];
      c.unreadMarker = marker?.id;
      c.unreadMarkerCount = c.unread;
      c.unread = 0;
    } else {
      c.unreadMarker = null;
    }

    el.input.value = state.drafts[id] || '';
    autoGrow();
    el.app.dataset.view = 'chat';
    renderAll();

    requestAnimationFrame(() => {
      const sep = $('#unread-sep');
      if (sep) sep.scrollIntoView({ block: 'center', behavior: 'instant' });
      else scrollToBottom(false);
      updateFab();
    });

    if (focus && c.stage === 'active' && !isMobile()) el.input.focus({ preventScroll: true });
    if (isOverlayDetails() && state.detailsOpen) setDetails(false);
  }

  function navigate(dir) {
    const ids = $$('.conv[data-id]').map((b) => b.dataset.id);
    if (!ids.length) return;
    const i = ids.indexOf(state.activeId);
    const next = ids[(i + dir + ids.length) % ids.length];
    openConversation(next, { focus: false });
    $(`.conv[data-id="${next}"]`)?.focus();
  }

  function selectNext() {
    const next = sortedConvs('active')[0] || sortedConvs('queue')[0];
    if (next) openConversation(next.id);
    else { state.activeId = null; renderAll(); }
  }

  /* ------------------------------------------------------------------------
     8. ROLAGEM
     ------------------------------------------------------------------------ */
  const nearBottom = () => el.messages.scrollHeight - el.messages.scrollTop - el.messages.clientHeight < 140;
  const scrollToBottom = (smooth = true) => el.messages.scrollTo({ top: el.messages.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });

  function updateFab() {
    const show = !nearBottom();
    el.fab.hidden = !show;
    if (!show) state.fabCount = 0;
    el.fabBadge.hidden = !state.fabCount;
    el.fabBadge.textContent = state.fabCount;
  }

  /* ------------------------------------------------------------------------
     9. MENSAGENS: ENVIO, RECEBIMENTO E SIMULAÇÃO
     ------------------------------------------------------------------------ */
  function pushMessage(c, from, data) {
    const m = M(from, { time: new Date(), enter: true, ...data });
    c.messages.push(m);
    return m;
  }

  function updateMessageStatus(c, m, status) {
    m.status = status;
    if (c.id === state.activeId) {
      const meta = $(`.msg[data-id="${m.id}"] .msg__meta`);
      if (meta) {
        meta.innerHTML = `<time datetime="${m.time.toISOString()}">${hhmm(m.time)}</time>${receiptHTML(status)}`;
        refreshIcons();
      }
    }
    renderSidebar();
  }

  function simulateDelivery(c, msgs) {
    setTimeout(() => msgs.forEach((m) => updateMessageStatus(c, m, 'sent')), 450);
    setTimeout(() => msgs.forEach((m) => updateMessageStatus(c, m, 'delivered')), 1100);
    if (c.presence !== 'online') return;
    setTimeout(() => {
      msgs.forEach((m) => updateMessageStatus(c, m, 'read'));
      if (c.autoReplies?.length && !c.replyPending) simulateCustomerReply(c);
    }, 2000);
  }

  function simulateCustomerReply(c) {
    c.replyPending = true;
    setTimeout(() => {
      if (c.stage !== 'active') { c.replyPending = false; return; }
      setTyping(c, true);
      setTimeout(() => {
        setTyping(c, false);
        c.replyPending = false;
        if (c.stage !== 'active') return;
        receiveMessage(c, { text: c.autoReplies.shift() });
        if (c.suggestions?.length) {
          c.aiSuggestion = c.suggestions.shift();
          if (c.id === state.activeId) renderComposerState();
        }
      }, 2200);
    }, 700);
  }

  function setTyping(c, on) {
    c.typing = on;
    if (c.id === state.activeId) {
      const stick = nearBottom();
      renderHeader(c);
      renderMessages();
      if (stick) scrollToBottom();
    }
    renderSidebar();
  }

  function receiveMessage(c, data) {
    const isActive = c.id === state.activeId;
    const stick = isActive && nearBottom();
    pushMessage(c, 'customer', data);
    if (!isActive) c.unread = (c.unread || 0) + 1;
    if (isActive) {
      renderMessages();
      if (stick) scrollToBottom();
      else { state.fabCount++; updateFab(); }
    }
    renderSidebar();
  }

  function sendMessage() {
    const c = active();
    if (!c || c.stage !== 'active') return;
    if (state.recording) { stopRecording(true); return; }

    const text = el.input.value.trim();
    if (!text && !state.attachments.length) return;

    if (state.mode === 'note') {
      if (!text) return;
      pushMessage(c, 'note', { text, author: 'Você' });
    } else {
      const sent = state.attachments.map((a) => pushMessage(c, 'agent', { attachment: a, status: 'sending' }));
      if (text) sent.push(pushMessage(c, 'agent', { text, replyTo: state.replyTo, status: 'sending' }));
      c.aiSuggestion = null;
      simulateDelivery(c, sent);
    }

    el.input.value = '';
    delete state.drafts[c.id];
    state.replyTo = null;
    state.attachments = [];
    autoGrow();
    renderMessages();
    renderComposerState();
    renderSidebar();
    scrollToBottom();
    el.input.focus();
  }

  /* ------------------------------------------------------------------------
     10. COMPOSITOR
     ------------------------------------------------------------------------ */
  function autoGrow() {
    el.input.style.height = 'auto';
    el.input.style.height = `${Math.min(el.input.scrollHeight, 180)}px`;
  }

  function updateSendState() {
    const canSend = !!el.input.value.trim() || state.attachments.length > 0 || !!state.recording;
    el.send.classList.toggle('is-send', canSend || state.mode === 'note');
    el.send.setAttribute('aria-label', canSend || state.mode === 'note' ? 'Enviar mensagem' : 'Gravar áudio');
  }

  function setMode(mode, { silent = false } = {}) {
    state.mode = mode;
    el.composer.classList.toggle('is-note', mode === 'note');
    $$('.composer__tab').forEach((t) => {
      const on = t.dataset.mode === mode;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
    });
    el.noteHint.hidden = mode !== 'note';
    el.input.placeholder = mode === 'note'
      ? 'Escreva uma nota interna… (o cliente não verá)'
      : 'Digite uma mensagem…  Use / para respostas rápidas';
    if (!silent) { renderComposerState(); el.input.focus(); }
  }

  function useSuggestion() {
    const c = active();
    if (!c?.aiSuggestion) return;
    el.input.value = c.aiSuggestion;
    c.aiSuggestion = null;
    autoGrow();
    renderComposerState();
    el.input.focus();
    el.input.setSelectionRange(el.input.value.length, el.input.value.length);
  }

  function polishText() {
    const t = el.input.value.trim();
    if (!t) { toast('Digite algo para a IA aprimorar o texto.', { type: 'info', icon: 'wand-sparkles' }); el.input.focus(); return; }
    const map = { vc: 'você', vcs: 'vocês', pq: 'porque', tb: 'também', tbm: 'também', obg: 'obrigado', blz: 'beleza', msg: 'mensagem', q: 'que', td: 'tudo', hj: 'hoje', pfv: 'por favor', pls: 'por favor', qdo: 'quando', mt: 'muito' };
    el.composer.classList.add('is-polishing');
    setTimeout(() => {
      let r = t.replace(/\b([a-zA-Z]+)\b/g, (w) => map[w.toLowerCase()] ?? w).replace(/\s+/g, ' ').trim();
      r = r.charAt(0).toUpperCase() + r.slice(1);
      if (!/[.!?…)\p{Extended_Pictographic}]$/u.test(r)) r += '.';
      el.input.value = r;
      autoGrow();
      updateSendState();
    }, 450);
    setTimeout(() => {
      el.composer.classList.remove('is-polishing');
      toast('Texto aprimorado pela Bacley IA', { type: 'success', icon: 'wand-sparkles' });
    }, 1000);
  }

  function insertAtCursor(text) {
    const { selectionStart: s, selectionEnd: e } = el.input;
    el.input.setRangeText(text, s, e, 'end');
    el.input.focus();
    autoGrow();
    renderComposerState();
  }

  /* Respostas rápidas ------------------------------------------------------ */
  function openQuick(filter = '') {
    const f = norm(filter);
    state.quick.items = QUICK_REPLIES.filter((q) => !f || q.cmd.startsWith(f) || norm(q.title).includes(f));
    state.quick.index = 0;
    state.quick.open = true;
    renderQuick();
  }
  function renderQuick() {
    const { items, index } = state.quick;
    el.quick.hidden = false;
    el.quick.innerHTML = `
      <div class="quick-replies__head"><span>Respostas rápidas</span><span><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></span></div>
      ${items.length ? items.map((q, i) => `
        <button class="qr ${i === index ? 'is-active' : ''}" role="option" aria-selected="${i === index}" data-qr="${i}">
          <span class="qr__top"><span class="qr__cmd">/${q.cmd}</span>${esc(q.title)}</span>
          <span class="qr__text">${esc(fillTemplate(q.text))}</span>
        </button>`).join('') : '<div class="qr-empty">Nenhuma resposta rápida encontrada</div>'}`;
    el.quick.querySelector('.qr.is-active')?.scrollIntoView({ block: 'nearest' });
  }
  function closeQuick() { state.quick.open = false; el.quick.hidden = true; }
  function fillTemplate(t) {
    const c = active();
    return t.replaceAll('{nome}', c ? firstName(c.name) : 'cliente').replaceAll('{atendente}', AGENT.name);
  }
  function applyQuick(i) {
    const q = state.quick.items[i];
    if (!q) return;
    el.input.value = fillTemplate(q.text);
    closeQuick();
    autoGrow();
    renderComposerState();
    el.input.focus();
  }

  /* Emojis ----------------------------------------------------------------- */
  function toggleEmoji() {
    const open = el.emoji.hidden;
    if (open) {
      el.emoji.innerHTML = `<div class="emoji-picker__label">Usados com frequência</div><div class="emoji-grid">${EMOJIS.map((e) => `<button data-emoji="${e}" aria-label="${e}">${e}</button>`).join('')}</div>`;
    }
    el.emoji.hidden = !open;
    $('#btn-emoji').setAttribute('aria-expanded', open);
  }
  function closeEmoji() { el.emoji.hidden = true; $('#btn-emoji').setAttribute('aria-expanded', 'false'); }

  /* Gravação de áudio ------------------------------------------------------ */
  function startRecording() {
    state.recording = { start: Date.now() };
    state.recording.timer = setInterval(() => {
      el.recTime.textContent = fmtDur((Date.now() - state.recording.start) / 1000);
    }, 250);
    el.recTime.textContent = '0:00';
    el.composer.classList.add('is-recording');
    el.recording.hidden = false;
    closeEmoji(); closeQuick();
    updateSendState();
  }
  function stopRecording(send) {
    if (!state.recording) return;
    clearInterval(state.recording.timer);
    const dur = Math.max(1, Math.round((Date.now() - state.recording.start) / 1000));
    state.recording = null;
    el.composer.classList.remove('is-recording');
    el.recording.hidden = true;
    updateSendState();
    if (send) {
      const c = active();
      const m = pushMessage(c, 'agent', { audio: { duration: dur }, status: 'sending' });
      simulateDelivery(c, [m]);
      renderMessages();
      renderSidebar();
      scrollToBottom();
    }
  }

  /* Reprodução de áudio (simulada) ---------------------------------------- */
  function playAudio(wrap) {
    if (state.playing?.wrap === wrap) { stopAudio(); return; }
    stopAudio();
    const dur = +wrap.dataset.duration;
    const bars = $$('.audio__wave i', wrap);
    const time = $('.audio__time', wrap);
    const btn = $('.audio__play', wrap);
    btn.innerHTML = icon('pause'); refreshIcons();
    btn.setAttribute('aria-label', 'Pausar áudio');
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / (dur * 1000));
      const played = Math.floor(p * bars.length);
      bars.forEach((b, i) => b.classList.toggle('is-played', i < played));
      time.textContent = fmtDur(dur * (1 - p));
      if (p < 1) state.playing.raf = requestAnimationFrame(step);
      else stopAudio();
    };
    state.playing = { wrap, raf: requestAnimationFrame(step) };
  }
  function stopAudio() {
    if (!state.playing) return;
    const { wrap, raf } = state.playing;
    cancelAnimationFrame(raf);
    state.playing = null;
    if (!wrap.isConnected) return;
    $$('.audio__wave i', wrap).forEach((b) => b.classList.remove('is-played'));
    $('.audio__time', wrap).textContent = fmtDur(+wrap.dataset.duration);
    const btn = $('.audio__play', wrap);
    btn.innerHTML = icon('play'); refreshIcons();
    btn.setAttribute('aria-label', 'Reproduzir áudio');
  }

  /* ------------------------------------------------------------------------
     11. BUSCA NA CONVERSA
     ------------------------------------------------------------------------ */
  function openChatSearch() {
    if (!active()) return;
    state.search.open = true;
    el.chatSearch.hidden = false;
    $('#btn-chat-search').setAttribute('aria-pressed', 'true');
    el.chatSearchInput.focus();
    el.chatSearchInput.select();
  }
  function closeChatSearch({ silent = false } = {}) {
    if (!state.search.open) return;
    state.search = { open: false, q: '', index: 0, total: 0 };
    el.chatSearch.hidden = true;
    el.chatSearchInput.value = '';
    $('#btn-chat-search').setAttribute('aria-pressed', 'false');
    if (!silent) renderMessages();
  }
  function updateSearchMatches(resetIndex = false) {
    const marks = $$('mark[data-match]', el.inner);
    state.search.total = marks.length;
    if (resetIndex || state.search.index >= marks.length) state.search.index = Math.max(0, marks.length - 1);
    if (!state.search.q.trim()) el.chatSearchCount.textContent = '';
    else if (!marks.length) el.chatSearchCount.textContent = 'Nenhum resultado';
    else {
      el.chatSearchCount.textContent = `${state.search.index + 1} de ${marks.length}`;
      marks.forEach((mk, i) => mk.classList.toggle('is-current', i === state.search.index));
    }
  }
  function gotoMatch(dir) {
    const { total } = state.search;
    if (!total) return;
    state.search.index = (state.search.index + dir + total) % total;
    updateSearchMatches();
    $('mark.is-current', el.inner)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------------
     12. AÇÕES DE ATENDIMENTO (assumir, finalizar, transferir)
     ------------------------------------------------------------------------ */
  function takeOver(c = active()) {
    if (!c || c.stage !== 'queue') return;
    c.stage = 'active';
    c.since = new Date();
    pushMessage(c, 'system', { text: '<b>Você</b> assumiu o atendimento', icon: 'hand' });
    c.aiSuggestion = `Olá, ${firstName(c.name)}! Meu nome é ${AGENT.name} e vou dar continuidade ao seu atendimento. ${c.suggestOnTake || 'Como posso ajudar?'}`;
    renderAll();
    scrollToBottom();
    el.input.focus();
    toast(`Você assumiu o atendimento de ${firstName(c.name)}`, { type: 'success', icon: 'hand' });
  }

  function archive(c, { stage, systemText, systemIcon, toastText }) {
    const prevStage = c.stage;
    const sysMsg = pushMessage(c, 'system', { text: systemText, icon: systemIcon });
    c.stage = stage;
    selectNext();
    toast(toastText, {
      type: 'success',
      action: 'Desfazer',
      duration: 6000,
      onAction: () => {
        c.stage = prevStage;
        c.messages = c.messages.filter((m) => m !== sysMsg);
        openConversation(c.id);
      },
    });
  }

  function openFinishDialog() {
    const c = active();
    if (!c || c.stage !== 'active') return;
    $('#finish-sub').textContent = `${c.name} · ${elapsed(c.since)} em atendimento · Protocolo ${c.protocol}`;
    $('#dialog-finish').showModal();
  }

  function openTransferDialog() {
    if (!active()) return;
    $('#transfer-search').value = '';
    renderTransferList('');
    $('#dialog-transfer').showModal();
    $('#transfer-search').focus();
  }

  function renderTransferList(filter) {
    const f = norm(filter);
    const deps = DEPARTMENTS.filter((d) => !f || norm(d.name).includes(f));
    const team = TEAM.filter((a) => !f || norm(`${a.name} ${a.role}`).includes(f));
    const opt = (o, visual, meta) => `
      <label class="transfer-opt">
        <input type="radio" name="target" value="${esc(o.name)}" ${o.disabled ? 'disabled' : ''} required>
        <span>${visual}<span class="transfer-opt__info"><span class="transfer-opt__name">${esc(o.name)}</span><span class="transfer-opt__meta">${esc(meta)}</span></span><span class="transfer-opt__load">${esc(o.load)}</span></span>
      </label>`;
    let html = '';
    if (deps.length) html += `<div class="transfer-list__label">Setores</div>${deps.map((d) => opt(d, `<span class="transfer-opt__icon">${icon(d.icon)}</span>`, d.meta)).join('')}`;
    if (team.length) html += `<div class="transfer-list__label">Atendentes</div>${team.map((a) => opt(a, avatarHTML({ name: a.name, presence: a.presence }, 'sm'), a.role)).join('')}`;
    if (!html) html = '<div class="qr-empty">Nenhum resultado</div>';
    $('#transfer-list').innerHTML = html;
    refreshIcons();
  }

  /* ------------------------------------------------------------------------
     13. PAINÉIS, TEMA E PREFERÊNCIAS
     ------------------------------------------------------------------------ */
  function setDetails(open) {
    state.detailsOpen = open;
    el.app.classList.toggle('details-open', open);
    const btn = $('#btn-details');
    btn.setAttribute('aria-pressed', open);
    btn.setAttribute('aria-label', open ? 'Ocultar detalhes do contato' : 'Mostrar detalhes do contato');
  }

  function setCollapsed(collapsed) {
    el.app.classList.toggle('is-collapsed', collapsed);
    const btn = $('#btn-collapse');
    const label = collapsed ? 'Expandir menu' : 'Recolher menu';
    btn.setAttribute('aria-label', `${label} lateral`);
    btn.dataset.tooltip = label;
    try { localStorage.setItem('bacley-sidebar', collapsed ? 'collapsed' : 'expanded'); } catch (e) { /* noop */ }
  }

  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    $('meta[name="theme-color"]').content = next === 'light' ? '#eceff4' : '#0f1218';
    try { localStorage.setItem('bacley-theme', next); } catch (e) { /* noop */ }
  }

  const STATUS_LABEL = { online: 'Disponível', busy: 'Ocupado', away: 'Ausente' };
  function setAgentStatus(status) {
    state.agentStatus = status;
    $('#agent-presence').className = `presence presence--${status}`;
    const label = $('#agent-status-label');
    label.textContent = STATUS_LABEL[status];
    label.dataset.status = status;
    $$('#agent-menu [data-status]').forEach((b) => b.setAttribute('aria-checked', b.dataset.status === status));
    toast(status === 'online'
      ? 'Você está disponível para novos atendimentos'
      : `Status: ${STATUS_LABEL[status]} — novas conversas não serão atribuídas a você`, { type: status === 'online' ? 'success' : 'warn', icon: 'user-round' });
  }

  function toggleMenu(menuId, btn, force) {
    const menu = $(menuId);
    const open = force ?? menu.hidden;
    closeMenus();
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    if (open) menu.querySelector('[role^="menuitem"]')?.focus();
  }
  function closeMenus() {
    ['#agent-menu', '#more-menu'].forEach((id) => { $(id).hidden = true; });
    $('#btn-agent').setAttribute('aria-expanded', 'false');
    $('#btn-more').setAttribute('aria-expanded', 'false');
  }

  function exportConversation() {
    const c = active();
    if (!c) return;
    const who = (m) => ({ customer: c.name, bot: 'Bacley IA', agent: m.author || AGENT.name, note: `[NOTA] ${m.author || AGENT.name}`, system: 'Sistema' }[m.from]);
    const lines = c.messages.map((m) => `[${m.time.toLocaleDateString('pt-BR')} ${hhmm(m.time)}] ${who(m)}: ${stripTags(snippet(m))}`);
    const blob = new Blob([`Conversa com ${c.name} — Protocolo ${c.protocol}\n\n${lines.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `conversa-${c.id}-${c.protocol}.txt` });
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Conversa exportada (.txt)', { type: 'success', icon: 'download' });
  }

  /* ------------------------------------------------------------------------
     14. TOASTS
     ------------------------------------------------------------------------ */
  function toast(msg, { type = 'info', icon: ic, action, onAction, duration = 3800 } = {}) {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `${icon(ic || { success: 'circle-check', info: 'info', warn: 'triangle-alert' }[type])}<span class="toast__msg">${esc(msg)}</span>${action ? `<button class="toast__action">${esc(action)}</button>` : ''}`;
    el.toasts.appendChild(t);
    refreshIcons();
    const close = () => {
      if (t.classList.contains('is-leaving')) return;
      t.classList.add('is-leaving');
      t.addEventListener('animationend', () => t.remove(), { once: true });
    };
    const timer = setTimeout(close, duration);
    if (action) t.querySelector('.toast__action').addEventListener('click', () => { clearTimeout(timer); onAction?.(); close(); });
    while (el.toasts.children.length > 3) el.toasts.firstElementChild.remove();
  }

  /* ------------------------------------------------------------------------
     15. RELÓGIO (cronômetros de SLA ao vivo)
     ------------------------------------------------------------------------ */
  function updateTakeoverTimer() {
    const c = active();
    if (c?.stage === 'queue') el.takeoverTimer.textContent = elapsed(c.since);
  }
  function tick() {
    $$('.timer[data-since]').forEach((t) => {
      const since = +t.dataset.since;
      $('.timer__value', t).textContent = elapsed(since);
      if (t.dataset.sla === 'true') {
        const cls = slaClass(since);
        t.classList.remove('timer--ok', 'timer--warn', 'timer--danger');
        t.classList.add(`timer--${cls}`);
      }
    });
    updateTakeoverTimer();
  }

  /* ------------------------------------------------------------------------
     16. EVENTOS
     ------------------------------------------------------------------------ */
  function bindEvents() {
    /* Sidebar ------------------------------------------------------------- */
    $('.sidebar__nav').addEventListener('click', (e) => {
      const conv = e.target.closest('.conv[data-id]');
      if (conv) { openConversation(conv.dataset.id); return; }
      const header = e.target.closest('.group__header');
      if (header) {
        if (el.app.classList.contains('is-collapsed')) { setCollapsed(false); return; }
        const open = header.getAttribute('aria-expanded') !== 'true';
        header.setAttribute('aria-expanded', open);
        const body = header.nextElementSibling;
        if (body?.classList.contains('group__body')) body.hidden = !open;
      }
    });

    el.search.addEventListener('input', () => { state.query = el.search.value; renderSidebar(); });
    el.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const first = $('.conv[data-id]'); if (first) openConversation(first.dataset.id); }
      if (e.key === 'Escape') { el.search.value = ''; state.query = ''; renderSidebar(); el.search.blur(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); $('.conv[data-id]')?.focus(); }
    });

    $$('.chip').forEach((chip) => chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      $$('.chip').forEach((c) => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-selected', c === chip); });
      renderSidebar();
    }));

    $('#btn-collapse').addEventListener('click', () => setCollapsed(!el.app.classList.contains('is-collapsed')));
    $('#btn-theme').addEventListener('click', toggleTheme);
    $('#btn-agent').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu('#agent-menu', e.currentTarget); });
    $('#agent-menu').addEventListener('click', (e) => {
      const item = e.target.closest('.menu__item');
      if (!item) return;
      if (item.dataset.status) setAgentStatus(item.dataset.status);
      if (item.dataset.action === 'shortcuts') $('#dialog-shortcuts').showModal();
      closeMenus();
    });

    /* Header -------------------------------------------------------------- */
    $('#btn-back').addEventListener('click', () => { el.app.dataset.view = 'list'; });
    $('#btn-contact').addEventListener('click', () => setDetails(true));
    $('#btn-details').addEventListener('click', () => setDetails(!state.detailsOpen));
    $('#btn-details-close').addEventListener('click', () => setDetails(false));
    $('#backdrop').addEventListener('click', () => setDetails(false));
    $('#btn-chat-search').addEventListener('click', () => (state.search.open ? closeChatSearch() : openChatSearch()));
    $('#btn-transfer').addEventListener('click', openTransferDialog);
    $('#btn-finish').addEventListener('click', openFinishDialog);
    $('#btn-more').addEventListener('click', (e) => { e.stopPropagation(); toggleMenu('#more-menu', e.currentTarget); });
    $('#more-menu').addEventListener('click', (e) => {
      const item = e.target.closest('.menu__item');
      const c = active();
      if (!item || !c) return;
      closeMenus();
      switch (item.dataset.action) {
        case 'mark-unread':
          c.unread = Math.max(1, c.unread);
          renderSidebar();
          toast('Conversa marcada como não lida', { icon: 'mail-warning' });
          break;
        case 'pin':
          c.pinned = !c.pinned;
          renderSidebar();
          toast(c.pinned ? 'Conversa fixada no topo' : 'Conversa desafixada', { icon: 'pin' });
          break;
        case 'export': exportConversation(); break;
        case 'block': toast(`${c.name} foi bloqueado (simulação)`, { type: 'warn', icon: 'ban' }); break;
        default:
      }
    });

    /* Busca na conversa --------------------------------------------------- */
    el.chatSearchInput.addEventListener('input', () => {
      state.search.q = el.chatSearchInput.value;
      renderMessages();
      updateSearchMatches(true);
      $('mark.is-current', el.inner)?.scrollIntoView({ block: 'center' });
    });
    el.chatSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); gotoMatch(e.shiftKey ? 1 : -1); }
      if (e.key === 'Escape') { e.stopPropagation(); closeChatSearch(); el.input.focus(); }
    });
    $('#search-prev').addEventListener('click', () => gotoMatch(-1));
    $('#search-next').addEventListener('click', () => gotoMatch(1));
    $('#search-close').addEventListener('click', () => closeChatSearch());

    /* Mensagens ----------------------------------------------------------- */
    el.messages.addEventListener('scroll', updateFab, { passive: true });
    el.fab.addEventListener('click', () => { state.fabCount = 0; scrollToBottom(); });

    el.inner.addEventListener('click', (e) => {
      const c = active();
      const msgEl = e.target.closest('.msg[data-id]');
      const m = msgEl && c?.messages.find((x) => x.id === msgEl.dataset.id);

      const pick = e.target.closest('.react-picker [data-emoji]');
      if (pick && m) { toggleReaction(m, pick.dataset.emoji); return; }

      const jump = e.target.closest('[data-jump]');
      if (jump) { flashMessage(jump.dataset.jump); return; }

      const btn = e.target.closest('[data-act]');
      if (!btn || !m) return;
      switch (btn.dataset.act) {
        case 'reply':
          if (c.stage !== 'active') { toast('Assuma o atendimento para responder', { type: 'warn', icon: 'hand' }); return; }
          state.replyTo = m.id;
          renderComposerState();
          el.input.focus();
          break;
        case 'react': openReactPicker(msgEl); break;
        case 'toggle-reaction': toggleReaction(m, btn.dataset.emoji); break;
        case 'copy':
          navigator.clipboard?.writeText(snippet(m)).catch(() => {});
          toast('Mensagem copiada', { icon: 'copy' });
          break;
        case 'download': toast(`Baixando ${m.attachment.name}…`, { icon: 'download' }); break;
        case 'play': playAudio(btn.closest('.audio')); break;
        default:
      }
    });
    el.inner.addEventListener('keydown', (e) => {
      const jump = e.target.closest('[data-jump]');
      if (jump && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); flashMessage(jump.dataset.jump); }
    });

    /* Compositor ---------------------------------------------------------- */
    el.input.addEventListener('input', () => {
      autoGrow();
      const match = el.input.value.match(/^\/([\w-]*)$/);
      if (match) openQuick(match[1]); else if (state.quick.open) closeQuick();
      renderComposerState();
    });

    el.input.addEventListener('keydown', (e) => {
      if (state.quick.open) {
        const n = state.quick.items.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); state.quick.index = (state.quick.index + 1) % Math.max(n, 1); renderQuick(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); state.quick.index = (state.quick.index - 1 + n) % Math.max(n, 1); renderQuick(); return; }
        if ((e.key === 'Enter' || e.key === 'Tab') && n) { e.preventDefault(); applyQuick(state.quick.index); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeQuick(); return; }
      }
      if (e.key === 'Tab' && !e.shiftKey && !el.input.value && !el.aiSuggest.hidden) { e.preventDefault(); useSuggestion(); return; }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendMessage(); return; }
      if (e.key === 'Escape' && state.replyTo) { e.stopPropagation(); state.replyTo = null; renderComposerState(); }
    });

    el.send.addEventListener('click', () => {
      if (state.recording || el.input.value.trim() || state.attachments.length || state.mode === 'note') sendMessage();
      else startRecording();
    });
    $('#rec-cancel').addEventListener('click', () => { stopRecording(false); toast('Gravação descartada', { icon: 'trash-2' }); });

    $$('.composer__tab').forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));
    $('#btn-emoji').addEventListener('click', (e) => { e.stopPropagation(); closeQuick(); toggleEmoji(); });
    el.emoji.addEventListener('click', (e) => { const b = e.target.closest('[data-emoji]'); if (b) insertAtCursor(b.dataset.emoji); });
    $('#btn-quick').addEventListener('click', (e) => {
      e.stopPropagation();
      closeEmoji();
      if (state.quick.open) { closeQuick(); return; }
      if (!el.input.value) el.input.value = '/';
      openQuick(el.input.value.startsWith('/') ? el.input.value.slice(1) : '');
      el.input.focus();
    });
    el.quick.addEventListener('mousedown', (e) => e.preventDefault()); // mantém o foco no textarea
    el.quick.addEventListener('click', (e) => { const b = e.target.closest('[data-qr]'); if (b) applyQuick(+b.dataset.qr); });
    $('#btn-ai-rewrite').addEventListener('click', polishText);
    $('#ai-use').addEventListener('click', useSuggestion);
    $('#ai-dismiss').addEventListener('click', () => { const c = active(); if (c) c.aiSuggestion = null; renderComposerState(); el.input.focus(); });

    $('#btn-attach').addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', () => { addFiles(el.fileInput.files); el.fileInput.value = ''; });
    el.composerWrap.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-remove-att]');
      if (rm) { state.attachments.splice(+rm.dataset.removeAtt, 1); renderComposerState(); }
      if (e.target.closest('[data-act="cancel-reply"]')) { state.replyTo = null; renderComposerState(); el.input.focus(); }
    });

    /* Arrastar e soltar arquivos */
    let dragDepth = 0;
    el.chat.addEventListener('dragenter', (e) => {
      if (active()?.stage !== 'active' || !e.dataTransfer?.types.includes('Files')) return;
      dragDepth++; el.chat.classList.add('is-dragging');
    });
    el.chat.addEventListener('dragover', (e) => { if (el.chat.classList.contains('is-dragging')) e.preventDefault(); });
    el.chat.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; el.chat.classList.remove('is-dragging'); } });
    el.chat.addEventListener('drop', (e) => {
      if (!el.chat.classList.contains('is-dragging')) return;
      e.preventDefault(); dragDepth = 0; el.chat.classList.remove('is-dragging');
      addFiles(e.dataTransfer.files);
    });

    /* Fila ---------------------------------------------------------------- */
    $('#btn-takeover').addEventListener('click', () => takeOver());
    $('#btn-takeover-transfer').addEventListener('click', openTransferDialog);
    $('#btn-next-queue').addEventListener('click', () => {
      const next = sortedConvs('queue')[0];
      if (!next) { toast('Não há clientes na fila no momento 🎉', { type: 'success' }); return; }
      openConversation(next.id);
      takeOver(next);
    });

    /* Diálogos ------------------------------------------------------------ */
    const finishDlg = $('#dialog-finish');
    finishDlg.addEventListener('close', () => {
      const form = $('#form-finish');
      if (finishDlg.returnValue === 'confirm') {
        const c = active();
        const data = new FormData(form);
        const reason = data.get('reason');
        archive(c, {
          stage: 'closed',
          systemText: `Atendimento finalizado · <b>${esc(reason)}</b>`,
          systemIcon: 'circle-check',
          toastText: `Atendimento de ${firstName(c.name)} finalizado${data.get('csat') ? ' · CSAT enviado' : ''}`,
        });
      }
      form.reset();
      finishDlg.returnValue = '';
    });

    const transferDlg = $('#dialog-transfer');
    $('#transfer-search').addEventListener('input', (e) => renderTransferList(e.target.value));
    transferDlg.addEventListener('close', () => {
      const form = $('#form-transfer');
      if (transferDlg.returnValue === 'confirm') {
        const target = new FormData(form).get('target');
        const c = active();
        if (target && c) {
          archive(c, {
            stage: 'transferred',
            systemText: `Conversa transferida para <b>${esc(target)}</b>`,
            systemIcon: 'arrow-right-left',
            toastText: `${firstName(c.name)} transferido para ${target}`,
          });
        }
      }
      form.reset();
      transferDlg.returnValue = '';
    });

    // Fecha diálogos ao clicar fora
    $$('dialog').forEach((d) => d.addEventListener('click', (e) => { if (e.target === d) d.close('cancel'); }));

    /* Painel de detalhes -------------------------------------------------- */
    el.details.addEventListener('click', (e) => {
      const c = active();
      if (!c) return;
      const copy = e.target.closest('[data-copy]');
      if (copy) { navigator.clipboard?.writeText(copy.dataset.copy).catch(() => {}); toast('Copiado para a área de transferência', { icon: 'copy' }); return; }
      const rm = e.target.closest('[data-remove-tag]');
      if (rm) { c.tags.splice(+rm.dataset.removeTag, 1); renderDetails(); return; }
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'add-tag') showTagInput(btn);
      if (btn.dataset.act === 'regen') {
        const card = $('#ai-card');
        card.classList.add('is-loading');
        setTimeout(() => { card.classList.remove('is-loading'); toast('Resumo atualizado pela Bacley IA', { type: 'success', icon: 'sparkles' }); }, 1200);
      }
      if (btn.dataset.act === 'simulate') toast(`${btn.dataset.label}: ação simulada no protótipo`, { icon: 'mouse-pointer-click' });
    });
    el.details.addEventListener('click', (e) => { if (e.target.closest('.history__item')) e.preventDefault(); });

    /* Globais ------------------------------------------------------------- */
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#emoji-picker, #btn-emoji')) closeEmoji();
      if (!e.target.closest('#quick-replies, #btn-quick, #composer-input')) closeQuick();
      if (!e.target.closest('.menu, #btn-agent, #btn-more')) closeMenus();
      if (!e.target.closest('.react-picker, [data-act="react"]')) closeReactPicker();
    });

    document.addEventListener('keydown', (e) => {
      if ($('dialog[open]')) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && !e.shiftKey && key === 'k') {
        e.preventDefault();
        if (el.app.classList.contains('is-collapsed')) setCollapsed(false);
        if (isMobile()) el.app.dataset.view = 'list';
        el.search.focus(); el.search.select();
      } else if (mod && e.key === '/') {
        e.preventDefault(); $('#dialog-shortcuts').showModal();
      } else if (mod && e.shiftKey && key === 'f') {
        e.preventDefault(); openChatSearch();
      } else if (mod && e.shiftKey && key === 'n') {
        e.preventDefault(); if (active()?.stage === 'active') setMode(state.mode === 'note' ? 'reply' : 'note');
      } else if (mod && e.shiftKey && key === 'e') {
        e.preventDefault(); openFinishDialog();
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault(); navigate(e.key === 'ArrowUp' ? -1 : 1);
      } else if (e.key === 'Escape') {
        if (!el.emoji.hidden) closeEmoji();
        else if ($('.react-picker')) closeReactPicker();
        else if (!$('#agent-menu').hidden || !$('#more-menu').hidden) closeMenus();
        else if (state.search.open) closeChatSearch();
        else if (state.detailsOpen && isOverlayDetails()) setDetails(false);
        else if (state.recording) stopRecording(false);
      }
    });

    /* Responsivo */
    let wasOverlay = isOverlayDetails();
    window.addEventListener('resize', () => {
      const overlay = isOverlayDetails();
      if (overlay && !wasOverlay && state.detailsOpen) setDetails(false);
      wasOverlay = overlay;
    });

    // Mantém o botão "ir para o fim" acima do compositor
    new ResizeObserver(([entry]) => {
      el.view.style.setProperty('--composer-h', `${entry.contentRect.height + 16}px`);
    }).observe(el.composerWrap);
  }

  /* Helpers de eventos ---------------------------------------------------- */
  function addFiles(files) {
    if (!files?.length) return;
    [...files].forEach((f) => state.attachments.push({ name: f.name, size: f.size, ext: (f.name.split('.').pop() || 'arq').toLowerCase() }));
    renderComposerState();
    el.input.focus();
    toast(`${files.length} arquivo(s) pronto(s) para envio`, { icon: 'paperclip' });
  }

  function openReactPicker(msgEl) {
    closeReactPicker();
    msgEl.classList.add('is-reacting');
    const picker = document.createElement('div');
    picker.className = 'react-picker';
    picker.innerHTML = REACTIONS.map((e) => `<button data-emoji="${e}" aria-label="Reagir com ${e}">${e}</button>`).join('');
    msgEl.appendChild(picker);
    picker.querySelector('button').focus();
  }
  function closeReactPicker() {
    $$('.react-picker').forEach((p) => p.remove());
    $$('.msg.is-reacting').forEach((m) => m.classList.remove('is-reacting'));
  }
  function toggleReaction(m, emoji) {
    const i = m.reactions.findIndex((r) => r.by === 'me' && r.emoji === emoji);
    if (i >= 0) m.reactions.splice(i, 1);
    else {
      m.reactions = m.reactions.filter((r) => r.by !== 'me'); // uma reação por pessoa
      m.reactions.push({ emoji, by: 'me' });
    }
    const top = el.messages.scrollTop;
    renderMessages();
    el.messages.scrollTop = top;
  }
  function flashMessage(id) {
    const target = $(`.msg[data-id="${id}"]`, el.inner);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    target.classList.remove('is-flash');
    void target.offsetWidth;
    target.classList.add('is-flash');
  }
  function showTagInput(btn) {
    const input = Object.assign(document.createElement('input'), { className: 'tag-input', placeholder: 'Nova etiqueta…', maxLength: 24 });
    input.setAttribute('aria-label', 'Nova etiqueta');
    btn.replaceWith(input);
    input.focus();
    const commit = (save) => {
      const v = input.value.trim();
      const c = active();
      if (save && v && c && !c.tags.includes(v)) c.tags.push(v);
      renderDetails();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commit(true);
      if (e.key === 'Escape') { e.stopPropagation(); commit(false); }
    });
    input.addEventListener('blur', () => commit(true), { once: true });
  }

  /* ------------------------------------------------------------------------
     17. SIMULAÇÃO DE EVENTOS EM TEMPO REAL
     ------------------------------------------------------------------------ */
  function simulateNewArrival() {
    setTimeout(() => {
      const c = {
        id: 'fernanda', name: 'Fernanda Lima', avatar: IMG('photo-1438761681033-6461ffad8d80'),
        presence: 'online', channel: 'whatsapp', stage: 'queue', since: new Date(), unread: 2, isNew: true, priority: 'Normal',
        phone: '+55 85 98111-2233', email: 'fernanda.lima@email.com', city: 'Fortaleza, CE', customerSince: 'ago/2025', plan: 'Essencial', protocol: '20261004-0207',
        tags: ['Pedido'], history: [],
        summary: 'Cliente relata que o pedido #48213 ainda não foi entregue. A IA consultou o rastreio, mas a transportadora não retornou status.',
        intent: 'Rastreio de pedido', sentiment: 'Preocupada',
        messages: [
          M('bot', { text: 'Olá, Fernanda! Sou a Bacley IA. Em que posso ajudar? 😊', time: secsAgo(40), status: 'read' }),
          M('customer', { text: 'Oi! Meu pedido #48213 ainda não chegou 😕', time: secsAgo(8) }),
          M('customer', { text: 'Podem verificar pra mim?', time: secsAgo(2) }),
        ],
        suggestOnTake: 'Já estou consultando o pedido #48213 junto à transportadora. Um instante!',
      };
      state.convs.push(c);
      renderSidebar();
      setTimeout(() => { delete c.isNew; }, 2000);
      toast('Novo cliente na fila: Fernanda Lima', { type: 'info', icon: 'bell-ring', action: 'Ver', onAction: () => openConversation(c.id) });
    }, 20000);
  }

  /* ------------------------------------------------------------------------
     18. INICIALIZAÇÃO
     ------------------------------------------------------------------------ */
  function init() {
    try { if (localStorage.getItem('bacley-sidebar') === 'collapsed') setCollapsed(true); } catch (e) { /* noop */ }
    setDetails(state.detailsOpen);
    if (isMobile()) el.app.dataset.view = 'list';
    bindEvents();
    renderAll();
    requestAnimationFrame(() => { scrollToBottom(false); updateFab(); });
    setInterval(tick, 1000);
    simulateNewArrival();
  }

  init();
})();
