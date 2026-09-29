import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { awsClientConfig } from "@/lib/aws/config";

const schema = z.object({
  fileName: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  kind: z.enum(["product", "catalogue-cover", "catalogue-banner"]).default("product"),
});

const KEY_PREFIXES = {
  product: "products",
  "catalogue-cover": "catalogues",
  "catalogue-banner": "banners",
} as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket)
    return NextResponse.json(
      { error: "Storage is not configured" },
      { status: 503 },
    );
  const extension =
    parsed.data.fileName.split(".").pop()?.toLowerCase() ?? "jpg";
  const environmentPrefix = process.env.AWS_S3_PREFIX?.replace(
    /^\/+|\/+$/g,
    "",
  );
  const key = [
    environmentPrefix,
    KEY_PREFIXES[parsed.data.kind],
    `${crypto.randomUUID()}.${extension}`,
  ]
    .filter(Boolean)
    .join("/");
  const client = new S3Client(awsClientConfig());
  try {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: parsed.data.contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { expiresIn: 300 },
    );
    const baseUrl = process.env.AWS_CLOUDFRONT_URL?.replace(/\/$/, "");
    return NextResponse.json({
      uploadUrl,
      key,
      publicUrl: baseUrl ? `${baseUrl}/${key}` : null,
    });
  } catch (error: unknown) {
    console.error(error);

    return NextResponse.json(
      { error: "Storage is not available right now." },
      { status: 503 },
    );
  }
}
