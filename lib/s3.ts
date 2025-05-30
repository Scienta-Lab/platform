import { S3Client } from "@aws-sdk/client-s3";
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY } from "./taintedEnvVar";

export const platformBucket = "scientalab-platform";

export const s3Client = new S3Client({
  region: "eu-west-3",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});
