import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"));
const crons = config.crons ?? [];

function runsMoreThanOncePerDay(schedule) {
  const parts = String(schedule).trim().split(/\s+/);
  if (parts.length !== 5) return `invalid expression "${schedule}"`;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const multi = (field) => field === "*" || field.includes("/") || field.includes(",") || field.includes("-");
  if (multi(minute) || multi(hour)) {
    return `"${schedule}" would run more than once per day and is not valid on the Vercel Hobby plan`;
  }
  if (dayOfMonth !== "*" && dayOfWeek !== "*") {
    return `"${schedule}" sets both day-of-month and day-of-week, which Vercel rejects`;
  }
  if (month !== "*" && !/^\d+$/.test(month)) {
    return `"${schedule}" is not a simple daily Hobby schedule`;
  }
  return null;
}

if (crons.length === 0) {
  console.error("vercel.json has no cron jobs.");
  process.exit(1);
}

for (const job of crons) {
  const problem = runsMoreThanOncePerDay(job.schedule);
  if (problem) {
    console.error(`Invalid cron ${job.path}: ${problem}`);
    process.exit(1);
  }
  console.log(`OK ${job.path} → ${job.schedule}`);
}

const reminder = crons.find((job) => job.path === "/api/cron/renewal-reminders");
if (!reminder) {
  console.error("Missing /api/cron/renewal-reminders");
  process.exit(1);
}
if (reminder.schedule !== "0 0 * * *") {
  console.error(`Renewal reminder must be 0 0 * * *, found ${reminder.schedule}`);
  process.exit(1);
}

console.log("Vercel Hobby cron configuration accepted.");
