export const localAudioUrl = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, "/");
  const prefix = normalized.startsWith("/") ? "file://" : "file:///";
  return encodeURI(`${prefix}${normalized}`).replace(/#/g, "%23");
};

