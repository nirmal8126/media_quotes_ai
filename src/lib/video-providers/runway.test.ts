import { runRunwayVideo } from "./runway";

function createFetchMock(expectedPath: string) {
  return async (url: string, init?: RequestInit) => {
    if (!url.includes(expectedPath)) {
      return new Response(JSON.stringify({ error: `Unexpected path: ${url}` }), { status: 500 });
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (!body.promptText) {
      return new Response(JSON.stringify({ error: "promptText missing" }), { status: 400 });
    }
    return new Response(JSON.stringify({ id: "task_test", output: [{ url: "https://example.com/video.mp4" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}

async function runSmokeTest() {
  process.env.RUNWAY_API_KEY = "test";
  process.env.RUNWAY_API_BASE_URL = "https://api.runwayml.com";

  const imageFetch = createFetchMock("/v1/image_to_video");
  await runRunwayVideo({
    prompt: "hello",
    imageUrl: "https://example.com/image.jpg",
    durationSec: 2,
    aspectRatio: "9:16",
    fetcher: imageFetch as typeof fetch,
  });

  const textFetch = createFetchMock("/v1/text_to_video");
  await runRunwayVideo({
    prompt: "hello",
    imageUrl: null,
    durationSec: 2,
    aspectRatio: "9:16",
    fetcher: textFetch as typeof fetch,
  });
}

if (process.env.RUNWAY_SMOKE_TEST === "true") {
  runSmokeTest().catch((err) => {
    console.error("Runway smoke test failed", err);
    process.exit(1);
  });
}
