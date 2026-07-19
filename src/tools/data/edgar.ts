import { ingestDocument } from "../../core/rag/store";
import { logger } from "../../core/logger";

/**
 * SEC EDGAR — free, no key, but requires a descriptive User-Agent (set
 * SEC_USER_AGENT="Name email"). We resolve a ticker → CIK, pull recent
 * 10-K/10-Q filings, strip them to text, and ingest into RAG so the CreditAgent
 * reasons over primary sources (and cites them).
 */
const UA = process.env.SEC_USER_AGENT || "Bulaveur Capital research@bulaveur.example";

async function secGet(url: string): Promise<Response> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json, text/html" } });
  if (!res.ok) throw new Error(`EDGAR ${res.status} for ${url}`);
  return res;
}

interface TickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

export async function getCik(ticker: string): Promise<string | null> {
  const res = await secGet("https://www.sec.gov/files/company_tickers.json");
  const map = (await res.json()) as Record<string, TickerEntry>;
  const entry = Object.values(map).find((e) => e.ticker.toUpperCase() === ticker.toUpperCase());
  return entry ? String(entry.cik_str).padStart(10, "0") : null;
}

export interface FilingRef {
  form: string;
  filingDate: string;
  accession: string;
  primaryDoc: string;
  url: string;
}

export async function getRecentFilings(cik: string, forms = ["10-K", "10-Q"], limit = 4): Promise<FilingRef[]> {
  const res = await secGet(`https://data.sec.gov/submissions/CIK${cik}.json`);
  const json = (await res.json()) as {
    filings?: { recent?: { form?: string[]; filingDate?: string[]; accessionNumber?: string[]; primaryDocument?: string[] } };
  };
  const r = json.filings?.recent;
  if (!r?.form) return [];
  const out: FilingRef[] = [];
  for (let i = 0; i < r.form.length && out.length < limit; i++) {
    const form = r.form[i]!;
    if (!forms.includes(form)) continue;
    const accession = (r.accessionNumber?.[i] ?? "").replace(/-/g, "");
    const primaryDoc = r.primaryDocument?.[i] ?? "";
    if (!accession || !primaryDoc) continue;
    out.push({
      form,
      filingDate: r.filingDate?.[i] ?? "",
      accession,
      primaryDoc,
      url: `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}/${primaryDoc}`,
    });
  }
  return out;
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchFilingText(url: string, maxChars = 200_000): Promise<string> {
  const res = await secGet(url);
  const html = await res.text();
  return htmlToText(html).slice(0, maxChars);
}

/** Ingest an issuer's recent filings into RAG. Returns how many were stored. */
export async function ingestIssuerFilings(issuerName: string, ticker: string): Promise<number> {
  const cik = await getCik(ticker);
  if (!cik) {
    logger.warn({ ticker }, "edgar.cik.notfound");
    return 0;
  }
  const filings = await getRecentFilings(cik);
  let n = 0;
  for (const f of filings) {
    try {
      const text = await fetchFilingText(f.url);
      if (text.length < 500) continue;
      await ingestDocument({
        source: "edgar",
        url: f.url,
        title: `${issuerName} ${f.form} ${f.filingDate}`,
        content: text,
        metadata: { ticker, cik, form: f.form, filingDate: f.filingDate },
      });
      n++;
    } catch (err) {
      logger.warn({ url: f.url, err: String(err) }, "edgar.filing.fail");
    }
  }
  logger.info({ issuerName, ticker, ingested: n }, "edgar.ingest.done");
  return n;
}
