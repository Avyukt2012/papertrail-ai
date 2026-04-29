import { Client } from "@notionhq/client";

export type NotionDoc = {
  id: string;
  title: string;
  url: string;
  content: string;
};

type PageMeta = {
  id: string;
  title: string;
  url: string;
};

async function getPageText(notion: Client, pageId: string): Promise<string> {
  const lines: string[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const block of blocks.results) {
      if (!("type" in block)) continue;
      const blockType = block.type;
      const blockData = (block as Record<string, unknown>)[blockType] as
        | { rich_text?: Array<{ plain_text?: string }> }
        | undefined;
      const rich = blockData?.rich_text ?? [];
      const text = rich.map((r) => r.plain_text ?? "").join("").trim();
      if (text) lines.push(text);
    }

    hasMore = blocks.has_more;
    cursor = blocks.next_cursor ?? undefined;
  }

  return lines.join("\n");
}

function getConcurrency() {
  const raw = Number(process.env.NOTION_FETCH_CONCURRENCY ?? "20");
  if (!Number.isFinite(raw)) return 20;
  return Math.min(50, Math.max(1, Math.floor(raw)));
}

export async function fetchNotionPages(
  notionAccessToken: string,
  limit = 200
): Promise<NotionDoc[]> {
  if (!notionAccessToken) {
    throw new Error("Missing Notion access token for current user.");
  }

  const notion = new Client({ auth: notionAccessToken });
  const metas: PageMeta[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore && metas.length < limit) {
    const remaining = limit - metas.length;
    const result = await notion.search({
      filter: { property: "object", value: "page" },
      page_size: Math.min(100, remaining),
      start_cursor: cursor,
    });

    for (const page of result.results) {
      if (!("properties" in page)) continue;
      if (metas.length >= limit) break;

      const titleProp = Object.values(page.properties).find(
        (prop) => prop.type === "title"
      );
      const title =
        titleProp && "title" in titleProp && titleProp.title[0]
          ? titleProp.title[0].plain_text
          : "Untitled";

      metas.push({
        id: page.id,
        title,
        url:
          "url" in page && typeof page.url === "string"
            ? page.url
            : `https://www.notion.so/${page.id.replace(/-/g, "")}`,
      });
    }

    hasMore = result.has_more;
    cursor = result.next_cursor ?? undefined;
  }

  const docs: NotionDoc[] = new Array(metas.length);
  const concurrency = getConcurrency();
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < metas.length) {
      const current = nextIndex;
      nextIndex += 1;

      const meta = metas[current];
      const content = await getPageText(notion, meta.id);
      docs[current] = { ...meta, content };
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, metas.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  return docs;
}
