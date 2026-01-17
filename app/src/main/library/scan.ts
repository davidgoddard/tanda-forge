export type LibraryRoot = {
  id: string;
  path: string;
  kind: "usb" | "folder";
};

export const scanLibraryRoots = async (_roots: LibraryRoot[]) => {
  // Placeholder for filesystem discovery and change detection.
  return [] as const;
};
