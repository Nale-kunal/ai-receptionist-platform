const { validateDoctorAvailability } = require('./src/shared/scheduling/doctorAvailabilityEngine');

const doctor = {
  id: "aaf6a91e-0b99-4cef-819b-c063a0397c16",
  status: "active",
  workingHours: [
    { dayOfWeek: 3, openTime: "09:00", closeTime: "17:00", breakStart: "12:00", breakEnd: "13:00", isClosed: false }
  ],
  leaves: []
};

// If browser is in local time and does `new Date("2026-09-02T09:00:00")` in IST (+05:30):
const date = "2026-09-02";
const time = "09:00";
const localDateObj = new Date(`${date}T${time}:00`);
console.log('Local Date Obj:', localDateObj.toString());
console.log('ISO String (UTC):', localDateObj.toISOString());

const res = validateDoctorAvailability({
  doctor,
  startTime: new Date(localDateObj.toISOString()),
  endTime: new Date(new Date(localDateObj.toISOString()).getTime() + 30 * 60000),
  timezone: 'UTC'
});

console.log('Availability check result with timezone UTC:', res);
