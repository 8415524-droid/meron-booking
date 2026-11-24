// מפתחות ציבוריים של Supabase. המפתח הזה מיועד לדפדפן, וההגנה על הנתונים נעשית בכללי RLS שב-supabase/schema.sql.
// כשהאתר מוגש תחת /old (באותה כתובת של מערכת נייחא החדשה), כל הקישורים האבסולוטיים מקבלים את התחילית.
window.MERON_BASE = /^\/old(\/|$)/.test(location.pathname) ? "/old" : "";
window.MERON_CONFIG = {
  url: "https://nasqvwzvgwvchfjjrygq.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5hc3F2d3p2Z3d2Y2hmampyeWdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM1NjI0NjAsImV4cCI6MjEwOTEzODQ2MH0.1zSQ_sM5cDUw38BcnxanYrfsak1UdEBDaayaDs2Hw2I"
};
