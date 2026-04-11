function goToDay(day) {
  window.location.href = `day.html?day=${day}`;
}

function goToOverview() {
  window.location.href = "index.html";
}

function goToSignup() {
  window.location.href = "signup.html";
}

function goToMyTours() {
  window.location.href = "my-tours.html";
}

function logout() {
  localStorage.removeItem("roomNumber");
  localStorage.removeItem("guests");
  localStorage.removeItem("uniwappBooking");
  window.location.href = "index.html";
}

function scrollToTopPage() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function getSavedBooking() {
  return JSON.parse(localStorage.getItem("uniwappBooking"));
}

function getConfirmedBookings() {
  return JSON.parse(localStorage.getItem("uniwappConfirmedBookings")) || [];
}

function isCurrentBookingConfirmed() {
  const booking = getSavedBooking();

  if (!booking) {
    return false;
  }

  return getConfirmedBookings().includes(String(booking.booking_id));
}

function setElementVisibility(id, shouldShow) {
  const element = document.getElementById(id);

  if (element) {
    element.style.display = shouldShow ? "" : "none";
  }
}

function updateNavigationVisibility() {
  const booking = getSavedBooking();
  const isConfirmed = isCurrentBookingConfirmed();

  setElementVisibility("logoutButton", !!booking);

  if (!booking) {
    setElementVisibility("signupNavItem", true);
    setElementVisibility("signupSeparator", true);
    setElementVisibility("myToursNavItem", false);
    setElementVisibility("myToursSeparator", false);
    return;
  }

  setElementVisibility("signupNavItem", !isConfirmed);
  setElementVisibility("signupSeparator", !isConfirmed);
  setElementVisibility("myToursNavItem", isConfirmed);
  setElementVisibility("myToursSeparator", isConfirmed);
}

function getFieldValue(item, possibleKeys) {
  for (const key of possibleKeys) {
    if (
      item[key] !== undefined &&
      item[key] !== null &&
      String(item[key]).trim() !== ""
    ) {
      return String(item[key]).trim();
    }
  }
  return "";
}

function getDayNumber(item) {
  const rawDay = getFieldValue(item, ["day", "Day", "dayNumber", "day_number"]);
  const match = rawDay.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function getCityName(item) {
  return getFieldValue(item, [
    "city",
    "City",
    "cities",
    "Cities",
    "port",
    "Port",
    "destination",
    "Destination",
    "location",
    "Location",
    "place",
    "Place"
  ]);
}

async function populateDayButtons() {
  const buttons = document.querySelectorAll(".day-btn");

  try {
    const response = await fetch("/api/excursions");

    if (!response.ok) {
      return;
    }

    const excursions = await response.json();

    if (!Array.isArray(excursions)) {
      return;
    }

    const cityByDay = {};

    excursions.forEach((item) => {
      const day = getDayNumber(item);
      const city = getCityName(item);

      if (day && city && !cityByDay[day]) {
        cityByDay[day] = city;
      }
    });

    buttons.forEach((button) => {
      const day = Number(button.dataset.day);
      const city = cityByDay[day];

      if (city) {
        button.textContent = `Day ${day} – ${city}`;
      } else {
        button.textContent = `Day ${day}`;
      }
    });
  } catch (error) {
    console.error("Error loading overview day buttons:", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateNavigationVisibility();
  populateDayButtons();
});