export function awsClientConfig() {
  return {
    region: process.env.AWS_REGION ?? "ap-south-1",
  };
}
