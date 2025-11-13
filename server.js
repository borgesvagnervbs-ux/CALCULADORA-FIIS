import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
app.use(cors());

const BRAPI_TOKEN = "efoyeAp4b6TW9iFURTW2xT";

// ===== FUNÇÃO BRAPI =====
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

// ===== FUNÇÃO FUNDSEXPLORER =====
/**
 * Função para buscar dividendo no StatusInvest (via API interna)
 */
async function buscarDividendoStatusInvest(ticker) {
  try {
    const url = `https://statusinvest.com.br/fii/getmainindicators?ticker=${ticker}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept": "application/json, text/plain, */*",
        "Referer": `https://statusinvest.com.br/fundos-imobiliarios/${ticker}`
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


// ===== FUNÇÃO STATUSINVEST =====
async function buscarDividendoStatusInvest(ticker) {
  try {
    const url = `https://statusinvest.com.br/fundos-imobiliarios/${ticker}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });
    const html = await res.text();

    if (!html.includes("DY (12M)")) throw new Error("HTML inválido ou bloqueado");
    const $ = cheerio.load(html);

    // Procura o dividendo em destaque
    const dividendoTxt = $('div.top-info div.info div.value').first().text().trim().replace(",", ".");
    const dividendo = Number(dividendoTxt) || 0;
    const nome = $("h1").first().text().trim() || ticker;

    return { nome, dividendo, fonteDiv: "StatusInvest" };
  } catch (err) {
    console.warn("StatusInvest falhou:", err.message);
    return { nome: ticker, dividendo: 0, fonteDiv: "StatusInvest" };
  }
}

// ===== ROTA PRINCIPAL =====
app.get("/api/fii/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  console.log("🔍 Consultando:", ticker);

  try {
    // 1️⃣ Busca cotação
    const valorCota = await buscarCotaBRAPI(ticker);

    // 2️⃣ Busca dividendo (FundsExplorer)
    let { nome, dividendo, fonteDiv } = await buscarDividendoFundsExplorer(ticker);

    // 3️⃣ Se vier 0, tenta StatusInvest
    if (!dividendo || dividendo === 0) {
      const si = await buscarDividendoStatusInvest(ticker);
      if (si.dividendo > 0) {
        dividendo = si.dividendo;
        nome = si.nome;
        fonteDiv = si.fonteDiv;
      }
    }

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Servidor ativo na porta ${PORT}`));

