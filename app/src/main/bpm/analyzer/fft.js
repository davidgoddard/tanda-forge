// Unnormalised forward DFT, 1/N inverse. Bluestein preserves arbitrary input
// lengths (zero-padding the original signal would change the legacy BPM axis).
export function fft(re, im, inverse = false) {
  const n = re.length;
  if (n !== im.length || !n || (n & (n - 1))) throw new Error('FFT requires equal power-of-two arrays');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = (inverse ? 2 : -2) * Math.PI / size;
    const cr = Math.cos(angle), ci = Math.sin(angle);
    for (let start = 0; start < n; start += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < size / 2; k++) {
        const a = start + k, b = a + size / 2;
        const tr = wr * re[b] - wi * im[b], ti = wr * im[b] + wi * re[b];
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
        const next = wr * cr - wi * ci; wi = wr * ci + wi * cr; wr = next;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
export function realSpectrum(values) {
  const n = values.length;
  if (!n) return {re: new Float64Array(), im: new Float64Array()};
  if (!(n & (n - 1))) {
    const re = Float64Array.from(values), im = new Float64Array(n); fft(re, im); return {re, im};
  }
  let size = 1; while (size < 2 * n - 1) size *= 2;
  const ar = new Float64Array(size), ai = new Float64Array(size);
  const br = new Float64Array(size), bi = new Float64Array(size);
  for (let i = 0; i < n; i++) {
    const angle = Math.PI * ((i * i) % (2 * n)) / n, c = Math.cos(angle), s = Math.sin(angle);
    ar[i] = values[i] * c; ai[i] = -values[i] * s;
    br[i] = c; bi[i] = s;
    if (i) { br[size - i] = c; bi[size - i] = s; }
  }
  fft(ar, ai); fft(br, bi);
  for (let i = 0; i < size; i++) {
    const r = ar[i] * br[i] - ai[i] * bi[i]; ai[i] = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r;
  }
  fft(ar, ai, true);
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const angle = Math.PI * ((i * i) % (2 * n)) / n, c = Math.cos(angle), s = Math.sin(angle);
    re[i] = ar[i] * c + ai[i] * s; im[i] = ai[i] * c - ar[i] * s;
  }
  return {re, im};
}
