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
// BAIRROS — Combobox com filtro
// ==========================================================================
function normalizarTexto(str) {
  return String(str)
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function initBairroCombobox() {
  const lista = getListaBairros();
  const input    = $("bairroInput");
  const list     = $("bairroList");
  const hidden   = $("bairro");
  const combobox = $("bairroCombobox");

  if (!input || !list || !hidden) {
    console.error("[IPTU] Combobox de bairro não encontrado.");
    return;
  }

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
    $("bairroInput")?.focus();
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
    initBairroCombobox();
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
