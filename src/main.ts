import { QdrantClient } from "@qdrant/js-client-rest"
import { randomUUID } from "crypto"
import "dotenv/config"
import { OpenAIApi, Configuration } from "openai"

const qdrant = new QdrantClient({ url: "http://127.0.0.1:6333" })
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }))

async function getEmbedding(text: string) {
  const res = await openai.createEmbedding({
    input: text,
    model: "text-embedding-ada-002",
  })
  return res.data.data[0].embedding
}

;(async () => {
  const collectionName = randomUUID()
  await qdrant.createCollection(collectionName, {
    vectors: {
      size: 1536,
      distance: "Cosine",
    }
  })
  await qdrant.createPayloadIndex(collectionName, {
    field_name: "docId",
    field_schema: "keyword",
    wait: true,
  })

  const texts = [
    "今日はいい天気ですね",
    "今日は雨が降っています",
    "昨日は雷でした",
    "今日は雪が降っています",
    "今日は嵐です"
  ]

  const textIdMap = new Map<string, string>()
  for (const text of texts) {
    const embedding = await getEmbedding(text)
    const id = randomUUID()
    await qdrant.upsert(collectionName, {
      wait: true,
      points: [
        {
          id: id,
          vector: embedding,
          payload: {
            docId: id,
          },
        },
      ],
    })
    textIdMap.set(id, text)
  }

  const queryText = "It's bad weather"
  const searchRes = await qdrant.search(collectionName, {
    vector: await getEmbedding(queryText),
    limit: 5,
  })

  console.log(`Query: ${queryText}`)
  console.log("Results:")
  searchRes.forEach((res) => {
    if (!res.payload) {
      throw new Error("Payload is not found")
    }
    const id = res.payload.docId
    if (typeof id !== "string") {
      throw new Error("Payload.docId is not found")
    }
    console.log(textIdMap.get(id))
  })

})()