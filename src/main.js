/**
 * IPTU Nova Iguaçu — Interface da Calculadora
 * Módulo de UI: navbar, tabs, calculadora, filtro, base legal.
 *
 * Sem dependências externas. Sem ícones.
 * Lógica de cálculo permanece em iptu.js (intacta).
 */
import "./style.css";
import { getListaBairros, calcularParaSite, BASE_LEGAL_IPTU } from "./iptu.js";

// ==========================================================================
// UTILITÁRIOS DOM
// ==========================================================================
const $ = (id) => document.getElementById(id);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

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
// BAIRROS (popular <select>)
// ==========================================================================
function carregarBairros() {
  const lista = getListaBairros();
  const select = $("bairro");
  if (!select) {
    console.error("[IPTU] <select id='bairro'> não encontrado.");
    return;
  }

  const frag = document.createDocumentFragment();
  const optDefault = document.createElement("option");
  optDefault.value = "";
  optDefault.textContent = "Selecione o bairro…";
  frag.appendChild(optDefault);

  lista.forEach((nome) => {
    const opt = document.createElement("option");
    opt.value = nome;
    opt.textContent = nome;
    frag.appendChild(opt);
  });

  select.innerHTML = "";
  select.appendChild(frag);
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

function exibirResultado(data) {
  const result = $("result");
  const layout = $('calcLayout');
  if (!result) return;

  result.classList.remove('hidden');
  layout?.classList.add('has-result');

  $("iptuValue").textContent = data.iptu || "—";
  $("vviValue").textContent = data.valorVenal || "—";
  $("aliqValue").textContent = data.aliquota || "—";
  $("calcText").textContent = data.calculo || "";
  $("whyText").textContent = data.texto || "";

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

function calcular() {
  const bairro = $("bairro")?.value;
  const tipo = $("tipo")?.value;
  const valor = $("valor")?.value;
  const ze = $("ze")?.value;

  if (!bairro) {
    alert("Selecione um bairro.");
    $("bairro")?.focus();
    return;
  }
  if (!valor || valor.trim().length === 0) {
    alert("Informe o valor venal do imóvel.");
    $("valor")?.focus();
    return;
  }

  setLoading(true);
  try {
    const res = calcularParaSite(bairro, tipo, valor, ze);
    exibirResultado(res);
  } catch (err) {
    console.error("[IPTU] Erro no cálculo:", err);
    alert("Erro ao calcular o IPTU. Verifique os dados e tente novamente.");
  } finally {
    setLoading(false);
  }
}

function limparFormulario() {
  const form = $("formCalc");
  if (form) form.reset();
  $("result")?.classList.add("hidden");  $('calcLayout')?.classList.remove('has-result');}

function initCalculadora() {
  const form = $("formCalc");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    calcular();
  });

  $("btnLimpar")?.addEventListener("click", limparFormulario);
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
    initNavbar();
    initTabs();
    initTableSearch();
    carregarBairros();
    initCalculadora();
    renderizarBaseLegal();
  } catch (err) {
    console.error("[IPTU] Falha na inicialização:", err);
  }
}

// Scripts type="module" são deferred — DOM já está pronto.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializar);
} else {
  inicializar();
}
