export type WaveformWidget = {
  container: HTMLDivElement | null;
  image: HTMLImageElement | null;
  placeholder: HTMLSpanElement | null;
};

export type WaveformSourceApi = {
  getWaveform?: (trackId: string) => Promise<string | null>;
};

export const createWaveformController = (params: {
  widgets: WaveformWidget[];
  api: WaveformSourceApi | undefined;
  translate: (key: string) => string;
  setStatus: (message: string) => void;
}) => {
  let waveformTrackId: string | null = null;
  let waveformRequestId = 0;

  const activeWidgets = () =>
    params.widgets.filter((widget) => widget.container && widget.image);

  const updateSource = async (trackId: string | null) => {
    const widgets = activeWidgets();
    if (widgets.length === 0) {
      return;
    }
    if (!trackId) {
      widgets.forEach((widget) => {
        widget.image!.src = "";
        widget.container!.classList.add("hidden");
        widget.container!.classList.remove("missing");
        if (widget.placeholder) {
          widget.placeholder.textContent = params.translate("waveformUnavailable");
        }
      });
      waveformTrackId = null;
      return;
    }
    if (
      waveformTrackId === trackId &&
      widgets.some((widget) => Boolean(widget.image?.src))
    ) {
      return;
    }
    waveformTrackId = trackId;
    widgets.forEach((widget) => {
      widget.container!.classList.remove("hidden");
      widget.container!.classList.add("missing");
      if (widget.placeholder) {
        widget.placeholder.textContent = params.translate("waveformLoading");
      }
    });
    const requestId = (waveformRequestId += 1);
    const dataUrl = await params.api?.getWaveform?.(trackId);
    if (requestId !== waveformRequestId) {
      return;
    }
    if (dataUrl) {
      widgets.forEach((widget) => {
        widget.image!.src = dataUrl;
        widget.container!.classList.remove("hidden");
        widget.container!.classList.remove("missing");
      });
      return;
    }
    widgets.forEach((widget) => {
      widget.image!.src = "";
      widget.container!.classList.remove("hidden");
      widget.container!.classList.add("missing");
      if (widget.placeholder) {
        widget.placeholder.textContent = params.translate("waveformUnavailable");
      }
    });
    params.setStatus(params.translate("statusWaveformUnavailable"));
  };

  return { updateSource };
};
