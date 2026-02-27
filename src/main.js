// src/main.js - Código de UI (DOM, eventos, renderização)
import "./style.css";
import { getListaBairros, calcularParaSite, BASE_LEGAL_IPTU } from "./iptu.js";

/**
 * Rola suavemente para o topo da página
 */
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Abre a tela da calculadora e esconde as tabelas
 */
function openCalculator() {
  document.getElementById("screenTables").classList.add("hidden");
  document.getElementById("screenCalc").classList.remove("hidden");
  scrollToTop();
}

/**
 * Volta para a tela de tabelas e esconde a calculadora
 */
function backToTables() {
  document.getElementById("screenCalc").classList.add("hidden");
  document.getElementById("screenTables").classList.remove("hidden");
  scrollToTop();
}

/**
 * Altera o estado de loading do botão de calcular
 * @param {boolean} isLoading 
 */
function setLoading(isLoading) {
  const btn = document.getElementById("btnCalc");
  btn.disabled = isLoading;
  btn.textContent = isLoading ? "Calculando..." : "Calcular";
}

/**
 * Exibe o resultado do cálculo na UI
 * @param {Object} data - Objeto retornado por calcularParaSite
 */
function showResult(data) {
  const result = document.getElementById("result");
  result.classList.remove("hidden");

  document.getElementById("iptuValue").textContent = data.iptu || "—";
  document.getElementById("vviValue").textContent = data.valorVenal || "—";
  document.getElementById("aliqValue").textContent = data.aliquota || "—";

  document.getElementById("calcText").textContent = data.calculo || "";
  document.getElementById("whyText").textContent = data.texto || "";

  const badge = document.getElementById("badge");
  const ze = document.getElementById("ze").value;
  const tipo = document.getElementById("tipo").value;

  // Verifica se há aviso de Zona Especial não cadastrada
  if (ze === "SIM" && tipo === "TERRITORIAL" && (data.texto || "").includes("não consta")) {
    badge.textContent = "ATENÇÃO";
    badge.className = "badgeWarn";
  } else {
    badge.textContent = "OK";
    badge.className = "badgeOk";
  }
}

/**
 * Executa o cálculo do IPTU
 */
function calcular() {
  const bairro = document.getElementById("bairro").value;
  const tipo = document.getElementById("tipo").value;
  const valor = document.getElementById("valor").value;
  const ze = document.getElementById("ze").value;

  if (!bairro) {
    alert("Selecione um bairro.");
    return;
  }
  if (!valor || valor.trim().length < 1) {
    alert("Informe o valor venal.");
    return;
  }

  setLoading(true);

  try {
    const res = calcularParaSite(bairro, tipo, valor, ze);
    showResult(res);
  } catch (e) {
    alert("Erro ao calcular: " + (e?.message || e));
  } finally {
    setLoading(false);
  }
}

/**
 * Carrega a lista de bairros no select
 */
function carregarBairros() {
  const lista = getListaBairros();
  const sel = document.getElementById("bairro");
  sel.innerHTML = '<option value="">Selecione...</option>';

  (lista || []).forEach((b) => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.textContent = b;
    sel.appendChild(opt);
  });
}

/**
 * Renderiza a base legal no card
 */
function renderizarBaseLegal() {
  const container = document.getElementById("baseLegal");
  if (!container) return;

  container.innerHTML = `
    <h3 class="base-legal-titulo">${BASE_LEGAL_IPTU.titulo}</h3>
    <p class="base-legal-texto">${BASE_LEGAL_IPTU.texto}</p>
    <p class="base-legal-ref">${BASE_LEGAL_IPTU.referencia}</p>
  `;
}

// ===============================
// INICIALIZAÇÃO
// ===============================

// Expondo funções no window para os eventos onclick do HTML
window.openCalculator = openCalculator;
window.backToTables = backToTables;
window.scrollToTop = scrollToTop;
window.calcular = calcular;

// Carrega os bairros quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
  carregarBairros();
  renderizarBaseLegal();
});
