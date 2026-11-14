declare module "mammoth/mammoth.browser" {
  const mammoth: {
    convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: Record<string, unknown>): Promise<{ value: string; messages: unknown[] }>;
    images: { imgElement(fn: (image: unknown) => Promise<{ src: string }> | { src: string }): unknown };
  };
  export default mammoth;
}
