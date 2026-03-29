/**
 * IPTU Nova Iguaçu — Interface da Calculadora
 * Módulo de UI: navbar, tabs, calculadora, filtro, base legal.
 *
 * Sem dependências externas. Sem ícones.
 * Lógica de cálculo permanece em iptu.js (intacta).
 */
import "./style.css";
import { getListaBairros, calcularParaSite, BASE_LEGAL_IPTU } from "./iptu.js";
import { calculateValorVenalTerreno } from "./services/iptuTerrenoService.js";
import { calculateValorVenalConstrucao } from "./services/iptuConstrucaoService.js";
import { loadIptuBaseData } from "./services/iptuDataService.js";
import { loadIptuTerrenoData } from "./services/iptuTerrenoService.js";
import { loadIptuConstrucaoData } from "./services/iptuConstrucaoService.js";
import { normalizeNeighborhoodText } from "./services/normalizers.js";
import html2pdf from "html2pdf.js";

// ==========================================================================
// UTILITÁRIOS DOM
// ==========================================================================
const $ = (id) => document.getElementById(id);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

let venalTerrenoData = null;
let venalConstrucaoData = null;
let venalBaseData = null;
const ZONA_FISCAL_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"];
const zeGuidedCatalog = {
  terreno: [],
  construcao: [],
};
const zeUiState = {
  terreno: { regiao: "", codigo: "", noMatchWarnKey: "" },
  construcao: { regiao: "", codigo: "", noMatchWarnKey: "" },
};
const UI_ERROR_REASON = {
  REQUIRED_FIELD: "REQUIRED_FIELD",
  INVALID_COMBINATION: "INVALID_COMBINATION",
  NO_MATCH_BASE: "NO_MATCH_BASE",
  NO_MATCH_ZONA_ESPECIAL: "NO_MATCH_ZONA_ESPECIAL",
  INCOMPATIBLE_CALCULATION_TYPE: "INCOMPATIBLE_CALCULATION_TYPE",
  UNEXPECTED: "UNEXPECTED",
};

let modalReviewAction = null;

function buildUiError(reason, message, details = {}, checks = []) {
  return {
    ok: false,
    reason,
    message,
    details,
    checks,
  };
}

function formatUiErrorReason(reason, details = {}) {
  if (reason === UI_ERROR_REASON.NO_MATCH_ZONA_ESPECIAL) {
    return "Motivo provável: não foi encontrada correspondência na base para a combinação selecionada de grupo/região, bairro e logradouro.";
  }
  if (reason === UI_ERROR_REASON.NO_MATCH_BASE) {
    return "Motivo provável: não existe registro correspondente na base para os parâmetros informados.";
  }
  if (reason === UI_ERROR_REASON.REQUIRED_FIELD) {
    return `Motivo provável: campo obrigatório ausente (${details.fieldLabel || "não informado"}).`;
  }
  if (reason === UI_ERROR_REASON.INVALID_COMBINATION) {
    return "Motivo provável: a combinação atual não é válida para o tipo de cálculo selecionado.";
  }
  if (reason === UI_ERROR_REASON.INCOMPATIBLE_CALCULATION_TYPE) {
    return "Motivo provável: o tipo de cálculo selecionado não é compatível com os dados preenchidos.";
  }
  return "Motivo provável: ocorreu uma falha inesperada durante o processamento.";
}

function closeAppModal() {
  const modal = $("appModal");
  if (!modal) return;
  modal.classList.add("hidden");
  modalReviewAction = null;

  // Garante que os seletores ZE sejam repovoados após qualquer falha exibida no modal.
  refreshZonaEspecialOptions("terreno");
  refreshZonaEspecialOptions("construcao");
}

function showAppModal(payload) {
  const modal = $("appModal");
  const titleEl = $("appModalTitle");
  const messageEl = $("appModalMessage");
  const reasonEl = $("appModalReason");
  const checksEl = $("appModalChecks");
  const reviewBtn = $("appModalReview");

  if (!modal || !titleEl || !messageEl || !reasonEl || !checksEl || !reviewBtn) return;

  titleEl.textContent = payload?.title || "Atenção";
  messageEl.textContent = payload?.message || "Não foi possível concluir esta operação.";

  const reasonText = payload?.reasonText || "";
  reasonEl.textContent = reasonText;
  reasonEl.classList.toggle("hidden", !reasonText);

  checksEl.innerHTML = "";
  const checks = Array.isArray(payload?.checks) ? payload.checks : [];
  if (checks.length > 0) {
    checks.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      checksEl.appendChild(li);
    });
  }
  checksEl.classList.toggle("hidden", checks.length === 0);

  modalReviewAction = typeof payload?.onReview === "function" ? payload.onReview : null;
  reviewBtn.classList.toggle("hidden", !modalReviewAction);

  modal.classList.remove("hidden");
}

function openStructuredErrorModal(error, title, onReview) {
  const safeError = error || buildUiError(UI_ERROR_REASON.UNEXPECTED, "Falha inesperada.");
  showAppModal({
    title,
    message: safeError.message,
    reasonText: formatUiErrorReason(safeError.reason, safeError.details),
    checks: safeError.checks,
    onReview,
  });
}

function initAppModal() {
  $("appModalClose")?.addEventListener("click", closeAppModal);
  $("appModalOk")?.addEventListener("click", closeAppModal);
  $("appModalReview")?.addEventListener("click", () => {
    const action = modalReviewAction;
    closeAppModal();
    if (action) action();
  });

  $("appModal")?.addEventListener("click", (event) => {
    const target = event.target;
    if (target?.dataset?.modalClose === "backdrop") {
      closeAppModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const modal = $("appModal");
      if (modal && !modal.classList.contains("hidden")) {
        closeAppModal();
      }
    }
  });
}

/**
 * Rola suavemente até o elemento com o id dado, sem alterar a URL.
 * Usa history.replaceState para garantir que nenhum fragmento (#) seja adicionado.
 */
function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  // Mantém a URL limpa (sem #fragmento)
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

/**
 * Intercepta todos os cliques em âncoras internas (href="#...").
 * Impede a navegação padrão (que adicionaria o hash à URL)
 * e substitui pelo scroll suave via scrollToId.
 */
function initScrollLinks() {
  document.addEventListener("click", (e) => {
    const anchor = e.target.closest("a[href^='#']");
    if (!anchor) return;
    const id = anchor.getAttribute("href").slice(1);
    if (!id) return; // href="#" puro — ignora
    e.preventDefault();
    scrollToId(id);
  });
}

function initHomeToolHubLinks() {
  $$('[data-open-calc-mode]').forEach((link) => {
    link.addEventListener("click", () => {
      const mode = link.dataset.openCalcMode;
      const modeSelect = $("calcModo");
      if (!mode || !modeSelect) return;

      modeSelect.value = mode;
      modeSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

// ==========================================================================
// TEMA (dark / light toggle)
// ==========================================================================
function initTheme() {
  const root = document.documentElement;
  const btn = $('themeToggle');

  function applyTheme(theme) {
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
    if (btn) {
      btn.textContent = theme === 'dark' ? 'Tema: Claro' : 'Tema: Escuro';
    }
  }

  // Determina tema inicial
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefersDark ? 'dark' : 'light'));

  btn?.addEventListener('click', () => {
    applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

// ==========================================================================
// NAVBAR (glass + scroll shadow + mobile toggle)
// ==========================================================================
function initNavbar() {
  const navbar = $("navbar");
  const toggle = $("btnMenuToggle");
  const links = $("navLinks");

  // Shadow on scroll
  const onScroll = () => {
    navbar?.classList.toggle("scrolled", window.scrollY > 10);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile toggle
  toggle?.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });

  // Close menu on link click (mobile)
  $$(".nav-link").forEach((a) => {
    a.addEventListener("click", () => {
      links?.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });

  // Active link based on scroll position (Intersection Observer)
  const sections = $$("section[id]");
  if (sections.length > 0 && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            $$(".nav-link").forEach((a) => {
              a.classList.toggle("active", a.dataset.section === id);
            });
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
  }
}

// ==========================================================================
// TABS (Tabelas de Alíquotas)
// ==========================================================================
function initTabs() {
  const tabs = $$(".tab");
  const panels = $$(".tab-panel");

  function activateTab(tabId) {
    tabs.forEach((t) => {
      const isActive = t.id === tabId;
      t.classList.toggle("active", isActive);
      t.setAttribute("aria-selected", String(isActive));
    });
    panels.forEach((p) => {
      const isActive = p.id === `panel-${tabId}`;
      p.classList.toggle("active", isActive);
      p.hidden = !isActive;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateTab(tab.id));
  });

  // Shortcut cards that activate a specific tab
  $$("[data-activate-tab]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const tabId = el.dataset.activateTab;
      if (tabId) {
        // Small delay to let scroll happen first
        setTimeout(() => activateTab(tabId), 100);
      }
    });
  });

  // Keyboard arrow navigation between tabs
  const tablist = document.querySelector('[role="tablist"]');
  tablist?.addEventListener("keydown", (e) => {
    const currentIdx = tabs.findIndex((t) => t === document.activeElement);
    if (currentIdx < 0) return;

    let newIdx = -1;
    if (e.key === "ArrowRight") newIdx = (currentIdx + 1) % tabs.length;
    if (e.key === "ArrowLeft") newIdx = (currentIdx - 1 + tabs.length) % tabs.length;

    if (newIdx >= 0) {
      e.preventDefault();
      tabs[newIdx].focus();
      activateTab(tabs[newIdx].id);
    }
  });
}

// ==========================================================================
// TABLE SEARCH / FILTER (Tabela 1 — Territorial)
// ==========================================================================
function initTableSearch() {
  const input = $("searchBairro");
  const table = $("tabelaTerritorial");
  if (!input || !table) return;

  input.addEventListener("input", () => {
    const query = input.value
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const rows = $$("tbody tr", table);

    rows.forEach((tr) => {
      if (!query) {
        tr.classList.remove("row-hidden");
        return;
      }
      const text = tr.textContent
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      tr.classList.toggle("row-hidden", !text.includes(query));
    });
  });
}

// ==========================================================================
// BAIRROS — Combobox com filtro
// ==========================================================================
function normalizarTexto(str) {
  return String(str)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizarBairro(str) {
  return normalizeNeighborhoodText(str);
}

function formatCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value, casas = 5) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(casas).replace(".", ",");
}

function initBairroCombobox() {
  const lista = getListaBairros();
  const input    = $("bairroInput");
  const list     = $("bairroList");
  const hidden   = $("bairro");
  const combobox = $("bairroCombobox");

  if (!input || !list || !hidden) return;

  let activeIdx = -1;
  let isSelected = false; // true quando o usuário escolheu da lista

  function getItems() {
    return [...list.querySelectorAll(".combobox-item")];
  }

  function openList(items) {
    list.classList.add("open");
    combobox.setAttribute("aria-expanded", "true");
  }

  function closeList() {
    list.classList.remove("open");
    combobox.setAttribute("aria-expanded", "false");
    setActive(-1);
  }

  function setActive(idx) {
    activeIdx = idx;
    getItems().forEach((el, i) => {
      el.classList.toggle("combobox-active", i === idx);
      if (i === idx) el.scrollIntoView({ block: "nearest" });
    });
  }

  function selectBairro(nome) {
    input.value = nome;
    hidden.value = nome;
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
    isSelected = true;
    input.classList.remove("combobox-invalid");
    closeList();
  }

  function renderList(query) {
    list.innerHTML = "";
    activeIdx = -1;

    const norm = normalizarTexto(query);
    const filtrados = query.trim()
      ? lista.filter((b) => normalizarTexto(b).includes(norm))
      : lista.slice(0, 40); // mostra primeiros 40 sem filtro

    if (filtrados.length === 0) {
      const li = document.createElement("li");
      li.className = "combobox-empty";
      li.textContent = "Nenhum bairro encontrado";
      list.appendChild(li);
    } else {
      filtrados.forEach((nome) => {
        const li = document.createElement("li");
        li.className = "combobox-item";
        li.textContent = nome;
        li.setAttribute("role", "option");
        li.addEventListener("mousedown", (e) => {
          e.preventDefault(); // evita blur antes do clique registrar
          selectBairro(nome);
        });
        list.appendChild(li);
      });
    }

    openList();
  }

  // Digitar
  input.addEventListener("input", () => {
    isSelected = false;
    hidden.value = "";
    input.classList.remove("combobox-invalid");
    renderList(input.value);
  });

  // Foco: mostra sugestões iniciais
  input.addEventListener("focus", () => {
    renderList(input.value);
  });

  // Teclado
  input.addEventListener("keydown", (e) => {
    const items = getItems();
    const validItems = items.filter((el) => el.classList.contains("combobox-item"));

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIdx + 1, validItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0 && validItems[activeIdx]) {
        e.preventDefault();
        selectBairro(validItems[activeIdx].textContent);
      }
    } else if (e.key === "Escape") {
      closeList();
    }
  });

  // Fechar ao clicar fora
  document.addEventListener("click", (e) => {
    if (!combobox.contains(e.target)) {
      // Valida se o que foi digitado não corresponde a nenhum bairro
      if (!isSelected && input.value.trim()) {
        const match = lista.find(
          (b) => normalizarTexto(b) === normalizarTexto(input.value)
        );
        if (match) {
          selectBairro(match);
        } else {
          hidden.value = "";
          input.classList.add("combobox-invalid");
        }
      }
      closeList();
    }
  });
}

// ==========================================================================
// CALCULADORA
// ==========================================================================
function setLoading(isLoading) {
  const btn = $("btnCalc");
  if (!btn) return;
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Calculando…" : "Calcular";
}

function setResultLabels(labels) {
  if (labels?.v1) $("labelVvi").textContent = labels.v1;
  if (labels?.v2) $("labelAliq").textContent = labels.v2;
  if (labels?.v3) $("labelIptu").textContent = labels.v3;
}

function exibirResultadoAliquota(data) {
  const result = $("result");
  const calcBottom = $("calcBottom");
  const layout = $('calcLayout');
  if (!result) return;

  result.classList.remove('hidden');
  calcBottom?.classList.remove('hidden');
  layout?.classList.add('has-result');

  setResultLabels({
    v1: "Valor Venal",
    v2: "Alíquota",
    v3: "IPTU Anual",
  });

  const resultCard = $("result");
  resultCard?.classList.remove("is-venal");
  $("resultTitle").textContent = "Resultado do Cálculo";
  $("detailsCalcSummary").textContent = "Detalhes do Cálculo";
  $("detailsWhySummary").textContent = "Fundamentação";
  $("calcText")?.classList.remove("memory-venal");

  $("iptuValue").textContent = data.iptu || "—";
  $("vviValue").textContent = data.valorVenal || "—";
  $("aliqValue").textContent = data.aliquota || "—";
  $("calcText").textContent = data.calculo || "";
  $("whyText").textContent = data.texto || "";

  // Store data for PDF generation
  window.__lastCalcData = data;
  window.__lastCalcMode = "aliquota";
  $("btnGerarPdf")?.classList.remove("hidden");

  const badge = $("badge");
  const ze = $("ze")?.value;
  const tipo = $("tipo")?.value;

  if (ze === "SIM" && tipo === "TERRITORIAL" && (data.texto || "").includes("não consta")) {
    badge.textContent = "ATENÇÃO";
    badge.className = "badge badge-warn";
  } else {
    badge.textContent = "OK";
    badge.className = "badge badge-ok";
  }

  // Scroll to result on mobile
  if (window.innerWidth < 768) {
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function exibirResultadoVenal(payload) {
  const result = $("result");
  const calcBottom = $("calcBottom");
  const layout = $('calcLayout');
  if (!result) return;

  result.classList.remove('hidden');
  calcBottom?.classList.remove('hidden');
  layout?.classList.add('has-result');

  setResultLabels({
    v1: "Terreno",
    v2: "Construção",
    v3: "Valor Venal Total",
  });

  const resultCard = $("result");
  resultCard?.classList.add("is-venal");
  $("resultTitle").textContent = "Resultado do Cálculo";
  $("detailsCalcSummary").textContent = "Memória de Cálculo";
  $("detailsWhySummary").textContent = "Fundamentação do Cálculo";
  $("calcText")?.classList.add("memory-venal");

  $("vviValue").textContent = formatCurrency(payload.valorTerreno);
  $("aliqValue").textContent = formatCurrency(payload.valorConstrucao);
  $("iptuValue").textContent = formatCurrency(payload.valorTotal);
  $("calcText").textContent = payload.calculo;
  $("whyText").textContent = payload.fundamentacao || payload.observacoes;

  window.__lastCalcData = payload;
  window.__lastCalcMode = "valor_venal";
  $("btnGerarPdf")?.classList.remove("hidden");

  const badge = $("badge");
  badge.textContent = "OK";
  badge.className = "badge badge-ok";

  if (window.innerWidth < 768) {
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function getCalcMode() {
  return $("calcModo")?.value || "aliquota";
}

function setSelectOptions(selectEl, values, placeholder = "Selecione") {
  if (!selectEl) return;

  const current = selectEl.value;
  selectEl.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  selectEl.appendChild(first);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    selectEl.appendChild(option);
  });

  if (current && values.some((v) => String(v) === current)) {
    selectEl.value = current;
  }
}

function setSelectObjectOptions(selectEl, items, placeholder = "Selecione", preferredValue = "") {
  if (!selectEl) return;

  const current = preferredValue || selectEl.value;
  selectEl.innerHTML = "";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = placeholder;
  selectEl.appendChild(first);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = String(item.value);
    option.textContent = String(item.label);
    selectEl.appendChild(option);
  });

  if (current && items.some((i) => String(i.value) === String(current))) {
    selectEl.value = current;
  }
}

function normalizeUrgLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "Região não informada";

  const normalizedKey = normalizarTexto(text).replace(/\s+/g, "");
  if (normalizedKey === "COMENDADORSOARES") {
    return "Comendador Soares";
  }

  return text
    .toLowerCase()
    .split(" ")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}

function getUrgFromBairro(bairro) {
  const bairroNorm = normalizarBairro(bairro || "");
  if (!bairroNorm || !venalBaseData?.bairrosUrg?.length) return "";

  const match = venalBaseData.bairrosUrg.find((row) => row.bairroNorm === bairroNorm);
  return match?.urg || "";
}

function buildZonaEspecialCatalog() {
  zeGuidedCatalog.terreno = [];
  zeGuidedCatalog.construcao = [];

  if (!venalTerrenoData || !venalConstrucaoData) return;

  const construcaoByCodeAndBairro = new Map();
  const construcaoByCode = new Map();

  venalConstrucaoData.zonaEspecial.forEach((row) => {
    const codeNorm = normalizarTexto(row.codigo);
    const bairroNorm = normalizarBairro(row.bairro);
    const key = `${codeNorm}::${bairroNorm}`;
    if (!construcaoByCodeAndBairro.has(key)) {
      construcaoByCodeAndBairro.set(key, row);
    }
    if (!construcaoByCode.has(codeNorm)) {
      construcaoByCode.set(codeNorm, row);
    }
  });

  const terrenoUnique = new Map();
  venalTerrenoData.terrenoZonaEspecial.forEach((row) => {
    const codeNorm = normalizarTexto(row.codigoLogradouro);
    const bairroNorm = normalizarBairro(row.bairro);
    const key = `${codeNorm}::${bairroNorm}`;
    if (!terrenoUnique.has(key)) {
      const meta =
        construcaoByCodeAndBairro.get(key) ||
        construcaoByCode.get(codeNorm) ||
        null;

      const regiao = normalizeUrgLabel(row.urg);
      const displayLogradouro = meta?.nomeLogradouro || `Código ${row.codigoLogradouro}`;
      const displayTrecho = meta?.trecho ? ` - ${meta.trecho}` : "";
      const label = `${displayLogradouro}${displayTrecho} (${row.bairro})`;

      terrenoUnique.set(key, {
        regiao,
        bairro: row.bairro,
        bairroNorm,
        codigo: row.codigoLogradouro,
        label,
        searchText: normalizarTexto(`${displayLogradouro} ${meta?.trecho || ""} ${row.bairro} ${row.codigoLogradouro}`),
      });
    }
  });
  zeGuidedCatalog.terreno = [...terrenoUnique.values()];

  const construcaoUnique = new Map();
  venalConstrucaoData.zonaEspecial.forEach((row) => {
    const codeNorm = normalizarTexto(row.codigo);
    const bairroNorm = normalizarBairro(row.bairro);
    const key = `${codeNorm}::${bairroNorm}`;
    if (!construcaoUnique.has(key)) {
      const urg = getUrgFromBairro(row.bairro);
      const regiao = normalizeUrgLabel(urg || row.bairro);
      const label = `${row.nomeLogradouro} - ${row.trecho} (${row.bairro})`;

      construcaoUnique.set(key, {
        regiao,
        bairro: row.bairro,
        bairroNorm,
        codigo: row.codigo,
        label,
        searchText: normalizarTexto(`${row.nomeLogradouro} ${row.trecho} ${row.bairro} ${row.codigo}`),
      });
    }
  });
  zeGuidedCatalog.construcao = [...construcaoUnique.values()];
}

function getZonaEspecialContext(context) {
  if (context === "terreno") {
    return {
      regiaoEl: $("terrenoZeRegiao"),
      logradouroEl: $("terrenoZeLogradouro"),
      breadcrumbEl: $("terrenoZeBreadcrumb"),
      hintEl: $("terrenoZeRegiaoHint"),
      metaEl: $("terrenoZeMeta"),
      codigoHiddenEl: $("terrenoCodigoLogradouro"),
      catalog: zeGuidedCatalog.terreno,
    };
  }

  return {
    regiaoEl: $("construcaoZeRegiao"),
    logradouroEl: $("construcaoZeLogradouro"),
    breadcrumbEl: $("construcaoZeBreadcrumb"),
    hintEl: $("construcaoZeRegiaoHint"),
    metaEl: $("construcaoZeMeta"),
    codigoHiddenEl: $("construcaoCodigoLogradouro"),
    catalog: zeGuidedCatalog.construcao,
  };
}

function getZonaEspecialState(context) {
  if (!zeUiState[context]) {
    zeUiState[context] = { regiao: "", codigo: "", noMatchWarnKey: "" };
  }
  return zeUiState[context];
}

function getZonaEspecialCompatibility(context) {
  const cfg = getZonaEspecialContext(context);
  const catalog = Array.isArray(cfg.catalog) ? cfg.catalog : [];
  const bairroRaw = $("bairro")?.value || "";
  const bairroNorm = normalizarBairro(bairroRaw);
  const byBairroList = bairroNorm
    ? catalog.filter((item) => item.bairroNorm === bairroNorm)
    : [];
  const regioes = [...new Set(byBairroList.map((item) => item.regiao))].sort((a, b) => a.localeCompare(b));

  return {
    bairroRaw,
    bairroNorm,
    byBairroList,
    regioes,
    hasBairro: Boolean(bairroNorm),
    hasMatch: byBairroList.length > 0,
    hasSingleRegiao: regioes.length === 1,
    regiaoUnica: regioes.length === 1 ? regioes[0] : "",
  };
}

function showZonaEspecialBairroNoMatchWarning(context) {
  const compatibility = getZonaEspecialCompatibility(context);
  const state = getZonaEspecialState(context);
  const warnKey = `${compatibility.bairroNorm}::${context}`;

  if (!compatibility.hasBairro || compatibility.hasMatch || state.noMatchWarnKey === warnKey) {
    return;
  }

  state.noMatchWarnKey = warnKey;
  openStructuredErrorModal(
    buildUiError(
      UI_ERROR_REASON.NO_MATCH_ZONA_ESPECIAL,
      "Este bairro não possui correspondência de Zona Especial na base atual.",
      {
        bairro: compatibility.bairroRaw,
        contexto: context,
      },
      [
        "Verifique se o tipo de terreno/construção correto é Bairro Oficial.",
        "Confirme se o bairro informado possui logradouros cadastrados como Zona Especial.",
        "Se necessário, altere o tipo de cálculo e tente novamente.",
      ]
    ),
    "Zona Especial indisponível para o bairro informado.",
    () => {
      if (context === "terreno") {
        $("tipoTerreno")?.focus();
      } else {
        $("tipoConstrucaoVenal")?.focus();
      }
    }
  );
}

function refreshZonaEspecialOptions(context) {
  const cfg = getZonaEspecialContext(context);
  if (!cfg.regiaoEl || !cfg.logradouroEl) return;

  const state = getZonaEspecialState(context);
  const currentCodigo = state.codigo || cfg.codigoHiddenEl?.value || cfg.logradouroEl.value || "";
  const currentRegiao = state.regiao || cfg.regiaoEl.value || "";
  const catalog = Array.isArray(cfg.catalog) ? cfg.catalog : [];
  const compatibility = getZonaEspecialCompatibility(context);

  let baseList = catalog;
  if (compatibility.hasBairro) {
    baseList = compatibility.hasMatch ? compatibility.byBairroList : [];
  }

  if (!compatibility.hasBairro && cfg.hintEl) {
    cfg.hintEl.textContent = "Informe o bairro do imóvel para orientar automaticamente a Zona Especial.";
    cfg.hintEl.classList.remove("is-warning");
  }

  if (compatibility.hasBairro && !compatibility.hasMatch) {
    cfg.regiaoEl.disabled = true;
    cfg.logradouroEl.disabled = true;
    cfg.codigoHiddenEl.value = "";
    state.regiao = "";
    state.codigo = "";
    setSelectOptions(cfg.regiaoEl, [], "Sem região disponível para o bairro");
    setSelectObjectOptions(cfg.logradouroEl, [], "Sem logradouro disponível");

    if (cfg.breadcrumbEl) {
      cfg.breadcrumbEl.textContent = "Zona Especial > Bairro sem correspondência na base";
    }
    if (cfg.metaEl) {
      cfg.metaEl.textContent = "Código técnico: —";
    }
    if (cfg.hintEl) {
      cfg.hintEl.textContent = "Este bairro não possui correspondência de Zona Especial. Considere usar Bairro Oficial.";
      cfg.hintEl.classList.add("is-warning");
    }
    return;
  }

  if (cfg.hintEl) {
    cfg.hintEl.classList.remove("is-warning");
  }

  const regioes = [...new Set(baseList.map((item) => item.regiao))].sort((a, b) => a.localeCompare(b));
  setSelectOptions(cfg.regiaoEl, regioes, "Selecione a região");

  if (compatibility.hasSingleRegiao) {
    cfg.regiaoEl.value = compatibility.regiaoUnica;
    cfg.regiaoEl.disabled = true;
    if (cfg.hintEl) {
      cfg.hintEl.textContent = "Região identificada automaticamente com base no bairro do imóvel.";
    }
  } else {
    cfg.regiaoEl.disabled = false;
    if (cfg.hintEl) {
      cfg.hintEl.textContent = compatibility.hasBairro
        ? "Selecione a região compatível com o bairro informado."
        : "Selecione a região para continuar.";
    }
  }

  if (!compatibility.hasSingleRegiao && currentRegiao && regioes.includes(currentRegiao)) {
    cfg.regiaoEl.value = currentRegiao;
  }

  const regiaoSelecionada = cfg.regiaoEl.value;
  state.regiao = regiaoSelecionada;

  const scopedByRegiao = baseList.filter((item) => (regiaoSelecionada ? item.regiao === regiaoSelecionada : true));
  const scopedList = scopedByRegiao.length > 0 ? scopedByRegiao : [];
  const filtered = scopedList;

  const selectedFromScope = scopedList.find((item) => item.codigo === currentCodigo) || null;
  const options = filtered.map((item) => ({ value: item.codigo, label: item.label }));
  if (selectedFromScope && !options.some((item) => item.value === selectedFromScope.codigo)) {
    options.unshift({
      value: selectedFromScope.codigo,
      label: `${selectedFromScope.label} (seleção atual)`,
    });
  }

  setSelectObjectOptions(
    cfg.logradouroEl,
    options,
    "Selecione o logradouro",
    selectedFromScope?.codigo || ""
  );

  const selectedCodigo = cfg.logradouroEl.value;
  state.codigo = selectedCodigo || "";
  cfg.codigoHiddenEl.value = selectedCodigo || "";
  cfg.logradouroEl.disabled = options.length === 0;

  const selectedItem = scopedList.find((item) => item.codigo === selectedCodigo) || null;
  const regiaoBreadcrumb = regiaoSelecionada || "Selecionar região";
  const logradouroBreadcrumb = selectedItem ? selectedItem.label.split(" (")[0] : "Selecionar logradouro";

  if (cfg.breadcrumbEl) {
    cfg.breadcrumbEl.textContent = `Zona Especial > ${regiaoBreadcrumb} > ${logradouroBreadcrumb}`;
  }
  if (cfg.metaEl) {
    cfg.metaEl.textContent = `Código técnico: ${selectedItem?.codigo || "—"}`;
  }
}

function initZonaEspecialGuidedSelectors() {
  ["terreno", "construcao"].forEach((context) => {
    const cfg = getZonaEspecialContext(context);
    if (!cfg.regiaoEl || !cfg.logradouroEl) return;

    cfg.regiaoEl.addEventListener("change", () => {
      const state = getZonaEspecialState(context);
      state.regiao = cfg.regiaoEl.value || "";
      state.codigo = "";
      refreshZonaEspecialOptions(context);
    });

    cfg.logradouroEl.addEventListener("change", () => {
      const state = getZonaEspecialState(context);
      state.codigo = cfg.logradouroEl.value || "";
      refreshZonaEspecialOptions(context);
    });
  });

  refreshZonaEspecialOptions("terreno");
  refreshZonaEspecialOptions("construcao");
}

function refreshZonaFiscalSelectors() {
  const tipoTerreno = $("tipoTerreno")?.value;
  const tipoConstrucao = $("tipoConstrucaoVenal")?.value;

  const terrenoZonas = tipoTerreno === "zona_especial" ? [] : ZONA_FISCAL_OPTIONS;
  setSelectOptions(
    $("terrenoZonaFiscal"),
    terrenoZonas,
    "Selecione a zona fiscal"
  );

  const construcaoZonas =
    tipoConstrucao === "zona_especial" ? [] : ZONA_FISCAL_OPTIONS;
  setSelectOptions(
    $("construcaoZonaFiscal"),
    construcaoZonas,
    "Selecione a zona fiscal"
  );
}

async function initVenalSelectors() {
  try {
    const baseData = await loadIptuBaseData();
    venalBaseData = baseData;
    const competencias = [...new Set(baseData.competenciasUfinig.map((c) => c.competencia))]
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));

    setSelectOptions($("competencia"), competencias, "Selecione o ano");

    const [terrenoData, construcaoData] = await Promise.all([
      loadIptuTerrenoData(),
      loadIptuConstrucaoData(),
    ]);
    venalTerrenoData = terrenoData;
    venalConstrucaoData = construcaoData;

    buildZonaEspecialCatalog();
    initZonaEspecialGuidedSelectors();

    refreshZonaFiscalSelectors();
  } catch (_) {
    // Falha silenciosa para não bloquear o restante da interface.
  }
}

function parseAreaFieldsText(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function getEscopoVenalLabel(value) {
  if (value === "terreno") return "Somente Terreno";
  if (value === "construcao") return "Somente Construção";
  if (value === "terreno_construcao") return "Terreno + Construção";
  return "Composição não informada";
}

function getTipoTerrenoLabel(value) {
  if (value === "bairro_oficial") return "Bairro Oficial";
  if (value === "zona_especial") return "Zona Especial";
  return "Não informado";
}

function getTipoConstrucaoLabel(value) {
  if (value === "residencial") return "Residencial";
  if (value === "comercial_industrial") return "Comercial / Industrial";
  if (value === "zona_especial") return "Zona Especial";
  return "Não informado";
}

function buildVenalFundamentacao(input) {
  const linhas = [
    "1. Enquadramento Legal",
    `A apuração foi realizada na competência ${input.competencia}, para o bairro ${input.bairro}, considerando o contexto territorial ${input.urg || "não informado"}.`,
    `O cálculo seguiu a composição ${getEscopoVenalLabel(input.escopoVenal)} e os parâmetros técnicos disponíveis na base municipal da aplicação (tabelas de terreno, construção e fatores auxiliares).`,
    "",
    "2. Justificativa do Valor Encontrado",
  ];

  if (input.terreno) {
    linhas.push(
      `Terreno enquadrado como ${getTipoTerrenoLabel(input.tipoTerreno)}.`
    );
    if (input.tipoTerreno === "bairro_oficial") {
      linhas.push(`A zona fiscal utilizada no terreno foi ${input.zonaFiscalTerreno || "não informada"}.`);
    }
    if (input.tipoTerreno === "zona_especial") {
      linhas.push(`A região de Zona Especial utilizada no terreno foi ${input.regiaoTerreno || "não informada"}.`);
    }
    linhas.push(
      `O valor venal do terreno foi obtido por: área (${formatNumber(input.terreno.areaTerreno, 2)} m²) x valor unitário (${formatNumber(input.terreno.valorUnitarioTerreno, 5)}) x fator Z (${formatNumber(input.terreno.fatorZ, 2)}).`
    );
  }

  if (input.construcao) {
    linhas.push(
      `Construção enquadrada como ${getTipoConstrucaoLabel(input.tipoConstrucao)}.`
    );
    if (input.tipoConstrucao !== "zona_especial") {
      linhas.push(`A zona fiscal utilizada na construção foi ${input.zonaFiscalConstrucao || "não informada"}.`);
    } else {
      linhas.push(`A região de Zona Especial utilizada na construção foi ${input.regiaoConstrucao || "não informada"}.`);
    }
    linhas.push("A composição da construção considerou parcelas por área construída e fator CUBE, multiplicadas pela UFINIG da competência.");
  }

  linhas.push(
    "",
    "3. Memória de Cálculo",
    `Valor venal do terreno: ${formatCurrency(input.valorTerreno)}.`,
    `Valor venal da construção: ${formatCurrency(input.valorConstrucao)}.`,
    `Valor venal total: ${formatCurrency(input.valorTotal)}.`
  );

  if (input.construcao?.componentes?.length) {
    linhas.push("Parcelas consideradas na construção:");
    input.construcao.componentes.forEach((item) => {
      linhas.push(
        `- ${item.chave}: área ${formatNumber(item.area, 2)} x CUBE ${formatNumber(item.cube, 5)} x UFINIG ${formatNumber(item.ufinig, 2)} = ${formatCurrency(item.valorVenalParcial)}.`
      );
    });
  }

  linhas.push(
    "",
    "4. Conclusão",
    "O valor venal foi apurado com base nas tabelas e parâmetros técnicos vigentes na aplicação, observando os dados informados no formulário e a classificação adotada para o imóvel."
  );

  return linhas.join("\n");
}

function buildRequiredFieldError(fieldLabel, checks = []) {
  return buildUiError(
    UI_ERROR_REASON.REQUIRED_FIELD,
    `Preencha o campo obrigatório: ${fieldLabel}.`,
    { fieldLabel },
    checks
  );
}

function buildZonaEspecialNoMatchError(section, details = {}) {
  const sectionLabel = section === "terreno" ? "esta Zona Especial de terreno" : "esta Zona Especial de construção";
  return buildUiError(
    UI_ERROR_REASON.NO_MATCH_ZONA_ESPECIAL,
    `Não foi possível calcular ${sectionLabel}.`,
    details,
    [
      "Verifique se o logradouro selecionado pertence ao grupo/região escolhido.",
      "Confirme se existe registro correspondente na base para bairro e código técnico.",
      "Revise se o tipo de cálculo atual é compatível com a seleção de Zona Especial.",
    ]
  );
}

function buildNoMatchBaseError(section) {
  const label = section === "terreno" ? "terreno" : "construção";
  return buildUiError(
    UI_ERROR_REASON.NO_MATCH_BASE,
    `Não foi encontrada correspondência para calcular o valor venal de ${label} com os dados informados.`,
    { section: label },
    [
      "Revise bairro, competência e tipo selecionado.",
      "Verifique se a zona fiscal está preenchida corretamente.",
      "Confirme se as áreas informadas são válidas e positivas.",
    ]
  );
}

function getReviewActionForContext(context) {
  if (context === "terreno") {
    return () => {
      $("tipoTerreno")?.focus();
      refreshZonaEspecialOptions("terreno");
    };
  }

  return () => {
    $("tipoConstrucaoVenal")?.focus();
    refreshZonaEspecialOptions("construcao");
  };
}

function validateTerrenoInput(tipoTerreno) {
  const areaTerreno = parseAreaFieldsText($("areaTerreno")?.value);
  if (!areaTerreno) {
    return buildRequiredFieldError("Área do Terreno", ["Informe uma área em m² para calcular o valor venal do terreno."]);
  }

  if (tipoTerreno === "bairro_oficial") {
    const zonaFiscal = parseAreaFieldsText($("terrenoZonaFiscal")?.value);
    if (!zonaFiscal) {
      return buildRequiredFieldError("Zona Fiscal (Terreno)", ["Selecione uma zona fiscal de 1 a 7 para terreno em bairro oficial."]);
    }
    return null;
  }

  if (tipoTerreno === "zona_especial") {
    const regiao = parseAreaFieldsText($("terrenoZeRegiao")?.value);
    const codigo = parseAreaFieldsText($("terrenoCodigoLogradouro")?.value);
    if (!regiao) {
      return buildRequiredFieldError("Região / URG da Zona Especial (Terreno)", ["Selecione primeiro o grupo/região para filtrar os logradouros disponíveis."]);
    }
    if (!codigo) {
      return buildRequiredFieldError("Logradouro / Trecho da Zona Especial (Terreno)", ["Escolha um logradouro legível para que o código técnico seja resolvido automaticamente."]);
    }
    return null;
  }

  return buildUiError(
    UI_ERROR_REASON.INCOMPATIBLE_CALCULATION_TYPE,
    "Tipo de terreno incompatível com o cálculo atual.",
    { tipoTerreno },
    ["Selecione Bairro Oficial ou Zona Especial para continuar."]
  );
}

function validateConstrucaoInput(tipoConstrucao) {
  if (tipoConstrucao === "residencial") {
    const zonaFiscal = parseAreaFieldsText($("construcaoZonaFiscal")?.value);
    if (!zonaFiscal) {
      return buildRequiredFieldError("Zona Fiscal (Construção)", ["Selecione uma zona fiscal de 1 a 7 para construção residencial."]);
    }

    const modoResidencial = $("residencialModo")?.value;
    if (modoResidencial === "padrao_diferente") {
      if (!parseAreaFieldsText($("areaConstruidaPrincipal")?.value)) {
        return buildRequiredFieldError("Área Principal (m²)");
      }
      if (!parseAreaFieldsText($("areaConstruidaDiferente")?.value)) {
        return buildRequiredFieldError("Área Diferente (m²)");
      }
      return null;
    }

    if (!parseAreaFieldsText($("areaConstruida")?.value)) {
      return buildRequiredFieldError("Área Construída (m²)");
    }
    return null;
  }

  if (tipoConstrucao === "comercial_industrial") {
    const zonaFiscal = parseAreaFieldsText($("construcaoZonaFiscal")?.value);
    if (!zonaFiscal) {
      return buildRequiredFieldError("Zona Fiscal (Construção)", ["Selecione uma zona fiscal de 1 a 7 para construção comercial/industrial."]);
    }
    return null;
  }

  if (tipoConstrucao === "zona_especial") {
    const regiao = parseAreaFieldsText($("construcaoZeRegiao")?.value);
    const codigo = parseAreaFieldsText($("construcaoCodigoLogradouro")?.value);
    const area = parseAreaFieldsText($("areaConstruidaZonaEspecial")?.value);

    if (!regiao) {
      return buildRequiredFieldError("Região / URG da Zona Especial (Construção)", ["Selecione primeiro o grupo/região para filtrar os logradouros disponíveis."]);
    }
    if (!codigo) {
      return buildRequiredFieldError("Logradouro / Trecho da Zona Especial (Construção)", ["Escolha um logradouro legível para que o código técnico seja resolvido automaticamente."]);
    }
    if (!area) {
      return buildRequiredFieldError("Área Construída (Zona Especial)");
    }
    return null;
  }

  return buildUiError(
    UI_ERROR_REASON.INCOMPATIBLE_CALCULATION_TYPE,
    "Tipo de construção incompatível com o cálculo atual.",
    { tipoConstrucao },
    ["Selecione Residencial, Comercial / Industrial ou Zona Especial para continuar."]
  );
}

async function calcularAliquota() {
  const bairro = $("bairro")?.value;
  const tipo = $("tipo")?.value;
  const valor = $("valor")?.value;
  const ze = $("ze")?.value;

  if (!bairro) {
    openStructuredErrorModal(
      buildRequiredFieldError("Bairro", ["Selecione um bairro válido na lista de sugestões."]),
      "Não foi possível calcular a alíquota.",
      () => $("bairroInput")?.focus()
    );
    $("bairroInput")?.focus();
    return;
  }
  if (!valor || valor.trim().length === 0) {
    openStructuredErrorModal(
      buildRequiredFieldError("Valor Venal do Imóvel", ["Informe o valor venal para calcular a alíquota e o IPTU."]),
      "Não foi possível calcular a alíquota.",
      () => $("valor")?.focus()
    );
    $("valor")?.focus();
    return;
  }

  setLoading(true);
  try {
    const res = calcularParaSite(bairro, tipo, valor, ze);
    exibirResultadoAliquota(res);
  } catch (_) {
    openStructuredErrorModal(
      buildUiError(
        UI_ERROR_REASON.UNEXPECTED,
        "Não foi possível calcular o IPTU com os dados atuais.",
        { bairro, tipo, ze },
        [
          "Confirme os campos obrigatórios do formulário.",
          "Revise o valor venal informado.",
          "Tente novamente após ajustar os dados.",
        ]
      ),
      "Erro no cálculo de alíquota."
    );
  } finally {
    setLoading(false);
  }
}

async function calcularValorVenal() {
  const competencia = parseAreaFieldsText($("competencia")?.value);
  const bairro = $("bairro")?.value;
  const escopoVenal = $("escopoVenal")?.value;
  const tipoTerreno = $("tipoTerreno")?.value;
  const tipoConstrucao = $("tipoConstrucaoVenal")?.value;

  if (!competencia) {
    openStructuredErrorModal(
      buildRequiredFieldError("Competência", ["Selecione o ano de competência antes de calcular o valor venal."]),
      "Não foi possível calcular o valor venal.",
      () => $("competencia")?.focus()
    );
    $("competencia")?.focus();
    return;
  }

  if (!bairro) {
    openStructuredErrorModal(
      buildRequiredFieldError("Bairro", ["Selecione um bairro válido na lista de sugestões."]),
      "Não foi possível calcular o valor venal.",
      () => $("bairroInput")?.focus()
    );
    $("bairroInput")?.focus();
    return;
  }

  let terreno = null;
  let construcao = null;

  setLoading(true);
  try {
    if (escopoVenal === "terreno" || escopoVenal === "terreno_construcao") {
      const terrenoValidationError = validateTerrenoInput(tipoTerreno);
      if (terrenoValidationError) {
        openStructuredErrorModal(
          terrenoValidationError,
          "Não foi possível calcular o valor venal do terreno.",
          getReviewActionForContext("terreno")
        );
        return;
      }

      terreno = await calculateValorVenalTerreno({
        competencia,
        bairro,
        tipoTerreno,
        zonaFiscal: parseAreaFieldsText($("terrenoZonaFiscal")?.value),
        codigoLogradouro: parseAreaFieldsText($("terrenoCodigoLogradouro")?.value),
        areaTerreno: parseAreaFieldsText($("areaTerreno")?.value),
      });

      if (!terreno) {
        const error =
          tipoTerreno === "zona_especial"
            ? buildZonaEspecialNoMatchError("terreno", {
                grupo: $("terrenoZeRegiao")?.value || "",
                bairro,
                codigoLogradouro: parseAreaFieldsText($("terrenoCodigoLogradouro")?.value),
                tipoCalculo: tipoTerreno,
              })
            : buildNoMatchBaseError("terreno");

        openStructuredErrorModal(
          error,
          "Não foi possível calcular o valor venal do terreno.",
          getReviewActionForContext("terreno")
        );
        return;
      }
    }

    if (escopoVenal === "construcao" || escopoVenal === "terreno_construcao") {
      const construcaoValidationError = validateConstrucaoInput(tipoConstrucao);
      if (construcaoValidationError) {
        openStructuredErrorModal(
          construcaoValidationError,
          "Não foi possível calcular o valor venal da construção.",
          getReviewActionForContext("construcao")
        );
        return;
      }

      const baseParams = {
        competencia,
        bairro,
        tipoConstrucao,
        zonaFiscal: parseAreaFieldsText($("construcaoZonaFiscal")?.value),
        codigoLogradouro: parseAreaFieldsText($("construcaoCodigoLogradouro")?.value),
      };

      if (tipoConstrucao === "residencial") {
        const modoResidencial = $("residencialModo")?.value;
        if (modoResidencial === "padrao_diferente") {
          construcao = await calculateValorVenalConstrucao({
            ...baseParams,
            areaConstruidaPrincipal: parseAreaFieldsText($("areaConstruidaPrincipal")?.value),
            padraoPrincipal: $("padraoPrincipal")?.value,
            areaConstruidaDiferente: parseAreaFieldsText($("areaConstruidaDiferente")?.value),
            padraoDiferente: $("padraoDiferente")?.value,
          });
        } else {
          construcao = await calculateValorVenalConstrucao({
            ...baseParams,
            areaConstruida: parseAreaFieldsText($("areaConstruida")?.value),
            padrao: $("padraoResidencial")?.value,
          });
        }
      } else if (tipoConstrucao === "comercial_industrial") {
        construcao = await calculateValorVenalConstrucao({
          ...baseParams,
          areaLojaTerrea: parseAreaFieldsText($("areaLojaTerrea")?.value),
          areaPavimentoSuperior: parseAreaFieldsText($("areaPavimentoSuperior")?.value),
          areaGalpao: parseAreaFieldsText($("areaGalpao")?.value),
          areaTelheiro: parseAreaFieldsText($("areaTelheiro")?.value),
          areaEstacionamento: parseAreaFieldsText($("areaEstacionamento")?.value),
          areaUsoComum: parseAreaFieldsText($("areaUsoComum")?.value),
        });
      } else {
        construcao = await calculateValorVenalConstrucao({
          ...baseParams,
          areaConstruida: parseAreaFieldsText($("areaConstruidaZonaEspecial")?.value),
        });
      }

      if (!construcao) {
        const error =
          tipoConstrucao === "zona_especial"
            ? buildZonaEspecialNoMatchError("construcao", {
                grupo: $("construcaoZeRegiao")?.value || "",
                bairro,
                codigoLogradouro: parseAreaFieldsText($("construcaoCodigoLogradouro")?.value),
                tipoCalculo: tipoConstrucao,
              })
            : buildNoMatchBaseError("construcao");

        openStructuredErrorModal(
          error,
          "Não foi possível calcular o valor venal da construção.",
          getReviewActionForContext("construcao")
        );
        return;
      }
    }

    const valorTerreno = terreno?.valorVenalTerreno ?? null;
    const valorConstrucao = construcao?.valorVenalConstrucao ?? null;
    const valorTotal = (valorTerreno || 0) + (valorConstrucao || 0);
    const ufinig = terreno?.ufinig ?? construcao?.ufinig ?? null;
    const regiaoTerreno = parseAreaFieldsText($("terrenoZeRegiao")?.value);
    const regiaoConstrucao = parseAreaFieldsText($("construcaoZeRegiao")?.value);
    const urgInferida =
      regiaoTerreno ||
      regiaoConstrucao ||
      getUrgFromBairro(bairro) ||
      "—";
    const zonaEspecial =
      (escopoVenal !== "construcao" && tipoTerreno === "zona_especial") ||
      (escopoVenal !== "terreno" && tipoConstrucao === "zona_especial")
        ? "SIM"
        : "NÃO";

    const calculoLinhas = [
      "MEMORIA DE CALCULO - VALOR VENAL",
      "--------------------------------",
      `Competencia: ${competencia}`,
      `Bairro: ${bairro}`,
      `UFINIG (referencia): ${ufinig !== null ? formatNumber(ufinig, 2) : "—"}`,
      "",
      "RESUMO",
      `Terreno: ${formatCurrency(valorTerreno)}`,
      `Construcao: ${formatCurrency(valorConstrucao)}`,
      `Valor Venal Total: ${formatCurrency(valorTotal)}`,
    ];

    if (terreno) {
      calculoLinhas.push(
        "",
        "[TERRENO]",
        `Area: ${formatNumber(terreno.areaTerreno, 2)} m²`,
        `Valor unitario: ${formatNumber(terreno.valorUnitarioTerreno, 5)}`,
        `Fator Z: ${formatNumber(terreno.fatorZ, 2)}`,
        `VVT: ${formatCurrency(terreno.valorVenalTerreno)}`
      );
    }

    if (construcao) {
      calculoLinhas.push("", "[CONSTRUCAO]", "Parcelas:");
      construcao.componentes.forEach((c) => {
        calculoLinhas.push(
          `- ${c.chave}: area ${formatNumber(c.area, 2)} x cube ${formatNumber(c.cube, 5)} x ufinig ${formatNumber(c.ufinig, 2)} = ${formatCurrency(c.valorVenalParcial)}`
        );
      });
      calculoLinhas.push(`VVC: ${formatCurrency(construcao.valorVenalConstrucao)}`);
    }

    const fundamentacao = buildVenalFundamentacao({
      competencia,
      bairro,
      urg: urgInferida,
      escopoVenal,
      tipoTerreno,
      tipoConstrucao,
      zonaFiscalTerreno: parseAreaFieldsText($("terrenoZonaFiscal")?.value),
      zonaFiscalConstrucao: parseAreaFieldsText($("construcaoZonaFiscal")?.value),
      regiaoTerreno,
      regiaoConstrucao,
      terreno,
      construcao,
      valorTerreno,
      valorConstrucao,
      valorTotal,
    });

    exibirResultadoVenal({
      valorTerreno,
      valorConstrucao,
      valorTotal,
      calculo: calculoLinhas.join("\n"),
      fundamentacao,
      observacoes:
        "Resultado consolidado com base nas parcelas de terreno e construcao. O valor total corresponde a soma dos componentes calculados no formulario.",
      identificacao: {
        tipoCalculo: getEscopoVenalLabel(escopoVenal),
        competencia,
        bairro,
        urg: urgInferida,
        zonaEspecial,
        tipoTerreno:
          escopoVenal === "construcao" ? "Não aplicável" : getTipoTerrenoLabel(tipoTerreno),
        tipoConstrucao:
          escopoVenal === "terreno" ? "Não aplicável" : getTipoConstrucaoLabel(tipoConstrucao),
        zonaFiscalTerreno:
          escopoVenal === "construcao"
            ? "Não aplicável"
            : parseAreaFieldsText($("terrenoZonaFiscal")?.value) || "—",
        zonaFiscalConstrucao:
          escopoVenal === "terreno"
            ? "Não aplicável"
            : parseAreaFieldsText($("construcaoZonaFiscal")?.value) || "—",
        valorTerreno: formatCurrency(valorTerreno),
        valorConstrucao: formatCurrency(valorConstrucao),
        valorTotal: formatCurrency(valorTotal),
      },
    });
  } catch (_) {
    openStructuredErrorModal(
      buildUiError(
        UI_ERROR_REASON.UNEXPECTED,
        "O cálculo de valor venal não pôde ser concluído nesta tentativa.",
        { competencia, bairro, escopoVenal },
        [
          "Revise os campos da seção ativa e tente novamente.",
          "Confirme se a seleção de Zona Especial está completa, quando aplicável.",
          "Se o problema persistir, valide os dados de entrada no formulário.",
        ]
      ),
      "Erro no cálculo de valor venal."
    );
  } finally {
    setLoading(false);
  }
}

function calcular() {
  const mode = getCalcMode();
  if (mode === "valor_venal") {
    calcularValorVenal();
    return;
  }
  calcularAliquota();
}

// ==========================================================================
// GERAR PDF
// ==========================================================================
function gerarPdf() {
  if (!["aliquota", "valor_venal"].includes(window.__lastCalcMode)) {
    openStructuredErrorModal(
      buildUiError(
        UI_ERROR_REASON.INVALID_COMBINATION,
        "A geração de PDF está disponível apenas após um cálculo válido.",
        { modoAtual: window.__lastCalcMode || "indefinido" },
        ["Realize o cálculo antes de emitir o documento em PDF."]
      ),
      "PDF indisponível no modo atual."
    );
    return;
  }

  const data = window.__lastCalcData;
  if (!data) {
    openStructuredErrorModal(
      buildRequiredFieldError("Resultado de cálculo", ["Realize um cálculo de alíquota antes de gerar o PDF."]),
      "PDF indisponível."
    );
    return;
  }

  const mode = window.__lastCalcMode;

  // Date
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dataEmissao = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const filename =
    mode === "valor_venal"
      ? `IPTU_Nova_Iguacu_Valor_Venal_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.pdf`
      : `IPTU_Nova_Iguacu_Calculo_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.pdf`;

  let rows = [];
  let textoFund = "";
  let resultadoLabel = "";
  let resultadoValor = "";
  let baseLegalTexto = "";

  const sanitizePdfFundamentacao = (text) =>
    String(text || "")
      .replace(/\(\s*Ref\.?\s*Tabelas?\s*2017\s*\)/gi, "")
      .replace(/ref\.?\s*2017/gi, "")
      .replace(/\(\s*2017\s*\)/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/ \./g, ".")
      .trim();

  if (mode === "aliquota") {
    const tipoEl = $("tipo");
    const bairroInput = $("bairroInput");
    const zeEl = $("ze");

    const tipoMap = {
      TERRITORIAL: "Territorial",
      RESIDENCIAL: "Predial Residencial",
      COMERCIAL: "Predial Comercial-Industrial",
      INDUSTRIAL: "Predial Industrial"
    };

    const tipo = tipoMap[tipoEl?.value] || tipoEl?.value || "—";
    const bairro = bairroInput?.value || "—";
    const ze = zeEl?.value === "SIM" ? "SIM" : "NÃO";
    const urg = data.urg || "—";

    rows = [
      ["Tipo do Imóvel", tipo],
      ["URG", urg],
      ["Bairro", bairro],
      ["Zona Especial", ze],
      ["Valor Venal (VVI)", data.valorVenal || "—"],
      ["Alíquota Aplicada", data.aliquota || "—"],
      ["Data de Emissão", dataEmissao]
    ];

    textoFund = sanitizePdfFundamentacao(data.texto || "");
    resultadoLabel = "Valor do IPTU Calculado:";
    resultadoValor = data.iptu || "—";
    baseLegalTexto =
      "Conforme o Art. 18 do Código Tributário Municipal, o IPTU é apurado pela aplicação da alíquota correspondente (ALC) sobre o valor venal do imóvel (VVI), seguindo a fórmula: IPTU = VVI × ALC. As alíquotas aplicáveis constam das tabelas municipais vigentes, variando conforme a localização/URG, uso do imóvel e faixas de valor venal.";
  } else {
    const info = data.identificacao || {};
    rows = [
      ["Tipo do Cálculo", info.tipoCalculo || "Valor Venal"],
      ["Competência", info.competencia || "—"],
      ["Bairro", info.bairro || "—"],
      ["URG / Região", info.urg || "—"],
      ["Zona Especial", info.zonaEspecial || "NÃO"],
      ["Tipo de Terreno", info.tipoTerreno || "—"],
      ["Tipo de Construção", info.tipoConstrucao || "—"],
      ["Zona Fiscal Terreno", info.zonaFiscalTerreno || "—"],
      ["Zona Fiscal Construção", info.zonaFiscalConstrucao || "—"],
      ["Data de Emissão", dataEmissao]
    ];

    textoFund = sanitizePdfFundamentacao(data.fundamentacao || data.observacoes || "");
    resultadoLabel = "Valor Venal Total Apurado:";
    resultadoValor = info.valorTotal || formatCurrency(data.valorTotal);
    baseLegalTexto =
      "A apuração do valor venal considerou os parâmetros técnicos vigentes nas tabelas municipais da aplicação, incluindo dados de terreno, construção, fator Z, CUBE e UFINIG por competência, conforme enquadramento do imóvel informado.";
  }

  const fundHtml = textoFund
    .split("\n")
    .map((line) =>
      line.trim() === ""
        ? '<div style="height:3px"></div>'
        : `<p style="margin:0 0 3px 0;font-size:10.5px;color:#2a2a2a;line-height:1.55">${escHtml(line)}</p>`
    )
    .join("");

  const rowsHtml = rows
    .map(
      ([label, val]) =>
        `<tr style="border-bottom:1px solid #e5e5e5"><td style="padding:4px 8px;font-weight:600;color:#3a3a3a;width:40%;font-size:10.5px">${escHtml(label)}</td><td style="padding:4px 8px;color:#1a1a1a;font-size:10.5px">${escHtml(val)}</td></tr>`
    )
    .join("");

  // Section title helper
  const secTitle = (text) =>
    `<h2 style="font-size:11px;font-weight:700;color:#34699A;text-transform:uppercase;letter-spacing:0.03em;margin:0 0 5px 0;padding-bottom:3px;border-bottom:1px solid #BCCCDC">${escHtml(text)}</h2>`;

  // Full HTML string with inline styles
  const htmlStr = `
    <div style="width:100%;background:#FFFFFF;color:#1a1a1a;font-family:Helvetica,Arial,sans-serif;font-size:10.5px;line-height:1.55;padding:0">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:10px">
        <p style="font-size:14px;font-weight:700;color:#34699A;text-transform:uppercase;letter-spacing:0.04em;margin:0 0 2px 0">PREFEITURA MUNICIPAL DE NOVA IGUAÇU</p>
        <p style="font-size:12px;font-weight:600;color:#3a3a3a;margin:0 0 2px 0">Secretaria Municipal da Fazenda</p>
        <p style="font-size:10.5px;color:#3a3a3a;margin:0 0 5px 0">Calculadora de IPTU</p>
        <div style="height:2px;background:#34699A;margin:5px 0"></div>
      </div>

      <!-- Identificação -->
      <div style="margin-bottom:10px">
        ${secTitle("Identificação do Cálculo")}
        <table style="width:100%;border-collapse:collapse;margin-bottom:3px">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>

      <!-- Resultado — layout horizontal compacto -->
      <div style="margin-bottom:10px">
        ${secTitle("Resultado")}
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:#f4f7fa;border:1px solid #e0e6ed;border-radius:3px">
          <span style="font-size:11px;font-weight:600;color:#3a3a3a">${escHtml(resultadoLabel)}</span>
          <span style="font-size:14px;font-weight:700;color:#1a1a1a">${escHtml(resultadoValor)}</span>
        </div>
      </div>

      <!-- Fundamentação -->
      <div style="margin-bottom:10px">
        ${secTitle("Fundamentação do Cálculo")}
        <div style="word-wrap:break-word;overflow-wrap:break-word">${fundHtml}</div>
      </div>

      <!-- Base Legal -->
      <div style="margin-bottom:10px">
        ${secTitle("Base Legal")}
        <p style="font-size:10.5px;color:#2a2a2a;margin:2px 0;line-height:1.55">Base legal (CTM Nova Iguaçu)</p>
        <p style="font-size:10.5px;color:#2a2a2a;margin:2px 0;line-height:1.55">${escHtml(baseLegalTexto)}</p>
        <p style="font-size:10.5px;color:#2a2a2a;margin:2px 0;line-height:1.55">Referência: Tabelas municipais vigentes</p>
      </div>

      <!-- Rodapé -->
      <div style="margin-top:12px;text-align:center">
        <div style="height:1px;background:#34699A;margin:5px 0"></div>
        <p style="font-size:8.5px;color:#888;margin:2px 0">Documento gerado automaticamente pela Calculadora de IPTU — Nova Iguaçu.</p>
        <p style="font-size:8.5px;color:#888;margin:2px 0">Este documento não substitui guia oficial de arrecadação.</p>
      </div>
    </div>
  `;

  const opt = {
    margin: [8, 8, 8, 8],
    filename: filename,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 1.8, useCORS: true, backgroundColor: "#FFFFFF" },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] }
  };

  html2pdf().set(opt).from(htmlStr, "string").save()
    .catch(() => {
      openStructuredErrorModal(
        buildUiError(
          UI_ERROR_REASON.UNEXPECTED,
          "O PDF não pôde ser gerado nesta tentativa.",
          {},
          ["Tente novamente em alguns instantes.", "Se necessário, refaça o cálculo antes de gerar o documento."]
        ),
        "Erro ao gerar PDF."
      );
    });
}

/** Escapa HTML para evitar XSS ao injetar conteúdo no template string */
function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function limparFormulario() {
  const form = $("formCalc");
  if (form) form.reset();
  closeAppModal();
  zeUiState.terreno = { regiao: "", codigo: "", noMatchWarnKey: "" };
  zeUiState.construcao = { regiao: "", codigo: "", noMatchWarnKey: "" };
  hideCalcResultCard();

  const bairroInput = $("bairroInput");
  if (bairroInput) bairroInput.value = "";
  const bairroHidden = $("bairro");
  if (bairroHidden) bairroHidden.value = "";

  $("result")?.classList.remove("is-venal");
  $("resultTitle").textContent = "Resultado";
  $("detailsCalcSummary").textContent = "Detalhes do Cálculo";
  $("detailsWhySummary").textContent = "Fundamentação";
  $("calcText")?.classList.remove("memory-venal");

  updateCalcModeUI();
}

function hideCalcResultCard() {
  $("result")?.classList.add("hidden");
  $("calcBottom")?.classList.add("hidden");
  $("calcLayout")?.classList.remove("has-result");
  $("result")?.classList.remove("is-venal");
  window.__lastCalcData = null;
  window.__lastCalcMode = null;
}

function showElement(el, show) {
  if (!el) return;
  el.classList.toggle("hidden", !show);
}

function syncCalcModeSegmentedUI(mode) {
  const isAliquota = mode === "aliquota";
  const segmented = $("calcModeSegmented");
  segmented?.classList.toggle("is-venal", !isAliquota);

  $$('[data-calc-mode-btn]').forEach((btn) => {
    const active = btn.dataset.calcModeBtn === mode;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });

  const formCard = $("calcFormCard");
  formCard?.classList.toggle("mode-venal", !isAliquota);
}

function animateCalcModeContent() {
  const visibleBlocks = document.querySelectorAll(
    ".calc-aliquota-only:not(.hidden), .calc-venal-only:not(.hidden)"
  );

  visibleBlocks.forEach((el) => {
    el.classList.remove("fade-enter");
    void el.offsetWidth;
    el.classList.add("fade-enter");
  });
}

function updateTerrenoFields() {
  const tipoTerreno = $("tipoTerreno")?.value;
  showElement($("terrenoZonaFiscalGroup"), tipoTerreno !== "zona_especial");
  showElement($("terrenoCodigoLogradouroGroup"), tipoTerreno === "zona_especial");
  refreshZonaFiscalSelectors();

  if (tipoTerreno === "zona_especial") {
    refreshZonaEspecialOptions("terreno");
    showZonaEspecialBairroNoMatchWarning("terreno");
  }
}

function updateConstrucaoFields() {
  const tipoConstrucao = $("tipoConstrucaoVenal")?.value;
  const residencialModo = $("residencialModo")?.value;

  showElement($("construcaoZonaFiscalGroup"), tipoConstrucao !== "zona_especial");
  showElement($("construcaoCodigoLogradouroGroup"), tipoConstrucao === "zona_especial");

  showElement($("residencialFields"), tipoConstrucao === "residencial");
  showElement($("comercialFields"), tipoConstrucao === "comercial_industrial");
  showElement($("zonaEspecialConstrucaoFields"), tipoConstrucao === "zona_especial");

  showElement($("residencialSimplesFields"), tipoConstrucao === "residencial" && residencialModo !== "padrao_diferente");
  showElement($("residencialCompostoFields"), tipoConstrucao === "residencial" && residencialModo === "padrao_diferente");

  refreshZonaFiscalSelectors();

  if (tipoConstrucao === "zona_especial") {
    refreshZonaEspecialOptions("construcao");
    showZonaEspecialBairroNoMatchWarning("construcao");
  }
}

function updateCalcModeUI(options = {}) {
  const { animate = true } = options;
  const mode = getCalcMode();
  const isAliquota = mode === "aliquota";
  const escopo = $("escopoVenal")?.value || "terreno";
  const calcLayout = $("calcLayout");

  syncCalcModeSegmentedUI(mode);

  calcLayout?.classList.toggle("mode-venal", !isAliquota);

  $$(".calc-aliquota-only").forEach((el) => showElement(el, isAliquota));
  $$(".calc-venal-only").forEach((el) => showElement(el, !isAliquota));

  showElement($("terrenoFields"), !isAliquota && (escopo === "terreno" || escopo === "terreno_construcao"));
  showElement($("construcaoFields"), !isAliquota && (escopo === "construcao" || escopo === "terreno_construcao"));

  const venalSections = $("venalSections");
  venalSections?.classList.toggle(
    "has-both",
    !isAliquota && escopo === "terreno_construcao"
  );

  updateTerrenoFields();
  updateConstrucaoFields();

  if (isAliquota) {
    $("btnGerarPdf")?.classList.remove("hidden");
  } else {
    $("btnGerarPdf")?.classList.add("hidden");
  }

  if (animate) {
    animateCalcModeContent();
  }
}

function initCalcModeSegmented() {
  const modeInput = $("calcModo");
  if (!modeInput) return;

  $$('[data-calc-mode-btn]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const nextMode = btn.dataset.calcModeBtn;
      if (!nextMode || modeInput.value === nextMode) return;

      modeInput.value = nextMode;
      modeInput.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function syncEscopoSwitchUI() {
  const escopo = $("escopoVenal")?.value || "terreno";
  $("escopoVenalSwitch")?.setAttribute("data-active-scope", escopo);
  $$(".scope-switch-btn").forEach((btn) => {
    const active = btn.dataset.scope === escopo;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
  });
}

function initEscopoSwitch() {
  const escopoSelect = $("escopoVenal");
  if (!escopoSelect) return;

  $$(".scope-switch-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      escopoSelect.value = btn.dataset.scope || "terreno";
      syncEscopoSwitchUI();
      updateCalcModeUI();
    });
  });

  syncEscopoSwitchUI();
}

function initCalculadora() {
  const form = $("formCalc");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    calcular();
  });

  // Máscara monetária no campo Valor Venal
  const inputValor = $("valor");
  if (inputValor) {
    inputValor.addEventListener("input", () => {
      const digits = inputValor.value.replace(/\D/g, "");
      if (!digits) {
        inputValor.value = "";
        return;
      }
      const num = parseInt(digits, 10) / 100;
      inputValor.value = num.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    });
  }

  $("calcModo")?.addEventListener("change", () => {
    hideCalcResultCard();
    updateCalcModeUI({ animate: true });
  });
  $("escopoVenal")?.addEventListener("change", () => {
    syncEscopoSwitchUI();
    updateCalcModeUI();
  });
  $("bairro")?.addEventListener("change", () => {
    zeUiState.terreno.noMatchWarnKey = "";
    zeUiState.construcao.noMatchWarnKey = "";
    refreshZonaFiscalSelectors();
    refreshZonaEspecialOptions("terreno");
    refreshZonaEspecialOptions("construcao");

    if ($("tipoTerreno")?.value === "zona_especial") {
      showZonaEspecialBairroNoMatchWarning("terreno");
    }
    if ($("tipoConstrucaoVenal")?.value === "zona_especial") {
      showZonaEspecialBairroNoMatchWarning("construcao");
    }
  });
  $("tipoTerreno")?.addEventListener("change", updateTerrenoFields);
  $("tipoConstrucaoVenal")?.addEventListener("change", updateConstrucaoFields);
  $("residencialModo")?.addEventListener("change", updateConstrucaoFields);

  $("btnLimpar")?.addEventListener("click", limparFormulario);
  $("btnGerarPdf")?.addEventListener("click", gerarPdf);

  initEscopoSwitch();
  initCalcModeSegmented();
  initVenalSelectors();
  updateCalcModeUI({ animate: false });
}

// ==========================================================================
// BASE LEGAL
// ==========================================================================
function renderizarBaseLegal() {
  const titulo = $("baseLegalTitulo");
  const texto = $("baseLegalTexto");
  const ref = $("baseLegalRef");

  if (titulo) titulo.textContent = BASE_LEGAL_IPTU.titulo;
  if (texto) texto.textContent = BASE_LEGAL_IPTU.texto;
  if (ref) ref.textContent = BASE_LEGAL_IPTU.referencia;
}

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
function inicializar() {
  try {
    initAppModal();
    initScrollLinks();
    initHomeToolHubLinks();
    initTheme();
    initNavbar();
    initTabs();
    initTableSearch();
    initBairroCombobox();
    initCalculadora();
    renderizarBaseLegal();
  } catch (_) {
    // Falha silenciosa na inicialização
  }
}

// Scripts type="module" são deferred — DOM já está pronto.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  inicializar();
}
