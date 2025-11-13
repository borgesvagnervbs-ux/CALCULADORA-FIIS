// server.js — versão final para Render/Vercel
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// ===== CONFIG =====
const BRAPI_TOKEN = "efoyeAp4b6TW9iFURTW2xT";

/* ==============================
   FUNÇÃO 1 — Cotação via BRAPI
   ============================== */
async function buscarCotaBRAPI(ticker) {
  try {
    const url = `https://brapi.dev/api/quote/${ticker}?token=${BRAPI_TOKEN}`;
    const res = await fetch(url);
    const data = await res.json();
    if (Array.isArray(data.results) && data.results.length > 0) {
      return Number(data.results[0].regularMarketPrice ?? 0);
    }
  } catch (err) {
    console.warn("Erro BRAPI:", err.message);
  }
  return 0;
}

/* ==========================================
   FUNÇÃO 2 — Dividendo via FundsExplorer API
   ========================================== */
async function buscarDividendoFundsExplorer(ticker) {
  try {
    const url = `https://www.fundsexplorer.com.br/api/funds/${ticker}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Erro HTTP FundsExplorer");
    const data = await res.json();

    return {
      nome: data.longName ?? data.paper ?? ticker,
      valorCota: Number(data.price ?? 0),
      dividendo: Number(data.dividend ?? 0),
      fonteDiv: "FundsExplorer",
    };
  } catch (err) {
    console.warn("FundsExplorer falhou:", err.message);
    return { nome: ticker, valorCota: 0, dividendo: 0, fonteDiv: "FundsExplorer" };
  }
}

/* =================================================
   FUNÇÃO 3 — Dividendo via StatusInvest (API JSON)
   ================================================= */
async function buscarDividendoStatusInvest(ticker) {
  try {
    const url = `https://statusinvest.com.br/fii/getmainindicators?ticker=${ticker}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
        "Referer": `https://statusinvest.com.br/fundos-imobiliarios/${ticker}`,
      },
    });

    if (!res.ok) throw new Error("Erro HTTP StatusInvest");

    const data = await res.json();
    const dividendo = Number(data.dy ?? 0);
    const nome = data.companyName ?? ticker;

    return { nome, dividendo, fonteDiv: "StatusInvest" };
  } catch (err) {
    console.warn("StatusInvest falhou:", err.message);
    return { nome: ticker, dividendo: 0, fonteDiv: "StatusInvest" };
  }
}

/* ===============================
   ROTA PRINCIPAL /api/fii/:ticker
   =============================== */
app.get("/api/fii/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  console.log(`🔍 Consultando ${ticker}...`);

  try {
    // 1️⃣ Cota via BRAPI
    const valorCota = await buscarCotaBRAPI(ticker);

    // 2️⃣ Dividendo via FundsExplorer
    let { nome, dividendo, fonteDiv } = await buscarDividendoFundsExplorer(ticker);

    // 3️⃣ Se não houver dividendo, tenta StatusInvest
    if (!dividendo || dividendo === 0) {
      const si = await buscarDividendoStatusInvest(ticker);
      if (si.dividendo > 0) {
        dividendo = si.dividendo;
        nome = si.nome;
        fonteDiv = si.fonteDiv;
      }
    }

    // 4️⃣ Retorno consolidado
    res.json({
      ok: true,
      ticker,
      nome,
      valorCota,
      dividendo,
      fonteCota: "BRAPI",
      fonteDiv,
    });
  } catch (error) {
    console.error("Erro geral:", error);
    res.json({ ok: false, error: error.message });
  }
});

/* ==========================
   INICIAR SERVIDOR (Render)
   ========================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor ativo na porta ${PORT}`));
