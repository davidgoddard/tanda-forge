export type AppApi = {
  ping: () => Promise<string>;
};

declare global {
  interface Window {
    tanda?: AppApi;
  }
}

export {};
