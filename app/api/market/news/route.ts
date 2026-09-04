import {loadRuntimeSecrets} from "@/lib/runtime-secrets";
export const dynamic = "force-dynamic";

type NewsApiAiArticle = {
  title?: string; body?: string; url?: string; image?: string; dateTime?: string;
  dateTimePub?: string; date?: string; source?: { title?: string; uri?: string };
  authors?: Array<{ name?: string }>;
};

type NewsApiAiResponse = {
  error?: string; message?: string;
  articles?: { totalResults?: number; results?: NewsApiAiArticle[] };
};

export async function GET(request: Request) {
  await loadRuntimeSecrets();
  // Keep NEWS_API_KEY compatibility so existing deployments do not need a rename.
  const key = process.env.NEWSAPI_AI_KEY || process.env.NEWS_API_KEY;
  if (!key) return Response.json({ status: "not_configured", error: "Configure NEWSAPI_AI_KEY (or NEWS_API_KEY) to enable NewsAPI.ai market news." }, { status: 503 });

  const incoming = new URL(request.url).searchParams.get("q")?.trim();
  const query = incoming?.slice(0, 120);
  const payload: Record<string, unknown> = {
    resultType: "articles", lang: "eng", articlesPage: 1, articlesCount: 40,
    articlesSortBy: "date", articlesSortByAsc: false, includeArticleBody: true,
    includeArticleImage: true, apiKey: key,
  };
  if (query) payload.keyword = query;
  else payload.sourceGroupUri = "business/top100";

  let response: Response;
  try {
    response = await fetch("https://eventregistry.org/api/v1/article/getArticles", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
    });
  } catch {
    return Response.json({ status: "provider_error", error: "NewsAPI.ai could not be reached." }, { status: 502 });
  }

  const text = await response.text();
  let data: NewsApiAiResponse = {};
  try { data = JSON.parse(text) as NewsApiAiResponse; }
  catch { return Response.json({ status: "provider_error", error: `NewsAPI.ai returned an unreadable response (${response.status}).` }, { status: 502 }); }

  if (!response.ok || data.error) return Response.json({
    status: "provider_error", error: data.message || data.error || `NewsAPI.ai request failed (${response.status}).`,
  }, { status: response.status >= 400 ? response.status : 502 });

  const articles = (data.articles?.results || []).filter((article) => article.title && article.url).map((article) => ({
    title: article.title,
    description: article.body ? `${article.body.slice(0, 320).trim()}${article.body.length > 320 ? "…" : ""}` : null,
    url: article.url, image: article.image || null,
    publishedAt: article.dateTimePub || article.dateTime || article.date || null,
    source: article.source?.title || article.source?.uri || "Unknown source",
    author: article.authors?.map((author) => author.name).filter(Boolean).join(", ") || null,
  }));

  return Response.json({ status: "connected", provider: "NewsAPI.ai", mode: query ? "search" : "top-business", query: query || null,
    asOf: new Date().toISOString(), totalResults: data.articles?.totalResults || articles.length, articles,
  }, { headers: { "Cache-Control": "private, max-age=300" } });
}
