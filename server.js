// server.js (versão local)
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const BRAPI_TOKEN = "efoyeAp4b6TW9iFURTW2xT";

// Rota principal
app.get("/api/fii/:ticker", async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const brapiUrl = `https://brapi.dev/api/quote/${ticker}?token=${BRAPI_TOKEN}`;
  const fundsUrl = `https://www.fundsexplorer.com.br/api/funds/${ticker}`;

  try {
    // Busca cotação na BRAPI
    const brapiResp = await fetch(brapiUrl);
    const brapiData = await brapiResp.json();

    let valorCota = 0;
    if (Array.isArray(brapiData.results) && brapiData.results.length > 0) {
      valorCota = Number(brapiData.results[0].regularMarketPrice ?? 0);
    }

    // Busca dividendo no FundsExplorer
    const fundsResp = await fetch(fundsUrl);
    const fundsData = await fundsResp.json();
    const dividendo = Number(fundsData.dividend ?? 0);
    const nome = fundsData.longName ?? fundsData.paper ?? ticker;

    res.json({
      ok: true,
      ticker,
      nome,
      valorCota,
      dividendo,
      fonteCota: "BRAPI",
      fonteDiv: "FundsExplorer",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ Proxy rodando em http://localhost:${PORT}`);
});
