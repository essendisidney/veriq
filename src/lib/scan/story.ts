import { crawlOrigin, type CrawledPage } from "@/lib/crawler";
import { stripToText } from "@/lib/crawler/text";

export type StoryPage = {
  url: string;
  kind: string;
};

export type StoryCrawl = {
  pages: StoryPage[];
  html: string;
  text: string;
  privacyUrl: string | null;
  privacyExcerpt: string | null;
  teamPageUrl: string | null;
  teamFootprint: number;
  crawled: CrawledPage[];
  budgetUsed: number;
  budgetMax: number;
  crawlSummary: string;
  refused: { url: string; reason: string }[];
};

export { stripToText };

export function classifyStoryKind(pathname: string) {
  const path = pathname.toLowerCase();
  if (/privacy/.test(path)) return "privacy";
  if (/team|people|leadership|founder/.test(path)) return "team";
  if (/career|job/.test(path)) return "careers";
  if (/contact/.test(path)) return "contact";
  if (/legal|terms/.test(path)) return "legal";
  if (/investor/.test(path)) return "investors";
  if (/compliance|licen|trust|security/.test(path)) return "compliance";
  if (/kenya|africa|location|office/.test(path)) return "presence";
  if (/about|company|who-we-are/.test(path)) return "about";
  return "story";
}

function countTeamFootprint(html: string) {
  const linkedin = html.match(/linkedin\.com\/in\//gi)?.length ?? 0;
  return Math.min(linkedin, 80);
}

export function storyFromCrawl(
  homepageUrl: string,
  homepageHtml: string,
  crawled: CrawledPage[],
): Omit<StoryCrawl, "crawled" | "budgetUsed" | "budgetMax" | "crawlSummary" | "refused"> {
  const home = homepageUrl.replace(/\/$/, "");
  const pages: StoryPage[] = [];
  const htmlParts: string[] = [];
  const textParts: string[] = [];
  let privacyUrl: string | null = null;
  let privacyExcerpt: string | null = null;
  let teamPageUrl: string | null = null;
  let teamFootprint = countTeamFootprint(homepageHtml);

  for (const page of crawled) {
    if (page.status !== "fetched" || page.contentType.includes("pdf")) continue;
    const isHome = page.url.replace(/\/$/, "") === home;
    let kind = "story";
    try {
      kind = classifyStoryKind(new URL(page.url).pathname);
    } catch {
      // Keep generic kind.
    }
    if (!isHome && (kind !== "story" || pages.length < 8)) {
      pages.push({ url: page.url, kind });
    }
    if (page.html) htmlParts.push(page.html);
    if (page.text) textParts.push(page.text);

    const linkedin = countTeamFootprint(page.html);
    if (linkedin > teamFootprint) {
      teamFootprint = linkedin;
      teamPageUrl = page.url;
    } else if (kind === "team" && !teamPageUrl) {
      teamPageUrl = page.url;
    }

    if (!privacyUrl && (kind === "privacy" || /privacy|personal data|data protection/i.test(page.text))) {
      privacyUrl = page.url;
      privacyExcerpt = page.text.slice(0, 4000);
    }
  }

  return {
    pages: pages.filter((row, index) => pages.findIndex((item) => item.url === row.url) === index).slice(0, 12),
    html: htmlParts.join("\n").slice(0, 200_000),
    text: textParts.join("\n").slice(0, 60_000),
    privacyUrl,
    privacyExcerpt,
    teamPageUrl,
    teamFootprint,
  };
}

export async function crawlStory(
  origin: string,
  homepageHtml: string,
  homepageUrl = origin,
): Promise<StoryCrawl> {
  const homeUrl = (homepageUrl || origin).replace(/\/$/, "");
  const crawl = await crawlOrigin({
    origin: origin.replace(/\/$/, ""),
    homepageUrl: homeUrl,
    homepageHtml,
  });
  const story = storyFromCrawl(homeUrl, homepageHtml, crawl.pages);
  return {
    ...story,
    crawled: crawl.pages,
    budgetUsed: crawl.budgetUsed,
    budgetMax: crawl.budgetMax,
    crawlSummary: crawl.summary,
    refused: crawl.refused,
  };
}
