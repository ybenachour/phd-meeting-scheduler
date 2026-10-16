/*
  Deployment configuration.
  Replace the two Supabase placeholders before publishing.
  The publishable key is safe to expose in browser code when Row Level Security is enabled.
*/
window.MEETING_APP_CONFIG = {
  pollId: "upec-phd-kickoff-2026-10-19-22",
  title: "PhD Kickoff Meeting Availability",
  participants: [
    { name: "Yassine", zone: "Asia/Dubai", label: "Dubai" },
    { name: "Barbara", zone: "Europe/Brussels", label: "Belgium" },
    { name: "Amir", zone: "Europe/Paris", label: "Paris" },
    { name: "Sadok", zone: "Europe/Paris", label: "Paris" }
  ],
  startDate: "2026-10-19",
  endDate: "2026-10-22",
  allowedWeekdays: [1, 2, 3, 4],
  durationMinutes: 30,
  startTimesDubai: ["10:00", "12:00", "13:00", "14:00", "15:00"],
  supabaseUrl: "PASTE_SUPABASE_PROJECT_URL_HERE",
  supabasePublishableKey: "PASTE_SUPABASE_PUBLISHABLE_KEY_HERE",
  table: "meeting_availability",
  refreshSeconds: 30
};
