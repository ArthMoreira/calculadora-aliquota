/**
 * IPTU Nova Iguaçu — Interface da Calculadora
 * Módulo de UI: navbar, tabs, calculadora, filtro, base legal.
 *
 * Sem dependências externas. Sem ícones.
 * Lógica de cálculo permanece em iptu.js (intacta).
 */
import "./style.css";
import { getListaBairros, calcularParaSite, BASE_LEGAL_IPTU } from "./iptu.js";
import html2pdf from "html2pdf.js";

// ==========================================================================
// UTILITÁRIOS DOM
// ==========================================================================
const $ = (id) => document.getElementById(id);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// ==========================================================================
// TEMA (dark / light toggle)
// ==========================================================================
function initTheme() {
  const root = document.documentElement;
  const btn = $('themeToggle');

  function applyTheme(theme) {
    root.dataset.theme = theme;
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

  // Store data for PDF generation
  window.__lastCalcData = data;

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
  } catch (_) {
    alert("Erro ao calcular o IPTU. Verifique os dados e tente novamente.");
  } finally {
    setLoading(false);
  }
}

// ==========================================================================
// GERAR PDF
// ==========================================================================
function gerarPdf() {
  const data = window.__lastCalcData;
  if (!data) {
    alert("Realize um cálculo antes de gerar o PDF.");
    return;
  }

  // Collect form values
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

  // Extract URG from calculation data
  let urg = data.urg || "—";

  // Date
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dataEmissao = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const filename = `IPTU_Nova_Iguacu_Calculo_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.pdf`;

  // Build fundamentação paragraphs
  const textoFund = data.texto || "";
  const fundHtml = textoFund
    .split("\n")
    .map((line) =>
      line.trim() === ""
        ? '<div style="height:3px"></div>'
        : `<p style="margin:0 0 3px 0;font-size:10.5px;color:#2a2a2a;line-height:1.55">${escHtml(line)}</p>`
    )
    .join("");

  // Build identification rows
  const rows = [
    ["Tipo do Imóvel", tipo],
    ["URG", urg],
    ["Bairro", bairro],
    ["Zona Especial", ze],
    ["Valor Venal (VVI)", data.valorVenal || "—"],
    ["Alíquota Aplicada", data.aliquota || "—"],
    ["Data de Emissão", dataEmissao]
  ];
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
          <span style="font-size:11px;font-weight:600;color:#3a3a3a">Valor do IPTU Calculado:</span>
          <span style="font-size:14px;font-weight:700;color:#1a1a1a">${escHtml(data.iptu || "—")}</span>
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
        <p style="font-size:10.5px;color:#2a2a2a;margin:2px 0;line-height:1.55">Conforme o Art. 18 do Código Tributário Municipal, o IPTU é apurado pela aplicação da alíquota correspondente (ALC) sobre o valor venal do imóvel (VVI), seguindo a fórmula: IPTU = VVI × ALC. As alíquotas aplicáveis constam das tabelas municipais vigentes (ref. 2017), variando conforme a localização/URG, uso do imóvel e faixas de valor venal.</p>
        <p style="font-size:10.5px;color:#2a2a2a;margin:2px 0;line-height:1.55">Referência: Tabelas municipais vigentes (2017)</p>
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
      alert("Erro ao gerar o PDF. Tente novamente.");
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
  $("result")?.classList.add("hidden");
  $('calcLayout')?.classList.remove('has-result');
  window.__lastCalcData = null;
}

function initCalculadora() {
  const form = $("formCalc");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    calcular();
  });

  $("btnLimpar")?.addEventListener("click", limparFormulario);
  $("btnGerarPdf")?.addEventListener("click", gerarPdf);
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
