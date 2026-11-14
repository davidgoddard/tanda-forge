// A slow beat must itself recur and have a supported faster subdivision.
// The rate prior is explicit and tuned only on the development partition.
export function selectRecurrence(windows, {
  prior = 1,
  power = 2,
  subdivisionWeight = .5,
  center = 70,
  maxBpm = 160,
} = {}) {
  function at(curve, bpm) {
    const position = (bpm - 40) * 2;
    const index = Math.floor(position);
    const fraction = position - index;
    if (index < 0 || index + 1 >= curve.length) return 0;
    return curve[index] * (1 - fraction) + curve[index + 1] * fraction;
  }

  const summed = new Float64Array(401);
  let count = 0;
  for (const {curve} of windows) {
    const scores = curve.map((value, index) => {
      const bpm = 40 + index * .5;
      const faster = Math.max(at(curve, 2 * bpm), at(curve, 3 * bpm), at(curve, 4 * bpm));
      return value * (1 - subdivisionWeight + subdivisionWeight * faster);
    });
    const maximum = Math.max(...scores);
    if (maximum < .01) continue;
    count++;
    for (let index = 0; index < scores.length; index++) {
      summed[index] += (scores[index] / maximum) ** power;
    }
  }

  for (let index = 0; index < summed.length; index++) {
    summed[index] *= Math.exp(-prior * Math.log2((40 + index * .5) / center) ** 2);
  }
  const peaks = [];
  for (let index = 1; index < 400 && 40 + index * .5 <= maxBpm; index++) {
    if (summed[index] < summed[index - 1] || summed[index] <= summed[index + 1]) continue;
    const curvature = summed[index - 1] - 2 * summed[index] + summed[index + 1];
    const delta = curvature ? .5 * (summed[index - 1] - summed[index + 1]) / curvature : 0;
    peaks.push({bpm: 40 + (index + delta) * .5, score: summed[index] / count});
  }
  peaks.sort((a, b) => b.score - a.score);
  return {
    status: peaks.length ? 'ok' : 'insufficient_evidence',
    bpm: peaks[0]?.bpm ?? null,
    candidates: peaks.slice(0, 12),
  };
}
