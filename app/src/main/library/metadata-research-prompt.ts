// Editable provider-neutral prompt template.
export const metadataResearchPrompt = `Research every recording in the attached CSV using reliable sources. Match the specific recording rather than just the composition. Prefer specialist tango discographies for historical recordings. Distinguish recording dates from compilation release dates, and identify the performing artist or orchestra and the actual singer(s).

Return a downloadable UTF-8 CSV with every original row, including unresolved tracks. Preserve each track ID and all original columns and values verbatim. The duration column is milliseconds. Append these columns:
suggested_title,suggested_artist,suggested_singer,suggested_genre,suggested_style,suggested_subgenre,recording_year,recording_date,suggested_bpm,vocal_status,source_url,confidence,review_status,notes

Use instrumental, vocal or unknown for vocal_status. Distinguish Tango, Milonga, Vals, Candombe and other genres from suitability for dancing. Identify traditional, modern, nuevo, electronic or alternative styles and subgenres when supported. Use YYYY-MM-DD for complete recording dates and separate multiple HTTP(S) source URLs with |. Flag contradictory evidence and ambiguous recording matches in notes. Use High, Medium, Low or Unknown for confidence based on evidence quality and certainty of the recording match. Mark unresolved rows as unresolved in review_status.

Leave unsupported suggestions blank. Never invent missing information, guess BPM from genre or style, or present subjective musical character as a verified acoustic measurement.`;
