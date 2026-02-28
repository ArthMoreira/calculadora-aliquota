import { defineConfig } from "vite";

export default defineConfig({
  // "base" deve ser ajustado se a aplicação NÃO for servida na raiz do domínio.
  // Ex.: base: "/iptu/" se acessível em https://prefeitura.gov.br/iptu/
  base: "/",

  build: {
    // Gera sourcemaps para facilitar depuração em produção
    sourcemap: false,

    // Pasta de saída do build
    outDir: "dist",

    // Limpa a pasta dist antes de cada build
    emptyOutDir: true,
  },

  server: {
    // Porta padrão do dev server
    port: 5173,
    open: true,
  },
});
