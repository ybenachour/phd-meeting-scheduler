/* Deployment configuration */
window.MEETING_APP_CONFIG = {
  pollId: "upec-phd-kickoff-2026-10-19-22",
  title: "PhD Kickoff Meeting Availability",
  participants: [
    { name: "Yassine", zone: "Asia/Dubai", label: "Dubai" },
    { name: "Barbara", zone: "Europe/Brussels", label: "Belgium" },
    { name: "Amir", zone: "Europe/Paris", label: "Paris" },
    { name: "Sadok", zone: "Asia/Dubai", label: "Dubai" }
  ],
  startDate: "2026-10-19",
  endDate: "2026-10-22",
  allowedWeekdays: [1, 2, 3, 4],
  durationMinutes: 30,
  startTimesDubai: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00"],
  apiUrl: "https://wxgsbrdfynvezmtcniwc.supabase.co/functions/v1/meeting-scheduler",
  refreshSeconds: 30
};
